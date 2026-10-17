# Fechas de los datasets: datos solicitados, registro de actualizaciones y admin renovado

Fecha: 17/10/2026. Rama sugerida: `feat/fechas-datasets`.

Mockups aprobados por el usuario, con datos reales de producción:
- [2026-10-17-fechas-datasets-mockup.html](2026-10-17-fechas-datasets-mockup.html): admin, con la lista, "Registrar actualización" y la sección "Actualización y pedido" del formulario. Tiene el cálculo funcionando.
- [2026-10-17-fechas-datasets-nota-mockup.html](2026-10-17-fechas-datasets-nota-mockup.html): la nota de aviso, la reiteración, el anexo y el email a las áreas.

Este documento manda sobre los mockups cuando difieren.

Análisis previo: cinco agentes revisaron las notas, las fechas, admin, los datos de producción y las demás pantallas. Sus hallazgos están resumidos acá; las líneas citadas (`archivo:línea`) son de `main` en 7b33913.

---

## 1. Intención

Una Nota Digital le pide a un área que actualice un dataset, pero hoy no le dice **qué datos** necesitamos. La única fecha "de datos" que aparece es "Última actualización", que en realidad es el día en que se cargó en el portal. Además, la fecha de próxima actualización se calcula sumando días, así que casi nunca cae a fin de mes, y se corrige a mano o por SQL sin dejar rastro.

El usuario quiere que el sistema:
- entienda sus reglas de fechas (sección 2);
- diga en cada pedido el período exacto de datos que se solicita;
- registre a qué fecha son los datos que llegan;
- calcule la próxima fecha y la proponga sin decidir solo;
- tenga una pantalla de admin clara y prolija para todo esto.

Es la base del **seguimiento de la "vida" de cada dataset**, que viene después (sección 16). Por eso cada actualización tiene que quedar registrada con sus fechas.

## 2. Reglas del negocio (las dio el usuario)

**R1. Próxima actualización.** `datasets.proxima_actualizacion` es **siempre el último día de un mes**: 31/1, 28/2, 31/3, 30/4, etc. **Febrero va siempre en 28**, también en los años bisiestos. Funciona como "fecha sugerida de envío" de los datos.

**R2. Corte.** Si la próxima es el último día del mes M, los datos se piden **al último día del mes M−1**. El área tiene un mes para prepararlos y hacer el circuito administrativo sin figurar vencida. Ejemplos:
- 31/01/2027 → datos al 31/12/2026.
- 31/07/2026 → datos al 30/06/2026.

**R3. Período: acumulado del año y todo lo que falta.** Para los datasets de tipo "acumulado" (sección 5), el período va del 1/1 del año del corte hasta el corte. Ejemplos:
- Pauta trimestral, próxima 31/10/2026 → del 01/01/2026 al 30/09/2026.
- Pedidos de Acceso cuatrimestral, próxima 31/05/2026 → del 01/01/2026 al 30/04/2026.
- Con la próxima en enero, el período es el año anterior completo.

**Se pide siempre todo lo que falta.** Si los datos publicados terminan antes del 1/1 del año del corte, el período arranca el día siguiente a los últimos datos publicados, aunque cruce el año. Ejemplos:
- Parque Automotor tiene datos al 31/12/2022 → se pide del 01/01/2023 al 31/12/2025.
- Pauta tiene datos al 30/09/2026 y avanzó a 30/04/2027 → se pide del 01/10/2026 al 31/03/2027.

**R4. "Cargado en el portal".** `datasets.ultima_actualizacion` es solo el día en que se cargó en el Portal de Datos Abiertos, **no la fecha de los datos**. Ejemplo: Gasto Público se cargó el 26/03/2026 con datos al 31/12/2025.

**R5. "Datos al".** Es el día al que llegan los datos publicados hoy. **Siempre es fin de mes**, con febrero en 28. Es un dato nuevo y se guarda (sección 6). Ejemplo: un dataset llega el 15/3, se carga en el portal el 16/3 y sus datos son al 31/12 del año anterior.

**R6. Gestión interna.** Son relevamientos de campo propios: la fecha de los datos es cuando se hizo el relevamiento, sin un corte rígido. "Datos al" es el fin del mes del relevamiento.

**R7. Vencidos.** Si el vencimiento ya pasó, el pedido llega hasta el corte del **último vencimiento del ciclo que ya pasó**, que se obtiene sumando la frecuencia al vencimiento original mientras siga en el pasado. Por eso Parque Automotor, que vencía el 31/01/2024, hoy pide hasta el 31/12/2025.

**R8. Avisos.** Siguen saliendo como hoy: 60 días antes si la gestión es interna y 40 si es externa. El usuario lo confirmó: el aviso externo llega más o menos al cierre del período. La nota tiene que separar **qué datos** se piden de **la fecha sugerida de envío**, con un tono que no apure. No se usa "plazo de entrega" (sección 9).

## 3. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- La nota, la reiteración, el anexo y el email a las áreas dicen qué datos se solicitan.
- Cada dataset tiene un tipo de pedido y un "Datos al". La próxima fecha es siempre fin de mes y el servidor lo valida.
- "Registrar actualización" pregunta a qué fecha son los datos, cuándo llegaron y cuándo se cargaron. Propone la próxima con opciones, sin elegirla de antemano, y todo pasa por la doble verificación.
- Cada actualización aprobada queda en el historial, con sus fechas.
- Admin renovado: lista, registro y formulario, como en el mockup, con los arreglos de la sección 8.6.
- El sitio público distingue "Datos al", "Cargado en el portal" y "Próxima actualización prevista".

**No objetivos**
- La pantalla de "vida del dataset". Es para después, pero el modelo de esta etapa tiene que servirle (sección 16).
- Cambiar las ventanas de los avisos (60/40), la numeración del libro, la firma, las licencias o la auditoría.
- Cambiar el umbral de "Próximo a vencer" (60 días).
- Corregir a mano las fechas viejas de `ultima_actualizacion`. Ver la sección 12.4.

**Anti-objetivos**: aunque ande, sería un fracaso si pasa cualquiera de estas cosas.
- Que se rompa algo de lo que ya funciona, o que cambie lo que dice una nota que ya se envió (el Libro sirve lo guardado).
- Que se guarde una próxima que no es fin de mes.
- Que el sistema elija solo la próxima fecha al registrar una actualización: siempre propone y la persona elige.
- Que un texto de la nota se contradiga, por ejemplo con "el trimestre siguiente" en "Qué se solicita" junto a un período explícito.
- Que el nombre "Última actualización" siga sugiriendo que es la fecha de los datos.
- Que se pierda o cambie la importación desde el portal: el paso 1 de "Nuevo dataset" y "Actualizar desde portal" al editar.

## 4. Restricciones

