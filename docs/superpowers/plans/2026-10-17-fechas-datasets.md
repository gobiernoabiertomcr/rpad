# Fechas de los datasets: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada pedido de datos diga qué período se solicita. "Registrar actualización" guarda a qué fecha son los datos y propone la próxima fecha, siempre a fin de mes. Admin se renueva y el sitio público distingue "Datos al" de "Cargado en el portal".

**Architecture:** Un módulo puro en el servidor, `services/fechasDatasetReglas.js`, es la única fuente de las reglas de fechas. La API devuelve el pedido, el estado y las opciones ya calculados, y la pantalla los pide (no hay copia de las reglas en el navegador). Los campos nuevos viajan por la doble verificación como los demás, y al aprobar un registro de actualización se escribe el historial. Son tres entregas que se despliegan por separado: 1) reglas, registro y admin; 2) notas y avisos; 3) sitio público y estados.

**Tech Stack:** Node 22, Express 4 (ESM), MariaDB 10.11 con mysql2, vanilla JS, node:test.

**Spec:** `docs/superpowers/specs/2026-10-17-fechas-datasets-design.md`. Mockups: `2026-10-17-fechas-datasets-mockup.html` (admin) y `2026-10-17-fechas-datasets-nota-mockup.html` (nota, anexo y email), en la misma carpeta. Si la spec y un mockup difieren, manda la spec. **Leé la spec antes de cada tarea:** este plan dice qué archivos, nombres y tests; la spec, el comportamiento.

## Global Constraints

- **No romper nada.** Correr `npm test` completo antes y después de cada tarea. Necesita Docker `rpad-db` (3307) y `rpad-mailpit` (1025/8025), y `RPAD_TESTS_DB_LOCAL=1` en `.env`. La base local tiene el dump de producción del 17/10/2026. La línea de base es la del commit 17e1892.
- **Fechas `'AAAA-MM-DD'` sin zona horaria.**
  - Para mostrarlas se corta el texto (`formatoCorto` del servidor o el equivalente del frontend); **nunca `Utils.formatDate`** con un campo nuevo.
  - Hoy, en el servidor, es `hoyArgentina()`. En el navegador, la fecha de Argentina; nunca `toISOString()`.
  - **Febrero va siempre en 28**, también en los años bisiestos, en todas las fechas de esta etapa.
- **Migraciones aditivas** en `database/updates/`, más `database/schema.sql` (`tests/schema.test.js` compara los dos). Cada migración se aplica también en la base local de Docker. Nada de `DROP` ni de renombrar.
- **Validaciones en la API, nunca `CHECK` en la base.** Los tests de notas cargan vencimientos que no son fin de mes por SQL.
- **Se valida solo lo que cambia.** Un dataset viejo con una fecha mala tiene que poder editarse sin tocar esa fecha.
- **El servidor no exige la próxima al crear o editar.** Los tests crean datasets mensuales sin próxima por la API. La exige el formulario, y el servidor solo la exige en `POST /datasets/:id/actualizar`.
- **Orden de los controles de `POST /datasets/:id/actualizar`:** 404 → 409 (bloqueado) → 400 (validación). `doble-verificacion.test.js` manda `{}` a un dataset bloqueado y espera 409.
- **Versiones de caché** (`tests/paginas.test.js`):
  - Si se toca `auth.js`, `main.js` o `api.js`, se sube `VERSION` y el `?v=` de esos tres en **todos** los `.html`.
  - Si se toca el script propio de una pantalla, se sube su `?v=` y se agrega o actualiza su constante en el test.
  - Valores de esta etapa:
    - entrega 1: `VERSION = '20261103'`, `VERSION_ADMIN = '20261103'` (admin.js y admin-fechas.js), `VERSION_PERFIL = '20261103'`;
    - entrega 3: `VERSION = '20261105'` y `VERSION_PUBLICAS = '20261105'` para datasets.js, dataset-detail.js, calendario.js y dashboard.js, que hoy se cargan sin `?v=` y pasan a llevarlo.
- **Estilos nuevos** en el `<style>` de cada página. En admin, con el prefijo `ad-`. No se extrae CSS de Correos ni de Mi Perfil.
- **Lo que arma HTML en el frontend es puro.** El script, al cargarse, solo declara; los tests lo cargan en un `vm`, como `perfil.js` y `correos.js`.
- Español rioplatense, voseo en la interfaz nueva. Sin emojis: íconos Lucide de `Icons` (main.js) o SVG en línea. Todo dato que se muestra pasa por `Utils.escapeHtml`.
- **Repo público.** No se versionan nombres ni emails de personas. Los datos de los datasets sí se versionan.
- Commits en español, con el prefijo `feat:`, `fix:`, `test:` o `chore:` y terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push.

## Review Focus

1. **Navegador argentino entre las 21 y las 24.** La fecha de "Cargado en el portal" por defecto, los selectores y toda fecha `'AAAA-MM-DD'` mostrada tienen que dar el día correcto (no el siguiente ni el anterior). Tests: `hoyEnArgentina` en T7 y `fechaCorta` en T7.
2. **Datos viejos o raros.** Un dataset con `proxima_actualizacion` que no es fin de mes, con `0000-00-00`, NULL o sin `tipo_pedido`:
   - `GET /datasets` no tiene que fallar (el pedido da null o "—");
   - editarlo sin tocar la fecha no da 400.
   Tests en T3 y T4.
3. **Cambios pendientes creados antes del despliegue,** con la forma vieja `{ultima, proxima, notas}`: aprobarlos funciona, sin historial, salvo que la próxima no sea fin de mes, que da 400. `calcularCambios` y Mi Perfil no se rompen con claves faltantes. Tests en T4 y T5.
4. **Febrero y bisiestos.** El selector de mes y año da 28/02 también en 2028, y `sumarMeses` cruza diciembre→enero y llega a febrero bien. Tests en T2 y T7.
5. **Doble clic en "Proponer actualización".** El botón se deshabilita durante el pedido. El servidor ya rechaza el segundo con 409. Test en T9: lo puro que decide si el botón está habilitado.

