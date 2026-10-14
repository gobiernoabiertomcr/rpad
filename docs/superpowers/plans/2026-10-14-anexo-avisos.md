# Anexo de los avisos, avisos solo a vencer y textos nuevos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada aviso de Notas Digitales informe solo datasets a vencer y viaje con un anexo PDF (A4, una hoja por dataset), que los vencidos sin aviso pasen a la reiteración, y que los textos de las notas queden como pidió el usuario.

**Architecture:** Se extiende el sistema existente sin cambiar su forma: la selección (`services/notasDigitalesDatos.js`) cambia sus reglas; el contenido (`services/notasDigitalesContenido.js`) suma la estructura del anexo y los textos nuevos; un módulo nuevo (`services/notasDigitalesAnexo.js`) dibuja el anexo con PDFKit y el QR de `qrcode`; el motor (`services/notasDigitales.js`) genera, guarda (columna nueva `anexo_pdf`) y adjunta el anexo; la API y la pantalla de Correos lo exponen.

**Tech Stack:** Node 22 (dev 24), Express 4, ES Modules, MariaDB 10.11 (mysql2/promise), PDFKit 0.15, `qrcode` 1.5.4 (nueva), node:test contra Docker (MariaDB + Mailpit).

**Spec:** `docs/superpowers/specs/2026-10-12-notas-digitales-design.md` — secciones 5.2, 5.3, 6.2 a 6.7, 7.1, 7.4, 9, 10, 12 y 13 (segunda entrega). La spec manda; este plan es su argumento.

## Global Constraints

- Node 22 en producción: no usar APIs que no existan en Node 22. ES Modules, `async/await`, arrow functions, español en nombres y textos.
- SQL siempre parametrizado con `?`; los nombres de columna solo pueden salir de listas fijas del código.
- Respuestas de la API: `{ success, data?, error?, message? }`; todas las rutas nuevas con `authMiddleware, adminOnly`, declaradas **antes** de las de `/:id`.
- Todo texto que se escribe o se mide en un PDF pasa por `textoParaPdf` (usar `DocumentoNota`, que lo aplica siempre).
- El repo es público: ninguna imagen institucional, casilla personal, contraseña ni nombre de persona en archivos versionados. Las imágenes de los tests se generan en el test.
- La migración de producción ya corrió: los cambios de esquema van en una migración nueva y aditiva (`database/updates/migracion-notas-digitales-anexo.sql`), replicada en `database/schema.sql` y en `tests/schema.test.js`.
- Antes de correr cualquier test: `grep -E '^SMTP_HOST=' .env` debe imprimir `SMTP_HOST=127.0.0.1`. Si no, no se corre nada.
- Textos exactos (spec 6.3, 6.5, 6.6, 6.7):
  - Aviso interna: `Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación, publicados en el Portal de Datos Abiertos Municipal, requieren ser actualizados. En tal sentido, solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.`
  - Justificación de aviso, tercer párrafo: `La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.`
  - Justificación de reiteración: `La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar). La información actualizada puede ser remitida a datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, y será publicada en cumplimiento del Artículo 9° de la mencionada ordenanza.`
  - Línea del anexo en la nota: `Anexo: reporte de los conjuntos de datos (1 hoja).` / `(N hojas).`
  - Primera línea del email: `SE ADJUNTAN NOTA Y ANEXO EN PDF` (avisos) y `SE ADJUNTA NOTA EN PDF` (reiteraciones).
  - "Informado en" de un vencido sin aviso: `Sin aviso previo` (y `– reiterado N vez/veces` si corresponde).
  - Corte de texto largo en el anexo: `… (continúa en el portal)`.

## Review Focus

1. **Textos larguísimos en el anexo** (descripción de 5.000 caracteres, observaciones largas, título de 300 caracteres, muchos formatos, área con 8 datos de contacto): cada dataset ocupa **exactamente una hoja** y nada se superpone ni se escribe fuera de la hoja. → tests en Task 3.
2. **Datasets sin link válido** (`url_dataset` vacío o `javascript:`): sin QR y sin link; **sin última actualización**: la línea de tiempo dice "Sin registro". → tests en Task 3.
3. **Un vencido sin aviso** que aparece a mitad de mes entra una sola vez en la próxima reiteración, con "Sin aviso previo" y su antecedente, y en las siguientes reiteraciones cuenta "reiterado N veces". → tests en Task 2.
4. **Reintento de un aviso** reenvía exactamente los mismos dos PDF; una reiteración (y su prueba) nunca lleva anexo. → tests en Task 4.
5. **Producción con la migración nueva pendiente:** el código nuevo no se sube sin la columna; el README lo deja en orden (migración, código, NPM Install, Restart). → Task 6.

---

## Task 1: Textos de la nota, línea del anexo y primera línea del email

**Files:**
- Modify: `services/notasDigitalesContenido.js` (`PARRAFO_INICIAL.aviso.interna`, `JUSTIFICACION`, `construirNota`, `renderHtml`, `renderTexto`, `AVISO_ADJUNTO`)
- Modify: `services/notasDigitalesPdf.js` (`renderPdf`: línea del anexo antes de "Justificación:")
- Test: `tests/notas-contenido.test.js`, `tests/notas-pdf.test.js`

**Interfaces:**
- Produces: `construirNota(...)` devuelve además `anexo: string | null` (la línea, solo en avisos) y `avisoAdjunto: string` (primera línea del email).

- [ ] **Step 1: Tests que fallan** (en `tests/notas-contenido.test.js`, usando los helpers `nota()` y `dataset()` que ya existen en el archivo)

```js
describe('textos del 14/10/2026', () => {
  it('el aviso interno dice "En tal sentido, solicito"', () => {
    assert.ok(nota().parrafoInicial.includes('requieren ser actualizados. En tal sentido, solicito tenga a bien gestionar su actualización'));
  });

  it('ninguna justificación menciona el WhatsApp', () => {
    for (const tipo of ['aviso', 'reiteracion']) {
      const texto = nota({ tipo }).justificacion.join(' ');
      assert.ok(!texto.includes('WhatsApp'), tipo);
      assert.ok(texto.includes('datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar'), tipo);
    }
    assert.equal(nota().justificacion[2],
      'La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.');
  });

  it('el aviso lleva la línea del anexo con la cantidad de hojas; la reiteración no', () => {
    assert.equal(nota().anexo, 'Anexo: reporte de los conjuntos de datos (1 hoja).');
    assert.equal(nota({ datasets: [dataset(), dataset({ id: 2, titulo: 'Dataset B' })] }).anexo,
      'Anexo: reporte de los conjuntos de datos (2 hojas).');
    assert.equal(nota({ tipo: 'reiteracion' }).anexo, null);
  });

  it('la línea del anexo va antes de "Justificación:" en el HTML y en el texto', () => {
    const html = renderHtml(nota());
    assert.ok(html.indexOf('Anexo: reporte de los conjuntos de datos (1 hoja).') < html.indexOf('Justificación:'));
    const texto = renderTexto(nota());
    assert.ok(texto.indexOf('Anexo: reporte de los conjuntos de datos (1 hoja).') < texto.indexOf('Justificación:'));
    assert.ok(!renderHtml(nota({ tipo: 'reiteracion' })).includes('Anexo:'));
  });

  it('el email del aviso anuncia nota y anexo; el de la reiteración, solo la nota', () => {
    assert.ok(renderHtml(nota()).includes('>SE ADJUNTAN NOTA Y ANEXO EN PDF</p>'));
    assert.ok(renderTexto(nota()).startsWith('SE ADJUNTAN NOTA Y ANEXO EN PDF\n\n'));
    assert.ok(renderHtml(nota({ tipo: 'reiteracion' })).includes('>SE ADJUNTA NOTA EN PDF</p>'));
  });
});
```

