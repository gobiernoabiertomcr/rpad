# Seguimiento del dataset: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** construir la sección "Seguimiento del dataset": una pantalla en Herramientas y un PDF de una hoja que juntan todos los movimientos de cada dataset y prueban cada aviso del RPAD.

**Architecture:**
- **Reglas puras:** `services/seguimientoReglas.js` (movimientos, ciclos, avisos, hitos, textos y ensamblado) y `services/seguimientoCinta.js` (la cinta como datos).
- **Datos:** las reglas se alimentan de `services/seguimientoDatos.js`, que hace las consultas y solo lee.
- **API:** un controlador con tres rutas (`authMiddleware`, sin `adminOnly`) devuelve el JSON y el PDF. El PDF lo arma `services/seguimientoPdf.js` con PDFKit y los ayudantes exportados del ANEXO.
- **Página:** `seguimiento.html` + `js/seguimiento.js` dibujan lo que manda el servidor, sin recalcular nada.

**Tech Stack:** Node 22 (ES modules), Express 4, mysql2/promise, PDFKit 0.15.2, qrcode, vanilla JS y `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-20-seguimiento-dataset-design.md`. Manda sobre los mockups de `docs/superpowers/specs/2026-10-20-seguimiento-mockups/`. El `cinta.js` de esa carpeta es el prototipo de referencia de la cinta (sus textos de vencido son anteriores a la spec: valen los de este plan).

## Global Constraints

- **Ningún email real.** Antes de levantar el servidor o de correr tests, verificar que en `.env` estén `SMTP_HOST=127.0.0.1` y `SMTP_PORT=1025` (Mailpit). Nunca llamar a `/api/cron/*`. El Seguimiento no envía nada.
- **Rama:** `feat/seguimiento-dataset`.
- **Suite completa** (`npm test`, con `docker compose up -d`) antes y después de cada tarea. Línea de base: 2438 tests, 2437 pasan, 0 fallan, 1 omitido.
- **Base intocable:** sin cambios de esquema, sin SQL de datos y sin tocar `aprobarCambio` (`controllers/cambiosPendientesController.js`).
- **SQL** siempre parametrizado. Respuestas `{ success: true, data }` o `{ success: false, error }`.
- **Fechas:** texto `'AAAA-MM-DD'`. Los momentos van como `'AAAA-MM-DD HH:MM:SS'` en hora argentina:
  - TIMESTAMP: `UNIX_TIMESTAMP(col)` y después `ahoraArgentina(new Date(ts * 1000))`.
  - DATE: `DATE_FORMAT(col, '%Y-%m-%d')`.
  - `notas_digitales.enviada_at`: `DATE_FORMAT(col, '%Y-%m-%d %H:%i:%s')`, sin convertir.
  - Hoy es `hoyArgentina()`. Las reglas reciben `hoy` por parámetro y no usan `Date` local.
- **Lenguaje neutro:** ni la pantalla ni el PDF dicen "sin entregar", "Sin respuesta" ni "Atrasado". La única excepción es el asunto original de un email, que se muestra en su detalle.
- **Nombres de personas:** van en "nombre y apellido corto". Ningún nombre real de una persona entra en archivos versionados: los tests usan `tests/seguimiento-casos.js`, que ya está anonimizado.
- **Frontend:**
  - cada script va como `<script src="js/X.js?v=…"></script>`, sin atributos;
  - `auth`, `main` y `api` llevan `?v=20261109` (`VERSION`), y `main.css` también `?v=20261109`;
  - sin `publico.css` y sin `aria-current` en el HTML;
  - todo texto dinámico pasa por `Utils.escapeHtml`.
- **Constantes de la spec:**
  - registro desde el `'2025-12-06'` (envíos) y el `'2026-01-26'` (cambios);
  - el PDF muestra 8 movimientos;
  - la lista de la pantalla muestra 10 filas y después tandas de 20;
  - la cinta cubre 12 meses;
  - la agrupación de marcas es a 11 unidades en pantalla y a 12 en el PDF.
- **Commits:** terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Id inválido** en la URL o la API (`abc`, `0`, `-3`, `999999`): tiene que dar 404 en JSON, nunca 500. Lo cubre la Task 6.
2. **Título con raya, comillas y `<b>`:** el PDF se descarga (sin `ERR_INVALID_CHAR` en el encabezado) y la pantalla lo muestra escapado. Lo cubren las Tasks 4, 7 y 9.
3. **Título y área muy largos:** el PDF sigue en una hoja y sin superposiciones. Lo cubre la Task 7.
4. **Fechas raras:** `ultima` null, `datos_al` null, una próxima que no es fin de mes (el caso real 38 tiene 2027-03-29 en un cambio) o el alta el mismo día que hoy. Ni las reglas ni la cinta pueden tirar error. Lo cubren las Tasks 2 y 3.
5. **Cambiar de filtro** con la lista de movimientos paginada: vuelve a 10 filas. Lo cubre la Task 9.

---

## Estructura de archivos

| Archivo | Qué hace |
|---|---|
| `services/seguimientoReglas.js` (nuevo) | Puro: textos fijos, fechas, nombres, alta, movimientos, ciclos, avisos, hitos, estado, circuito, ensamblado y nombre del PDF |
| `services/seguimientoCinta.js` (nuevo) | Puro: la cinta como datos |
| `services/seguimientoDatos.js` (nuevo) | Consultas (solo lectura) → `Fuentes` |
| `services/seguimientoPdf.js` (nuevo) | `renderSeguimiento` (PDFKit) |
| `services/notasDigitalesAnexo.js` | Solo se agregan `export` a ayudantes y constantes. Lo que dibuja no cambia |
| `controllers/seguimientoController.js` (nuevo) | Los tres handlers |
| `routes/index.js` | Las tres rutas |
| `public/seguimiento.html` y `public/js/seguimiento.js` (nuevos) | La página |
| Las 13 páginas con carcasa (`public/*.html`) | El link en `#sidebarTools` |
| `public/js/admin-fechas.js` y `public/admin.html` | El ícono "Ver seguimiento" |
| `tests/seguimiento-casos.js` (ya está, generado y anonimizado) | Los 12 casos reales de la spec |
| `tests/seguimiento-{reglas,cinta,datos,api,pdf,frontend}.test.js` (nuevos) | Los tests nuevos |
| `tests/paginas.test.js`, `tests/permisos.test.js` y `tests/admin-frontend.test.js` | Ajustes |
| `CLAUDE.md` y `README.md` | Pasan de 13 a 14 páginas y suman la sección nueva |

## Tipos compartidos

`Fuentes` es exactamente la forma de `CASOS[id]` en `tests/seguimiento-casos.js` más `catalogos`. En los tests se arma así: `{ ...CASOS[52], catalogos: CATALOGOS }`, y `HOY_DE_LOS_CASOS` es `'2026-10-20'`.

```
Fuentes = {
  dataset: { id, titulo, area, area_superior, area_id, tipo_gestion, frecuencia, meses: number|null, proxima, datos_al, ultima,
             tipo_pedido, url_dataset, activo: boolean, alta: momento },
  altasSinDataset: Cambio[],   // 'crear' aprobados con dataset_id NULL y aprobación a ≤ 5 s del alta
  cambios: Cambio[],           // los del dataset
  historial: [{ fecha, creado, usuario, cambio_id }],
  emails: [{ id, tipo, enviado, success, cantidad, area, area_articulo, destinatarios, error }],
  notas: [{ id, numero, anio, tipo: 'aviso'|'reiteracion', gestion, fecha, estado, enviada, para, cc, seccion, vencimiento,
            datos_solicitados, creado_por, firmante }],
  auditorias: [{ id, numero, anio, fecha, estado, cambio_id, seccion: 'nuevo'|'reiterado' }],
  catalogos: { areas: { [id]: nombre }, frecuencias: { [id]: nombre } }
}
Cambio = { id, tipo: 'crear'|'editar'|'eliminar', estado, creado, revisado, propuso, reviso, motivo, nuevos, anteriores, dataset_id }

Movimiento = { tipo, filtro, fecha, momento, titulo, detalle, quien: string[], extra }
Ciclo = { inicio, venc, cierre: fecha|null, como: 'actualizacion'|'reprogramacion'|'baja'|null, nueva?: fecha,
          desde: momento, hasta: momento|null, diasVencido: number }
Hito = { fecha, tipo: 'vencio'|'actualizado'|'reprogramado', texto }
Seguimiento = { ficha, circuito, cinta, movimientos, hitos, registro: { envios: '2025-12-06', cambios: '2026-01-26' } }
```

**Tipos de movimiento** (`tipo`) y el filtro al que pertenece cada uno (`filtro`):

| tipo | filtro |
|---|---|
| `nota`, `email` | `avisos` |
| `area` | `area` |
| `act` | `actualizaciones` |
| `cambio` | `cambios` |
| `rech`, `actp`, `cambiop` | `propuestas` |
| `auditoria` | `auditoria` |
| `alta`, `baja` | `altas` |

**`extra` según el tipo:**
- `nota`: `{ nota_id, numero, anio, vencimiento, datos_solicitados, para, cc, enviada, estado }`.
- `email` y `area`: `{ asunto, destinatarios, enviado, success, error }`.
- Los cambios (`act`, `actp`, `cambio`, `cambiop`, `rech`, `baja`): `{ cambio_id, campos: [{ campo, antes, despues }], creado, revisado }`.
- `auditoria`: `{ nota_id, cambio_id }`.
- `alta`: `{ cambio_id }`.

---

### Task 1: Reglas: textos fijos, fechas, nombres, alta y movimientos