---

## Entrega 1: reglas, registro y admin

### Task 1: Migración de estructura

**Files:**
- Create: `database/updates/migracion-fechas-datasets.sql`
- Modify: `database/schema.sql`
- Test: `tests/schema.test.js`. Ya compara el schema con la base y el catálogo de frecuencias, en las líneas 198-203.

**Interfaces:**
- Produces:
  - `frecuencias.meses SMALLINT NULL`, después de `dias`;
  - `datasets.datos_al DATE NULL`, después de `ultima_actualizacion`;
  - `datasets.tipo_pedido ENUM('acumulado','foto','anio_anterior','ejercicio','edicion','relevamiento','eventual') NULL`, después de `que_se_solicita`;
  - en `historial_actualizaciones`: `cambio_id INT NULL` (FK `fk_historial_cambio` → `cambios_pendientes(id)` con `ON DELETE SET NULL`), `vencimiento DATE NULL`, `datos_al DATE NULL`, `recibido_el DATE NULL` y `proxima_nueva DATE NULL`;
  - en `notas_digitales_datasets`: `datos_desde DATE NULL`, `datos_hasta DATE NULL` y `datos_solicitados VARCHAR(255) NULL`.

- [ ] Escribir la migración: `ALTER TABLE … ADD COLUMN` más `UPDATE frecuencias SET meses = …` por nombre: Mensualmente 1, Bimestralmente 2, Trimestralmente 3, Cuatrimestralmente 4, Cada medio año 6, Anualmente 12, Cada dos años 24, Cada tres años 36, Cada cuatro años 48, Cada diez años 120. Eventual queda NULL. Tiene que poder correrse en phpMyAdmin tal cual: sin `DELIMITER` y sin `USE`.
- [ ] Actualizar `schema.sql`: las definiciones de las tablas y los `INSERT` del catálogo con `meses`.
- [ ] Extender el test del catálogo en `schema.test.js`:
  - `meses` tiene los valores de arriba y Eventual es NULL;
  - toda frecuencia con `meses <= 12` divide a 12 (`12 % meses === 0`).
- [ ] Aplicar la migración en Docker: `docker exec -i -e MYSQL_PWD=… rpad-db mariadb -uroot datospublicos_mcr_rpad < database/updates/migracion-fechas-datasets.sql`. Correr `node --test tests/schema.test.js` → PASS. Correr `npm test` completo → igual que la línea de base.
- [ ] Commit: `feat: columnas para "Datos al", tipo de pedido, frecuencia en meses e historial de actualizaciones`.

### Task 2: Reglas puras

**Files:**
- Create: `services/fechasDatasetReglas.js`
- Test: `tests/fechas-reglas.test.js`

**Interfaces:**
- Consumes: `esFechaIso` y `formatoCorto` de `services/notasDigitalesCalendario.js`.
- Produces: estos exports. Todas las fechas son `'AAAA-MM-DD'` y ninguna función tira error: si una entrada es inválida, devuelve `null`, `false` o una lista vacía.

| Export | Qué devuelve |
|---|---|
| `TIPOS_PEDIDO` | `['acumulado','foto','anio_anterior','ejercicio','edicion','relevamiento','eventual']` |
| `NOMBRES_TIPO_PEDIDO` | Objeto tipo → nombre en pantalla (spec, sección 5) |
| `finDeMes(anio, mes)` | `string` |
| `esFinDeMes(iso)` | `boolean` |
| `vencimientoDelMes(iso)` | `string \| null` |
| `sumarMeses(iso, n)` | `string \| null` |
| `corteDe(vencimiento)` | `string \| null` |
| `ultimoVencimientoPasado(vencimiento, meses, hoy)` | `string` |
| `tipoSugerido(gestion, meses)` | `string` |
| `tipoEfectivo({ tipo_pedido, tipo_gestion, meses })` | `string`: el guardado o el sugerido |
| `pedido({ vencimiento, tipo, datosAl, meses, hoy })` | `{ desde, hasta, texto } \| null` |
| `cubre(datosAl, vencimiento, tipo, meses, hoy)` | `boolean` |
| `opcionesDeProxima({ vencimiento, tipo, meses, datosNuevo, hoy })` | `Array<{ fecha, motivo, sugerida, advertencia, pideDespues }>` |
| `estadoDelDataset({ proxima, meses, tipoGestion, hoy })` | `{ estado, dias }` |
| `topeDatosAl(tipo, hoy)` | `string`: fin del mes actual, o 31/12 del año siguiente en `ejercicio` |

Detalle de las funciones:
- `pedido` sigue la spec (sección 7, R3 y R7, y la tabla de la sección 5). `texto` usa `formatoCorto`:
  - `Del dd/mm/aaaa al dd/mm/aaaa`
  - `Vigente al dd/mm/aaaa`
  - `Presupuesto del ejercicio aaaa`
  - `Presupuestos de los ejercicios aaaa y aaaa` o `Presupuestos de los ejercicios aaaa a aaaa`
  - `Próxima edición disponible`
  - `Relevamiento actualizado`
  - Para `eventual` devuelve `null`. Con un vencimiento inválido, también `null`.
- `opcionesDeProxima`: el orden y los motivos están en la spec (sección 7). Los `motivo` exactos son:
  - "Siguiente período"
  - "Primer pedido que todavía no llegó"
  - "Mantener: se siguen debiendo datos de lo que se pidió"
  - "Relevamiento más la frecuencia"
  - `advertencia` es "Ya pasó", "Pediría datos que ya llegaron" o "Ya pasó y pediría datos que ya llegaron".
- `estadoDelDataset`:
  - `estado` es uno de: `actualizado`, `proximo`, `atrasado`, `sin-respuesta`, `eventual`, `sin-fecha`;
  - `dias` es el número de días hasta el vencimiento, o `null`;
  - "próximo" es `0 <= dias <= 60`; `dias < 0` da `atrasado` (interna) o `sin-respuesta` (externa);
  - `meses == null` da `eventual`, y sin próxima da `sin-fecha`.