Ajustá los tests existentes que fijaban la primera línea (`SE ADJUNTA NOTA EN PDF` con `nota()` de aviso) para que esperen la variante de aviso.

En `tests/notas-pdf.test.js`, un test con `lineasPorHoja`: en un aviso la línea `Anexo: reporte de los conjuntos de datos (N hojas).` aparece en el PDF y antes de `Justificación:`; en una reiteración no aparece.

- [ ] **Step 2: Verificar que fallan** — `node --test tests/notas-contenido.test.js tests/notas-pdf.test.js` (no usan la base). Esperado: FAIL en los tests nuevos.

- [ ] **Step 3: Implementación**

En `services/notasDigitalesContenido.js`:
- `PARRAFO_INICIAL.aviso.interna`: el texto exacto de Global Constraints.
- `JUSTIFICACION.aviso[2]` y `JUSTIFICACION.reiteracion[0]`: los textos exactos de Global Constraints.
- Reemplazar la constante `AVISO_ADJUNTO` por:

```js
// Primera línea del email (en bordó en el HTML): la nota formal es el PDF adjunto, y el aviso suma su anexo
const AVISO_ADJUNTO = { aviso: 'SE ADJUNTAN NOTA Y ANEXO EN PDF', reiteracion: 'SE ADJUNTA NOTA EN PDF' };
```

- En `construirNota`, agregar al objeto devuelto:

```js
    avisoAdjunto: AVISO_ADJUNTO[tipo],
    // Una hoja del anexo por dataset (spec 6.7); solo los avisos llevan anexo
    anexo: tipo === 'aviso' ? `Anexo: reporte de los conjuntos de datos (${cantidad(datasets.length, 'hoja', 'hojas')}).` : null,
```

  (La constante `AVISO_ADJUNTO` se declara antes de `construirNota`; moverla arriba si hace falta.)
- `renderHtml`: la primera línea usa `${escapeHtml(nota.avisoAdjunto)}`; antes de `<p style="margin:16px 0 6px;"><b>Justificación:</b></p>` agregar `${nota.anexo ? `<p style="margin:16px 0 0;">${escapeHtml(nota.anexo)}</p>` : ''}`.
- `renderTexto`: la primera línea es `nota.avisoAdjunto`; antes de `'Justificación:'` agregar `...(nota.anexo ? [nota.anexo, ''] : [])`.

En `services/notasDigitalesPdf.js` (`renderPdf`), justo antes del bloque de la justificación:

```js
    // La línea del anexo (solo avisos) viaja con el título de la justificación
    if (nota.anexo) {
      asegurarEspacio(altoTexto(nota.anexo) + 25 + altoTexto(nota.justificacion[0] || ''));
      parrafo(nota.anexo, { align: 'left', espacio: 0.6 });
    }
```

- [ ] **Step 4: Verificar que pasan** — los mismos archivos y después `npm test` completo (con la verificación de `SMTP_HOST`).

- [ ] **Step 5: Commit**

```bash
git add services/notasDigitalesContenido.js services/notasDigitalesPdf.js tests/notas-contenido.test.js tests/notas-pdf.test.js
git commit -F - <<'EOF'
feat: textos nuevos de las Notas Digitales, línea del anexo y primera línea del email según el tipo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

## Task 2: Avisos solo a vencer; vencidos sin aviso a la reiteración

**Files:**
- Modify: `services/notasDigitalesDatos.js` (`seleccionarParaAviso`, `seleccionarParaReiteracion`, `aperturaDelProximoAviso`)
- Modify: `services/notasDigitales.js` (`prepararContenido`, `estadoNotas`)
- Modify: `services/notasDigitalesContenido.js` (`textoInformado`, antecedente en reiteraciones)
- Test: `tests/notas-datos.test.js`, `tests/notas-motor.test.js`, `tests/notas-contenido.test.js`

**Interfaces:**
- Consumes: Task 1 (`construirNota`).
- Produces:
  - `seleccionarParaAviso(gestion, hoy)` — solo `proxima_actualizacion >= hoy` (además de lo que ya pedía).
  - `seleccionarParaReiteracion(gestion, hoy)` — devuelve también los vencidos sin aviso con `informado: null`.
  - `aperturaDelProximoAviso(gestion, hoy)` — **nuevo parámetro `hoy`**: ignora los datasets vencidos.

- [ ] **Step 1: Tests que fallan**

En `tests/notas-datos.test.js` (con las fixtures `crearDataset`, `crearNota`, `crearEmailViejo` y el patrón `before/after` del archivo):

```js
describe('avisos solo a vencer (14/10/2026)', () => {
  it('el aviso no toma vencidos, aunque nunca hayan tenido aviso', async () => {
    const vencido = await crearDataset({ gestion: 'interna', vencimiento: '2026-09-30' });
    const aVencer = await crearDataset({ gestion: 'interna', vencimiento: '2026-11-30' });
    const ids = (await seleccionarParaAviso('interna', '2026-10-14')).map(d => d.id);
    assert.ok(ids.includes(aVencer));
    assert.ok(!ids.includes(vencido));
  });

  it('un dataset que vence hoy todavía entra en el aviso', async () => {
    const hoy = await crearDataset({ gestion: 'externa', vencimiento: '2026-10-14' });
    assert.ok((await seleccionarParaAviso('externa', '2026-10-14')).some(d => d.id === hoy));
  });
});

describe('reiteración: vencidos sin aviso', () => {
  it('entran sin esperar 20 días, con informado null', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-10-31' });
    const fila = (await seleccionarParaReiteracion('externa', '2026-11-02')).find(d => d.id === id);
    assert.ok(fila);
    assert.equal(fila.informado, null);
    assert.equal(fila.reiteraciones, 0);
  });

  it('no entran si todavía no vencieron, ni si tienen un aviso registrado (aunque haya fallado)', async () => {
    const aVencer = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    const conAvisoFallido = await crearDataset({ gestion: 'externa', vencimiento: '2026-10-31' });
    await crearNota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-10-01', numero: 90, estado: 'fallida',
      datasets: [{ id: conAvisoFallido, vencimiento: '2026-10-31' }] });
    const ids = (await seleccionarParaReiteracion('externa', '2026-11-02')).map(d => d.id);
    assert.ok(!ids.includes(aVencer));
    assert.ok(!ids.includes(conAvisoFallido));
  });

  it('cuenta las reiteraciones anteriores del mismo vencimiento', async () => {
    const id = await crearDataset({ gestion: 'interna', vencimiento: '2026-09-30' });
    await crearNota({ tipo: 'reiteracion', gestion: 'interna', fecha: '2026-10-01', numero: 91,
      datasets: [{ id, vencimiento: '2026-09-30', seccion: 'vencido' }] });
    const fila = (await seleccionarParaReiteracion('interna', '2026-11-02')).find(d => d.id === id);
    assert.equal(fila.reiteraciones, 1);
    assert.equal(fila.informado, null);
  });
});
```

Revisá los tests existentes que daban por hecho que el aviso incluye vencidos (por ejemplo `toma los que vencen dentro de la ventana y los vencidos…` en `tests/notas-datos.test.js` y los del motor que avisan un vencido con su antecedente, como el de `tests/notas-motor.test.js` que espera `Antecedente: notificado a la DGMIT … en 2 oportunidades`): cambialos para que el vencido sin aviso aparezca en la **reiteración** y el antecedente se verifique ahí. Ajustá también el test de `aperturaDelProximoAviso` para el parámetro `hoy` (un mes que solo tiene vencidos no abre un aviso).

En `tests/notas-contenido.test.js`:

```js
it('reiteración: un vencido sin aviso dice "Sin aviso previo" y lleva su antecedente', () => {
  const n = nota({ tipo: 'reiteracion', datasets: [dataset({ vencimiento: '2026-09-30', informado: null, reiteraciones: 2,
    antecedente: { cantidad: 3, primera: '2026-07-01', ultima: '2026-09-01' } })] });
  const fila = n.secciones[0].filas[0];
  assert.equal(fila.valores.at(-1), 'Sin aviso previo – reiterado 2 veces');
  assert.equal(fila.antecedente, 'Antecedente: notificado a la DGMIT por correo electrónico en 3 oportunidades, entre el 01/07/2026 y el 01/09/2026.');
});