**Files:**
- Create: `services/seguimientoReglas.js`
- Test: `tests/seguimiento-reglas.test.js`

**Interfaces:**
- Consumes: `formatoCorto`, `esFechaIso` (`services/notasDigitalesCalendario.js`).
- Produces:
  - `REGISTRO_DESDE = Object.freeze({ envios: '2025-12-06', cambios: '2026-01-26' })`;
  - `ASUNTOS_EMAIL`, `QUE_PEDIA` y `FALTABAN` (objetos congelados, por tipo de email);
  - `diaDe(valor) → 'AAAA-MM-DD'|null`;
  - `nombreCorto(nombre) → string|null`;
  - `unirAlta(dataset, altasSinDataset) → Cambio|null`;
  - `movimientosDe(fuentes) → Movimiento[]`.

Textos fijos (copiados de la spec y de `git show 70c7042^:services/emailTemplates.js`):

```js
ASUNTOS_EMAIL = { 'interno-60': 'Planificación: Datasets Internos (60 días)', 'interno-30': 'Atención: Vencimiento en 1 mes (Internos)',
  'interno-vencido': 'Resumen Mensual: Datasets Atrasados (Internos)', 'externo-60': 'Gestión Administrativa: Redacción de Notas',
  'externo-40': 'Logística: Distribución de Notas', 'externo-5': 'Seguimiento: Vencimiento Inminente',
  'externo-vencido': 'Resumen Mensual: Sin Respuesta (Externos)', 'area-aviso-40': 'Aviso: Solicitud próxima de actualización de datos' }
QUE_PEDIA = { 'externo-60': 'redacción de notas', 'externo-40': 'distribución de notas', 'externo-5': 'vencimiento inminente',
  'externo-vencido': 'resumen mensual de vencidos', 'interno-60': 'planificación (60 días)', 'interno-30': 'vence en 1 mes',
  'interno-vencido': 'resumen mensual de vencidos' }
FALTABAN = { 'externo-60': 60, 'externo-40': 40, 'externo-5': 5, 'interno-60': 60, 'interno-30': 30 }
```

**Reglas de texto de `movimientosDe`** (cada detalle son frases unidas por un espacio):

- **"partes" de un cambio.** Solo se miran los campos de la lista de abajo que estén en `nuevos` (`Object.hasOwn`) y difieran de `anteriores`. Se comparan normalizados: las fechas con `diaDe`, los arrays ordenados y el resto como texto recortado. Cada campo da su frase:
  - `ultima_actualizacion` → `Cargado en el portal el dd/mm/aaaa.`
  - `datos_al` → `Datos al dd/mm/aaaa.`
  - `recibido_el` → `Recibido el dd/mm/aaaa.`
  - `proxima_actualizacion` → `Próxima: <nueva>.` si también cambió `ultima_actualizacion`; si no, `Próxima: <vieja> a <nueva>.`
  - `frecuencia_id` → `Frecuencia: <nombre> a <nombre>.`
  - `area_id` → `Área: <nombre> a <nombre>.` (los nombres salen de `catalogos`)
  - los demás → `Cambió: <rótulos>.`, con los rótulos en minúscula separados por coma: título (`titulo`), descripción (`descripcion`), URL en el portal (`url_dataset`), qué se solicita (`que_se_solicita`), observaciones (`observaciones`), tipo de pedido (`tipo_pedido`), gestión (`tipo_gestion`), tema principal (`tema_principal_id`), tema secundario (`tema_secundario_id`) y formatos (`formatos`).
  - Las claves que no están en la lista (por ejemplo `registro_actualizacion` o `notas`) no cuentan.
  - `extra.campos` lleva los mismos campos, con su rótulo ("Cargado en el portal", "Datos al", "Recibido el", "Próxima actualización", "Frecuencia", "Área responsable", "Título"…) y sus valores formateados: las fechas en dd/mm/aaaa y los ids, por su nombre.
- **Alta.** Con `unirAlta(...)`: título `Alta en el RPAD`, detalle `Cambio #N.`, quien `['Propuso X', 'Aprobó Y']`. Sin alta unida: detalle `Carga inicial del registro.` y quien `[]`. La fecha y el momento son `dataset.alta`.
- **`editar` aprobado que cambia `ultima_actualizacion`** → tipo `act`, título `Actualización registrada`, detalle = partes + `Cambio #N.`. Fecha: la nueva `ultima_actualizacion`. Momento: `revisado`.
- **`editar` aprobado sin ese cambio** → tipo `cambio`, título `Cambio en la ficha`, partes + `Cambio #N.`. Fecha: el día de `revisado`.
- **Rechazado** → tipo `rech`, título `Propuesta rechazada`, partes + `Motivo: "<motivo>".` (si hay motivo) + `Cambio #N.`, quien `['Propuso X', 'Rechazó Y']`. Fecha: `revisado`. Si es un `eliminar`, las partes son `Pedía dar de baja el dataset.`
- **Pendiente:**
  - si cambia `ultima_actualizacion`: tipo `actp`, título `Actualización pendiente de aprobación`;
  - si no: tipo `cambiop`, título `Cambio pendiente de aprobación` (o `Baja pendiente de aprobación` si es un `eliminar`);
  - quien `['Propuso X']`; fecha y momento: `creado`.
- **`eliminar` aprobado** → tipo `baja`, título `Baja del RPAD`, detalle `Cambio #N.`. Fecha: `revisado`.
- **Historial.** Si tiene `cambio_id`, no se muestra. Si no, se deduplica por `fecha`. Queda tipo `act`, título `Actualización registrada`, detalle `Cargado en el portal el dd/mm/aaaa. Registro anterior a la doble verificación.`, quien `[nombreCorto(usuario)]` (o `[]` si no hay usuario). Momento: `creado`.
- **Nota** → tipo `nota`, título `Nota Digital N° n/aa a DGMIT`.
  - Detalle de un aviso: `Aviso de gestión <gestion>, sección vencidos: vencía el dd/mm/aaaa.` o `Aviso de gestión <gestion>, próximos a vencer: vence el dd/mm/aaaa.`
  - Detalle de una reiteración: `Reiteración de gestión <gestion>: vencía el dd/mm/aaaa.`
  - "vencía" va si el vencimiento es anterior a la fecha de la nota; si no, "vence".
  - Después se suma `Pide: <datos_solicitados>.` si hay, y `Pendiente de envío.` o `No se pudo enviar.` según el estado.
  - Quien: primero `Generada por X` (si hay `creado_por`) o `Envío automático`, y después `Firmó X` si hay firmante.
  - Momento: `enviada` o `fecha 00:00:00`.
- **Auditoría** → tipo `auditoria`, título `Nota Digital N° n/aa de auditoría`, detalle `Pidió auditar el cambio #N.` (si `seccion === 'reiterado'`, `Pidió auditar el cambio #N (reiterado).`), quien `['Envío automático']`.
- **Email a DGMIT** (los siete tipos) → tipo `email`, título `Email a DGMIT: <QUE_PEDIA>`.
  - Si falló: detalle `No se pudo enviar.`
  - Si no: `Faltaban N días.` (solo los tipos con `FALTABAN`) seguido de `Junto con otros M datasets.`, `Junto con otro dataset.` o `Solo este dataset.`, donde M es `cantidad - 1`.
  - Quien `['Sistema']`.
- **Email al área** (`area-aviso-40`) → tipo `area`, título `Email al área: anticipo de la nota formal`.
  - Detalle `A la <area>.` o `Al <area>.`, según `area_articulo`; `A el área.` si no hay área; `No se pudo enviar.` si falló.
  - `extra.asunto` = `ASUNTOS_EMAIL['area-aviso-40'] + ' - ' + area`.
- **Orden:** `fecha` de la más nueva a la más vieja; dentro del mismo día, `momento` de mayor a menor; a igual momento, el id de mayor a menor.

- [ ] **Step 1: Escribir los tests que fallan**

Archivo `tests/seguimiento-reglas.test.js`. Importa `CASOS`, `CATALOGOS` y `HOY_DE_LOS_CASOS` de `./seguimiento-casos.js`, con `const f = (id) => ({ ...CASOS[id], catalogos: CATALOGOS });`.