- **No romper nada.** Correr `npm test` completo antes y después de cada tarea. Necesita `docker compose up -d`, `RPAD_TESTS_DB_LOCAL=1` y Mailpit. La base local tiene el dump de producción del 17/10/2026.
- **Migraciones aditivas**, en `database/updates/`, más `database/schema.sql`. `tests/schema.test.js` compara los dos. En producción se corren en phpMyAdmin, antes que el código. Nada de `DROP` ni de renombrar columnas.
- **Producción es cPanel sin terminal.** Los archivos se suben con el Administrador de archivos, el SQL va por phpMyAdmin y el Restart se hace en "Setup Node.js App". Hay que entregar un kit por entrega en el Escritorio, como los anteriores (zip con `git archive` y `PASOS.txt`).
- **Repo público.** No se versionan nombres ni emails de personas. Los datos de los datasets (fechas, tipo de pedido, textos) no son personales y pueden ir en `database/updates/`.
- **Fechas sin zona.** Todo se maneja como texto `'AAAA-MM-DD'` y se formatea cortando el texto, como `formatoCorto` (`services/notasDigitalesCalendario.js`) o `fecha()` de `correos.js`. **Nunca `Utils.formatDate` para los campos nuevos**: con `'AAAA-MM-DD'` en el navegador argentino muestra el día anterior. "Hoy" es `hoyArgentina()` en el servidor. En el navegador hay que calcular la fecha de Argentina; no sirve `toISOString()`, que después de las 21 da mañana.
- **Validación en la API, no en la base.** Los tests de notas cargan vencimientos que no son fin de mes directamente por SQL (`tests/notas-fixtures.js`), así que no puede haber `CHECK` en la base.
- **Validar solo lo que cambia.** Al editar un dataset, la regla de fin de mes se aplica a `proxima_actualizacion` y `datos_al` **solo si vienen en el pedido y cambian**. Así un dataset viejo con una fecha mala no bloquea la edición de su título.
- **Frontend: cada página carga `config.js → auth.js → main.js → api.js → página.js`** (en admin, el script nuevo de la sección 8.1 va entre `api.js` y `admin.js`). Si se toca `auth.js`, `main.js` o `api.js`, se sube su `?v=` en **todas** las páginas y en `VERSION` de `tests/paginas.test.js`. Si se toca el script de una pantalla, se sube su `?v=` y se agrega su constante en ese test, como `VERSION_CORREOS`. `main.css` no tiene `?v`.
- **Estilos nuevos** en el `<style>` de cada página, con el prefijo `ad-` en admin. No se extrae CSS de Correos ni de Mi Perfil: sus tests leen su `<style>`.
- **Lo que arma HTML es puro y testeable** (como `perfil.js` y `correos.js`). El script, al cargarse, solo declara.
- Español rioplatense, voseo en la interfaz nueva, sin emojis (íconos Lucide). Todo dato que se muestra pasa por `Utils.escapeHtml`.

## 5. Tipos de pedido

Cada dataset tiene un **tipo de pedido**, que define qué dice "Datos solicitados".

| Valor (`tipo_pedido`) | Nombre en pantalla | Qué dice la nota | Para qué |
|---|---|---|---|
| `acumulado` | Acumulado | `Del dd/mm/aaaa al dd/mm/aaaa` (R3, R7) | Flujos: pauta, gasto, pedidos, consumos |
| `foto` | Foto al corte | `Vigente al dd/mm/aaaa` (el corte) | Listados, padrones y nóminas |
| `anio_anterior` | Año anterior completo | `Del 01/01/aaaa al 31/12/aaaa`, el último año calendario cerrado antes del corte, o desde lo que falta | TMDA: Vialidad consolida el año en mayo o junio del siguiente |
| `ejercicio` | Ejercicio que empieza | `Presupuesto del ejercicio aaaa` (año del vencimiento). Si falta más de uno: `Presupuestos de los ejercicios 2026 y 2027`, o `… 2025 a 2027` | Presupuestos |
| `edicion` | Próxima edición | `Próxima edición disponible` | Censos y elecciones: dependen del INDEC o del Tribunal |
| `relevamiento` | Relevamiento interno | `Relevamiento actualizado` | Gestión interna (R6) |
| `eventual` | Eventual | `—` (sin pedido automático) | Frecuencia "Eventual" |

**Tipo sugerido.** Lo calcula `tipoSugerido(gestion, meses)`:
- Eventual → `eventual`.
- Gestión interna → `relevamiento`.
- Externa, de 12 meses o menos → `acumulado`.
- Externa, de más de 12 meses → `foto`.

El formulario lo propone y avisa cuando el elegido es distinto ("Usar el sugerido"). Se guarda el tipo elegido, **no se deriva al leer**.

## 6. Modelo de datos (migración `migracion-fechas-datasets.sql`, aditiva)

- **`frecuencias.meses SMALLINT NULL`**, después de `dias`. Valores: Mensualmente 1, Bimestralmente 2, Trimestralmente 3, Cuatrimestralmente 4, Cada medio año 6, Anualmente 12, Cada dos años 24, Cada tres años 36, Cada cuatro años 48, Cada diez años 120, Eventual NULL.
  - `dias` queda: lo usan unos diez filtros (`f.dias IS NOT NULL` = no eventual) y el frontend.
  - Toda la aritmética nueva usa `meses`. Un test sobre el catálogo exige que toda frecuencia de 12 meses o menos divida a 12.
- **`datasets.datos_al DATE NULL`**, después de `ultima_actualizacion`. R5: siempre fin de mes; NULL = sin dato.
- **`datasets.tipo_pedido ENUM('acumulado','foto','anio_anterior','ejercicio','edicion','relevamiento','eventual') NULL`**, después de `que_se_solicita`. Si es NULL, se usa `tipoSugerido` y así un dataset sin cargar nunca falla. La carga inicial lo completa en los 80.
- **`historial_actualizaciones`** suma estas columnas, todas NULL:
  - `cambio_id INT NULL`: FK a `cambios_pendientes(id)` con `ON DELETE SET NULL`.
  - `vencimiento DATE NULL`: la próxima que se cumplió. Es la clave del ciclo, la misma que `notas_digitales_datasets.vencimiento`.
  - `datos_al DATE NULL`.
  - `recibido_el DATE NULL`.
  - `proxima_nueva DATE NULL`.
  - `fecha_actualizacion` sigue siendo la fecha de carga en el portal.
- **`notas_digitales_datasets`** suma `datos_desde DATE NULL`, `datos_hasta DATE NULL` y `datos_solicitados VARCHAR(255) NULL`: el pedido **tal como salió**, congelado. Las filas de las notas 1/26 y 2/26 quedan en NULL, porque esas notas no dijeron ningún período y completarlas sería inventar.
- **Carga de datos.** Archivo aparte: `migracion-fechas-datasets-datos.sql`. Ver la sección 12.

## 7. Reglas puras: `services/fechasDatasetReglas.js`

Es un módulo nuevo, puro, sin pool ni `Date` local, al estilo de `auditoriaReglas.js`. Todas las fechas son `'AAAA-MM-DD'`. Usa `esFechaIso` de `notasDigitalesCalendario.js`.