it('reiteración: un dataset con aviso no lleva antecedente aunque lo tenga', () => {
  const n = nota({ tipo: 'reiteracion', datasets: [dataset({ informado: { numero: 1, anio: 2026, fecha: '2026-10-13' },
    antecedente: { cantidad: 3, primera: '2026-07-01', ultima: '2026-09-01' } })] });
  assert.equal(n.secciones[0].filas[0].antecedente, null);
});
```

En `tests/notas-motor.test.js`, un test de punta a punta (con `ejecutarNotasDigitales({ hoy })` y Mailpit, como los existentes): un dataset vencido sin aviso no sale en el aviso de un día cualquiera y sí sale en la reiteración del primer día hábil del mes siguiente, con "Sin aviso previo" en el HTML enviado; y el estado (`estadoNotas`) cuenta ese dataset en la próxima reiteración y no en el próximo aviso.

- [ ] **Step 2: Verificar que fallan** — `node --test tests/notas-datos.test.js tests/notas-contenido.test.js` y los tests nuevos de `tests/notas-motor.test.js`.

- [ ] **Step 3: Implementación**

`services/notasDigitalesDatos.js`:

```js
// Solo datasets a vencer (spec 5.2): los vencidos sin aviso van a la reiteración (5.3)
export const seleccionarParaAviso = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_DATASET} ${DESDE_DATASETS}
     WHERE ${CONDICION_BASE}
       AND d.proxima_actualizacion >= ?
       AND ${PRIMER_VENCIMIENTO_DEL_MES} <= DATE_ADD(?, INTERVAL ? DAY)
       AND ${SIN_AVISO}
     ORDER BY d.proxima_actualizacion, d.titulo`,
    [gestion, hoy, hoy, VENTANA_DIAS[gestion]]
  );
  return filas;
};
```

Para la regla del mes, `PRIMER_VENCIMIENTO_DEL_MES` se mantiene como está (el "primer vencimiento del mes" se busca entre todos, vencidos o no, como dice la spec 5.2).

`seleccionarParaReiteracion`: unir las dos condiciones de la spec 5.3 con `UNION ALL` (son excluyentes: una exige aviso enviado y la otra que no haya ningún aviso), y ordenar el resultado completo:

```js
const REITERACIONES_PREVIAS = `(SELECT COUNT(*) FROM notas_digitales_datasets r
   JOIN notas_digitales rn ON rn.id = r.nota_id
  WHERE r.dataset_id = d.id AND r.vencimiento = d.proxima_actualizacion
    AND rn.tipo = 'reiteracion' AND rn.es_prueba = 0 AND rn.estado = 'enviada')`;

export const seleccionarParaReiteracion = async (gestion, hoy) => {
  const [filas] = await pool.query(
    `SELECT * FROM (
       SELECT ${COLUMNAS_DATASET}, av.numero AS aviso_numero, av.anio AS aviso_anio,
              DATE_FORMAT(av.fecha, '%Y-%m-%d') AS aviso_fecha, ${REITERACIONES_PREVIAS} AS reiteraciones
       ${DESDE_DATASETS}
       JOIN notas_digitales_datasets avd ON avd.dataset_id = d.id AND avd.vencimiento = d.proxima_actualizacion
       JOIN notas_digitales av ON av.id = avd.nota_id AND av.tipo = 'aviso' AND av.es_prueba = 0 AND av.estado = 'enviada'
       WHERE ${CONDICION_BASE} AND av.fecha <= DATE_SUB(?, INTERVAL ? DAY)
       UNION ALL
       SELECT ${COLUMNAS_DATASET}, NULL, NULL, NULL, ${REITERACIONES_PREVIAS}
       ${DESDE_DATASETS}
       WHERE ${CONDICION_BASE} AND d.proxima_actualizacion < ? AND ${SIN_AVISO}
     ) AS x
     ORDER BY x.vencimiento, x.titulo`,
    [gestion, hoy, DIAS_PARA_REITERAR, gestion, hoy]
  );
  return filas.map(({ aviso_numero, aviso_anio, aviso_fecha, reiteraciones, ...dataset }) => ({
    ...dataset,
    informado: aviso_fecha ? { numero: aviso_numero, anio: aviso_anio, fecha: aviso_fecha } : null,
    reiteraciones: Number(reiteraciones)
  }));
};
```

`aperturaDelProximoAviso(gestion, hoy)`: agregar `AND d.proxima_actualizacion >= ?` (parámetro `hoy`) a la consulta, y actualizar su comentario.

`services/notasDigitales.js`:
- `prepararContenido`: el antecedente se busca para los avisos y, en las reiteraciones, para los datasets sin aviso:

```js
const prepararContenido = async ({ tipo, gestion, datasets }) => {
  // Antecedente de los emails anteriores: en los avisos y en las filas "Sin aviso previo" de las reiteraciones
  const conAntecedente = datasets.filter(d => tipo === 'aviso' || !d.informado).map(d => d.id);
  const antecedentes = await antecedentesDe(conAntecedente);
  const conDatos = datasets.map(d => ({ informado: null, reiteraciones: 0, ...d, antecedente: antecedentes.get(d.id) ?? null }));
  const areas = gestion === 'externa' ? await areasDe([...new Set(datasets.map(d => d.area_id))]) : [];
  return { datasets: conDatos, areas };
};
```

- `estadoNotas`: `aperturaDelProximoAviso(gestion, hoy)`.

`services/notasDigitalesContenido.js`:
- `textoInformado`: sin aviso devuelve `'Sin aviso previo'` (con `– reiterado N vez/veces` si `reiteraciones > 0`):

```js
const textoInformado = (dataset) => {
  const base = dataset.informado
    ? `Nota Digital N° ${textoNumero(dataset.informado)} (${formatoCorto(dataset.informado.fecha)})`
    : 'Sin aviso previo';
  return dataset.reiteraciones > 0 ? `${base} – reiterado ${cantidad(dataset.reiteraciones, 'vez', 'veces')}` : base;
};
```

- En `construirNota`, el antecedente de cada fila: `antecedente: tipo === 'aviso' || !d.informado ? textoAntecedente(d.antecedente) : null`.

- [ ] **Step 4: Verificar que pasan** — los archivos tocados y `npm test` completo.