- [ ] **Test 1:** la tabla de casos de la spec (sección 7), fila por fila, con `hoy = '2026-10-17'`. Una aserción por columna: lo que pide hoy, la sugerida, las otras opciones y `pideDespues` cuando la tabla lo dice. Es una sola tabla de casos recorrida con un `for`, no un test por fila copiado a mano.
- [ ] **Test 2:** bordes.
  - `sumarMeses('2027-11-30', 3) === '2028-02-28'` y `sumarMeses('2028-02-28', 1) === '2028-03-31'`.
  - `sumarMeses('2026-12-31', 1) === '2027-01-31'`.
  - `corteDe('2028-03-31') === '2028-02-28'`.
  - `esFinDeMes`: `'2028-02-28'` da true; `'2028-02-29'`, `'2027-03-29'`, `'2026-10-30'`, `'0000-00-00'`, `''` y `null` dan false.
  - `finDeMes(2028, 2) === '2028-02-28'`.
  - `vencimientoDelMes('2026-10-15') === '2026-10-31'`.
- [ ] **Test 3:** `estadoDelDataset`.
  - Vence hoy → `proximo`, con 0 días.
  - Faltan 60 → `proximo`; faltan 61 → `actualizado`.
  - Ayer → `atrasado` (interna) o `sin-respuesta` (externa).
  - `meses` null → `eventual`; próxima null con meses 12 → `sin-fecha`.