**Funciones auxiliares**
- `finDeMes(anio, mes)`: con febrero en 28.
- `esFinDeMes(iso)`: '2028-02-28' sí; '2028-02-29', '2027-03-29' y '2026-10-30' no.
- `vencimientoDelMes(iso)`.
- `sumarMeses(iso, n)`: sobre el índice `año × 12 + mes − 1`, nunca con `setMonth`.
- `corteDe(vencimiento)`.
- `ultimoVencimientoPasado(vencimiento, meses, hoy)`.
- `tipoSugerido(gestion, meses)`.

**`pedido({ vencimiento, tipo, datosAl, meses, hoy })`**
- Devuelve `{ desde, hasta, texto } | null`.
- `hasta` es lo que hay que recibir para dar el pedido por cubierto:
  - `acumulado` y `foto`: el corte;
  - `anio_anterior`: el 31/12 del año pedido;
  - `ejercicio`: el 31/12 del año del vencimiento;
  - `edicion`, `relevamiento` y `eventual`: `null`.
- Aplica R7 si `vencimiento < hoy`, y "lo que falta" si `datosAl + 1 día < desde`.
- Los textos exactos están en la sección 5, con fechas `dd/mm/aaaa`.

**`cubre(datosAl, vencimiento, tipo, meses)`**: es verdadero si `pedido(...).hasta` no es nulo y `datosAl >= hasta`.

**`opcionesDeProxima({ vencimiento, tipo, meses, datosNuevo, hoy })`** devuelve la lista de opciones `[{ fecha, motivo, sugerida, advertencia, pideDespues }]`, en este orden:

| Tipo | Opciones |
|---|---|
| `relevamiento` | Una sola, sugerida: `sumarMeses(datosNuevo, meses)`. |
| `edicion` | Una sola, sugerida: `sumarMeses(vencimiento, meses)`. |
| `eventual` | Ninguna, lista vacía. |
| Los demás | Ver abajo. |

Para los demás tipos:
1. `siguiente = sumarMeses(vencimiento, meses)`. `primero` = el primer vencimiento del ciclo, empezando por el actual, que **no** queda cubierto por `datosNuevo`.
2. **Sugerida:** el mayor de los dos. Si es `siguiente`, el motivo es "Siguiente período". Si no, "Primer pedido que todavía no llegó".
3. **Mantener el vencimiento actual:** se ofrece si `datosNuevo` no cubre el pedido actual. Motivo: "Se siguen debiendo datos de lo que se pidió".
4. **Siguiente período no sugerido:** si `siguiente` no es la sugerida, se ofrece igual con `advertencia`: "ya pasó" o "pediría datos que ya llegaron".
5. **Otra fecha:** la agrega la interfaz.

Cada opción trae `pideDespues = pedido({ vencimiento: fecha, …, datosAl: datosNuevo }).texto`.

**Casos que tienen que estar en los tests**, con hoy = 2026-10-17:

| Caso | Vence | Datos al | Llegan datos al | Pide hoy | Sugerida | Otras |
|---|---|---|---|---|---|---|
| Pauta, normal (acumulado, 3 meses) | 2027-01-31 | 2026-07-31 | 2026-12-31 | Del 01/01/2026 al 31/12/2026 | 2027-04-30 | — |
| Pauta, entrega parcial | 2027-01-31 | 2026-07-31 | 2026-09-30 | ídem | 2027-04-30; la nota siguiente pide del 01/10/2026 al 31/03/2027 | Mantener 2027-01-31 |
| Parque Automotor (acumulado, 12) | 2024-01-31 | 2022-12-31 | 2025-12-31 | Del 01/01/2023 al 31/12/2025 | 2027-01-31; la nota siguiente pide del 01/01/2026 al 31/12/2026 | 2025-01-31, con la advertencia "ya pasó, pediría datos que ya llegaron" |
| Parque Automotor, solo 2023 | 2024-01-31 | 2022-12-31 | 2023-12-31 | ídem | 2025-01-31 (pasada); la nota siguiente pide del 01/01/2024 al 31/12/2025 | — |
| TMDA (anio_anterior, 12) | 2027-06-30 | 2025-12-31 | 2026-12-31 | Del 01/01/2026 al 31/12/2026 | 2028-06-30 | — |
| Espacios Verdes (relevamiento, 24) | 2027-03-31 | 2026-06-30 | 2027-03-31 | Relevamiento actualizado | 2029-03-31 | — |
| Presupuesto con perspectiva de género (ejercicio) | 2027-01-31 | 2025-12-31 | — | Presupuestos de los ejercicios 2026 y 2027 | — | — |
| Presupuesto Municipal (ejercicio, vencido) | 2026-01-31 | 2025-12-31 | 2026-12-31 | Presupuesto del ejercicio 2026 | 2027-01-31 | — |
| Gasto Público (acumulado, 6, vencido) | 2026-07-31 | 2025-12-31 | — | Del 01/01/2026 al 30/06/2026 | — | — |
| Funcionarios Públicos (foto, 6) | 2026-07-31 | 2025-12-31 | — | Vigente al 30/06/2026 | — | — |

Esta tabla prueba las funciones puras, que reciben `hoy` como parámetro. Los casos en que "Llegan datos al" es posterior a hoy, como Pauta normal y TMDA, no sirven para los tests de integración: la API los rechazaría (sección 10.1). Ahí se usan fechas pasadas.

**`estadoDelDataset({ proxima, meses, tipoGestion, hoy })`** devuelve `{ estado, dias }`:
- `estado` es `actualizado`, `proximo`, `atrasado`, `sin-respuesta`, `eventual` o `sin-fecha`. El umbral de `proximo` sigue en 60 días corridos, y el día del vencimiento todavía cuenta como próximo, igual que hoy.
- `dias` es la cantidad de días hasta el vencimiento (negativa si ya venció).
- Un Eventual da `eventual`, no `actualizado`. Va en la entrega 1, porque la lista de admin la necesita.

**Bordes que también se prueban**
- `sumarMeses('2027-11-30', 3)` = 2028-02-28.
- `sumarMeses('2028-02-28', 1)` = 2028-03-31.
- `corteDe('2028-03-31')` = 2028-02-28, con febrero siempre en 28.
- Diciembre que cruza a enero.
- Fechas inválidas devuelven null; nunca tiran error.

## 8. Admin (`admin.html` + `admin.js`): entrega 1

Lo que se ve está en el mockup de admin. Lo que se describe acá es el comportamiento que el código tiene que cumplir.

### 8.1 Estructura del código
- **Script nuevo `public/js/admin-fechas.js`**, que se carga antes de `admin.js`. Tiene:
  - lo puro para mostrar: `htmlDeFila`, `htmlDeOpciones`, `htmlDeCiclo`, `textoEstado`, `fechaCorta` (corta texto), `mesAnio`, `hoyEnArgentina()`;
  - la lectura y armado de los selectores de mes y año.
  - Al cargarse solo declara. Lo prueba `tests/admin-frontend.test.js` (nuevo), cargándolo en un `vm` como los demás.