- [ ] **Step 5: Commit** (`feat: los avisos informan solo datasets a vencer y los vencidos sin aviso pasan a la reiteración`)

---

## Task 3: El anexo en PDF (diseño) — con punto de control del usuario

**Files:**
- Create: `services/notasDigitalesAnexo.js`
- Modify: `services/notasDigitalesPdf.js` (exportar `DocumentoNota`)
- Modify: `services/notasDigitalesContenido.js` (`construirAnexo`)
- Modify: `package.json`, `package-lock.json` (`qrcode@1.5.4`)
- Test: `tests/notas-anexo.test.js` (nuevo)

**Interfaces:**
- Produces:
  - `construirAnexo({ numero, anio, esPrueba, fecha, fichas })` → `{ numeroTexto, fechaLarga, hojas: Hoja[] }` (pura). Cada `ficha` tiene: `id, titulo, descripcion, observaciones, url_dataset, tipo_gestion, frecuencia_nombre, ultima_actualizacion, vencimiento, tema_principal, tema_secundario, formatos` (texto separado por comas o null) y los datos del área: `area_nombre, area_superior, email_principal, email_secundario, telefono_area, celular_area, nombre_contacto, telefono_contacto, email_contacto`.
  - `Hoja = { titulo, etiqueta, estado, linea: { inicio: string|null, fin: string, hoy: string }, campos: [etiqueta, valor][], url: string|null, descripcion: string, observaciones: string|null, contacto: { nombre, lineas: string[] } }`.
  - `renderAnexo(anexo)` → `Promise<Buffer>` (PDF A4, una hoja por elemento de `hojas`).

- [ ] **Step 1: Dependencia** — `npm install qrcode@1.5.4` (queda en `dependencies` y en `package-lock.json`).

- [ ] **Step 2: Tests que fallan** — `tests/notas-anexo.test.js` (no usa la base):