```js
it('nombreCorto: primer nombre y último apellido', () => {
  assert.equal(nombreCorto('Elena Noelia Cuatro'), 'Elena Cuatro');
  assert.equal(nombreCorto('  Ana  María  Uno '), 'Ana Uno');
  assert.equal(nombreCorto('Test adminA'), 'Test adminA');
  assert.equal(nombreCorto(null), null);
});
it('diaDe corta las fechas de los JSON viejos', () => {
  assert.equal(diaDe('2025-07-31T03:00:00.000Z'), '2025-07-31'); assert.equal(diaDe('2026-02-30'), null); assert.equal(diaDe(null), null);
});
it('unirAlta: por título y a ≤ 5 s; si el título cambió, solo por la hora', () => {
  assert.equal(unirAlta(CASOS[81].dataset, CASOS[81].altasSinDataset).id, 50);
  const otra = { ...CASOS[81].altasSinDataset[0], nuevos: { titulo: 'Otro título' } };
  assert.equal(unirAlta(CASOS[81].dataset, [otra]).id, 50);
  assert.equal(unirAlta(CASOS[81].dataset, [{ ...otra, revisado: '2026-10-19 10:29:30' }]), null);
});
it('52: los 16 movimientos, del más nuevo al más viejo', () => {
  const m = movimientosDe(f(52));
  assert.equal(m.length, 16);
  assert.deepEqual([m[0].fecha, m[0].titulo, m[0].detalle, m[0].quien],
    ['2026-10-13', 'Nota Digital N° 2/26 a DGMIT', 'Aviso de gestión externa, sección vencidos: vencía el 31/07/2026.', ['Envío automático']]);
  const act = m.find(x => x.extra.cambio_id === 7);
  assert.deepEqual([act.tipo, act.fecha, act.detalle, act.quien], ['act', '2026-02-04', 'Cargado en el portal el 04/02/2026. Próxima: 31/07/2026. Cambio #7.', ['Propuso Ana Uno', 'Aprobó Bruno Dos']]);
  const rech = m.find(x => x.extra.cambio_id === 6);
  assert.equal(rech.detalle, 'Cargado en el portal el 04/02/2026. Próxima: 03/08/2026. Motivo: "Mal la fecha". Cambio #6.');
  assert.deepEqual(rech.quien, ['Propuso Bruno Dos', 'Rechazó Ana Uno']);
  assert.equal(m.find(x => x.tipo === 'area').detalle, 'A la Dirección General de Relaciones Laborales.');
  assert.equal(m.find(x => x.momento === '2026-07-26 08:00:05').detalle, 'Faltaban 5 días. Junto con otros 5 datasets.');
  assert.equal(m.find(x => x.momento === '2026-10-01 08:00:06').titulo, 'Email a DGMIT: resumen mensual de vencidos');
  assert.deepEqual(m.at(-2).detalle, 'Cargado en el portal el 17/12/2025. Registro anterior a la doble verificación.');
  assert.deepEqual([m.at(-1).titulo, m.at(-1).detalle, m.at(-1).quien], ['Alta en el RPAD', 'Carga inicial del registro.', []]);
});
it('81: la nota pide lo guardado y la firma; el alta por el cambio #50', () => {
  const [nota, alta] = movimientosDe(f(81));
  assert.equal(nota.detalle, 'Aviso de gestión externa, próximos a vencer: vence el 31/10/2026. Pide: Vigente al 30/09/2026.');
  assert.deepEqual(nota.quien, ['Envío automático', 'Firmó Bruno Dos']);
  assert.deepEqual([alta.detalle, alta.quien], ['Cambio #50.', ['Propuso Bruno Dos', 'Aprobó Carla Tres']]);
});
it('10: cambio en la ficha con próxima y frecuencia', () => {
  const c14 = movimientosDe(f(10)).find(x => x.extra.cambio_id === 14);
  assert.deepEqual([c14.tipo, c14.fecha, c14.detalle], ['cambio', '2026-02-25', 'Próxima: 31/07/2026 a 31/05/2026. Frecuencia: Cada medio año a Cuatrimestralmente. Cambio #14.']);
});
it('1: la actualización pendiente', () => {
  const p = movimientosDe(f(1)).find(x => x.extra.cambio_id === 51);
  assert.deepEqual([p.tipo, p.titulo, p.fecha, p.quien], ['actp', 'Actualización pendiente de aprobación', '2026-10-19', ['Propuso Bruno Dos']]);
  assert.equal(p.detalle, 'Cargado en el portal el 19/10/2026. Datos al 31/12/2026. Recibido el 19/10/2026. Próxima: 31/01/2027. Cambio #51.');
});
```

Más casos sintéticos, armados sobre `f(52)` con un cambio o un registro agregado:
- un historial con `cambio_id` no aparece;
- un email con `success: false` da `No se pudo enviar.`;
- una nota `pendiente` termina en `Pendiente de envío.`;
- una auditoría da `Nota Digital N° 5/26 de auditoría` / `Pidió auditar el cambio #51.`;
- un `eliminar` aprobado da `Baja del RPAD`.

Y una prueba de lenguaje neutro: `movimientosDe(f(id))` para los 12 casos. Ningún `titulo`, `detalle` ni `quien` cumple `/sin entregar|sin respuesta|atrasad/i`.

- [ ] **Step 2: Correr para ver que falla**

Run: `node --test tests/seguimiento-reglas.test.js`. Expected: FAIL (el módulo no existe).

- [ ] **Step 3: Implementar** las funciones de Interfaces en `services/seguimientoReglas.js`, con las reglas de texto de arriba. `unirAlta` compara los momentos convirtiéndolos a segundos con `Date.UTC` (los dos están en hora argentina, así que la diferencia es exacta). Elige primero el que tenga el título igual a `dataset.titulo` (comparado en JS) y, si no hay, el más cercano a ≤ 5 s.

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test tests/seguimiento-reglas.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/seguimientoReglas.js tests/seguimiento-reglas.test.js tests/seguimiento-casos.js
git commit -m "feat: reglas del Seguimiento (movimientos, nombres y altas)"
```

---

### Task 2: Reglas: ciclos, avisos, hitos, estado y circuito

**Files:**
- Modify: `services/seguimientoReglas.js`
- Test: `tests/seguimiento-reglas.test.js`

**Interfaces:**
- Consumes: `diaDe` y `nombreCorto` (Task 1); `diasEntre` (calendario); `estadoDelDataset` (`services/fechasDatasetReglas.js`).
- Produces:
  - `ciclosDe(fuentes, hoy) → Ciclo[] | null`;
  - `cicloDelAviso(ciclos, momento, vencimiento = null) → number`;
  - `avisosDelCiclo(fuentes, ciclos, indice) → { emails, notas: string[] ('2/26'), alArea: fecha[], total }`;
  - `ultimoAviso(fuentes) → fecha|null`;
  - `hitosDe(ciclos, hoy) → Hito[]`;
  - `estadoDeSeguimiento(dataset, hoy) → { estado: 'vencido'|'proximo'|'actualizado'|'eventual'|'sin-fecha'|'baja', texto, dias }`;
  - `circuitoDe(fuentes, ciclos, hoy) → Circuito`.

**Algoritmo de ciclos.** La firma y los tests no lo determinan:

```
ciclosDe(f, hoy):
  d = f.dataset
  si d.meses no es entero > 0, o no hay d.proxima → null
  aprobados = cambios 'editar' aprobados, ordenados por revisado y después por id
  baja = el cambio 'eliminar' aprobado, si hay
  venc = la primera diaDe(c.anteriores?.proxima_actualizacion) válida de los aprobados; si no hay, d.proxima
  inicio = día de d.alta; desde = d.alta; ciclos = []
  para cada c de aprobados:
    ua = diaDe(anteriores.ultima_actualizacion); ud = diaDe(nuevos.ultima_actualizacion); pd = diaDe(nuevos.proxima_actualizacion)
    si ud y ud ≠ ua y pd y pd ≠ venc:
      cerrar { inicio, venc, cierre: ud, como: 'actualizacion', desde, hasta: c.revisado }; inicio = ud; desde = c.revisado; venc = pd
    si no, si pd y pd ≠ venc:
      si día(c.revisado) > venc: cerrar { inicio, venc, cierre: día(c.revisado), como: 'reprogramacion', nueva: pd, desde, hasta: c.revisado }
                                 inicio = día(c.revisado); desde = c.revisado; venc = pd
      si no: venc = pd
  abierto = { inicio, venc: d.proxima, cierre: null, como: null, desde, hasta: null }   // manda la próxima actual
  si hay baja: abierto.cierre = día(baja.revisado); abierto.como = 'baja'; abierto.hasta = baja.revisado
  para cada ciclo: fin = cierre ?? hoy; diasVencido = fin > venc ? diasEntre(venc, fin) : 0