- **La aritmética de fechas no se copia al navegador.** El servidor es la única fuente: la pantalla le pide al servidor el pedido y las opciones (sección 10.2). Así no hay dos versiones de las reglas.
- `admin.js`: la línea que hoy registra el `submit` al cargarse (`admin.js:635`) pasa adentro de `DOMContentLoaded`. Se borran `calcularProximaPropuesta` y el CSS muerto (`admin.html:43-108`).

### 8.2 Lista
- **Barra:** buscador, selector de gestión y selector de tipo de pedido.
- **Filtros de estado** con su contador: Todos, Vencidos, Vencen en menos de 60 días, Al día, Eventuales y Con un cambio pendiente. Usan `aria-pressed` y combinan con el buscador. Al registrar o editar, la lista **conserva** el filtro, la búsqueda y la página.
- **Columnas:**

| Columna | Qué muestra |
|---|---|
| Dataset | Título y área |
| Estado | Pastilla y renglón chico: "Venció en ene 2024", "Vence en 44 días", "Vence en ene 2027" o "Esperando aprobación" |
| Datos publicados | "Al 31/07/2026", o "Ejercicio 2025" si el tipo es ejercicio; debajo, "Cargado el 13/10/2026". Se oculta en el celular. |
| Próximo pedido | El texto del pedido; debajo, el tipo y "Fecha sugerida de envío: dd/mm/aaaa" (solo si no venció) |
| Acciones | Ver abajo |

- **Acciones:**
  - "Registrar actualización", con ícono y texto; en el celular solo el ícono, con `aria-label`.
  - "Editar" y "Eliminar": botones de ícono con `aria-label`.
- **Dataset con cambio pendiente:** pastilla violeta "Cambio pendiente", fila tenue, botones `disabled`. El `title` dice "Tiene un cambio pendiente de aprobación".
  - Se acaba el bloqueo con `pointer-events`. El bloqueo también se verifica antes de abrir el modal.
  - Después de proponer, la lista vuelve a pedir los pendientes (hoy no lo hace: `admin.js:894`).
- **El lector** ve la tabla sin acciones y sin "Nuevo dataset", como hoy.
- **Celular (≤ 760 px):** la tabla pasa a tarjetas, una por dataset, con los mismos datos. No hay desplazamiento horizontal de la página.

### 8.3 Registrar actualización

Es un modal con `role="dialog"`, `aria-modal` y `aria-labelledby`. Se cierra con Escape y con clic afuera, pero solo si el clic arrancó en el velo, como en Correos. Retiene el foco y, al cerrar, lo devuelve al botón que lo abrió.

**Cabecera "Datos solicitados"**
- El texto del pedido actual.
- Frecuencia y tipo de pedido.
- "Fecha sugerida de envío" o "Vencido desde".
- "Publicado hoy": "datos al dd/mm/aaaa", o "ejercicio aaaa".

**Línea del ciclo**
- Va debajo de la cabecera y es decorativa (`aria-hidden`).
- Bandas: "Ya publicado", "Pedido, todavía no llegó" (rayado) y "Llega con esta actualización" (verde, que se mueve al cambiar "Datos al").
- Marcas: "Publicado", "Corte pedido", "Envío sugerido" y "Hoy".
- La misma información está en texto en la cabecera.

**Paso 1: ¿A qué fecha son los datos que llegaron?**
- Se elige con dos `select`, mes con nombre y año.
- Por defecto: lo pedido, pero nunca después del fin del mes anterior al actual.
- Si es `relevamiento`, la pregunta es "¿De qué mes es el relevamiento?" y el valor por defecto es el mes actual.
- Si es `ejercicio`, la pregunta es "¿De qué ejercicio es el presupuesto que llegó?" y solo se elige el año. Se guarda el 31/12 de ese año.
- Error en línea si es posterior al fin del mes actual: "Todavía no puede haber datos al dd/mm/aaaa." En `ejercicio` el tope es el ejercicio del año siguiente, porque el presupuesto de un año se aprueba antes de que empiece.

**Paso 2: ¿Cuándo llegó y cuándo se cargó?**
- "Recibido el": opcional.
- "Cargado en el portal el": hoy en Argentina.
- Las dos fechas no pueden ser futuras, y "Recibido el" no puede ser posterior a la carga.

**Paso 3: Próxima actualización**
- Las opciones de `opcionesDeProxima` son tarjetas de radio (`role="radiogroup"`). **Ninguna viene elegida.**
  - La sugerida lleva la marca "Sugerida".
  - Cada tarjeta dice por qué existe y "La nota siguiente va a pedir: …".
  - La última es "Otra fecha", que abre mes y año.
- Si el tipo es `eventual`, no hay paso 3.

**Pie**
- Texto: "Queda como propuesta: otra persona la aprueba en Mi Perfil. Hasta entonces, el dataset no se puede editar."
- Botones: "Cancelar" y **"Proponer actualización"**, que se habilita recién con una opción elegida y sin errores.
- Al enviar, `showToast("Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.")`, la fila pasa a "Cambio pendiente" y los errores salen en el modal.
- Se acaban los mensajes detrás del velo y el falso "registrada correctamente".

### 8.4 Formulario (alta y edición)
- Se agrupa en `fieldset`: "Datos del dataset" (como hoy) y **"Actualización y pedido"**, que es nuevo.
- **Frecuencia y gestión.** La opción interna dice "Interna (relevamiento propio)", sin "DGMIT".
- **Tipo de pedido.** Selector con la sugerencia debajo: "Es el sugerido…" o "Para esta gestión y frecuencia se sugiere… · Usar el sugerido".
- **"Cargado en el portal el"** es el campo `ultima_actualizacion`, con la etiqueta nueva.
- **"Datos al"** y **"Próxima actualización"** se eligen con mes y año. La próxima se deshabilita si la frecuencia es Eventual.
  - Al cambiar a Eventual, se avisa que la próxima va a quedar vacía.
  - Al dejar de ser Eventual, la próxima pasa a ser obligatoria.
- **Eventual va siempre junto con su frecuencia.** Con frecuencia Eventual, el tipo de pedido queda en "Eventual" y no se puede cambiar. Con cualquier otra frecuencia, "Eventual" no aparece entre los tipos. Lo mismo valida el servidor (sección 10.1).
- **"Qué se solicita"** lleva la ayuda "Describí qué tiene que mandar el área, sin fechas ni períodos: los agrega el sistema."
  - Aviso en ámbar, que no bloquea, si el texto contiene `siguiente al último`, `nuevo período`, `nuevo ejercicio`, `fecha de corte`, `posterior al último` o `desde la última actualización`, sin distinguir mayúsculas.
  - El aviso solo aparece si el tipo de pedido pone fechas en la nota: `acumulado`, `foto`, `anio_anterior` o `ejercicio`. En `relevamiento`, `edicion` y `eventual` esas frases no contradicen nada.