- [ ] **Test 4:** `tipoSugerido`: (externa, 3) da `acumulado`; (externa, 24) da `foto`; (interna, 12) da `relevamiento`; (cualquiera, null) da `eventual`. `tipoEfectivo` respeta el guardado.
- [ ] **Test 5:** `topeDatosAl('acumulado', '2026-10-17') === '2026-10-31'` y `topeDatosAl('ejercicio', '2026-10-17') === '2027-12-31'`.
- [ ] Correr `node --test tests/fechas-reglas.test.js`: tiene que fallar porque el módulo no existe. Implementar. Volver a correrlo → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: reglas puras de las fechas de un dataset (pedido, opciones de la próxima y estado)`.

### Task 3: API de lectura y de cálculo

**Files:**
- Modify: `controllers/datasetController.js`: `DATASET_SELECT_QUERY`, `getDatasets` y `getDatasetById`, más dos handlers nuevos.
- Modify: `routes/index.js` y `public/js/api.js`.
- Modify: todos los `public/*.html`, por `VERSION`.
- Modify: `tests/paginas.test.js`, por `VERSION`.
- Test: `tests/fechas-api.test.js` (nuevo, de integración, con `iniciarServidor` y `crearCliente` de `tests/helpers.js`).

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - **Lo que suma cada dataset en `GET /datasets` y `GET /datasets/:id`:**
    - `datos_al`: `'AAAA-MM-DD'` o null. Reemplaza el `Date` que trae `d.*`; se toma de `DATE_FORMAT` en el SELECT.
    - `tipo_pedido`: el efectivo.
    - `tipo_pedido_guardado`: el de la base, que puede ser null.
    - `frecuencia_meses`.
    - `pedido`: `{desde, hasta, texto}` o null.
    - `estado` y `dias_para_vencer`.
    - Hoy = `hoyArgentina()`. Los campos de siempre no cambian, incluidos `proxima_actualizacion` y `ultima_actualizacion` como vienen hoy.
    - Una función local `enriquecer(fila, hoy)` hace todo, y la usan los dos handlers.
  - **`GET /datasets/calculo-pedido?tipo=&meses=&proxima=&datos_al=`** (`authMiddleware, adminOnly`):
    - responde `{ success, data: { pedido } }`;
    - `meses` vacío equivale a null;
    - si `tipo` no está en `TIPOS_PEDIDO`, da 400;
    - **la ruta se declara antes que `/datasets/:id`.**
  - **`GET /datasets/:id/opciones-proxima?datos_al=AAAA-MM-DD`** (`authMiddleware, adminOnly`):
    - responde `{ success, data: { pedido, opciones } }`;
    - si `datos_al` falta, es inválido o no es fin de mes, da 400; si el dataset no existe, 404.
  - **`api.js`:** `API.calculoPedido({ tipo, meses, proxima, datos_al })` y `API.opcionesDeProxima(id, datosAl)`, con el mismo estilo de los métodos que ya tiene el objeto `API`. `VERSION` pasa a `'20261103'` en todos los `.html` y en el test.

- [ ] **Tests de `fechas-api.test.js`:**
  - Un dataset de prueba con `proxima = '2027-01-31'`, `datos_al = '2026-07-31'`, trimestral y externo, cargado por SQL como en `tests/notas-fixtures.js` y con el prefijo `[TEST]`. `GET /datasets/:id` trae `datos_al === '2026-07-31'`, `tipo_pedido === 'acumulado'`, `frecuencia_meses === 3`, `pedido.texto === 'Del 01/01/2026 al 31/12/2026'` y `estado`.
  - Un dataset con `proxima = '2026-03-29'`, que no es fin de mes, no rompe `GET /datasets`.
  - `opciones-proxima`:
    - con `datos_al=2026-09-30` trae la sugerida `2027-04-30` y "Mantener" `2027-01-31`;
    - sin token da 401; con un lector, 403; con `datos_al=2026-09-15`, 400.
  - `calculo-pedido?tipo=foto&meses=24&proxima=2027-03-31` da `pedido.texto === 'Vigente al 28/02/2027'`.
- [ ] Correr el test: tiene que fallar. Implementar. Volver a correrlo → PASS. Correr `npm test` → verde, con `paginas.test.js` en la versión nueva.
- [ ] Commit: `feat: la API de datasets trae "Datos al", el pedido y el estado, y calcula las opciones de la próxima`.

### Task 4: API de escritura, registro de actualización e historial

**Files:**
- Modify: `controllers/datasetController.js`: `hayCambiosReales`, `createDataset`, `updateDataset` y `registrarActualizacion`.
- Modify: `controllers/cambiosPendientesController.js`: `aprobarCambio` y el `INSERT` de `crear`.
- Modify: `controllers/gestionController.js`: "Operador más activo", en las líneas 76-88.
- Test: `tests/doble-verificacion.test.js`, que se reescribe a propósito en las líneas 155-170, y `tests/fechas-api.test.js`, al que se le suman casos.

**Interfaces:**
- Consumes: Task 2 (`esFinDeMes`, `TIPOS_PEDIDO`, `topeDatosAl`, `tipoEfectivo`) y `hoyArgentina`.
- Produces:
  - **`POST` y `PUT /datasets`** aceptan `datos_al` y `tipo_pedido`. La spec (sección 10.1) dice qué validan; el mensaje de cada 400 dice qué campo falló. Este plan solo fija estas reglas:
    - el servidor no exige la próxima (Global Constraints);
    - la coherencia de Eventual se valida sobre el estado final del dataset: lo que llega en el pedido o, si no llega, lo guardado.
  - **`POST /datasets/:id/actualizar`.** Recibe `{ datos_al, cargado_el | fecha_actualizacion, recibido_el?, proxima_actualizacion, notas? }`.
    - Si falta `cargado_el`, se usa `hoyArgentina()`.
    - Crea el cambio `editar` con `datos_nuevos = { ultima_actualizacion, datos_al, proxima_actualizacion, recibido_el, notas, registro_actualizacion: true }` y `datos_anteriores = { ultima_actualizacion, datos_al, proxima_actualizacion }`.
    - **Ya no calcula la próxima con `frecuencias.dias`.**
  - **`aprobarCambio`:**
    - Suma `datos_al` y `tipo_pedido` al `INSERT` de `crear` y a `campos` de `editar`.
    - Antes de aplicar, si `datos_nuevos` trae una `proxima_actualizacion` o un `datos_al` que no son null y no son fin de mes, responde 400 con el mensaje de la spec y no toca nada.
    - Si `datos_nuevos.registro_actualizacion === true`, hace el `INSERT` en `historial_actualizaciones` en la misma transacción. Las columnas están en la spec, sección 10.1.

- [ ] **Reescribir "registrar una actualización y aprobarla mueve las fechas"**: registrar con `{ datos_al: '2026-02-28', cargado_el: '2026-03-15', proxima_actualizacion: '2026-05-31' }` y aprobar. El dataset queda con `ultima = '2026-03-15'`, `datos_al = '2026-02-28'` y `proxima = '2026-05-31'`. El historial tiene una fila con `vencimiento` (la próxima anterior), `datos_al`, `proxima_nueva` y `cambio_id`.
- [ ] **Tests nuevos en `fechas-api.test.js`:**
  - **Registrar da 400 con:**
    - `proxima_actualizacion: '2026-05-29'`;
    - `datos_al` posterior al fin del mes actual;
    - `recibido_el` posterior a `cargado_el`;
    - falta la próxima en un dataset que no es Eventual.
  - **Registrar en un dataset Eventual** sin próxima da 200.
  - **Bloqueo:** con un cambio pendiente, `{}` da 409 (ya existe en `doble-verificacion`; se verifica que siga).
  - **PUT:**
    - `{ proxima_actualizacion: '2026-05-29' }` da 400;
    - `{ titulo }` en un dataset cuya próxima guardada es `'2026-03-29'` da 200;
    - `{ tipo_pedido: 'eventual' }` con una frecuencia mensual da 400.
  - **Aprobar:** un cambio pendiente insertado por SQL con `datos_nuevos.proxima_actualizacion = '2026-05-29'` da 400 y el dataset no cambia. El mismo cambio con la forma vieja `{ultima_actualizacion, proxima_actualizacion: '2026-05-31', notas}` da 200 y no escribe historial.
  - **"Operador más activo"** no cuenta dos veces un registro (la consulta del test, contra la respuesta del endpoint de gestión que lo calcula).
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: registrar una actualización guarda "Datos al" y la próxima elegida, valida fin de mes y escribe el historial`.

### Task 5: Mi Perfil y la comparación de cambios

**Files:**
- Modify: `controllers/cambiosPendientesController.js` (`CAMPOS_DE_FECHA` y las etiquetas de `calcularCambios`).
- Modify: `public/js/perfil.js` (`ETIQUETAS_DE_CAMPO`, el resumen del cambio y la marca de fin de mes) y `public/perfil.html` (versión).
- Test: `tests/cambios-listas-api.test.js` (se ajusta a propósito la línea 150) y `tests/perfil-frontend.test.js`.

**Interfaces:**
- Produces:
  - **Etiquetas:** `ultima_actualizacion` pasa a "Cargado en el portal"; se suman `datos_al` "Datos al", `tipo_pedido` "Tipo de pedido" y `recibido_el` "Recibido el". La clave `registro_actualizacion` **no** se muestra como un campo.
  - **Título:** un cambio con `registro_actualizacion` se titula "Actualización registrada".
  - **Marca:** en la comparación, la próxima nueva que no es fin de mes lleva "No es el último día del mes". La regla de fin de mes se copia como `esFinDeMesTexto`, pura, en `perfil.js`. Es la única excepción a "las reglas no se copian al navegador", porque solo marca.
  - `VERSION_PERFIL = '20261103'`.

- [ ] **Tests:**
  - `calcularCambios` con `datos_al` y `ultima_actualizacion` da las etiquetas nuevas; las fechas se siguen comparando por día.
  - `perfil.js`: un cambio con `registro_actualizacion` se titula "Actualización registrada", y la marca aparece con `'2026-05-29'` y no con `'2026-05-31'` ni con `'2028-02-28'`.
  - Un cambio con la forma vieja, sin las claves nuevas, se muestra como antes.
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: Mi Perfil muestra "Datos al", "Cargado en el portal" y las actualizaciones registradas`.

### Task 6: Migración de datos ("Datos al" y tipo de pedido)

**Files:**
- Create: `database/updates/migracion-fechas-datasets-datos.sql`.
- Create: `scripts/generar-migracion-datos-al.py` (o `.mjs`), que lee la planilla y escribe el SQL. **No se versiona:** va en el scratchpad, y en el repo solo queda el `.sql`.
- Test: `tests/fechas-datos.test.js` (nuevo).

**Interfaces:**
- Consumes: `C:\Users\Mariano\Desktop\rpad-datos-al.xlsx`, hoja "Datos al". La columna A es el id, la H el tipo propuesto, la I la estimación (mm/aaaa), la J la corrección y la K el tipo corregido.
- Produces: por cada uno de los 80 datasets, `UPDATE datasets SET datos_al = ?, tipo_pedido = ? WHERE id = ?;` con literales. Las reglas de cada fila:
  - "Datos al" es la J si está completa y si no la I, convertida a fin de mes con febrero en 28. En `ejercicio` es el 31/12 de ese año.
  - Tipo: la K si está completa, si no la H. El nombre en pantalla se convierte a la clave del enum.
  - **Ruling para "Próxima edición":** 50, 63, 77 y 78 llevan `datos_al = '2022-05-31'` (Censo 2022). El 44 lleva `datos_al = NULL`: el usuario no dio la fecha de la elección y la carga después desde el formulario.
  - Eventuales: se cargan "Datos al" y el tipo `eventual`.
  - La cabecera del archivo comenta qué es, de dónde sale y que va después de la migración de estructura.

- [ ] **Test (`fechas-datos.test.js`)** que lee el `.sql`:
  - hay exactamente un `UPDATE` por id del 1 al 80;
  - todo `datos_al` no nulo es fin de mes (`esFinDeMes`);
  - todo tipo está en `TIPOS_PEDIDO`;
  - los casos: id 10 → 2026-07-31, `acumulado`; id 38 → 2025-05-31, `relevamiento`; id 57 → 2025-12-31, `ejercicio`; id 74 → `anio_anterior`; id 77 → 2022-05-31, `edicion`; id 44 → NULL, `edicion`; id 3 → `foto`; id 66 → `eventual`.
- [ ] Generar el SQL, aplicarlo en Docker y comprobar con `SELECT COUNT(*) … WHERE tipo_pedido IS NULL AND activo = 1` → 0. Correr `npm test` → verde.
- [ ] Commit: `feat: carga inicial de "Datos al" y tipo de pedido de los 80 datasets`.

### Task 7: Funciones puras de admin

**Files:**
- Create: `public/js/admin-fechas.js`
- Test: `tests/admin-frontend.test.js` (nuevo, con el patrón de `vm` de `tests/correos-frontend.test.js:12-67`).

**Interfaces:**
- Consumes: `Utils.escapeHtml` (de `api.js`; en el test se inyecta un `Utils` falso).
- Produces: funciones globales, todas declaradas con `function` para que el `vm` las vea. Ninguna toca el DOM al cargarse.

| Función | Qué hace |
|---|---|
| `hoyEnArgentina(ahora = new Date())` | Devuelve `'AAAA-MM-DD'` con `Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', … })` |
| `fechaCorta(iso)` | `dd/mm/aaaa`, o `'—'` |
| `mesAnio(iso)` | `'ene 2027'` |
| `finDeMesDe(anio, mes)` | Febrero en 28 |
| `opcionesDeMes(seleccionado)` | HTML de `<option>`; los nombres con mayúscula inicial |
| `opcionesDeAnio(desde, hasta, seleccionado)` | HTML de `<option>`, en orden descendente |
| `textoEstado(estado, dias, proxima, tipoGestion, pendiente)` | `{ clase, texto, detalle }`, como en el mockup |
| `htmlDeFila(dataset, { pendiente, esAdmin })` | `<tr>` de la lista, con las columnas de la spec (sección 8.2) |
| `htmlDeTarjeta(dataset, { pendiente, esAdmin })` | La versión para celular |
| `htmlDeOpciones(opciones)` | Las tarjetas de radio del paso 3, más "Otra fecha" |
| `htmlDeCiclo({ datosAl, desde, hasta, proxima, hoy })` | Las bandas y marcas de la línea del ciclo, con posiciones en % |
| `puedeProponer({ opcionElegida, errores, enviando })` | `boolean` |
| `contarPorEstado(datasets, pendientes)` | Los contadores de los filtros |

- [ ] **Tests:**
  - `hoyEnArgentina(new Date('2026-10-18T01:30:00Z')) === '2026-10-17'`, que en Argentina son las 22:30.
  - `fechaCorta('2026-12-31') === '31/12/2026'`, sin corrimiento.
  - `finDeMesDe(2028, 2)` da `'2028-02-28'`.
  - `htmlDeFila`:
    - escapa el título (`<b>` no queda como etiqueta);
    - un pendiente lleva "Cambio pendiente" y los botones `disabled`;
    - con `esAdmin: false` no hay botones;
    - un eventual lleva "Eventual";
    - un ejercicio lleva "Ejercicio 2025".
  - `htmlDeOpciones`: ninguna viene `checked`; la sugerida lleva "Sugerida"; la última es "Otra fecha".
  - `puedeProponer` da false sin opción, con errores o mientras envía.
  - `contarPorEstado` con datos de ejemplo.
- [ ] Correr el test: tiene que fallar. Implementar. Volver a correrlo → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: funciones puras de la lista y el registro de admin`.

### Task 8: Admin, la lista

**Files:**
- Modify: `public/admin.html`: `<style>`, barra, filtros, tabla, pie con "RPAD v1.6.0", el script nuevo y versiones.
- Modify: `public/js/admin.js`: carga, filtros, conservar el contexto y los pendientes.
- Modify: `public/css/main.css`: definir las variables `--mcr-*` y `--radius*` que usa la paginación (líneas 1593-1646).
- Modify: `tests/paginas.test.js` (`VERSION_ADMIN`). Test: `tests/admin-frontend.test.js`.

**Interfaces:**
- Consumes: Task 3 (`estado`, `dias_para_vencer`, `datos_al`, `pedido`, `tipo_pedido`) y Task 7.
- Produces:
  - Los IDs `#filtros-estado` (con `aria-pressed`), `#buscar`, `#filtro-gestion`, `#filtro-tipo` y `#filas-datasets`.
  - Un global `estadoDeLista = { filtro, busqueda, gestion, tipo, pagina }` que se conserva al recargar.

- [ ] Implementar la spec, sección 8.2, y los arreglos 1, 2, 4, 6, 7 y 8 de la sección 8.6.
  - La línea `admin.js:635` pasa adentro de `DOMContentLoaded`.
  - Se borran el CSS muerto (`admin.html:43-108`) y `calcularProximaPropuesta`.
  - Paginación de 25 por página, como hoy.
  - Celular: tarjetas en ≤ 760 px, sin scroll horizontal de la página.
- [ ] **Tests (`admin-frontend.test.js`):**
  - Cargar `admin.js` en el `vm` no tira error: al cargarse solo declara.
  - La prueba de CSS sin uso del `<style>` de `admin.html`, por palabra entera, como `aparece()` en `correos-frontend.test.js:2263-2298`.
  - `paginas.test.js`: `admin.html` carga `admin-fechas.js` y `admin.js` con `?v=20261103`, en ese orden y después de `api.js`.
- [ ] Verificar en el navegador (`preview_start` "rpad", superadmin de prueba local, en escritorio y en 375 px):
  - filtros y contadores;
  - una fila pendiente bloqueada;
  - el lector no tiene acciones;
  - sin errores en la consola.
- [ ] Correr `npm test` → verde. Commit: `feat: admin renovado: lista con filtros por estado, "Datos publicados" y "Próximo pedido"`.

### Task 9: Admin, "Registrar actualización"

**Files:**
- Modify: `public/admin.html`: el modal nuevo reemplaza a `#modal-registrar-actualizacion`, con el mismo id.
- Modify: `public/js/admin.js`: abrir, recalcular con `API.opcionesDeProxima`, proponer, foco y teclado.
- Test: `tests/admin-frontend.test.js`.

**Interfaces:**
- Consumes: Tasks 3, 4 y 7.
- Produces: un `POST /datasets/:id/actualizar` con el cuerpo de la Task 4. El éxito avisa con `showToast` y vuelve a pedir los pendientes.

- [ ] Implementar la spec, sección 8.3, y los arreglos 3 y 5 de la sección 8.6:
  - `role="dialog"`, Escape, clic afuera solo si el clic arranca en el velo (como `correos.js` `presionEnVelo`), retención del foco y vuelta del foco al botón que abrió;
  - verificar el bloqueo antes de abrir;
  - ninguna opción elegida de entrada;
  - "Otra fecha" con mes y año;
  - pedirle al servidor de nuevo con cada cambio de "Datos al";
  - errores dentro del modal;
  - el botón se deshabilita mientras envía.
- [ ] **Tests:** las funciones puras nuevas de esta tarea, por ejemplo `cuerpoDelRegistro(formulario)`, que arma el JSON del POST:
  - "Recibido el" vacío da `null`;
  - "Otra fecha" da el fin de mes elegido;
  - en `ejercicio`, `datos_al` es el 31/12.
- [ ] Verificar en el navegador:
  - Pauta con "Datos al" en septiembre de 2026 muestra la sugerida 30/04/2027 y "Mantener".
  - Parque Automotor con diciembre de 2025 muestra la sugerida 31/01/2027 y la advertencia de 31/01/2025.
  - Proponer crea el cambio (se ve en Mi Perfil) y la fila queda "Cambio pendiente".
  - Rechazar ese cambio desde otro usuario de prueba lo deja como estaba.
- [ ] Correr `npm test` → verde. Commit: `feat: "Registrar actualización" pregunta "Datos al", cuándo llegó y cuándo se cargó, y propone la próxima`.

### Task 10: Admin, el formulario y la importación desde el portal

**Files:**
- Modify: `public/admin.html`: paso 1 (estilo y accesibilidad, mismo flujo), `#modal-dataset` con `fieldset`, "Actualización y pedido", la vista previa y las etiquetas con `for`.
- Modify: `public/js/admin.js`: `openModal`, submit, sugerencia de tipo, coherencia con Eventual, aviso de frases de período, vista previa con `API.calculoPedido` y los chips accesibles.
- Test: `tests/admin-frontend.test.js`.

**Interfaces:**
- Consumes: Task 3 (`API.calculoPedido`), Task 4 (`datos_al` y `tipo_pedido` en POST y PUT) y Task 7.
- Produces: POST y PUT con `datos_al` y `tipo_pedido`, más `ultima_actualizacion` (con la etiqueta "Cargado en el portal") y `proxima_actualizacion` desde los selectores de mes y año.

- [ ] Implementar la spec, sección 8.4.
  - **La importación desde el portal no cambia:** el paso 1 con URL, "Carga manual" y "Siguiente", `GET /andino/fetch` y "Actualizar desde portal" al editar. Solo cambian el estilo, la accesibilidad y los textos que la spec menciona.
- [ ] **Tests (funciones puras):**
  - `frasesDePeriodo(texto)` encuentra las 6 frases de la spec sin distinguir mayúsculas.
  - `avisarFrases(tipo)` da false en `relevamiento`, `edicion` y `eventual`.
  - `tiposPermitidos(meses)`: sin `eventual` si hay meses; solo `eventual` si no hay.
  - `cuerpoDelDataset(formulario)` arma las fechas como fin de mes.
- [ ] Verificar en el navegador:
  - **Nuevo dataset:** el paso 1 importa desde una URL real del portal (`https://datos.comodoro.gov.ar/dataset/presupuesto-municipal`) y llega al paso 2 con título, descripción y formatos. "Carga manual" abre "Nuevo dataset".
  - **Editar Pauta:** aparecen el aviso por "nuevo período" y la vista previa. Al cambiar el tipo, la vista previa cambia.
  - **Eventual:** al elegir la frecuencia Eventual, el tipo queda fijo y la próxima se deshabilita.
  - **Guardar** crea un cambio pendiente.
- [ ] Correr `npm test` → verde. Commit: `feat: formulario del dataset con "Actualización y pedido" y vista previa de la nota`.

**Fin de la entrega 1.** Anotar en el ledger el commit, que será el punto de corte del kit 1.

---

## Entrega 2: notas y avisos

### Task 11: Datos de las notas y pedido guardado

**Files:**
- Modify: `services/notasDigitalesDatos.js` (`COLUMNAS_DATASET`, `fichasDe`, `seleccionarParaAviso` y `seleccionarParaReiteracion`).
- Modify: `services/notasDigitales.js` (`fichasDelAviso`, el `INSERT` de `notas_digitales_datasets` en 153-156, los ejemplos de la vista previa en 541-581 y `obtenerNota`).
- Test: `tests/notas-datos.test.js` y `tests/notas-motor.test.js`.

**Interfaces:**
- Consumes: `pedido` y `tipoEfectivo` (Task 2), y las columnas de la Task 1.
- Produces:
  - Cada ficha trae `meses`, `datos_al`, `tipo_pedido` (el efectivo) y `pedido` (`{desde, hasta, texto}`), calculado con el `hoy` de la corrida.
  - La reiteración **recalcula** el pedido (spec, sección 9).
  - `notas_digitales_datasets` guarda `datos_desde`, `datos_hasta` y `datos_solicitados` (el `texto`) en avisos y reiteraciones.
  - Los ejemplos de la vista previa vencen a fin de mes y traen `datos_al` y `tipo_pedido`.

- [ ] **Tests:**
  - Un aviso generado guarda los tres campos con los valores de `pedido`.
  - Una reiteración de un dataset vencido hace dos ciclos pide hasta el último corte cerrado (R7), y la fila de esa reiteración lo guarda.
  - Las filas de notas viejas (insertadas sin esos campos) siguen leyéndose.
  - Los ejemplos de la vista previa vencen a fin de mes.
  - Los tests actuales de selección (ventanas 60/40, Eventual excluido, `0000-00-00`) siguen pasando sin cambios.
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: las Notas Digitales calculan y guardan los datos solicitados de cada dataset`.

### Task 12: Contenido de la nota, PDF y nota de auditoría

**Files:**
- Modify: `services/notasDigitalesContenido.js` (`PARRAFO_INICIAL`, `construirNota`, `TIPO_DE_CAMBIO`, `QUE_IMPLICA` y `detalleDelCambio`).
- Modify: `services/notasDigitalesPdf.js` (`PROPORCIONES`).
- Test: los listados en la spec, sección 14, "Que cambian a propósito": `notas-contenido`, `notas-pdf` y `notas-motor`.

**Interfaces:**
- Consumes: la Task 11 (`ficha.pedido`).
- Produces: las columnas, los textos y las proporciones de la spec, sección 9:
  - el aviso tiene 5 columnas, y la reiteración 7, con "Informado en" al final;
  - `PROPORCIONES[5]`;
  - la frase nueva va solo en el aviso externo;
  - "Actualización" en la nota de auditoría, para los cambios con `registro_actualizacion`.

- [ ] Ajustar a propósito los tests que fijan las columnas y los textos viejos. Agregar:
  - las columnas exactas del aviso y la reiteración;
  - el `colspan` del antecedente igual a la cantidad de columnas;
  - la frase solo en el externo;
  - la maquetación del PDF con 1 a 30 datasets en 5 columnas, sin cortar fechas ni palabras, como el test de 7 columnas;
  - la auditoría con el título "Actualización" y sus filas.
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde.
- [ ] Verificar la vista previa de Correos en el navegador: aviso externo, interno y reiteración, en HTML y PDF. Tiene que coincidir con el mockup de la nota.
- [ ] Commit: `feat: la nota dice los datos solicitados y la fecha sugerida de envío`.

### Task 13: Anexo

**Files:**
- Modify: `services/notasDigitalesContenido.js` (`construirAnexo` y `estadoDelAnexo`).
- Modify: `services/notasDigitalesAnexo.js` (`prepararCabecera` y `dibujarLineaDeTiempo`).
- Test: `tests/notas-anexo.test.js`.

**Interfaces:**
- Consumes: la Task 11.
- Produces:
  - `hoja.pedido` (texto);
  - el estado "Fecha sugerida de envío: dd/mm/aaaa · faltan N días" ("Vence hoy" sigue igual);
  - el recuadro "DATOS SOLICITADOS" en la cabecera, debajo del estado;
  - la línea de tiempo arranca en `datos_al`, con el rótulo "Datos publicados al", o en la fecha de carga, con "Cargado en el portal", si no hay `datos_al`.

- [ ] Ajustar el orden vertical que fija el test (240-258), con el recuadro entre el estado y la línea de tiempo, y los rótulos. Agregar:
  - con un pedido largo, la hoja sigue entrando en una A4, sin superposiciones (tests de 308-358);
  - sin `datos_al`, se usa el rótulo "Cargado en el portal".
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde. Abrir el anexo de la vista previa en el navegador.
- [ ] Commit: `feat: el anexo muestra los datos solicitados y arranca la línea de tiempo en los datos publicados`.

### Task 14: Email a las áreas (40 días)

**Files:**
- Modify: `services/avisosDiariosService.js` (`datasetsExternosPorArea`).
- Modify: `services/emailTemplates.js` (`areaAviso40diasTemplate`).
- Modify: `controllers/notificacionesController.js` (`AREA_DE_EJEMPLO`).
- Test: `tests/email-diseno.test.js` (se ajusta a propósito la línea 206) y `tests/avisos-diarios.test.js`.

**Interfaces:**
- Consumes: `pedido` (Task 2).
- Produces: dos renglones más en cada tarjeta, "Datos que se solicitarán: {pedido.texto con minúscula inicial}" y "Fecha sugerida de envío: dd/mm/aaaa". Si el pedido es null, el renglón no aparece.

- [ ] Tests:
  - el texto visible exacto con los dos renglones;
  - un dataset sin pedido no lleva el renglón;
  - el ejemplo de la vista previa los muestra.
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: el aviso a las áreas dice qué datos se van a solicitar`.

### Task 15: Migración de textos de "Qué se solicita"

**Files:**
- Create: `database/updates/migracion-fechas-datasets-textos.sql`
- Test: `tests/fechas-datos.test.js`, al que se le suman casos.

**Interfaces:**
- Consumes: `C:\Users\Mariano\Desktop\rpad-revision-textos-y-grilla.xlsx`, hoja "Qué se solicita". La columna A es el id y la D, el texto aprobado. El usuario aprobó los 26 sin cambios.
- Produces: 26 `UPDATE datasets SET que_se_solicita = ? WHERE id = ?;`, con los literales escapados para MariaDB (comillas simples duplicadas).

- [ ] **Test:**
  - hay 26 `UPDATE`, con los ids 1-11, 13, 23, 35, 36, 46, 48, 52, 57, 61 y 69-74;
  - ningún texto contiene las 6 frases de período de la spec (sección 8.4);
  - el 38 no está.
- [ ] Generar el SQL, aplicarlo en Docker y correr `npm test` → verde.
- [ ] Commit: `feat: los "Qué se solicita" dejan de decir el período (lo dice la nota)`.

**Fin de la entrega 2.** Anotar el commit en el ledger.

---

## Entrega 3: sitio público y estados

### Task 16: Estados y tasa en el servidor

**Files:**
- Modify: `controllers/datasetController.js` (`getEstadisticas` y `getDatasets` con el filtro `estado`; se borra el `calcularEstado` local).
- Modify: `controllers/reportesController.js` (su `calcularEstado`, la tasa en 255 y "Datos al" donde lista la próxima).
- Test: `tests/fechas-api.test.js` y `tests/reportes.test.js`.

**Interfaces:**
- Consumes: `estadoDelDataset` (Task 2).
- Produces: las estadísticas con `eventual` aparte. La tasa es (actualizados + próximos) / (total − eventuales), igual en el tablero y en el PDF. El filtro `?estado=` acepta `eventual`.

- [ ] **Tests:**
  - con un set controlado (base de prueba con `crearBaseDePrueba`, o datasets `[TEST]` contados aparte), la tasa excluye a los eventuales;
  - el reporte PDF se genera y su texto (con `tests/pdf-lector.js`) trae "Datos al".
- [ ] Correr los tests: tienen que fallar. Implementar. Volver a correrlos → PASS. Correr `npm test` → verde.
- [ ] Commit: `feat: un solo cálculo de estado en el servidor; la tasa de actualización deja afuera a los eventuales`.

### Task 17: Sitio público

**Files:**
- Modify: `public/dataset.html` y `public/js/dataset-detail.js`.
- Modify: `public/js/datasets.js` (lista, CSV, columna "Área" y `?mes=`), `public/js/calendario.js` y `public/js/dashboard.js` (el mes en curso, en la línea 363).
- Modify: `public/js/api.js` (`Utils.calcularEstado` alineado: un Eventual da `eventual`).
- Modify: todos los `.html` (`VERSION = '20261105'` y `?v=` en los cuatro scripts públicos) y `tests/paginas.test.js`.
- Test: `tests/frontend-utils.test.js` y `tests/publico-frontend.test.js` (nuevo, si hace falta).

**Interfaces:**
- Consumes: el campo `estado` de la API (Task 3), y `datos_al`, `pedido`, `tipo_pedido` y `frecuencia_meses`.
- Produces: la spec, sección 11. Se borran las copias de `calcularEstado` de `datasets.js`, `dataset-detail.js` y `calendario.js`; usan `d.estado`.

- [ ] **Tests:**
  - `Utils.calcularEstado` con Eventual da `eventual`, y los demás casos como antes;
  - las funciones puras nuevas de formato, como "Datos al" o "Próxima actualización prevista: enero de 2027";
  - el CSV con las columnas nuevas, si se extrae la función que lo arma;
  - `paginas.test.js` con las versiones nuevas.
- [ ] Verificar en el navegador:
  - el detalle de Gasto Público (datos al 31/12/2025, cargado el 26/03/2026, próxima prevista);
  - el listado (filtro por mes desde el tablero y la columna Área);
  - el tablero (el mes en curso y la tasa del 80 % con los datos locales);
  - el calendario sin errores.
- [ ] Correr `npm test` → verde. Commit: `feat: el sitio público distingue "Datos al", "Cargado en el portal" y la próxima prevista`.

### Task 18: Documentación

**Files:**
- Modify: `CLAUDE.md`: reglas de fechas, tipos de pedido, `fechasDatasetReglas.js`, historial y `admin-fechas.js`.
- Modify: `README.md`: árbol de archivos y migraciones nuevas.

- [ ] Documentar sin repetir la spec: una línea por concepto, como las secciones vecinas de `CLAUDE.md`. Correr `npm test` → verde.
- [ ] Commit: `chore: documentación de las fechas de los datasets`.

**Fin de la entrega 3.** Anotar el commit en el ledger.

---

## Después del plan (lo hace quien coordina, no un subagente)

- Revisión final de toda la rama.
- Un kit por entrega en el Escritorio, armado con `git archive` de los archivos de cada tramo y su `PASOS.txt`:
  - backup;
  - las consultas previas de la spec (sección 13);
  - el SQL en phpMyAdmin;
  - subir los archivos;
  - Restart;
  - verificación;
  - cómo volver atrás.
- Sin merge ni push sin el OK del usuario.