```

**`cicloDelAviso`:**
- Con `vencimiento`, busca los ciclos con ese `venc`. Si hay uno, es ese. Si hay varios, el que contiene el `momento` en `[desde, hasta)`, o el último de ellos.
- Sin `vencimiento`, o si ningún ciclo lo tiene, el que contiene el `momento`. Si ninguno, el 0.
- Para las notas se usa `momento = enviada ?? fecha + ' 00:00:00'`.

**`avisosDelCiclo`:** cuenta solo los emails con éxito y las notas `enviada` de tipo `aviso` o `reiteracion`.

**Textos que fija la spec:**
- **`estadoDeSeguimiento`:**
  - `atrasado` y `sin-respuesta` dan `{ estado: 'vencido', texto: 'Vencido' }`;
  - los demás: `Próximo a vencer`, `Actualizado`, `Eventual` y `Sin fecha`;
  - un dataset con `activo: false` da `{ estado: 'baja', texto: 'Dado de baja' }`;
  - `dias` es el de `estadoDelDataset`: negativo si ya venció.
- **`circuitoDe`:**
  - `nodoMedio`: externa `{ nombre: 'DGMIT y Dirección Administrativa', rol: 'Mandan la nota formal al área' }`; interna `{ nombre: 'DGMIT y Dirección de Investigación Territorial', rol: 'Hacen el relevamiento' }`.
  - `tramoFuera`: externa `{ titulo: 'Nota formal', texto: 'Por fuera del RPAD: no queda registrada' }`; interna `{ titulo: 'Relevamiento', texto: 'Por fuera del RPAD: no queda registrado' }`.
  - `avisos.titulo`: `N avisos`, `1 aviso` o `Sin avisos`.
  - `avisos.texto`: une con " y " `N emails` o `1 email` y `la Nota Digital N° x` o `las Notas Digitales N° a, b y c`, y pone mayúscula a la primera letra. Sin avisos: `Todavía no hizo falta`. Eventual o sin fecha: `Sin vencimiento`.
  - `area`: `{ nombre, texto, vencido }`. El `texto` es `Vencido hace N días`, `Vencido hace 1 día`, `Vence hoy`, `Vence en N días`, `Sin vencimiento` (eventual o sin fecha) o `Dado de baja`.
  - `alArea`: solo en gestión externa; en interna es `null`. Va como `{ fechas, texto, textoPdf }`:
    - `texto`: `Además, el dd/mm/aaaa el RPAD le anticipó por email al área que iba a recibir una nota formal.` Con varias fechas, `el a, el b y el c`. Sin fechas, `null`.
    - `textoPdf`: `Al área: el dd/mm/aaaa el RPAD le anticipó por email que iba a recibir una nota formal.` Sin fechas: `Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.`
  - `vencimiento`: `{ fecha, texto: 'Vencimiento del dd/mm/aaaa' }`, o `null` en eventual o sin fecha.
- **`hitosDe`**, uno por ciclo que llegó a su vencimiento:
  - abierto (o cerrado por baja) con `venc < (cierre ?? hoy)`: `{ fecha: venc, tipo: 'vencio', texto: 'Venció' }`;
  - `actualizacion` con `diasVencido > 0`: `{ tipo: 'actualizado', texto: 'Venció. Actualizado el dd/mm/aaaa, N días después del vencimiento' }` ("1 día" en singular);
  - `reprogramacion`: `{ tipo: 'reprogramado', texto: 'Venció. Reprogramado el dd/mm/aaaa al dd/mm/aaaa' }`.

- [ ] **Step 1: Escribir los tests que fallan**

Escribir una tabla con los valores reales (ya verificados contra los casos). `resumen(id)` devuelve, para cada ciclo, `[venc, cierre, como, diasVencido]`, y para el abierto `{ emails, notas, alArea }`:

```js
const CICLOS = {
  52: [['2026-01-31', '2026-02-04', 'actualizacion', 4], ['2026-07-31', null, null, 81]],
  9:  [['2025-01-31', '2026-03-13', 'actualizacion', 406], ['2026-04-30', '2026-10-09', 'actualizacion', 162], ['2027-01-31', null, null, 0]],
  10: [['2026-01-31', '2026-02-18', 'actualizacion', 18], ['2026-05-31', '2026-05-22', 'actualizacion', 0], ['2026-07-31', '2026-09-25', 'actualizacion', 56],
       ['2026-10-31', '2026-10-13', 'actualizacion', 0], ['2027-01-31', null, null, 0]],
  42: [['2026-03-31', '2026-04-06', 'reprogramacion', 6], ['2027-04-30', null, null, 0]],
  38: [['2026-03-31', '2026-02-12', 'actualizacion', 0], ['2026-09-30', '2026-10-02', 'actualizacion', 2], ['2027-03-31', null, null, 0]],
  1: [['2026-01-31', null, null, 262]], 11: [['2024-01-31', null, null, 993]], 26: [['2025-03-31', null, null, 568]],
  33: [['2026-01-31', null, null, 262]], 81: [['2026-10-31', null, null, 0]]
};
const ABIERTO = { 52: { emails: 5, notas: ['2/26'], alArea: ['2026-06-21'] }, 9: { emails: 0, notas: [], alArea: [] }, 10: { emails: 0, notas: [], alArea: [] },
  42: { emails: 0, notas: [], alArea: [] }, 1: { emails: 10, notas: ['2/26'], alArea: [] }, 11: { emails: 11, notas: ['2/26'], alArea: [] },
  33: { emails: 5, notas: ['2/26'], alArea: [] }, 61: { emails: 6, notas: ['2/26'], alArea: ['2025-12-22', '2026-06-21'] }, 81: { emails: 0, notas: ['3/26'], alArea: [] } };
```

Tests:
- `ciclosDe` y `avisosDelCiclo(…, último)` coinciden con las tablas para cada id;
- `ciclosDe(f(66), HOY)` es `null`;
- `circuitoDe(f(52))`: `avisos.titulo` `'6 avisos'`, `avisos.texto` `'5 emails y la Nota Digital N° 2/26'`, `area.texto` `'Vencido hace 81 días'`, `vencido` true y `alArea.texto` `'Además, el 21/06/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.'`;
- `circuitoDe(f(81))`: `'1 aviso'`, `'La Nota Digital N° 3/26'`, `'Vence en 11 días'` y `alArea.texto` null;
- `circuitoDe(f(38))`: el nodo de Investigación Territorial y `alArea` null;
- `circuitoDe(f(10))`: `'Sin avisos'` y `'Todavía no hizo falta'`;
- `hitosDe(ciclosDe(f(42)))` contiene `{ fecha: '2026-03-31', tipo: 'reprogramado', texto: 'Venció. Reprogramado el 06/04/2026 al 30/04/2027' }`;
- `hitosDe(ciclosDe(f(52)))` es `[{ fecha: '2026-07-31', tipo: 'vencio', texto: 'Venció' }, { fecha: '2026-01-31', tipo: 'actualizado', texto: 'Venció. Actualizado el 04/02/2026, 4 días después del vencimiento' }]`, ordenado del más nuevo al más viejo;
- `estadoDeSeguimiento(f(52).dataset, HOY)` es `{ estado: 'vencido', texto: 'Vencido', dias: -81 }`, y con `activo: false` da `estado` `'baja'`.

Fechas raras (Review Focus 4): `ciclosDe` y `circuitoDe` no tiran error con un `f(38)` modificado (`ultima: null`, `datos_al: null`) ni con un dataset cuyo `alta` es `HOY + ' 09:00:00'`.

- [ ] **Step 2: Correr para ver que falla.** `node --test tests/seguimiento-reglas.test.js`: FAIL (las funciones no existen).
- [ ] **Step 3: Implementar** las funciones de Interfaces con el algoritmo y los textos de arriba.
- [ ] **Step 4: Correr y ver que pasa.** `node --test tests/seguimiento-reglas.test.js`: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat: ciclos, avisos, hitos y circuito del Seguimiento"`

---

### Task 3: La cinta como datos

**Files:**
- Create: `services/seguimientoCinta.js`
- Test: `tests/seguimiento-cinta.test.js`

**Interfaces:**
- Consumes: `movimientosDe` y `ciclosDe` (Tasks 1 y 2); `diasEntre`.
- Produces:
  - `ventanaDe(hoy) → { desde, hasta, meses: [{ desde, etiqueta, anio }] }`;
  - `cintaDe({ fuentes, ciclos, movimientos, hoy, separacion = 11, letra = 6.6 }) → Cinta`.

```
Cinta = { meses: [{ x0, x1, etiqueta: 'nov', anio: 2025|null }],                       // anio solo en el primero y en enero
          tramos: [{ x0, x1, tipo: 'antes'|'ciclo'|'vencido'|'futuro'|'eventual' }],
          textos: [{ x, texto, tipo: 'vencido'|'eventual'|'antes' }],
          vencimientos: [{ x, texto: 'vence 31/07' }],
          marcas: [{ x, fila: 'arriba'|'banda'|'abajo', tipo, cantidad, etiqueta: 'Nota 2/26'|null, detalle: string[] }],
          hoy: { x, renglon: 1|2 } }
```

Coordenadas en 0–1000. `x(día) = 30 + (n(día) + 0.5 − n(desde)) / días de la ventana × 940`, contando los días con `Date.UTC`. Ventana: del primer día del mes de hace 11 meses al último día del mes actual.

**Reglas** (tal cual la spec, sección "La cinta"):
- **Filas de las marcas:**
  - `arriba`: `nota` y `email`;
  - `banda`: `alta`, `act`, `actp`, `cambio` y `cambiop`;
  - `abajo`: `area` y `rech`;
  - no van: `auditoria`, `baja`, los emails con `success` false y las notas que no están `enviada`.
- **Agrupación** dentro de cada fila: las marcas ordenadas por x se juntan si `x − x0 del grupo < separacion`. Se dibuja la de más prioridad, en el orden `['nota', 'email', 'act', 'actp', 'cambio', 'cambiop', 'alta', 'rech', 'area']`. `detalle` lleva `dd/mm/aaaa: <titulo>` de cada una. `etiqueta` es `Nota n/aa` (con " y " si hay varias), o `null` si el grupo no tiene notas.
- **Tramos:**
  - `antes`: del inicio de la ventana al alta, si el alta cae dentro;
  - por ciclo: `ciclo` hasta `min(venc, cierre ?? hoy)`; `vencido` entre `venc` y `cierre ?? hoy` si `diasVencido > 0`; `futuro` de hoy a `min(venc, fin de la ventana)` en el ciclo abierto con `venc > hoy`;
  - todo recortado a la ventana;
  - sin ciclos: un tramo `eventual` del alta (o del inicio de la ventana) a hoy.
- **Textos:**
  - `antes`: `Todavía no estaba en el RPAD`, solo si `xAlta − 30 > 260`;
  - `vencido`:
    - en el ciclo abierto, `Vencido hace N días`, o `Vencido desde el dd/mm/aaaa (hace N días)` si el `venc` cae antes de la ventana;
    - en un ciclo cerrado, `Estuvo vencido N días`;
    - con "1 día" en singular;
  - `eventual`: `Frecuencia eventual: sin vencimiento`, o `Sin fecha de próxima actualización` si tiene meses y no tiene próxima;
  - todos van en el hueco libre más grande entre las marcas de la banda (cada una ocupa ±11), con un ancho mínimo de `texto.length × letra + 10`. Si no entra, no va.
- **Vencimientos:** `vence dd/mm` cuando el `venc` cae en la ventana y el ciclo llegó a él (`!cierre` o `cierre ≥ venc`).
- **Hoy:** `renglon: 2` si algún vencimiento está a menos de 62.