- **Vista previa "Así va a salir en la próxima nota":** una fila con conjunto de datos, datos solicitados y fecha sugerida de envío, más "Qué se solicita". Se recalcula con cada cambio usando el endpoint de la sección 10.2.
- **Importación desde el portal: se mantiene tal cual.** "Nuevo dataset" sigue abriendo el **paso 1**: "Importar desde el Portal de Datos Abiertos", con la URL del dataset, "Carga manual" y "Siguiente". Trae título, descripción, URL, formatos y el área sugerida (`GET /andino/fetch`) y después abre el formulario. Al editar sigue el botón **"Actualizar desde portal"**, con su confirmación. Se renuevan el estilo y la accesibilidad (diálogo, etiqueta con `for`, Escape) y se cambia el 💡 por un ícono Lucide. El flujo, los campos que se importan y el endpoint no cambian.
- **Alta nueva:** el título es "Nuevo dataset - Paso 2" si se vino del paso 1 y "Nuevo dataset" con carga manual (hoy dice "Paso 2" aunque no haya habido paso 1). El tipo de pedido toma el sugerido y "Datos al" y "Próxima" quedan para completar. El texto de la confirmación de "Actualizar desde portal" dice también "formatos", que hoy se importan sin avisarlo (`admin.html:589-594` contra `admin.js:558-563`).
- Las etiquetas llevan `for`. Los chips de formatos pasan a ser botones con `aria-pressed`.
- El banner "sin cambios" se limpia al abrir el formulario: hoy queda pegado (`admin.js:679-696`).

### 8.5 Estilo
- Vocabulario de Correos y Mi Perfil, copiado al `<style>` de admin con prefijo `ad-`. Tokens `--pf-*`, con `--pf-suave: #5F6E80` en admin para el contraste.
- Pastillas de estado con contraste de 4.5:1 o más:
  - Vencido: rojo `--pf-rojo` sobre `--pf-rojo-fondo`. Dice "Sin respuesta" si es externo y "Atrasado" si es interno, como hoy.
  - Próximo: ámbar.
  - Actualizado: verde.
  - Eventual: gris.
  - Cambio pendiente: violeta.
- Foco visible en todo. Movimiento solo en la banda verde, y se respeta `prefers-reduced-motion`.
- Pie de página "RPAD v1.6.0".

### 8.6 Arreglos incluidos (encontrados en el análisis)
1. `.alert-success` sin estilo, y mensajes detrás del velo: se pasa a `showToast` y a errores dentro del modal.
2. Los pendientes no se recargan después de registrar.
3. La fecha de hoy se toma en UTC: después de las 21 da mañana.
4. "Registrar actualización" no verifica el bloqueo antes de abrir: depende solo de `pointer-events` (`admin.js:707-709`). Editar y Eliminar ya lo verifican.
5. Los modales no tienen semántica de diálogo ni manejo de teclado. Las etiquetas no tienen `for`.
6. El banner "sin cambios" queda pegado. `.text-small` y `.mt-2` no existen.
7. La paginación usa variables `--mcr-*` y `--radius*` que no están definidas en `main.css` (`main.css:1593-1646`). Se definen en `main.css`, y eso arregla también `datasets.html`.
8. "Pag." sin tilde. Si fallan los catálogos no se avisa nada.

## 9. Notas Digitales y avisos: entrega 2

**Fichas.** `fichasDe` y `COLUMNAS_DATASET` (`notasDigitalesDatos.js`) suman `f.meses`, `d.datos_al` y `d.tipo_pedido`. Cada ficha trae `pedido`, calculado con `pedido(...)` el día de la nota.

**Aviso** (`construirNota`, `PARRAFO_INICIAL` en `notasDigitalesContenido.js`):
- El párrafo inicial **del aviso externo** suma, antes del punto final: ", con los datos del período que se indica en cada caso y, de ser posible, antes de la fecha sugerida de envío". Se ajusta el test que fija esa frase (`notas-contenido.test.js:243`).
- El párrafo del aviso interno no cambia: casi todos los internos son relevamientos y su pedido no tiene fechas. La columna "Datos solicitados" va en los dos.
- Columnas de "Próximos a vencer": **Conjunto de datos · Área (o Área responsable) · Frecuencia · Datos solicitados · Fecha sugerida de envío**. Son 5 columnas: se van "Última actualización" y "Situación".
- Se agrega la clave `5` a `PROPORCIONES` (`notasDigitalesPdf.js:26-30`), con Datos solicitados como la columna más ancha después del título.
- Si un aviso trae una sección de vencidos, esa sección usa las columnas de la reiteración.
- El renglón del antecedente sigue, con `colspan` igual a la cantidad de columnas.

**Reiteración**: mismas 7 columnas que hoy, cambiando "Última actualización" por **"Datos solicitados"**. "Venció/Vence", "Situación" e "Informado en" siguen, e "Informado en" sigue siendo la última.
- El pedido **se calcula cada vez**, con R7 y "todo lo que falta", igual que en "Sin aviso previo". Así se cumple "pedir siempre todo lo que falta".
  - Mientras el área no entregue, `datos_al` no cambia, así que el inicio queda igual que en el aviso.
  - El final avanza solo si pasa otro ciclo entero sin respuesta. Por ejemplo, un trimestral avisado para el 31/01/2027 pide hasta el 31/12/2026, y desde el 30/04/2027 pide hasta el 31/03/2027.

**Lo que se guarda.** `generarNota` escribe `datos_desde`, `datos_hasta` y `datos_solicitados` en el mismo `INSERT` de `notas_digitales_datasets` (`notasDigitales.js:153-156`), en el aviso y en cada reiteración: queda el registro de qué pidió cada nota. `obtenerNota` los devuelve, y el Libro de Correos puede mostrarlos más adelante (no es parte de esta etapa).

**Anexo** (`construirAnexo` y `estadoDelAnexo`, en `notasDigitalesContenido.js:417-460`; el dibujo, `prepararCabecera` y la línea de tiempo, en `notasDigitalesAnexo.js`):
- La línea de estado pasa a "Fecha sugerida de envío: dd/mm/aaaa · faltan N días" (antes decía "Vence el…").
- Debajo va el recuadro **"DATOS SOLICITADOS"**, con el texto en negrita. Se suma al cálculo de altura de `prepararCabecera` y entra en el orden que fija `notas-anexo.test.js:240-258`.
- La línea de tiempo va de **"Datos publicados al dd/mm/aaaa"** (`datos_al`; si es NULL, la fecha de carga con el rótulo "Cargado en el portal") a "Fecha sugerida de envío".
- La ficha sigue sin repetir fechas.