```js
// Anexo de los avisos: una hoja A4 por dataset (spec 6.7)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirAnexo } from '../services/notasDigitalesContenido.js';
import { renderAnexo } from '../services/notasDigitalesAnexo.js';
import { lineasPorHoja, contenidoPorHoja } from './pdf-lector.js';

const MM = 72 / 25.4;
const ficha = (cambios = {}) => ({
  id: 1, titulo: 'Áreas específicas de género', descripcion: 'Listado de áreas municipales con funciones específicas de género.',
  observaciones: null, url_dataset: 'https://datos.comodoro.gov.ar/dataset/areas-genero', tipo_gestion: 'externa',
  frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-16', vencimiento: '2026-11-30',
  tema_principal: 'Género', tema_secundario: null, formatos: 'CSV, XLSX',
  area_nombre: 'Secretaría de la Mujer, Género y Diversidad', area_superior: 'Intendencia',
  email_principal: 'area@ejemplo.gov.ar', email_secundario: null, telefono_area: '297 400-0000', celular_area: null,
  nombre_contacto: null, telefono_contacto: null, email_contacto: null, ...cambios
});
const anexo = (fichas, extra = {}) => construirAnexo({ numero: 3, anio: 2026, fecha: '2026-11-02', fichas, ...extra });
// Cantidad de rectángulos dibujados en una hoja: el QR se dibuja con decenas de ellos
const rectangulos = (contenido) => (contenido.match(/ re\b/g) ?? []).length;

describe('construirAnexo', () => {
  it('arma una hoja por ficha, con estado, línea de tiempo y campos', () => {
    const a = anexo([ficha(), ficha({ id: 2, titulo: 'Otro', vencimiento: '2026-11-02' })]);
    assert.equal(a.numeroTexto, '3/26');
    assert.equal(a.hojas.length, 2);
    assert.equal(a.hojas[0].estado, 'Vence el 30/11/2026 · faltan 28 días');
    assert.equal(a.hojas[1].estado, 'Vence hoy');
    assert.equal(a.hojas[0].etiqueta, 'CONJUNTO DE DATOS · GESTIÓN EXTERNA');
    assert.deepEqual(a.hojas[0].linea, { inicio: '2025-12-16', fin: '2026-11-30', hoy: '2026-11-02' });
    assert.ok(a.hojas[0].campos.some(([e, v]) => e === 'Formatos' && v === 'CSV, XLSX'));
    assert.deepEqual(a.hojas[0].contacto.lineas, ['Email: area@ejemplo.gov.ar', 'Teléfono: 297 400-0000']);
  });

  it('sin link válido no hay url; sin datos de contacto lo dice', () => {
    const h = anexo([ficha({ url_dataset: 'javascript:alert(1)', email_principal: null, telefono_area: null })]).hojas[0];
    assert.equal(h.url, null);
    assert.deepEqual(h.contacto.lineas, ['Sin datos de contacto registrados']);
  });

  it('las pruebas y la vista previa numeran PRUEBA y XX', () => {
    assert.equal(anexo([ficha()], { esPrueba: true }).numeroTexto, 'PRUEBA');
    assert.equal(anexo([ficha()], { numero: null, anio: null }).numeroTexto, 'XX');
  });
});

describe('renderAnexo', () => {
  it('es un PDF A4 con una hoja por dataset, título y pie "Hoja i de t"', async () => {
    const pdf = await renderAnexo(anexo([ficha(), ficha({ id: 2, titulo: 'Segundo dataset' })]));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Áreas específicas de género'));
    assert.ok(hojas[0].some(l => l.includes('Hoja 1 de 2')));
    assert.ok(hojas[1].some(l => l.includes('Hoja 2 de 2')));
    assert.ok(hojas[0].some(l => l.includes('Anexo – Nota Digital N° 3/26')));
    const texto = pdf.toString('latin1');
    assert.ok(texto.includes(`/MediaBox [0 0 ${(210 * MM).toFixed(2).replace(/\.?0+$/, '')}`) || /\/MediaBox \[0 0 595\.2/.test(texto));
  });

  it('textos larguísimos: sigue siendo una sola hoja por dataset y corta con "(continúa en el portal)"', async () => {
    const larga = 'Texto muy largo de la descripción del dataset. '.repeat(120);
    const pdf = await renderAnexo(anexo([ficha({
      titulo: 'Título larguísimo '.repeat(18), descripcion: larga, observaciones: 'Observación larga. '.repeat(80),
      formatos: Array.from({ length: 20 }, (_, i) => `FORMATO${i}`).join(', '),
      email_secundario: 'otra@ejemplo.gov.ar', celular_area: '297 400-0001', nombre_contacto: 'Persona',
      telefono_contacto: '297 400-0002', email_contacto: 'persona@ejemplo.gov.ar'
    })]));
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].join(' ').includes('(continúa en el portal)'));
  });

  it('dibuja el QR solo cuando hay link válido', async () => {
    const con = contenidoPorHoja(await renderAnexo(anexo([ficha()])))[0];
    const sin = contenidoPorHoja(await renderAnexo(anexo([ficha({ url_dataset: '' })])))[0];
    assert.ok(rectangulos(con) > rectangulos(sin) + 50);
  });

  it('sin última actualización, la línea de tiempo dice "Sin registro"', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha({ ultima_actualizacion: null })])));
    assert.ok(hojas[0].some(l => l.includes('Sin registro')));
  });

  it('escribe solo texto que Helvetica puede escribir', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha({ titulo: 'Tel. ☎ Datos' })])));
    assert.ok(hojas[0].some(l => l.includes('Tel. ? Datos')));
  });
});
```

(Si la comprobación de `MediaBox` no coincide con cómo PDFKit escribe el número, reemplazala por la medida de la hoja que ya usan los tests de `tests/notas-pdf.test.js` para el oficio, con 210 × 297 mm.)

- [ ] **Step 3: Verificar que fallan** — `node --test tests/notas-anexo.test.js`.

- [ ] **Step 4: Implementación**

En `services/notasDigitalesPdf.js`: `export class DocumentoNota …` (solo agregar `export`).

En `services/notasDigitalesContenido.js`:

```js
const ETIQUETA_GESTION = { interna: 'GESTIÓN INTERNA', externa: 'GESTIÓN EXTERNA' };

const estadoDelAnexo = (vencimiento, fecha) => {
  const dias = diasEntre(fecha, vencimiento);
  if (dias === 0) return 'Vence hoy';
  return `Vence el ${formatoCorto(vencimiento)} · faltan ${cantidad(dias, 'día', 'días')}`;
};

// Anexo de los avisos: una hoja por dataset con su ficha completa (spec 6.7)
export const construirAnexo = ({ numero = null, anio = null, esPrueba = false, fecha, fichas }) => ({
  numeroTexto: textoNumero({ numero, anio, esPrueba }),
  fechaLarga: formatoLargo(fecha),
  hojas: fichas.map((f) => {
    const lineas = CAMPOS_CONTACTO
      .filter(([campo]) => campo !== 'area_superior' && String(f[campo] ?? '').trim())
      .map(([campo, etiqueta]) => `${etiqueta}: ${f[campo]}`);
    return {
      titulo: f.titulo,
      etiqueta: `CONJUNTO DE DATOS · ${ETIQUETA_GESTION[f.tipo_gestion] ?? ''}`.trim(),
      estado: estadoDelAnexo(f.vencimiento, fecha),
      linea: { inicio: f.ultima_actualizacion ?? null, fin: f.vencimiento, hoy: fecha },
      campos: [
        ['Área responsable', f.area_nombre],
        ['Depende de', f.area_superior],
        ['Gestión', f.tipo_gestion === 'externa' ? 'Externa' : 'Interna'],
        ['Frecuencia', f.frecuencia_nombre],
        ['Última actualización', f.ultima_actualizacion ? formatoCorto(f.ultima_actualizacion) : 'Sin registro'],
        ['Vencimiento', formatoCorto(f.vencimiento)],
        ['Tema principal', f.tema_principal],
        ['Tema secundario', f.tema_secundario],
        ['Formatos', f.formatos]
      ].filter(([, valor]) => String(valor ?? '').trim()),
      url: urlSegura(f.url_dataset),
      descripcion: String(f.descripcion ?? '').trim() || 'Sin descripción registrada.',
      observaciones: String(f.observaciones ?? '').trim() || null,
      contacto: { nombre: f.area_nombre, lineas: lineas.length ? lineas : ['Sin datos de contacto registrados'] }
    };
  })
});
```

`services/notasDigitalesAnexo.js` (nuevo). Diagramación fija en A4 con márgenes de 15 mm; colores monocromáticos con un solo acento. Implementación de referencia (ajustá posiciones si un test lo pide, pero mantené: una hoja por dataset, nada fuera de la hoja, todo texto por `DocumentoNota`):

```js
// Anexo de los avisos de Notas Digitales: una hoja A4 por dataset, diseño de ficha monocromático (spec 6.7)
import QRCode from 'qrcode';
import { DocumentoNota } from './notasDigitalesPdf.js';
import { formatoCorto, diasEntre } from './notasDigitalesCalendario.js';

const MM = 72 / 25.4;
const ANCHO = 210 * MM;
const ALTO = 297 * MM;
const MARGEN = 15 * MM;
const CONTENIDO = ANCHO - 2 * MARGEN;
const NORMAL = 'Helvetica';
const NEGRITA = 'Helvetica-Bold';
const COLOR = {
  tinta: '#1F2933', gris: '#52606D', grisClaro: '#9AA5B1', linea: '#D9DEE3', fondo: '#F5F7FA',
  acento: '#3E6A99', acentoSuave: '#E4ECF5'
};
const CORTE = '… (continúa en el portal)';
const LADO_QR = 32 * MM;
const PIE = ALTO - 10 * MM;

// Texto que entra en un alto: achica la letra hasta min y, si no alcanza, corta por palabras con CORTE
const ajustar = (doc, texto, { ancho, alto, max = 10, min = 8, fuente = NORMAL }) => {
  const limpio = String(texto ?? '').trim();
  for (let tamano = max; tamano >= min; tamano -= 0.5) {
    doc.font(fuente).fontSize(tamano);
    if (doc.heightOfString(limpio, { width: ancho }) <= alto) return { texto: limpio, tamano };
  }
  doc.font(fuente).fontSize(min);
  const palabras = limpio.split(/\s+/);
  let desde = 0;
  let hasta = palabras.length;
  while (desde < hasta) {
    const medio = Math.ceil((desde + hasta) / 2);
    if (doc.heightOfString(`${palabras.slice(0, medio).join(' ')}${CORTE}`, { width: ancho }) <= alto) desde = medio;
    else hasta = medio - 1;
  }
  return { texto: `${palabras.slice(0, desde).join(' ')}${CORTE}`, tamano: min };
};

// QR como vectores: un rectángulo por tramo horizontal de módulos oscuros, con 2 módulos de margen
const dibujarQr = (doc, url, x, y, lado) => {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const modulo = lado / (n + 4);
  doc.rect(x, y, lado, lado).fill('#FFFFFF');
  for (let fila = 0; fila < n; fila++) {
    let inicio = null;
    for (let col = 0; col <= n; col++) {
      const oscuro = col < n && modules.get(fila, col);
      if (oscuro && inicio === null) inicio = col;
      if (!oscuro && inicio !== null) {
        doc.rect(x + (inicio + 2) * modulo, y + (fila + 2) * modulo, (col - inicio) * modulo, modulo);
        inicio = null;
      }
    }
  }
  doc.fill(COLOR.tinta);
};

const dibujarLineaDeTiempo = (doc, { inicio, fin, hoy }, y) => {
  const x0 = MARGEN + 4;
  const x1 = MARGEN + CONTENIDO - 4;
  doc.lineCap('round').lineWidth(5).strokeColor(COLOR.linea).moveTo(x0, y).lineTo(x1, y).stroke();
  if (inicio) {
    const total = Math.max(1, diasEntre(inicio, fin));
    const avance = Math.min(1, Math.max(0, diasEntre(inicio, hoy) / total));
    const xHoy = x0 + (x1 - x0) * avance;
    if (avance > 0) doc.lineWidth(5).strokeColor(COLOR.acento).moveTo(x0, y).lineTo(xHoy, y).stroke();
    doc.circle(xHoy, y, 5).fill(COLOR.tinta);
    doc.font(NEGRITA).fontSize(7).fillColor(COLOR.tinta)
      .text(`Hoy ${formatoCorto(hoy)}`, Math.min(Math.max(xHoy - 40, x0), x1 - 80), y - 17, { width: 80, align: 'center', lineBreak: false });
  }
  doc.circle(x0, y, 3.5).fill(inicio ? COLOR.acento : COLOR.grisClaro);
  doc.circle(x1, y, 3.5).fill(COLOR.tinta);
  doc.font(NORMAL).fontSize(7).fillColor(COLOR.gris)
    .text('ÚLTIMA ACTUALIZACIÓN', x0 - 4, y + 9, { width: 150, lineBreak: false })
    .text('VENCIMIENTO', x1 - 146, y + 9, { width: 150, align: 'right', lineBreak: false });
  doc.font(NEGRITA).fontSize(9).fillColor(COLOR.tinta)
    .text(inicio ? formatoCorto(inicio) : 'Sin registro', x0 - 4, y + 19, { width: 150, lineBreak: false })
    .text(formatoCorto(fin), x1 - 146, y + 19, { width: 150, align: 'right', lineBreak: false });
};

const dibujarHoja = (doc, anexo, hoja, i, total) => {
  // Encabezado
  doc.rect(0, 0, ANCHO, 24 * MM).fill(COLOR.fondo);
  doc.rect(0, 24 * MM, ANCHO, 1.5).fill(COLOR.acento);
  doc.font(NEGRITA).fontSize(8.5).fillColor(COLOR.gris)
    .text('DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', MARGEN, 9 * MM, { width: CONTENIDO / 2, lineBreak: false });
  doc.font(NORMAL).fontSize(7.5).fillColor(COLOR.grisClaro)
    .text('Municipalidad de Comodoro Rivadavia', MARGEN, 13.5 * MM, { width: CONTENIDO / 2, lineBreak: false });
  doc.font(NEGRITA).fontSize(10).fillColor(COLOR.tinta)
    .text(`Anexo – Nota Digital N° ${anexo.numeroTexto}`, MARGEN + CONTENIDO / 2, 8.5 * MM, { width: CONTENIDO / 2, align: 'right', lineBreak: false });
  doc.font(NORMAL).fontSize(8).fillColor(COLOR.gris)
    .text(anexo.fechaLarga, MARGEN + CONTENIDO / 2, 13.5 * MM, { width: CONTENIDO / 2, align: 'right', lineBreak: false });

  // Etiqueta, título (hasta 3 líneas) y estado
  let y = 32 * MM;
  doc.font(NEGRITA).fontSize(7.5).fillColor(COLOR.acento)
    .text(hoja.etiqueta, MARGEN, y, { width: CONTENIDO, characterSpacing: 0.6, lineBreak: false });
  y += 12;
  const titulo = ajustar(doc, hoja.titulo, { ancho: CONTENIDO, alto: 66, max: 20, min: 14, fuente: NEGRITA });
  doc.font(NEGRITA).fontSize(titulo.tamano).fillColor(COLOR.tinta).text(titulo.texto, MARGEN, y, { width: CONTENIDO, height: 66 });
  y += Math.min(66, doc.heightOfString(titulo.texto, { width: CONTENIDO })) + 8;
  doc.font(NEGRITA).fontSize(9.5);
  const anchoEstado = doc.widthOfString(hoja.estado) + 20;
  doc.roundedRect(MARGEN, y, anchoEstado, 18, 9).fill(COLOR.acentoSuave);
  doc.fillColor(COLOR.acento).text(hoja.estado, MARGEN + 10, y + 4.5, { lineBreak: false });
  y += 18 + 26;

  // Línea de tiempo
  dibujarLineaDeTiempo(doc, hoja.linea, y);
  y += 40;

  // Ficha (dos columnas de pares etiqueta/valor) y QR a la derecha
  const anchoFicha = CONTENIDO - (hoja.url ? LADO_QR + 8 * MM : 0);
  const anchoColumna = (anchoFicha - 6 * MM) / 2;
  const yFicha = y;
  let yCol = [y, y];
  hoja.campos.forEach(([etiqueta, valor], k) => {
    const col = k % 2;
    const x = MARGEN + col * (anchoColumna + 6 * MM);
    const ajuste = ajustar(doc, valor, { ancho: anchoColumna, alto: 24, max: 9.5, min: 8, fuente: NORMAL });
    doc.font(NEGRITA).fontSize(6.5).fillColor(COLOR.grisClaro)
      .text(etiqueta.toUpperCase(), x, yCol[col], { width: anchoColumna, characterSpacing: 0.4, lineBreak: false });
    doc.font(NORMAL).fontSize(ajuste.tamano).fillColor(COLOR.tinta).text(ajuste.texto, x, yCol[col] + 9, { width: anchoColumna, height: 24 });
    yCol[col] += 9 + Math.min(24, doc.heightOfString(ajuste.texto, { width: anchoColumna })) + 7;
    if (col === 1) yCol = [Math.max(...yCol), Math.max(...yCol)];
  });
  y = Math.max(...yCol);
  if (hoja.url) {
    const xQr = MARGEN + CONTENIDO - LADO_QR;
    doc.roundedRect(xQr - 4, yFicha - 4, LADO_QR + 8, LADO_QR + 22, 6).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
    dibujarQr(doc, hoja.url, xQr, yFicha, LADO_QR);
    doc.font(NORMAL).fontSize(7).fillColor(COLOR.gris)
      .text('Abrir en el portal', xQr, yFicha + LADO_QR + 5, { width: LADO_QR, align: 'center', lineBreak: false, link: hoja.url });
    y = Math.max(y, yFicha + LADO_QR + 26);
  }
  y += 6;

  // Contacto (abajo, alto acotado) y descripción y observaciones en el espacio que queda
  const limite = PIE - 8 * MM;
  const contacto = ajustar(doc, hoja.contacto.lineas.join('\n'), { ancho: CONTENIDO - 20, alto: 80, max: 9, min: 7.5 });
  doc.font(NORMAL).fontSize(contacto.tamano);
  const altoContacto = 30 + Math.min(80, doc.heightOfString(contacto.texto, { width: CONTENIDO - 20 }));
  const yContacto = limite - altoContacto;
  const disponible = yContacto - 8 - y;
  const altoObs = hoja.observaciones ? Math.min(90, disponible * 0.35) : 0;
  const altoDesc = disponible - altoObs - (hoja.observaciones ? 8 : 0);

  const bloque = (titulo, texto, yBloque, alto) => {
    doc.roundedRect(MARGEN, yBloque, CONTENIDO, alto, 6).fill(COLOR.fondo);
    doc.font(NEGRITA).fontSize(7.5).fillColor(COLOR.gris)
      .text(titulo.toUpperCase(), MARGEN + 10, yBloque + 8, { width: CONTENIDO - 20, characterSpacing: 0.5, lineBreak: false });
    const ajuste = ajustar(doc, texto, { ancho: CONTENIDO - 20, alto: alto - 30, max: 10, min: 8 });
    doc.font(NORMAL).fontSize(ajuste.tamano).fillColor(COLOR.tinta)
      .text(ajuste.texto, MARGEN + 10, yBloque + 22, { width: CONTENIDO - 20, height: alto - 30, align: 'justify' });
  };
  bloque('Descripción', hoja.descripcion, y, altoDesc);
  if (hoja.observaciones) bloque('Observaciones', hoja.observaciones, y + altoDesc + 8, altoObs);

  doc.roundedRect(MARGEN, yContacto, CONTENIDO, altoContacto, 6).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
  doc.font(NEGRITA).fontSize(7.5).fillColor(COLOR.gris)
    .text('CONTACTO DEL ÁREA RESPONSABLE', MARGEN + 10, yContacto + 8, { width: CONTENIDO - 20, characterSpacing: 0.5, lineBreak: false });
  doc.font(NEGRITA).fontSize(9).fillColor(COLOR.tinta)
    .text(hoja.contacto.nombre, MARGEN + 10, yContacto + 18, { width: CONTENIDO - 20, lineBreak: false, ellipsis: true });
  doc.font(NORMAL).fontSize(contacto.tamano).fillColor(COLOR.tinta)
    .text(contacto.texto, MARGEN + 10, yContacto + 29, { width: CONTENIDO - 20, height: 80 });

  // Pie
  doc.rect(MARGEN, PIE - 5 * MM, CONTENIDO, 0.6).fill(COLOR.linea);
  doc.font(NORMAL).fontSize(7.5).fillColor(COLOR.gris)
    .text(`Anexo – Nota Digital N° ${anexo.numeroTexto}`, MARGEN, PIE - 3 * MM, { width: CONTENIDO / 2, lineBreak: false })
    .text(`Hoja ${i + 1} de ${total}`, MARGEN + CONTENIDO / 2, PIE - 3 * MM, { width: CONTENIDO / 2, align: 'right', lineBreak: false });
};

export const renderAnexo = (anexo) => new Promise((resolve, reject) => {
  try {
    // Márgenes en 0: la diagramación es fija y nada se escribe donde PDFKit agregaría una hoja
    const doc = new DocumentoNota({
      size: 'A4', autoFirstPage: false, margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: { Title: `Anexo – Nota Digital ${anexo.numeroTexto}`, Author: 'Dirección de Datos Públicos y Comunicación' }
    });
    const partes = [];
    doc.on('data', parte => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    anexo.hojas.forEach((hoja, i) => {
      doc.addPage();
      dibujarHoja(doc, anexo, hoja, i, anexo.hojas.length);
    });
    doc.end();
  } catch (error) {
    reject(error);
  }
});
```

- [ ] **Step 5: Verificar que pasan** — `node --test tests/notas-anexo.test.js` y `npm test` completo.

- [ ] **Step 6: Commit** (`feat: anexo de los avisos en PDF, una hoja A4 por dataset con QR`)

- [ ] **Step 7: PUNTO DE CONTROL DEL USUARIO (lo hace el controlador, no el implementador).** El controlador genera, con datos reales de la copia local (`fichasDe` todavía no existe: armá las fichas con una consulta de solo lectura en un script del scratchpad), el anexo de uno o dos datasets reales, se lo manda al usuario y **espera su OK o sus cambios de diseño** antes de seguir con la Task 4. Los cambios de diseño que pida se hacen en esta misma tarea (otra ronda del implementador) antes de avanzar.

---

## Task 4: El motor genera, guarda y adjunta el anexo

**Files:**
- Create: `database/updates/migracion-notas-digitales-anexo.sql`
- Modify: `database/schema.sql`, `tests/schema.test.js`
- Modify: `services/notasDigitalesDatos.js` (`fichasDe`)
- Modify: `services/notasDigitales.js` (`prepararContenido`, `generarNota`, `enviarNota`, `ejemplo`, `previewAnexo`)
- Test: `tests/notas-datos.test.js`, `tests/notas-motor.test.js`

**Interfaces:**
- Consumes: Task 3 (`construirAnexo`, `renderAnexo`), Task 2.
- Produces:
  - Columna `notas_digitales.anexo_pdf MEDIUMBLOB NULL` (después de `pdf`).
  - `fichasDe(ids: number[]) → Promise<Map<id, ficha>>` con los campos de la ficha de Task 3.
  - `previewAnexo({ gestion, hoy }) → Promise<Buffer>` (aviso de la vista previa, `N° XX`).
  - `enviarNota(id)` adjunta `Anexo-Nota-Digital-{n}-{aa}.pdf` (en pruebas `Anexo-Nota-Digital-PRUEBA.pdf`) cuando la nota tiene anexo.

- [ ] **Step 1: Migración y esquema**

`database/updates/migracion-notas-digitales-anexo.sql`:

```sql
-- =====================================================
-- RPAD - Notas Digitales: anexo de los avisos (una hoja por dataset)
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 6.7 y 7.1)
-- Requiere migracion-notas-digitales.sql. Ejecutar ANTES de subir el código:
--   mysql -u USUARIO -p NOMBRE_BASE < migracion-notas-digitales-anexo.sql
-- =====================================================

ALTER TABLE `notas_digitales` ADD COLUMN `anexo_pdf` MEDIUMBLOB NULL AFTER `pdf`;
```

En `database/schema.sql`, la misma columna en el `CREATE TABLE notas_digitales`; en `tests/schema.test.js`, que la columna exista. Aplicar a la base local de Docker el `ALTER` (reportar el SQL), con la verificación de `SMTP_HOST` hecha.

- [ ] **Step 2: Tests que fallan**

`tests/notas-datos.test.js`: `fichasDe([id])` devuelve título, descripción, observaciones, temas (por nombre), formatos (`'CSV, XLSX'`, ordenados), gestión y los datos de contacto del área; `fichasDe([])` devuelve un mapa vacío. (Para los formatos y temas usá los catálogos que crea `crearBaseDePrueba`; insertá filas en `dataset_formatos` desde el test.)

`tests/notas-motor.test.js` (con Mailpit, como los tests existentes que leen los adjuntos):
- un aviso enviado por la corrida trae **dos** adjuntos: `Nota-Digital-{n}-{aa}.pdf` y `Anexo-Nota-Digital-{n}-{aa}.pdf`; el anexo tiene tantas hojas como datasets (usá `lineasPorHoja`);
- una reiteración trae **un** adjunto y `anexo_pdf` queda en NULL;
- el reintento de un aviso fallido reenvía el mismo anexo (mismos bytes que `anexo_pdf`);
- "Enviarme una prueba" de un aviso adjunta `Anexo-Nota-Digital-PRUEBA.pdf`; la de una reiteración, no;
- `previewAnexo({ gestion, hoy })` devuelve un PDF (`%PDF-`) y no inserta filas en `notas_digitales`; sin datasets reales usa los de ejemplo (una hoja).

- [ ] **Step 3: Verificar que fallan.**

- [ ] **Step 4: Implementación**

`services/notasDigitalesDatos.js`:

```js
// Ficha completa de cada dataset para el anexo de los avisos (spec 6.7)
export const fichasDe = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query(
    `SELECT d.id, d.titulo, d.descripcion, d.observaciones, d.url_dataset, d.tipo_gestion, f.nombre AS frecuencia_nombre,
            DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_actualizacion,
            DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento,
            tp.nombre AS tema_principal, ts.nombre AS tema_secundario,
            (SELECT GROUP_CONCAT(fo.nombre ORDER BY fo.nombre SEPARATOR ', ')
               FROM dataset_formatos df JOIN formatos fo ON fo.id = df.formato_id WHERE df.dataset_id = d.id) AS formatos,
            a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario, a.telefono_area, a.celular_area,
            a.nombre_contacto, a.telefono_contacto, a.email_contacto
     FROM datasets d
     JOIN frecuencias f ON f.id = d.frecuencia_id
     JOIN areas a ON a.id = d.area_id
     LEFT JOIN temas tp ON tp.id = d.tema_principal_id
     LEFT JOIN temas ts ON ts.id = d.tema_secundario_id
     WHERE d.id IN (?)`,
    [ids]
  );
  return new Map(filas.map(f => [f.id, f]));
};
```

`services/notasDigitales.js`:
- `prepararContenido`: en los avisos agrega `fichas` (en el orden de `datasets`): `fichas: tipo === 'aviso' ? datasets.map(d => fichasPorId.get(d.id)).filter(Boolean) : []` con `fichasPorId = await fichasDe(ids)`.
- `ejemplo(tipo, hoy)`: los datasets de ejemplo llevan los campos de ficha (`descripcion`, `observaciones: null`, `tipo_gestion` según la gestión, `tema_principal: 'Tema de ejemplo'`, `tema_secundario: null`, `formatos: 'CSV'` y los del área de ejemplo) y el resultado devuelve `fichas` con el dataset "a vencer" de ejemplo (ya que el aviso no lleva vencidos). `ejemplo` recibe `gestion` para completar `tipo_gestion`.
- `generarNota`: si `tipo === 'aviso'`, renderiza el anexo **dentro de la transacción, antes del INSERT** (así un anexo que falla no deja una nota numerada sin anexo):

```js
    const anexoPdf = tipo === 'aviso'
      ? await renderAnexo(construirAnexo({ numero, anio, esPrueba, fecha, fichas: contenido.fichas ?? [] }))
      : null;
```

  y agrega `anexo_pdf` a la lista de columnas y `anexoPdf` a los valores del `INSERT`.
- `enviarNota`: seleccionar también `anexo_pdf` y, si existe, agregar el adjunto:

```js
  const sufijo = nota.es_prueba ? 'PRUEBA' : `${nota.numero}-${String(nota.anio).slice(-2)}`;
  const adjuntos = [{ filename: `Nota-Digital-${sufijo}.pdf`, content: nota.pdf, contentType: 'application/pdf' }];
  if (nota.anexo_pdf) adjuntos.push({ filename: `Anexo-Nota-Digital-${sufijo}.pdf`, content: nota.anexo_pdf, contentType: 'application/pdf' });
```

- `previewAnexo`:

```js
// Anexo del aviso de la vista previa (N° XX): no se guarda ni se envía
export const previewAnexo = async ({ gestion, hoy = hoyArgentina() }) => {
  const { fichas } = await contenidoParaMostrar('aviso', gestion, hoy);
  return renderAnexo(construirAnexo({ numero: null, anio: null, fecha: hoy, fichas }));
};
```

- [ ] **Step 5: Verificar que pasan** — archivos tocados y `npm test` completo.

- [ ] **Step 6: Commit** (`feat: el aviso de Notas Digitales se genera, guarda y envía con su anexo`)

---

## Task 5: API y pantalla de Correos

**Files:**
- Modify: `controllers/notasDigitalesController.js` (`listarNotas`, `obtenerNota`, `descargarAnexo`, `verPreviewAnexo`)
- Modify: `routes/index.js`
- Modify: `public/js/api.js`, `public/js/correos.js`, `public/correos.html` (y el `?v=` de `api.js` en **todos** los HTML que lo cargan)
- Test: `tests/notas-api.test.js`

**Interfaces:**
- Consumes: Task 4 (`previewAnexo`, columna `anexo_pdf`).
- Produces: `GET /api/notificaciones/notas-digitales/:id/anexo`, `GET /api/notificaciones/notas-digitales/preview/anexo?gestion=`; `tiene_anexo` (boolean) en cada nota del libro y en el detalle.

- [ ] **Step 1: Tests que fallan** (`tests/notas-api.test.js`, con el patrón del archivo):
- `GET /:id/anexo` de un aviso devuelve `application/pdf` con `Content-Disposition` `attachment; filename="Anexo-Nota-Digital-{n}-{aa}.pdf"` (pruebas: `Anexo-Nota-Digital-PRUEBA-{id}.pdf`); de una reiteración, 404 `{ success: false, error: 'La nota no tiene anexo' }`; de una nota inexistente, 404.
- `GET /preview/anexo?gestion=externa` devuelve un PDF; con `gestion` inválida, 400; no inserta notas.
- El libro y el detalle traen `tiene_anexo` (true en avisos generados por el motor, false en reiteraciones).
- La matriz de permisos incluye las dos rutas nuevas (lector → 403, sin token → 401).

- [ ] **Step 2: Verificar que fallan.**

- [ ] **Step 3: Implementación**
- `listarNotas` y `obtenerNota`: agregar `(n.anexo_pdf IS NOT NULL) AS tiene_anexo` (y convertirlo a boolean en la respuesta), sin traer el blob.
- `descargarAnexo`: igual que `descargarPdf`, con `SELECT numero, anio, es_prueba, anexo_pdf`, el nombre del archivo de arriba y 404 si `anexo_pdf` es NULL.
- `verPreviewAnexo`: valida `GESTIONES.includes(req.query.gestion)` (400 si no), llama a `notas.previewAnexo({ gestion })` y responde `inline; filename="Anexo-vista-previa-{gestion}.pdf"`; ante `ImagenInvalida` no aplica (el anexo no usa imágenes), el resto va a `errorInterno`.
- `routes/index.js`: `router.get('/notificaciones/notas-digitales/preview/anexo', authMiddleware, adminOnly, verPreviewAnexo);` junto a `preview/pdf`, y `router.get('/notificaciones/notas-digitales/:id/anexo', authMiddleware, adminOnly, descargarAnexo);` junto a `/:id/pdf`.
- `public/js/api.js`: `getNotaAnexo(id)` y `previewNotaAnexo(gestion)` con `pedirArchivo`, como `getNotaPdf` y `previewNotaPdf`.
- `public/correos.html`: botón `<button type="button" class="btn btn-outline" id="btn-preview-anexo">Ver anexo</button>` junto a "Ver PDF".
- `public/js/correos.js`:
  - en el libro, si `n.tiene_anexo`, un botón `data-accion="anexo"` ("Anexo") que descarga con el mismo patrón que `pdf` (nombre `Anexo-Nota-Digital-…`);
  - `#btn-preview-anexo` descarga el anexo de la vista previa (con `conBotonBloqueado`) y queda `disabled` cuando `#preview-tipo` no es `aviso` (actualizar al cargar y en el `change` del select).
- Cache-busting: subir `correos.js?v=` y `api.js?v=` (en todos los HTML que cargan `api.js`).

- [ ] **Step 4: Verificar que pasan** — `node --check public/js/correos.js public/js/api.js`, los tests de la API y `npm test` completo.

- [ ] **Step 5: Commit** (`feat: anexo de los avisos en la API y en la pantalla de Correos`)

---

## Task 6: Documentación de la segunda entrega

**Files:**
- Modify: `README.md` (sección "Migración: Notas Digitales" y descripción del cron)

- [ ] **Step 1:** En la sección de Notas Digitales del README:
  - describir que el aviso informa solo datasets a vencer y viaja con el anexo (una hoja A4 por dataset), y que los vencidos sin aviso van a la reiteración;
  - agregar la secuencia de la **segunda entrega**: backup; `mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-notas-digitales-anexo.sql` (antes de subir el código); subir el código; **Run NPM Install** (dependencia nueva `qrcode`); Restart; revisar "Ver PDF" y "Ver anexo" en Correos y enviar una prueba de un aviso.
- [ ] **Step 2:** `npm test` completo en verde; `git diff main --stat` revisado; `git diff main -- . ':!docs' | grep -i -E "gmail|yahoo|\.png|SMTP_PASS="` no devuelve nada.
- [ ] **Step 3: Commit** (`docs: segunda entrega de Notas Digitales en el README`)