- [ ] **Step 1: Escribir los tests que fallan.** `tests/seguimiento-cinta.test.js`, con `const cinta = (id, extra) => { const fu = f(id); return cintaDe({ fuentes: fu, ciclos: ciclosDe(fu, HOY), movimientos: movimientosDe(fu), hoy: HOY, ...extra }); };`

```js
it('ventana de 12 meses: de nov/2025 a oct/2026', () => {
  const v = ventanaDe('2026-10-20');
  assert.equal(v.desde, '2025-11-01'); assert.equal(v.hasta, '2026-10-31');
  assert.deepEqual(v.meses.map(m => m.etiqueta), ['nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct']);
});
it('52: la ✕ del 04/02 y la actualización caen en la misma x; la ✕ lleva 2', () => {
  const c = cinta(52);
  const rech = c.marcas.find(m => m.tipo === 'rech'), act = c.marcas.find(m => m.tipo === 'act' && m.detalle[0].startsWith('04/02/2026'));
  assert.equal(rech.cantidad, 2); assert.ok(Math.abs(rech.x - act.x) < 0.01);
  assert.ok(c.textos.some(t => t.texto === 'Vencido hace 81 días'));
  assert.deepEqual(c.vencimientos.map(v => v.texto), ['vence 31/01', 'vence 31/07']);
  assert.equal(c.marcas.find(m => m.etiqueta === 'Nota 2/26').fila, 'arriba');
});
it('11: rayado desde el alta y el texto con la fecha vieja', () => {
  assert.ok(cinta(11).textos.some(t => t.texto === 'Vencido desde el 31/01/2024 (hace 993 días)'));
  assert.equal(cinta(11).marcas.find(m => m.fila === 'arriba' && m.cantidad === 2).tipo, 'email'); // 06/12 y 10/12
});
it('10: textos de los ciclos cerrados', () => { assert.ok(cinta(10).textos.some(t => t.texto === 'Estuvo vencido 56 días')); });
it('66: eventual, sin vencimientos, y el texto no pisa marcas', () => {
  const c = cinta(66); assert.deepEqual(c.vencimientos, []);
  const t = c.textos.find(x => x.tipo === 'eventual'), ancho = t.texto.length * 6.6 + 10;
  for (const m of c.marcas.filter(m => m.fila === 'banda')) assert.ok(Math.abs(m.x - t.x) >= ancho / 2 + 11 - 0.01);
});
it('81: hoy baja un renglón por "vence 31/10"', () => { assert.equal(cinta(81).hoy.renglon, 2); });
it('toda x queda entre 30 y 970', () => { for (const id of Object.keys(CASOS)) for (const m of cinta(id).marcas) assert.ok(m.x >= 30 && m.x <= 970); });
```

- [ ] **Step 2: Correr para ver que falla.** `node --test tests/seguimiento-cinta.test.js`: FAIL.
- [ ] **Step 3: Implementar** `ventanaDe` y `cintaDe`. El prototipo `docs/superpowers/specs/2026-10-20-seguimiento-mockups/cinta.js` (función `svg`, sin el dibujo) es la referencia de la lógica de tramos, el hueco y la agrupación. Los textos de vencido son los de esta tarea.
- [ ] **Step 4: Correr y ver que pasa.** `node --test tests/seguimiento-cinta.test.js`: PASS.
- [ ] **Step 5: Commit.** `git add services/seguimientoCinta.js tests/seguimiento-cinta.test.js && git commit -m "feat: la cinta del Seguimiento como datos"`

---

### Task 4: Ensamblado: `seguimientoDe`, `resumenParaLista` y el nombre del PDF

**Files:**
- Modify: `services/seguimientoReglas.js`
- Test: `tests/seguimiento-reglas.test.js`

**Interfaces:**
- Consumes: Tasks 1 a 3; `tipoEfectivo` y `pedido` (`fechasDatasetReglas.js`).
- Produces:
  - `seguimientoDe(fuentes, hoy, opcionesCinta = {}) → Seguimiento`;
  - `resumenParaLista(fuentes, hoy) → { id, titulo, area, tipo_gestion, activo, estado, dias, proxima, avisos: { total, emails, notas }, ultimo_aviso, pendiente }`;
  - `nombreDelPdf(titulo, hoy) → string`;
  - `disposicionDeAdjunto(nombre) → string`.

**`ficha`:**
```
{ id, titulo, area, area_superior, tipo_gestion, frecuencia, datos_al, ultima, proxima,
  pedido: texto|null, url_dataset: solo http/https, si no null, estado: estadoDeSeguimiento, activo, baja: fecha|null }
```
- `pedido` es `pedido({ vencimiento: proxima, tipo: tipoEfectivo({ tipo_pedido, tipo_gestion, meses }), datosAl, meses, hoy })?.texto ?? null`.
- `registro` = `REGISTRO_DESDE`.
- En `resumenParaLista`, `pendiente` es true si algún cambio está pendiente.
- `nombreDelPdf` devuelve `` `Seguimiento - ${titulo} - ${hoy}.pdf` ``.
- `disposicionDeAdjunto` devuelve `` `attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987}` ``:
  - `ascii`: el nombre en NFD, sin diacríticos, con lo que no esté entre `\x20` y `\x7e` cambiado por `_`, y `"` y `\` también por `_`;
  - `rfc5987`: `encodeURIComponent(nombre)`, codificando además `'()*`.

- [ ] **Step 1: Tests que fallan**
  - `seguimientoDe(f(52), HOY)`:
    - `ficha.pedido` es `'Vigente al 30/06/2026'` y `ficha.estado.texto` es `'Vencido'`;
    - `movimientos.length` es 16, y `hitos` y `cinta.marcas` tienen elementos;
    - `registro` es `{ envios: '2025-12-06', cambios: '2026-01-26' }`.
  - `resumenParaLista(f(1), HOY)`:
    - `avisos` es `{ total: 11, emails: 10, notas: 1 }`;
    - `pendiente` es true;
    - `ultimo_aviso` es `'2026-10-13'`.
  - `disposicionDeAdjunto(nombreDelPdf('Áreas – "género" <b>', '2026-10-20'))`:
    - no tiene caracteres fuera de `\x20-\x7e`;
    - contiene `filename="Seguimiento - Areas _ _genero_ <b> - 2026-10-20.pdf"`;
    - contiene `filename*=UTF-8''Seguimiento%20-%20%C3%81reas%20%E2%80%93%20%22g%C3%A9nero%22%20%3Cb%3E%20-%202026-10-20.pdf`.
  - `ficha.url_dataset` es `null` con `'javascript:alert(1)'`.
- [ ] **Step 2: Correr.** FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat: ensamblado del Seguimiento y nombre del PDF"`

---

### Task 5: Datos: `fuentesDe`

**Files:**
- Create: `services/seguimientoDatos.js`
- Test: `tests/seguimiento-datos.test.js`

**Interfaces:**
- Consumes:
  - `pool` (`config/database.js`);
  - `ahoraArgentina`;
  - `TIPOS_EMAIL_REEMPLAZADOS` (`services/notasDigitalesDatos.js`);
  - `catalogosParaAuditoria` (`services/auditoriaService.js`, que devuelve `{ areas, frecuencias, temas, formatos }`).
- Produces: `fuentesDe(ids = null) → Promise<Map<number, Fuentes>>`. Con `null`, trae todos los datasets, activos e inactivos.

**Consultas.** Todas con `pool.query` (porque `IN (?)` lleva un array) y sin filtrar por `activo`:
1. **Datasets:** `datasets d JOIN areas a JOIN frecuencias f`, con los campos de `Fuentes.dataset` (DATE con `DATE_FORMAT` y `UNIX_TIMESTAMP(d.created_at) alta_ts`).
2. **Cambios:** `cambios_pendientes` con `dataset_id IN (?)`, `LEFT JOIN usuarios` dos veces (propuso y revisor) y `UNIX_TIMESTAMP` de `created_at` y de `revisado_at`.
3. **Altas sin dataset:** los `crear` aprobados con `dataset_id IS NULL`. Por dataset, solo los que tienen `|revisado_ts − alta_ts| ≤ 5`.
4. **Historial:** `historial_actualizaciones` con `LEFT JOIN usuarios`.
5. **Emails:** todo `notificaciones_log`, con `LEFT JOIN areas` (nombre y `articulo`). Se reparte en JS con `REPLACE(datasets_ids, ' ', '')` partido por comas.
6. **Notas:** `notas_digitales_datasets JOIN notas_digitales`, con `es_prueba = 0` y `tipo IN ('aviso','reiteracion')`, y `LEFT JOIN usuarios` para `creado_por` y `firmante_id`.
7. **Auditorías:** `notas_digitales_cambios JOIN notas_digitales` (`es_prueba = 0`), con `cambio_id IN (ids de los cambios y de las altas unidas de cada dataset)`.

Los JSON se parsean si llegan como texto. `catalogos` lleva solo `{ areas, frecuencias }`, y es el mismo objeto para todos los datasets.

- [ ] **Step 1: Tests que fallan.** Base propia `rpad_test_seguimiento_datos`, con el patrón `before`/`after` de `tests/cambios-listas-api.test.js`. Usa `crearArea`, `crearDataset`, `crearNota` y `crearEmailViejo` de `notas-fixtures.js`, más SQL con `FROM_UNIXTIME(instante('AAAA-MM-DD HH:MM:SS'))` para las horas (`instante` sale de `auditoria-datos.test.js:59`). Los tests:
  - un email insertado a las `'2026-06-21 08:00:04'` (hora argentina) vuelve como `enviado === '2026-06-21 08:00:04'`;
  - un `area-aviso-40` con área de artículo 'el' trae `area_articulo === 'el'` y el nombre del área de ese momento, aunque después se cambie el área del dataset;
  - `datasets_ids = ' 5, 7'` (con espacios) aparece en los dos datasets;
  - una nota con `es_prueba = 1` no aparece;
  - un dataset con `activo = 0` sí aparece;
  - un `crear` aprobado con `revisado_at` a 3 s del `created_at` del dataset aparece en `altasSinDataset`, y otro a 60 s no;
  - `fuentesDe(null)` trae todos;
  - los momentos tienen el formato `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/`.