**Email a las áreas a los 40 días** (`areaAviso40diasTemplate`, `datasetsExternosPorArea`):
- Cada tarjeta suma "Datos que se solicitarán: del … al …" (el texto del pedido) y "Fecha sugerida de envío: dd/mm/aaaa".
- La consulta trae `meses`, `datos_al`, `tipo_pedido` y la fecha con `DATE_FORMAT`.
- `AREA_DE_EJEMPLO` (`notificacionesController.js:12-27`) suma esos datos.
- Se ajusta el texto exacto que fija `email-diseno.test.js:206`.

**Nota de auditoría**
- Un registro de actualización se muestra como **"Actualización"** y no como "Modificación" (`TIPO_DE_CAMBIO`), con las filas Datos al, Cargado en el portal, Recibido el y Próxima actualización.
- `QUE_IMPLICA` suma: "y que la próxima actualización sea el último día de un mes".

**Vista previa de Correos.** Los ejemplos de `notasDigitales.js:541-581` pasan a vencimientos de fin de mes, con `datos_al` y `tipo_pedido`, y muestran la columna nueva.

**Lo que no cambia**: lo que ya se envió (HTML, PDF y anexo guardados), la numeración, la firma, las ventanas, los asuntos y la autorización.

## 10. API y servidor: entrega 1

### 10.1 Datasets
- **`GET /datasets` y `GET /datasets/:id`** (públicos) suman, sin quitar nada:
  - `datos_al` y `tipo_pedido` (el efectivo: el guardado o el sugerido);
  - `frecuencia_meses`;
  - `pedido` (`{ desde, hasta, texto }`), calculado con `hoyArgentina()`;
  - `estado` y `dias_para_vencer`, de `estadoDelDataset`. Admin los usa desde la entrega 1; el sitio público, desde la entrega 3. El `calcularEstado` de hoy (`datasetController.js:127-151`) sigue para las estadísticas hasta la entrega 3.
  - Las fechas nuevas viajan como `'AAAA-MM-DD'`, con `DATE_FORMAT`.
- **`POST /datasets` y `PUT /datasets/:id`** aceptan `datos_al` y `tipo_pedido`, y validan:
  - `proxima_actualizacion` y `datos_al` tienen que ser fin de mes (`esFinDeMes`). El error dice cuál falló, por ejemplo: "La próxima actualización tiene que ser el último día de un mes (febrero, el 28)."
  - `tipo_pedido` tiene que estar en el enum.
  - Si la frecuencia es Eventual, `proxima_actualizacion` tiene que ir vacía y `tipo_pedido` tiene que ser `eventual`. Si no es Eventual, la próxima es obligatoria y el tipo no puede ser `eventual`.
  - `ultima_actualizacion` no puede ser posterior a hoy. `datos_al` no puede ser posterior al fin del mes actual, salvo en `ejercicio`, donde el tope es el 31/12 del año siguiente.
  - Todo esto se valida **solo si el campo cambia** (sección 4). Una fecha inválida da 400, nunca 500.
  - `hayCambiosReales`, `datosAnteriores` y `datosNuevos` suman los campos nuevos.
- **`POST /datasets/:id/actualizar`**. Recibe `{ datos_al, cargado_el, recibido_el?, proxima_actualizacion, notas? }`.
  - Por compatibilidad, acepta `fecha_actualizacion` como sinónimo de `cargado_el`.
  - Valida lo mismo, más: `proxima_actualizacion` es obligatoria salvo en Eventual, y `recibido_el` no puede ser posterior a `cargado_el`.
  - **Respeta la próxima que eligió la persona.** Se acaba el cálculo con `frecuencias.dias` (`datasetController.js:649-655`).
  - Crea el cambio pendiente `editar` con:
    - `datos_nuevos = { ultima_actualizacion, datos_al, proxima_actualizacion, recibido_el, notas, registro_actualizacion: true }`;
    - `datos_anteriores = { ultima_actualizacion, datos_al, proxima_actualizacion }`.
  - El mensaje sigue siendo "Solicitud de actualización enviada…".
- **`aprobarCambio`** (`cambiosPendientesController.js`):
  - Suma `datos_al` y `tipo_pedido` al `INSERT` de `crear` y a `campos` de `editar`.
  - **No aprueba** un cambio que lleva una `proxima_actualizacion` o un `datos_al` que no son fin de mes. Responde 400: "La próxima actualización del cambio no es el último día de un mes. Rechazalo y proponé la fecha correcta." Mi Perfil muestra ese error en la fila, como los demás. Así se cubren los cambios propuestos antes del despliegue y los cargados por SQL.
  - Si `datos_nuevos.registro_actualizacion` es verdadero, en la misma transacción hace un `INSERT` en `historial_actualizaciones` con:

| Columna | Valor |
|---|---|
| `dataset_id` | el del cambio |
| `fecha_actualizacion` | la carga |
| `usuario_id` | quien propuso |
| `notas` | las notas del registro |
| `cambio_id` | el cambio |
| `vencimiento` | la próxima anterior |
| `datos_al` | el `datos_al` nuevo |
| `recibido_el` | la fecha de recepción |
| `proxima_nueva` | la próxima nueva |

  - `gestionController` ("Operador más activo", `:76-88`) deja de contar dos veces un registro que ahora está en las dos tablas.
- **`calcularCambios` y Mi Perfil**:
  - Rótulos nuevos: "Datos al", "Tipo de pedido", "Recibido el", y **"Cargado en el portal"** para `ultima_actualizacion` (antes "Ultima Actualizacion"). Se ajusta a propósito `cambios-listas-api.test.js:150`. En Mi Perfil, `ETIQUETAS_DE_CAMPO` (`perfil.js:799-808`) suma las claves nuevas. `perfil-frontend.test.js:149,326` fija "Próxima actualización", que no cambia.
  - `CAMPOS_DE_FECHA` suma `datos_al` y `recibido_el`.
  - En Mi Perfil, un registro de actualización se titula "Actualización registrada".
  - En la comparación, una próxima que no es fin de mes se marca: "No es el último día del mes". Es una señal para quien audita.

### 10.2 Cálculo para la pantalla (nuevos, `authMiddleware` + `adminOnly`)
- **`GET /datasets/:id/opciones-proxima?datos_al=AAAA-MM-DD`** devuelve `{ pedido, opciones }` de `opcionesDeProxima` para ese dataset, con `hoyArgentina()`. Si `datos_al` falta o es inválido, responde 400.
- **`GET /datasets/calculo-pedido?tipo=&meses=&proxima=&datos_al=`** devuelve `{ pedido }`. Es para la vista previa del formulario y sirve también para un alta, que todavía no tiene id.
- `api.js` suma `API.opcionesDeProxima(id, datosAl)` y `API.calculoPedido(params)`. Como cambia `api.js`, se sube `VERSION` en todas las páginas.

## 11. Sitio público y estados: entrega 3

- **Detalle (`dataset.html`, `dataset-detail.js`)**:
  - Tres datos: **"Datos al"**: dd/mm/aaaa; "Ejercicio aaaa" si el tipo es ejercicio; "Relevamiento de {mes} {año}" si es relevamiento; "—" si es NULL.
  - **"Cargado en el portal"**: dd/mm/aaaa.
  - **"Próxima actualización prevista"**: {mes} de {año}, o "Eventual".