- [ ] **Step 2: Correr.** `node --test tests/seguimiento-datos.test.js`: FAIL.
- [ ] **Step 3: Implementar** `fuentesDe`.
- [ ] **Step 4: Correr.** PASS.
- [ ] **Step 5: Commit.** `git add services/seguimientoDatos.js tests/seguimiento-datos.test.js && git commit -m "feat: datos del Seguimiento (solo lectura)"`

---

### Task 6: Controlador, rutas y permisos

**Files:**
- Create: `controllers/seguimientoController.js`
- Modify: `routes/index.js` (import junto a los otros controladores; las rutas después de "Reportes PDF", `:245`)
- Modify: `tests/permisos.test.js`
- Test: `tests/seguimiento-api.test.js`

**Interfaces:**
- Consumes: `fuentesDe`, `seguimientoDe`, `resumenParaLista`, `hoyArgentina`.
- Produces:
  - `listarSeguimiento`, `verSeguimiento` y `descargarSeguimientoPdf` (este último se completa en la Task 7);
  - las rutas:
    - `GET /api/seguimiento`: `{ success, data: resumenParaLista[] }`;
    - `GET /api/seguimiento/:id`: `{ success, data: Seguimiento }`.

```js
router.get('/seguimiento', authMiddleware, listarSeguimiento);
router.get('/seguimiento/:id/pdf', authMiddleware, descargarSeguimientoPdf);
router.get('/seguimiento/:id', authMiddleware, verSeguimiento);
```

**Comportamiento:**
- Un id que no sea un entero positivo (`/^\d+$/` y > 0) da 404 `{ success: false, error: 'Dataset no encontrado' }`, y lo mismo si `fuentesDe([id])` no lo trae.
- Un error da 500 `{ success: false, error: 'Error al obtener el seguimiento' }`.
- `descargarSeguimientoPdf`, por ahora, responde 501 `{ success: false, error: 'Todavía no disponible' }`.

- [ ] **Step 1: Tests que fallan**
  - `tests/seguimiento-api.test.js`:
    - base `rpad_test_seguimiento_api` y usuarios `{ adminA: 'admin', lector: 'lector' }`, con un área, un dataset y un email;
    - el lector: `GET /seguimiento` responde 200 e incluye el dataset; `GET /seguimiento/:id` responde 200 con `data.ficha.titulo` y `data.registro.envios === '2025-12-06'`;
    - `/seguimiento/abc`, `/seguimiento/0`, `/seguimiento/-3` y `/seguimiento/999999` dan 404 con `success: false` (Review Focus 1);
    - sin token, 401 en las tres rutas.
  - `tests/permisos.test.js`:
    - sumar `'/seguimiento'` al array de `:94`;
    - agregar un `it` en `describe('lector', …)` que tome un id con `query('SELECT id FROM datasets LIMIT 1')` y espere 200 en `/seguimiento/${id}`;
    - agregar un `it` en "visitante sin sesión" que espere 401 en `/seguimiento`, `/seguimiento/${id}` y `/seguimiento/${id}/pdf`.
- [ ] **Step 2: Correr.** `node --test tests/seguimiento-api.test.js tests/permisos.test.js`: FAIL.
- [ ] **Step 3: Implementar** el controlador y las rutas.
- [ ] **Step 4: Correr.** PASS.
- [ ] **Step 5: Commit.** `git add controllers/seguimientoController.js routes/index.js tests/seguimiento-api.test.js tests/permisos.test.js && git commit -m "feat: API del Seguimiento para todos los roles con sesión"`

---

### Task 7: El PDF

**Files:**
- Modify: `services/notasDigitalesAnexo.js`. Solo se antepone `export` a:
  - `COLOR`, `MM`, `MARGEN`, `IZQUIERDA`, `DERECHA`, `CONTENIDO`, `ABAJO`, `NORMAL`, `NEGRITA`, `ASCENDENTE`, `DESCENDENTE`;
  - `desdeBase`, `ajustar`, `escribir`, `renglon`, `rotulo`, `filete`, `etiquetaDeCabecera`, `prepararGrilla`, `cargarQrcode`, `dibujarTarjetaQr`.
  - Sin ningún otro cambio. El `import('qrcode')` sigue siendo diferido.
- Create: `services/seguimientoPdf.js`
- Modify: `controllers/seguimientoController.js` (`descargarSeguimientoPdf`)
- Test: `tests/seguimiento-pdf.test.js` y `tests/seguimiento-api.test.js`

**Interfaces:**
- Consumes:
  - el `Seguimiento` de `seguimientoDe(fuentes, hoy, { separacion: 12, letra: 8.4 })`;
  - `DocumentoNota` (`notasDigitalesPdf.js`);
  - los ayudantes exportados de arriba;
  - `formatoLargo` y `formatoCorto`.
- Produces:
  - `FILAS_PDF = 8`;
  - `renderSeguimiento(seguimiento, { hoy, generado: { momento, por } }) → Promise<Buffer>`.

**Armado del PDF:**
- **Documento:** igual que `renderAnexo`: `await cargarQrcode()`, `new DocumentoNota({ size: 'A4', autoFirstPage: false, margins: 0…, info: { Title: 'Seguimiento del dataset', Author: 'Dirección de Datos Públicos y Comunicación' } })` y el Buffer por eventos.
- **Encabezado y pie:** propios, copiando `dibujarEncabezado` y `dibujarPie` del anexo (`:181-206`) con estos textos:
  - encabezado: "Seguimiento del dataset" y `formatoLargo(hoy)`;
  - pie: a la izquierda `Generado el dd/mm/aaaa a las hh:mm por <por>`; a la derecha `Seguimiento del dataset · Hoja 1 de 1`.
- **Orden de las secciones** (spec, "El PDF"):
  1. la etiqueta, con `etiquetaDeCabecera`;
  2. el título, con `ajustar(doc, titulo, { ancho: CONTENIDO, lineas: 2, max: 20, min: 20, fuente: NEGRITA, opciones: t => ({ lineGap: -0.075 * t }) })` y dos líneas reservadas;
  3. la ficha, con `prepararGrilla` (`divisorias: true`) y `dibujarTarjetaQr` a la derecha. "Venció el" va en `#9B3B36`;
  4. el circuito: tres nodos con `roundedRect` y flechas con `moveTo`/`lineTo`; la punteada con `dash`;
  5. la línea del email al área: el `textoPdf` del circuito, solo en gestión externa;
  6. la cinta;
  7. la tabla de movimientos (`FILAS_PDF` renglones);
  8. la aclaración `Los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026.`;
  9. el pie.
- **Colores nuevos** (no van en `COLOR`): `{ rojo: '#9B3B36', verde: '#2E6B4C', ambar: '#7A5200', rayaFondo: '#FCEFC7', raya: '#F2CF5B' }`.
- **Cinta:** x → `IZQUIERDA + x / 1000 * CONTENIDO`. Las filas, en pt desde el tope del bloque:

  | Fila | pt |
  |---|---|
  | etiqueta | 7.7 |
  | arriba | 16.8 |
  | bandaY | 25.5 |
  | bandaH | 10.2 |
  | abajo | 42.8 |
  | vence | 53 |
  | vence2 | 59.7 |
  | mes | 67.8 |
  | año | 75 |

  - Alto total: 77 pt.
  - Las marcas se dibujan con `polygon` (rombos), `circle` y `moveTo`/`lineTo` (la ✕).
  - El rayado se hace con `save` → `rect().clip()` → fondo → diagonales → `restore`.
  - Nunca con `roundedRect`, que el test de diagramación tomaría como bloque.
- **Movimientos:**
  - si hay menos de 8: `No hay movimientos anteriores: el dataset está en el RPAD desde el dd/mm/aaaa.`;
  - si hay más: `Hay N movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).`
- **Controlador** (`descargarSeguimientoPdf`):
  - toma el nombre con `SELECT nombre_completo FROM usuarios WHERE id = ?` (`req.user.userId`) y lo pasa por `nombreCorto`;
  - `momento` es `ahoraArgentina()`;
  - responde con `Content-Type: application/pdf`, `Content-Disposition: disposicionDeAdjunto(nombreDelPdf(titulo, hoy))` y `res.send(buffer)`;
  - un 404 sigue la misma regla de la Task 6.

- [ ] **Step 1: Tests que fallan.** `tests/seguimiento-pdf.test.js`, puro, con `CASOS`. Copiar `diagramacion`, `seCruzan`, `contiene` y `verificarDiagramacion` de `notas-anexo.test.js:142-223`, cambiando `diagramacion(datos)` por `diagramacion(render)`, donde `render` es una función async:
  - para 52, 10, 81, 66 y un 52 con título de 250 caracteres y área de 200 (Review Focus 3): `lineasPorHoja(pdf).length === 1` y `verificarDiagramacion(await diagramacion(() => renderSeguimiento(…)))`;
  - 52:
    - las líneas incluyen `'6 avisos'`, `'Vencido hace 81 días'`, `'Vencimiento del 31/07/2026'`, `'Hay 8 movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).'` y `'Seguimiento del dataset · Hoja 1 de 1'`;
    - ninguna cumple `/sin entregar|sin respuesta|atrasad/i`;
  - 52: los textos que cumplen `/^\d{2}\/\d{2}\/\d{4}$/` y quedan debajo del rótulo de movimientos son 8;
  - 81: incluye `'No hay movimientos anteriores: el dataset está en el RPAD desde el 19/10/2026.'`;
  - QR: `rectangulos(contenidoPorHoja(con)[0]) > rectangulos(contenidoPorHoja(sin)[0]) + 50`, donde `sin` es la ficha con `url_dataset: null`;
  - `tests/notas-anexo.test.js` sigue pasando, sin cambios.

  En `tests/seguimiento-api.test.js`:
  - `GET /seguimiento/:id/pdf` como lector responde 200, `application/pdf` y `%PDF-`;
  - un dataset con título `'Áreas – "género"'` responde 200 y el `content-disposition` incluye `filename*=UTF-8''` (Review Focus 2).
- [ ] **Step 2: Correr.** `node --test tests/seguimiento-pdf.test.js tests/seguimiento-api.test.js tests/notas-anexo.test.js`: FAIL en los nuevos y PASS en el anexo.
- [ ] **Step 3: Implementar** los `export` del anexo, `renderSeguimiento` y el controlador.
- [ ] **Step 4: Correr.** Todo PASS. Guardar un PDF de 52 en el scratchpad y abrirlo para verificarlo a ojo contra `docs/superpowers/specs/2026-10-20-seguimiento-mockups/Seguimiento-mockup-PDF.pdf`.
- [ ] **Step 5: Commit.** `git add services/notasDigitalesAnexo.js services/seguimientoPdf.js controllers/seguimientoController.js tests/seguimiento-pdf.test.js tests/seguimiento-api.test.js && git commit -m "feat: PDF de una hoja del Seguimiento"`

---

### Task 8: Carcasa: el link en el menú y la página `seguimiento.html`

**Files:**
- Create: `public/seguimiento.html` y `public/js/seguimiento.js` (por ahora solo el arranque)
- Modify: las 13 páginas con carcasa: admin, areas, calendario, contacto, correos, dataset, datasets, gestion, index, notas, perfil, reportes y usuarios
- Modify: `tests/paginas.test.js`

**Interfaces:**
- Produces: los ids que usa la Task 9:
  - buscador: `sg-buscar` (`<input type="search" list="sg-sugerencias">`), `sg-sugerencias` (`<datalist>`) y `sg-volver`;
  - lista: `vista-lista`, `sg-filtros`, `sg-filas` (`<tbody>`) y `sg-vacio`;
  - dataset: `vista-dataset`, `sg-ficha`, `sg-circuito`, `sg-cinta`, `sg-filtros-mov`, `sg-movimientos` (`<ol>`), `sg-mas` (`<button>`) y `sg-aclaracion`;
  - estados: `loading`, `not-found` (`<h1>Dataset no encontrado</h1>`) y `sg-error` (`<h1>No se pudo cargar el seguimiento</h1><p>Probá de nuevo en unos minutos.</p>`, `role="alert"`);
  - `message-container`.

**Detalle:**
- **El link**, después del de Gestión en `#sidebarTools` de las 14 páginas, idéntico en todas:

```html
                    <a href="seguimiento.html" class="sidebar-link"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg><span>Seguimiento</span></a>
```

- **`seguimiento.html`:**
  - la plantilla es `reportes.html` (head, carcasa, `<main class="main-content">`, `.page-header` con `h1.page-title` "Seguimiento de datasets" y el ícono history con `aria-hidden="true"`, el footer y los scripts);
  - la bajada: `Todo lo que pasó con cada dataset: los avisos del RPAD, las actualizaciones y los cambios, con quién hizo cada cosa.`;
  - el `<style>` sale de `docs/superpowers/specs/2026-10-20-seguimiento-mockups/consolidado.html` (clases `sg-*` y tokens `--sg-*`), más `[hidden] { display: none !important; }`, `.alert*` (de `perfil.html:37-39`), foco `outline: 2px solid` en cada control y `.sg-cinta-marco { overflow-x: auto } .sg-cinta-marco svg { min-width: 640px }`;
  - el último script: `<script src="js/seguimiento.js?v=20261111"></script>`.
- **`seguimiento.js` en esta tarea:** solo el arranque. `document.addEventListener('DOMContentLoaded', () => { if (!Auth.isAuthenticated()) { window.location.href = 'login.html'; return; } iniciarSeguimiento(); });`, con un `iniciarSeguimiento` vacío.
- **`tests/paginas.test.js`:**
  - `const VERSION_SEGUIMIENTO = '20261111';`;
  - sumar `['seguimiento.html', 'seguimiento', VERSION_SEGUIMIENTO]` al `for` de `:78-79`;
  - `:109-110` pasa a `'hay 14 páginas con carcasa'` y a 14;
  - `'seguimiento.html'` se suma al array de `href` de `:128`;
  - los comentarios de `:105` y `:160` pasan de 13 a 14.

- [ ] **Step 1: Cambiar los tests** (`paginas.test.js`, como arriba).
- [ ] **Step 2: Correr.** `node --test tests/paginas.test.js`: FAIL (hay 13 páginas, falta el href y falta la página).
- [ ] **Step 3: Implementar.** Insertar el link en las 13 páginas (en la línea de Gestión que listó el relevamiento, por ejemplo `index.html:83`) y crear `seguimiento.html` y el arranque de `seguimiento.js`.
- [ ] **Step 4: Correr.** `node --test tests/paginas.test.js tests/main-frontend.test.js`: PASS.
- [ ] **Step 5: Commit.** `git add public tests/paginas.test.js && git commit -m "feat: Seguimiento en el menú de Herramientas y su página"`

---

### Task 9: La página: lista, ficha, circuito, cinta y movimientos

**Files:**
- Modify: `public/js/seguimiento.js`
- Test: `tests/seguimiento-frontend.test.js`

**Interfaces:**
- Consumes:
  - las respuestas de la Task 6;
  - `API.pedirJson`, `API.pedirArchivo`, `API.getNotaPdf(id)` y `API.getNotaAnexo(id)`;
  - `Utils.escapeHtml`, `Utils.fechaCorta`, `Utils.hoyEnArgentina` y `Utils.getUrlParams`;
  - `Auth.isAdmin()`.
- Produces: funciones puras con `function`, para que el vm las vea.
  - **Lista:**
    - `FILTROS_LISTA` = `[['vencidos','Vencidos'],['proximos','Próximos a vencer'],['actualizados','Actualizados'],['eventuales','Eventuales'],['sin-fecha','Sin fecha'],['bajas','Dados de baja'],['todos','Todos']]`;
    - `filtroDeEstado(estado)` (`vencido` → `vencidos`, `proximo` → `proximos`, `actualizado` → `actualizados`, `eventual` → `eventuales`, `sin-fecha` → `sin-fecha`, `baja` → `bajas`);
    - `filasDelFiltro(filas, filtro, busqueda)`: "todos" son los activos; la búsqueda compara sin tildes ni mayúsculas, en el título o en el área;
    - `ordenarFilas(filas, filtro)`: los vencidos por `dias` ascendente; el resto por `proxima` (las nulas al final) y después por título;
    - `cantidadesPorFiltro(filas, busqueda)`;
    - `htmlDeFiltros(cantidades, elegido)`: botones con `aria-pressed`; "Sin fecha" y "Dados de baja" solo si tienen algo o están elegidos;
    - `htmlDeFilaDeLista(fila)`: un `<tr>` con un `<a href="seguimiento.html?id=N">`.
  - **Dataset:** `htmlDeFicha(ficha)`, `htmlDelCircuito(circuito)`, `svgDeCinta(cinta)` y `htmlDeLeyenda()`.
  - **Movimientos:**
    - `FILTROS_MOVIMIENTOS` = `[['todos','Todos'],['avisos','Avisos a DGMIT'],['area','Emails al área'],['actualizaciones','Actualizaciones'],['cambios','Cambios en la ficha'],['propuestas','Propuestas'],['auditoria','Notas de auditoría'],['altas','Alta y baja']]`;
    - `htmlDeFiltrosDeMovimientos(movimientos, elegido)`: con cantidad, y solo los que tienen algo;
    - `itemsDeLaLista(movimientos, hitos, filtro)`: los hitos solo con "todos", intercalados por fecha;
    - `htmlDeMovimiento(m, i, { esAdmin })`: un `li.sg-mov`, con un `button.sg-fila` (`aria-expanded="false"`, `aria-controls="sg-cuerpo-i"`) y un `div.sg-cuerpo` con `hidden`;
    - `htmlDeHito(h)`;
    - `htmlDeMovimientos(items, visibles, { esAdmin })`.
  - **PDF:** `nombreDelPdf(titulo, hoy)`, una copia de la regla del servidor (Task 4).
  - **DOM:**
    - `iniciarSeguimiento()`;
    - `cargarLista()` y `cargarDataset(id)`;
    - `mostrarEstado(visibles)`, sobre `['loading', 'vista-lista', 'vista-dataset', 'not-found', 'sg-error']`;
    - `dibujarLista()` y `dibujarMovimientos()`;
    - `alternarFila(evento)`;
    - `descargarPdf()`, con `API.pedirArchivo('/seguimiento/' + id + '/pdf')` y `descargarBlob` / `conBotonBloqueado` copiados de `correos.js:62-79`;
    - el estado de la vista: `{ filas, filtro: 'vencidos', busqueda: '', seguimiento: null, filtroMov: 'todos', visibles: 10, pedido: 0 }`, descartando las respuestas viejas como en `perfil.js:255-269`.