- **Listado (`datasets.js`)**:
  - "Datos al dic 2025" y "Próxima: ene 2027" en lugar de "Próx: dd/mm/aaaa".
  - El CSV suma la columna "Datos al" y renombra "Última Actualización" a "Cargado en el portal".
  - Se arregla la columna "Área" vacía (`area_responsable` no existe).
- **Estados.** `estadoDelDataset` y el campo `estado` ya existen desde la entrega 1 (secciones 7 y 10.1). En esta entrega:
  - las páginas públicas usan `d.estado`, y se borran las copias de `datasets.js`, `dataset-detail.js` y `calendario.js`;
  - `getEstadisticas` y `reportesController.js` dejan su `calcularEstado` y usan `estadoDelDataset`;
  - `Utils.calcularEstado` queda solo como respaldo, alineado con el servidor: un Eventual da `eventual`.
- **Tasa de actualización** (tablero y reporte PDF, `reportesController.js:255`): es (actualizados + próximos) dividido el total **sin los eventuales**. Con los datos de hoy da 53/66 = 80 %. Hoy da 84 %, porque cuenta a los eventuales como actualizados.
- **Tablero (`dashboard.js`)**:
  - El gráfico de 12 meses incluye el mes en curso (`:363`).
  - El clic en un mes filtra de verdad el listado: `?mes=` hoy se lee (`datasets.js:89`) y nunca se usa.
- **Reportes PDF**: donde se lista la próxima, se suma "Datos al". La tasa cambia como en el tablero; lo demás del reporte de cumplimiento queda igual.
- **Calendario**: no cambia. Con R1, los vencimientos caen el último día del mes, y FullCalendar ya agrupa con "+N más".

## 12. Datos iniciales y limpieza

1. **"Datos al" y tipo de pedido de los 80 datasets** (entrega 1).
   - Salen de la planilla que corrigió el usuario, `Desktop/rpad-datos-al.xlsx`: la columna J (o la I, si J está vacía) y la K (o la H, si K está vacía).
   - Se genera `database/updates/migracion-fechas-datasets-datos.sql` con un `UPDATE … WHERE id = ?` por dataset. Va después de la migración de estructura y antes del código, para que los datos estén completos desde el primer momento.
   - Los "Datos al" en mes y año se cargan como fin de mes, con febrero en 28. En `ejercicio` es el 31/12 del ejercicio publicado.
   - El usuario corrigió tres: Pauta 07/2026, Escala salarial 05/2025 y Presupuesto con perspectiva de género 12/2025. La Escala salarial (38) sigue como relevamiento interno.
   - **"Próxima edición" (44, 50, 63, 77 y 78).** La planilla trae el mes de carga, pero "Datos al" tiene que ser la fecha de referencia de la edición: 05/2022 para los cuatro del Censo 2022 (50, 63, 77 y 78), y el mes de la última elección publicada para el 44. **A confirmar por el usuario.**
2. **Los "Qué se solicita" relativos** (entrega 2). Son 26: los ids 1-11, 13, 23, 35, 36, 46, 48, 52, 57, 61 y 69-74.
   - Se les saca solo la frase del período. Por ejemplo, "en el nuevo período (el trimestre siguiente al último publicado)" se borra, y "a la fecha de corte del nuevo período" también.
   - **El usuario aprobó los 26 textos tal como están** en `Desktop/rpad-revision-textos-y-grilla.xlsx`, hoja "Qué se solicita", columna D.
   - Van en una migración aparte, `migracion-fechas-datasets-textos.sql`, que se corre **con la entrega 2**. Así ninguna nota sale con el texto sin período antes de que la nota diga "Datos solicitados".
   - **Quedan como están:**
     - la Escala salarial (38): es relevamiento interno y la nota no le pone período;
     - las guías 14-16, Gimnasios (54) y Barrios (66): son eventuales y su "desde la última versión publicada" describe el contenido.
3. **Los 12 datasets fuera de la grilla** (ids 33, 38, 42, 45, 49, 56, 58, 60, 61, 74, 75 y 80).
   - Con el tipo de pedido y "todo lo que falta", ninguno queda mal.
   - El usuario movió dos al 31/01/2027 y ya lo cambió en producción el 17/10/2026: Proveedores (33) y Comercios habilitados (61), para tener la foto del año. Más adelante podría pasarlos a semestral.
   - El resto queda como está.
4. **`ultima_actualizacion` vieja.** Hay 12 valores anteriores a sep-2025 que parecen fechas de datos. No se tocan. Ahora "Datos al" tiene el dato correcto, y el usuario puede corregir la fecha de carga desde la aplicación si quiere.
5. **El historial no se reconstruye** de los 36 cambios viejos. Lo nuevo empieza con la entrega 1.

## 13. Entregas y despliegue

Cada entrega es un kit en el Escritorio con su `PASOS.txt`. Siempre se respalda primero y se verifica después. La migración va antes que el código.

| Entrega | Qué incluye | Producción |
|---|---|---|
| **1. Reglas, registro y admin** | Las migraciones de estructura y de datos (sección 12.1); `fechasDatasetReglas.js` (con `estadoDelDataset`); API (sección 10); admin (sección 8); Mi Perfil (rótulos, "Actualización registrada" y el bloqueo de aprobación); historial | phpMyAdmin (2 SQL) → subir archivos → Restart |
| **2. Notas y avisos** | Sección 9 y la migración de textos (sección 12.2). Las columnas de las notas ya están desde la migración 1. | phpMyAdmin (1 SQL) → subir archivos → Restart |
| **3. Sitio público y estados** | Sección 11 | Subir archivos → Restart |

- **Fecha límite de la entrega 2: antes del 22/12/2026.** Ese día sale el aviso externo de los datasets que vencen el 31/01/2027: son 18, todos externos (Pauta, Pedidos de Acceso, consumos, aeropuerto, Proveedores, Comercios y otros). Es el primer aviso grande que debería llevar "Datos solicitados".
- **Orden dentro de la entrega 1.** Si se suben archivos sueltos: primero los del servidor, después `api.js` y los scripts, y al final los HTML.
- **Antes de la entrega 1**, el usuario corre en phpMyAdmin estas consultas, que son solo de lectura. Si devuelven filas, se corrigen desde la aplicación antes de desplegar.
  ```sql
  -- Próximas que no son fin de mes (28/2 vale, 29/2 no)
  SELECT d.id, d.titulo, d.proxima_actualizacion FROM datasets d
  WHERE d.activo = 1 AND d.proxima_actualizacion IS NOT NULL
    AND NOT ((MONTH(d.proxima_actualizacion) = 2 AND DAY(d.proxima_actualizacion) = 28)
          OR (MONTH(d.proxima_actualizacion) <> 2 AND d.proxima_actualizacion = LAST_DAY(d.proxima_actualizacion)));
  -- Eventuales con próxima, y no eventuales sin próxima
  SELECT d.id, d.titulo, f.nombre, d.proxima_actualizacion FROM datasets d JOIN frecuencias f ON f.id = d.frecuencia_id
  WHERE d.activo = 1 AND ((f.dias IS NULL AND d.proxima_actualizacion IS NOT NULL) OR (f.dias IS NOT NULL AND d.proxima_actualizacion IS NULL));
  -- Cambios pendientes con fechas: al desplegar, el servidor no aprueba una próxima que no sea fin de mes (sección 10.1)
  SELECT id, dataset_id, datos_nuevos FROM cambios_pendientes WHERE estado = 'pendiente' AND JSON_CONTAINS_PATH(datos_nuevos, 'one', '$.proxima_actualizacion');
  ```
- **Hasta que salga la entrega 1**, al aprobar una actualización hay que mirar la próxima. `main` no tiene la corrección del 7/2 (tag v1.5.0, commit e962a13), y si producción tiene el `datasetController.js` de `main`, guarda la fecha de carga más los días.

## 14. Tests

**Nuevos**
- `tests/fechas-reglas.test.js`: todas las funciones de la sección 7, con la tabla de casos, los bordes, `estadoDelDataset` y el catálogo (las frecuencias de 12 meses o menos dividen a 12).
- `tests/admin-frontend.test.js`: `admin-fechas.js` en un `vm`, con:
  - el HTML de una fila: estado, pendiente, eventual y escape de HTML;
  - las opciones;
  - el ciclo;
  - el selector de mes y año: fin de mes y febrero en 28;
  - `hoyEnArgentina` a las 22 h;
  - la prueba de CSS sin uso de `admin.html`, con la comparación por palabra entera de `correos-frontend.test.js`.
- Integración, en la API:
  - registrar respeta la próxima elegida;
  - 400 con una próxima que no es fin de mes, con `datos_al` futuro (y el tope del ejercicio), con `recibido_el` posterior a la carga y con un tipo `eventual` que no coincide con la frecuencia;
  - editar un dataset viejo con fecha mala sin tocar esa fecha no da error;
  - al aprobar, se escribe el historial;
  - aprobar una próxima que no es fin de mes da 400;
  - `opciones-proxima` y `calculo-pedido` (permisos y contenido);
  - `GET /datasets` trae los campos nuevos y `estado`.
- Notas: la columna "Datos solicitados" en el aviso (5 columnas) y en la reiteración (7); el período guardado en cada nota y recalculado en la reiteración; las filas viejas NULL; el recuadro del anexo y su lugar en el orden vertical; la maquetación del PDF con 5 columnas; el email a las áreas.

**Que cambian a propósito**
- `doble-verificacion.test.js:155-170`, que hoy exige próxima − última = días de la frecuencia. Se reescribe: la próxima elegida se respeta y una próxima que no es fin de mes da 400.
- Notas:
  - `notas-contenido.test.js`: las columnas exactas del aviso y la reiteración (71-77), los índices de las celdas (56-87), el `colspan` del antecedente (163-167), el párrafo inicial (241-244) y el texto plano (229-239);
  - `notas-anexo.test.js`: la ficha (13-21), el estado (39-49) y el orden vertical (240-258);
  - `notas-pdf.test.js`: la maquetación con 6 y 7 columnas (129-227 y 482-530);
  - `notas-motor.test.js`: la vista previa y el ejemplo (697-729 y 867-879);
  - `email-diseno.test.js:206`, el texto exacto del aviso a las áreas.
- El rótulo de `calcularCambios` (`cambios-listas-api.test.js:150`).
- Las versiones de `paginas.test.js`.

## 15. Lo que queda a criterio de quien construye
- Los nombres internos de las funciones del frontend y la forma exacta del HTML, siempre que cumpla las secciones 8 y 9 y el mockup.
- Cómo se dibuja la línea del ciclo en el celular: puede simplificarse a texto.
- Si la vista previa del formulario espera un instante antes de llamar al servidor, y cuánto.
- Cómo se reparte cada entrega en tareas.

## 16. Para después: la "vida" del dataset

Esta etapa deja todo listo para armar la línea de tiempo de cada dataset sin rediseñar nada. La clave del ciclo es el **vencimiento**, que une:

| Evento | Dónde queda |
|---|---|
| Avisos y reiteraciones | `notas_digitales_datasets.vencimiento`, con el pedido congelado |
| Emails a las áreas | `notificaciones_log` |
| La actualización que lo cumplió | `historial_actualizaciones.vencimiento`, con `datos_al`, `recibido_el`, `proxima_nueva` y `cambio_id` (quién propuso y quién aprobó) |
| Altas, ediciones y bajas | `cambios_pendientes` |

Con `recibido_el` contra la fecha sugerida se puede medir si cada área entregó a tiempo.

## 17. Decisiones que tomé yo (para revisar)

1. Febrero en 28 también para "Datos al" y para el corte. En un bisiesto, "datos al 28/02/2028" deja afuera un día.
2. El aviso pierde la columna "Situación" ("Faltan N días") y "Vence" pasa a "Fecha sugerida de envío", para no apurar. La reiteración conserva "Situación".
3. La frase suave va en el párrafo inicial de la nota: "…con los datos del período que se indica en cada caso y, de ser posible, antes de la fecha sugerida de envío."
4. El umbral de "Próximo a vencer" sigue en 60 días.
5. Con datos parciales, "Mantener" se ofrece siempre como alternativa, aunque la sugerida avance.
6. Los presupuestos piden todos los ejercicios que faltan (los de perspectiva de género, 2026 y 2027).
7. "Recibido el" es opcional, y por defecto queda vacío.
8. La próxima de un relevamiento se calcula desde el mes del relevamiento, no desde el vencimiento anterior.
9. Los cálculos los hace solo el servidor y la pantalla los pide (sin copias de las reglas en el navegador).
10. Las fechas viejas de `ultima_actualizacion` no se corrigen.
11. En los presupuestos, "Datos al" es el 31/12 del ejercicio publicado, y el tope es el ejercicio del año siguiente.
12. El estado (`estadoDelDataset`) pasa a la entrega 1, porque admin lo necesita. En la entrega 3 lo empiezan a usar también el sitio público y las estadísticas.
13. La reiteración recalcula el pedido cada vez ("todo lo que falta"), en lugar de repetir el del aviso. Cada nota guarda lo que pidió.
14. "Eventual" va siempre junto con la frecuencia Eventual, y el servidor lo exige.
15. La limpieza de los "Qué se solicita" sale con la entrega 2, junto con "Datos solicitados", y no antes.
16. El servidor no aprueba un cambio con una próxima o un "Datos al" que no son fin de mes.
17. La frase nueva va solo en el aviso externo.
18. La tasa de actualización (tablero y reporte) deja a los eventuales fuera del total: da 80 %.