**Contenido** (de la spec, "La pantalla"):
- **Ficha:** la insignia sale de `ficha.estado.texto` con la clase `sg-insignia sg-<estado>`. Los botones son "Descargar PDF" y "Ver en el portal" (este último, solo con `url_dataset`). La fila de datos lleva Frecuencia, Datos al, Cargado en el portal, "Venció el" (con `hace N días`) o "Vence el", y Datos solicitados hoy.
- **Circuito:** usa los textos ya armados por el servidor.
- **Cinta:** SVG con `viewBox="0 0 1000 170"`. Las filas en unidades de pantalla son las de `MEDIDAS.pantalla` del prototipo: `etiqueta: 14, arriba: 34, bandaY: 54, bandaH: 22, abajo: 92, vence: 113, vence2: 126, mes: 151, anio: 164`. Cada marca lleva un `<title>` con `detalle.join('\n')`.
- **Nota desplegada:** el link "Descargar la nota y su anexo" va solo con `esAdmin`.
- **Lista de movimientos:** al cambiar de filtro vuelve a `visibles = 10`. "Ver los N anteriores" suma 20.
- **Aclaración:** `Los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026: antes de esas fechas no hay registro.`
- **Buscador:** las sugerencias del `datalist` son `título — área`. Al elegir una que coincide exacto, navega a `?id=`. En la vista de lista filtra en vivo.
- **Sin `id`:** `cargarLista()`. Con `id`: `cargarDataset(id)`, y además se pide la lista para las sugerencias.

- [ ] **Step 1: Tests que fallan.** `tests/seguimiento-frontend.test.js`. Usa el `cargar` de `publico-frontend.test.js:12-25` con el `api.js` real y los datos reales del servidor: `import { seguimientoDe, resumenParaLista } from '../services/seguimientoReglas.js'` + `CASOS`.

```js
it('el circuito de 52, con los textos del servidor', () => {
  const s = seguimientoDe(f(52), HOY), html = ctx.htmlDelCircuito(s.circuito);
  for (const t of ['6 avisos', '5 emails y la Nota Digital N° 2/26', 'DGMIT y Dirección Administrativa', 'Vencido hace 81 días']) assert.ok(html.includes(t), t);
});
it('la cinta: una marca por agrupación, con <title>', () => {
  const s = seguimientoDe(f(52), HOY), svg = ctx.svgDeCinta(s.cinta);
  assert.equal((svg.match(/<title>/g) ?? []).length, s.cinta.marcas.length);
});
it('lista: filtros, cantidades y orden', () => {
  const filas = Object.keys(CASOS).map(id => resumenParaLista(f(id), HOY));
  const vencidos = filas.filter(x => ctx.filtroDeEstado(x.estado) === 'vencidos').map(x => x.id).sort((a, b) => a - b);
  assert.deepEqual(vencidos, [1, 11, 26, 33, 52, 61]);
  assert.equal(ctx.cantidadesPorFiltro(filas, '').vencidos, 6);
  assert.deepEqual(plano(ctx.ordenarFilas(ctx.filasDelFiltro(filas, 'vencidos', ''), 'vencidos').map(x => x.id)).slice(0, 2), [11, 26]);
});
it('cambiar de filtro vuelve a 10 filas', () => { /* dibujarMovimientos con un DOM falso: filtroMov 'avisos' → visibles 10 */ });
it('escapa el título y la URL', () => {
  const html = ctx.htmlDeFicha({ ...seguimientoDe(f(52), HOY).ficha, titulo: '<b>x</b>', url_dataset: null });
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;')); assert.ok(!html.includes('Ver en el portal'));
});
it('la nota desplegada: descarga solo para administración', () => {
  const nota = seguimientoDe(f(52), HOY).movimientos[0];
  assert.ok(ctx.htmlDeMovimiento(nota, 0, { esAdmin: true }).includes('Descargar la nota y su anexo'));
  assert.ok(!ctx.htmlDeMovimiento(nota, 0, { esAdmin: false }).includes('Descargar la nota y su anexo'));
});
it('sin sesión, al login', async () => { /* capturar el oyente de DOMContentLoaded como en perfil-frontend.test.js:673-683; Auth.isAuthenticated() false → window.location.href === 'login.html' */ });
it('cuatro estados: 404 → not-found; 500 → sg-error; el dibujo roto → sg-error', async () => { /* como publico-frontend.test.js:180-281 */ });
it('lenguaje neutro en todo el HTML de los 12 casos', () => { /* htmlDeFicha + htmlDelCircuito + htmlDeMovimientos: sin /sin entregar|sin respuesta|atrasad/i */ });
```

- [ ] **Step 2: Correr.** `node --test tests/seguimiento-frontend.test.js`: FAIL.
- [ ] **Step 3: Implementar** `seguimiento.js`. Las clases y el markup salen de `consolidado.html` del mockup: la vista "Sin elegir" es la tabla `.sg-tabla`; el circuito, `.sg-tramos`; la lista, `.sg-movs`.
- [ ] **Step 4: Correr.** `node --test tests/seguimiento-frontend.test.js tests/paginas.test.js`: PASS.
- [ ] **Step 5: Commit.** `git add public/js/seguimiento.js public/seguimiento.html tests/seguimiento-frontend.test.js && git commit -m "feat: pantalla del Seguimiento"`

---

### Task 10: "Ver seguimiento" en Gestión de Datasets

**Files:**
- Modify: `public/js/admin-fechas.js` (`htmlDeAcciones`, `:263-273`, más una constante `ICONO_SEGUIMIENTO` junto a los íconos de `:33-35`)
- Modify: `public/admin.html`: `admin-fechas.js?v=20261111` y `admin.js?v=20261111` (los dos van emparejados)
- Modify: `tests/paginas.test.js` (`VERSION_ADMIN = '20261111'`) y `tests/admin-frontend.test.js`

**Interfaces:**
- Produces: dentro de `.ad-acciones`, después del botón "Registrar actualización":

```js
`<a class="ad-icono" href="seguimiento.html?id=${textoSeguro(encodeURIComponent(String(d.id)))}" aria-label="Ver seguimiento de ${titulo}">${ICONO_SEGUIMIENTO}</a>`
```

- `ICONO_SEGUIMIENTO` es el SVG de history con `aria-hidden="true" focusable="false"`.
- Es un link, así que no se deshabilita aunque el dataset tenga un cambio pendiente.
- El lector no lo ve: `htmlDeAcciones` devuelve `''` sin `esAdmin`.

- [ ] **Step 1: Tests**
  - En `tests/admin-frontend.test.js:417-421`, `'<svg'` y `aria-hidden="true"` pasan de 3 a 4.
  - Un test nuevo:
    - `htmlDeFila(dataset, { esAdmin: true, hoy })` incluye `href="seguimiento.html?id=1"` y `aria-label="Ver seguimiento de `;
    - con `id: '1" onmouseover="x'` no aparece `" onmouseover`;
    - con `esAdmin: false`, no aparece `seguimiento.html`.
  - Los conteos de `<button` siguen en 3.
- [ ] **Step 2: Correr.** `node --test tests/admin-frontend.test.js tests/paginas.test.js`: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** PASS.
- [ ] **Step 5: Commit.** `git add public/js/admin-fechas.js public/admin.html tests/admin-frontend.test.js tests/paginas.test.js && git commit -m "feat: Ver seguimiento desde Gestión de Datasets"`

---

### Task 11: Documentación, verificación final y kit de despliegue

**Files:**
- Modify: `CLAUDE.md`
  - `:36`, `:72`, `:74` y `:128`: de 13 a 14 páginas, y `seguimiento` en la lista;
  - en la estructura del proyecto, los cuatro `services/seguimiento*.js`;
  - una sección nueva "Seguimiento del dataset" con el circuito, el lenguaje neutro, los ciclos y la asignación de avisos, la cinta, el PDF y los endpoints, todo en el estilo de las demás secciones.
- Modify: `README.md` (`:168` y `:664`).

- [ ] **Step 1: Escribir la documentación.**
- [ ] **Step 2: Suite completa.** `npm test`. Expected: 0 fallan y el total sube respecto de la línea de base (2438).
- [ ] **Step 3: Prueba a mano en el navegador.**
  - Verificar el SMTP en Mailpit (Global Constraints) y levantar la app con `preview_start` (`name: "rpad"`, puerto 3001) contra la base local, que es copia de producción.
  - Entrar con un usuario de prueba local (`npm run setup-admin`, rol lector; credenciales de prueba guardadas solo en local).
  - Revisar:
    - Herramientas → Seguimiento: la vista "Sin elegir", con 13 vencidos;
    - el dataset 52, contra `consolidado-escritorio.png`;
    - Descargar PDF: una hoja;
    - el celular (375 px): sin desplazamiento horizontal fuera de la cinta;
    - la consola sin errores.
  - Al terminar, borrar el usuario de prueba.
- [ ] **Step 4: Kit de despliegue** en `Desktop/RPAD-deploy-seguimiento/`:
  - los archivos de `public/` (las 14 páginas con carcasa, `js/seguimiento.js` y `js/admin-fechas.js`);
  - `services/seguimientoReglas.js`, `seguimientoCinta.js`, `seguimientoDatos.js`, `seguimientoPdf.js` y `notasDigitalesAnexo.js`;
  - `controllers/seguimientoController.js` y `routes/index.js`;
  - un `LEEME.html`: sin SQL, sin "Run NPM Install", con Restart.
- [ ] **Step 5: Commit.** `git add CLAUDE.md README.md && git commit -m "docs: Seguimiento del dataset en CLAUDE.md y el README"`
