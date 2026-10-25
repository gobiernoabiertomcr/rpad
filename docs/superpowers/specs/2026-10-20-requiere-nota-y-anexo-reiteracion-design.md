# «Requiere nota DGMIT» y anexo de la reiteración

Fecha: 20/10/2026.

Mockups: PDF reales de prueba, generados con una copia descartable del código (no versionada) sobre una copia de la base local (`rpad_spike_requiere_nota`) con la columna y la carga del Excel. Están en `Escritorio/RPAD-mockups-requiere-nota-y-anexo/` y **no van al repositorio**: llevan la firma escaneada y nombres reales de personas de contacto de las áreas.
- `1-Aviso-externo-22-12-2026.pdf`: el aviso externo del 22/12/2026 (16 datasets, 3 con «No»).
- `2b-Reiteracion-externa-9-26-con-7-columnas.pdf`: la reiteración externa del 02/11/2026, con la tabla elegida. (`2a-…-con-8-columnas.pdf` es la descartada.)
- `3-Anexo-de-la-9-26-reiteracion-externa-10-hojas.pdf` y `5-Anexo-de-la-8-26-reiteracion-interna-3-hojas.pdf`: los anexos.
- `6-Hoja-Seguimiento-81-…pdf` y `7-Hoja-Seguimiento-74-…pdf`: la hoja del Seguimiento de un dataset con «No».

Los números de nota de los mockups (8/26, 9/26) son de ejemplo. Este documento manda sobre los mockups.

## Por qué

**Requiere nota DGMIT.** Algunos datasets de gestión externa no se le piden a ningún área: los datos se sacan de una fuente pública. Por ejemplo, el TMDA sale de la web de Vialidad Nacional y la cantidad de empleados municipales, del Boletín Oficial. Para esos datasets la DGMIT no tiene que mandar una nota formal. Hoy la Nota Digital no lo dice, así que la DGMIT no sabe en cuáles tiene que hacer la nota y en cuáles no. El usuario no quiere cambiar el circuito: las notas siguen informando todo como hoy y solo agregan el dato.

**Anexo de la reiteración.** La reiteración es el segundo aviso de un dataset que sigue pendiente. Hoy sale sin anexo. Con el anexo, cada dataset lleva su hoja del Seguimiento: cuántas veces avisó el RPAD, desde cuándo está vencido y qué se pide. Así la nota prueba por sí sola que ya se avisó (suposición de la conversación, no corregida por el usuario).

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Un dato nuevo por dataset externo, «Requiere nota DGMIT» (Sí o No), cargado al principio desde el Excel del usuario y editable después con doble verificación.
- La columna «Requiere nota DGMIT» en las tablas del aviso externo y de la reiteración externa (HTML del email, texto plano y PDF).
- Si un dataset no requiere nota, no se le manda al área el email de los 40 días, porque ese email le anuncia una nota formal.
- El dato se ve también en la ficha del Seguimiento (pantalla y PDF) y como filtro de la lista de Gestión de Datasets. Con «No», el circuito del Seguimiento ya no habla de la nota formal.
- Cada reiteración (interna y externa) lleva un anexo en PDF con la hoja del Seguimiento de cada dataset, igual a la que se descarga desde Herramientas → Seguimiento.

**No objetivos**
- No cambia quién recibe las notas ni cuándo salen. Los datasets con «No» siguen saliendo en el aviso y en la reiteración como hoy.
- No cambian las tablas del aviso interno ni de la reiteración interna: en gestión interna nunca hay nota formal al área.
- No cambia el anexo del aviso (la hoja de cada dataset con «DATOS SOLICITADOS»).
- No cambian los datos de contacto de las áreas en la nota: un área cuyos datasets son todos «No» se sigue listando como hoy.
- No se muestra en el sitio público.

**Antiobjetivos** (aunque funcione, sería un fracaso)
- Que cambie una nota ya generada. Las notas 1/26, 2/26 y 3/26, y cualquier nota pendiente o fallida generada antes del despliegue, se guardaron en bytes y se reintentan tal cual: no se regeneran ni se les agrega la columna ni el anexo.
- Que un dataset con «No» desaparezca de una nota.
- Que el Seguimiento de un dataset con «No» siga diciendo que DGMIT «manda la nota formal al área» o que el RPAD «le anticipó por email que iba a recibir una nota formal».
- Que un «No» (0) se guarde o se aplique como NULL. El patrón `x || null` del código lo haría.
- Que salga un email real durante las pruebas (solo Mailpit o las dos casillas de prueba del usuario).

## Plazo

Las dos partes van **juntas y en producción el mismo 20/10/2026** (lo decidió el usuario al aprobar este documento), así que la corrida del 21/10 a las 8:15 ya usa el código nuevo. Como límite duro sigue la corrida de las 8:15 del lunes 02/11/2026. Antes de entregar el kit se simula del 20/10 al 15/11/2026 sobre una base de simulación nueva, cargada con el dump de producción del 20/10 a las 9:00, con Mailpit y sin ningún email real. El 02/11 es el primer día hábil de noviembre, cuando se evalúa la reiteración del mes, y va a ser la primera reiteración de la historia: la externa con 10 datasets (11, 13, 8, 61, 33, 5, 1, 52, 3 y 2, todos «Sí») y la interna con 3 (26, 62 y 17). Así la primera reiteración ya sale con anexo y con la columna. El kit tiene que quedar listo con tiempo para que el usuario lo despliegue, porque lo despliega él.

## Parte 1: «Requiere nota DGMIT»

### 1.1 El dato

- Columna nueva `datasets.requiere_nota TINYINT(1) NULL DEFAULT NULL`, **después de `tipo_gestion`**. No va entre `que_se_solicita` y `tipo_pedido`, porque `tests/schema.test.js` (`crearConEstructuraAnterior`) borra `tipo_pedido` y lo vuelve a poner `AFTER que_se_solicita`.
- Valores: `1` = Sí (la DGMIT tiene que mandarle una nota formal al área); `0` = No (los datos se obtienen sin nota); `NULL` = sin dato.
- Gestión interna: siempre `NULL`. El servidor guarda NULL aunque llegue un valor, y si un dataset pasa de externa a interna, el cambio deja `requiere_nota` en NULL.
- Un externo con NULL se comporta como «Sí» en todo lo que no es mostrar el dato: recibe el email de los 40 días y su circuito habla de la nota formal. Donde se muestra el dato, se ve «—» en la nota y «Sin dato» en el Seguimiento. Después de la carga inicial no queda ninguno así.

### 1.2 Carga inicial

El usuario completó el Excel (`Escritorio/RPAD-requiere-nota.xlsx`) con los 45 datasets externos activos: 35 con Sí y 10 con No.
- **No requieren nota:** 10 (Pauta Publicitaria), 30 (Puntos Fijos de la Red de Nivelación Argentina), 35 y 36 (EANA), 50, 63, 77 y 78 (INDEC), 74 (TMDA, «se extraen en web Vialidad») y 81 (Cantidad de empleados municipales, «se extraen del Boletín Oficial»).
- **Requieren nota:** los otros 35 externos: 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 22, 23, 25, 27, 32, 33, 42, 44, 46, 48, 52, 53, 54, 56, 57, 58, 59, 61, 69, 70, 71, 72, 73 y 75.

Migraciones aditivas, con la convención de `migracion-fechas-datasets*.sql`:
- `database/updates/migracion-requiere-nota.sql`: `ADD COLUMN IF NOT EXISTS`, se puede repetir y va **antes** de subir el código.
- `database/updates/migracion-requiere-nota-datos.sql`: un `UPDATE … SET requiere_nota = ? WHERE id = N AND tipo_gestion = 'externa' AND requiere_nota IS NULL` por dataset. Va **después de la estructura y antes del código**, y lleva una consulta de verificación (que no quede ningún externo activo en NULL). La condición `IS NULL` evita que una segunda corrida pise un cambio aprobado después.
- `database/schema.sql` suma la columna.

### 1.3 Alta y edición (doble verificación)

- **Formulario** (`admin.html`, sección «Actualización y pedido»): un `<select>` «Requiere nota DGMIT», al lado de «Tipo de gestión», con «Elegí una opción» (vacío), «Sí» y «No». Solo se ve con gestión externa: al cambiar la gestión aparece o se oculta.
  - En el alta de un externo, y al pasar un dataset a externo, viene vacío y es obligatorio.
  - En la edición de un externo viene con su valor.
  - El aviso del navegador es copia del mensaje del servidor (va a la lista de copias mínimas de CLAUDE.md).
- **Servidor** (`datasetController.js`):
  - Valida 0/1. Normaliza `true`/`false` y `"1"`/`"0"`; con cualquier otro valor responde 400.
  - Si el dataset resultante es externo y el valor queda NULL, responde 400 con «Indicá si el dataset requiere nota DGMIT.» (texto final a criterio de quien lo construye, pero el mismo en servidor y navegador).
  - Si el campo no viene en el cuerpo, se conserva el valor actual.
  - Va en `datosNuevos` y en `datosAnteriores` del alta y de la edición, y en `hayCambiosReales`. Una edición que solo cambia este dato es un cambio real.
  - Compara normalizado (`String(0)` contra `String(false)` no tiene que dar un cambio fantasma).
  - Ojo: `tipo_gestion` es `'externa'` por defecto, así que un alta por API sin el campo pasa a dar 400. Hay que actualizar los tests que crean datasets por API.
- **Aprobación** (`cambiosPendientesController.js`, `aprobarCambio`):
  - Se aplica en el INSERT del alta y en la lista `campos` del UPDATE de la edición, con `??`, nunca con `||`.
  - Un cambio viejo que no trae la clave no lo toca (UPDATE) o lo deja NULL (INSERT). Por ejemplo, el cambio #51, pendiente en producción.
- **Rótulo «Requiere nota DGMIT», con «Sí»/«No»/«—», en todo lo que muestra un cambio:**
  - `calcularCambios` y `enriquecerDatos` (comparación de Mi Perfil → Para revisar y Mis cambios);
  - `perfil.js` (`ETIQUETAS_DE_CAMPO`, `CAMPOS_DE_ALTA_Y_BAJA`). De la base llega 0/1 como número, no como booleano;
  - la nota de auditoría (`CAMPOS_DEL_DATASET`, `valorDelCampo` en `notasDigitalesContenido.js`);
  - los movimientos del Seguimiento (`CAMPOS` en `seguimientoReglas.js`: «Cambió: requiere nota DGMIT»).

### 1.4 Lista de Gestión de Datasets

Un filtro nuevo, «Requiere nota» (Todos, Sí, No), en la barra de filtros de `admin.html`, con el mismo patrón que `filtro-gestion` (`estadoDeLista`, `filtrarPorBarra`). «Sí» y «No» muestran solo externos. La fila del dataset no cambia.

### 1.5 Las notas

**Aviso externo (tabla de próximos a vencer): 5 columnas.** Conjunto de datos, Área responsable, Frecuencia, **Requiere nota DGMIT** (Sí / No / —) y Datos solicitados.
- Proporciones del PDF: `[28, 24, 15, 10, 23]`, probadas en el spike con el aviso real del 22/12/2026.
- El encabezado ocupa tres renglones y «Del … al …» pasa a dos. La tabla no crece de más.

**Reiteración externa (y la sección de vencidos que pudiera traer un aviso externo): 7 columnas, reorganizadas.** Conjunto de datos, Área responsable, Frecuencia, **Requiere nota DGMIT**, Datos solicitados, **Venció/Vence** e Informado en.
- La celda «Venció» (o «Vence») lleva la fecha y, **en un segundo renglón de la misma celda**, la situación de hoy, con el mismo texto de la columna «Situación» de la interna: «Vencido hace 1006 días», «Faltan 10 días», «Falta 1 día», «Vence hoy». La columna «Situación» deja de existir en la externa.
- «Informado en» sigue última (ahí va `informadoAnterior`).
- Proporciones del PDF con la segunda parte de «Informado en»: `[18, 14, 10, 10, 13, 10, 25]`, probadas con la reiteración real del 02/11/2026 (10 datasets): 7 filas en la primera hoja y ningún título partido, como hoy. Sin la segunda parte, unas análogas a criterio de quien lo construye.
- Esta tabla de 7 columnas no es la de 7 columnas de la interna. `PROPORCIONES` hoy se elige por cantidad de columnas, así que hay que distinguirlas (por ejemplo, con `seccion.proporciones`, que `calcularAnchos` ya acepta).
- Se descartó agregar una octava columna. Con 8, todas las columnas quedan en su mínimo, el título se parte («Patentamien-to») y entran 4 filas por hoja en lugar de 7 (mockup `2a`).
- HTML del email: la situación va debajo de la fecha, en la misma celda (`<br>`).
- Texto plano: sigue con dos renglones, «Venció: …» y «Situación: …». No tiene problema de ancho.

**Interna:** las tablas del aviso y de la reiteración interna no cambian (4 y 7 columnas, como hoy).

**De dónde sale el dato:**
- `COLUMNAS_DATASET` (`notasDigitalesDatos.js`) suma `d.requiere_nota`, y con eso llega a la selección del aviso, a la de la reiteración y a los pendientes en su fecha.
- Los ejemplos de la vista previa (`ejemplo()` en `notasDigitales.js`) llevan el dato.
- No se agrega columna a `notas_digitales_datasets`: la nota se guarda en bytes y no hace falta reconstruirla.

**Vista previa del admin** («Así va a salir en la próxima nota», `admin-fechas.js`): para un externo suma la columna «Requiere nota DGMIT» entre Frecuencia y Datos solicitados.

### 1.6 Email de los 40 días al área

`datasetsExternosPorArea` (`avisosDiariosService.js`) deja afuera los datasets con `requiere_nota = 0` (`AND (d.requiere_nota IS NULL OR d.requiere_nota = 1)`). Como la vista previa y la prueba del email en Correos usan la misma función, quedan coherentes.

Con la carga del Excel, dos áreas que hoy tienen email dejan de recibirlo para esos datasets: la Subsecretaría de Comunicación (10) y el IGN (30). Los otros «No» no tienen email cargado.

### 1.7 Seguimiento (pantalla, PDF y anexo)

- `fuentesDe` y `aDataset` (`seguimientoDatos.js`) traen `requiere_nota`.
- La ficha (`fichaDe`) lo devuelve; en gestión interna, null.
- **La ficha de un externo** suma «Requiere nota DGMIT: Sí / No / Sin dato».
  - En el PDF, «Datos que se piden» deja de ocupar todo el ancho y comparte el renglón con este dato, como en el mockup 6.
  - En la pantalla (`seguimiento.js`), el mismo dato en la ficha.
  - La interna no cambia.
- **El circuito de un externo con «No»** (`circuitoDe`):
  - el recuadro del medio sigue diciendo «DGMIT y Dirección Administrativa», con «No hace falta nota formal» como rol;
  - el tramo punteado se titula «Sin nota formal», con el texto «Los datos se obtienen de la fuente»;
  - el renglón «Al área» no se dibuja (`alArea` en null), salvo que en el ciclo abierto el RPAD ya le haya mandado al área el email de los 40 días. Puede pasar si el dataset estaba en «Sí» y después pasó a «No». En ese caso se muestra como hoy, con sus fechas, porque ese email existió. Lo que nunca aparece con «No» es «todavía no se le envió el email que anticipa la nota formal». Hoy no hay ningún caso así.
  - Con «Sí» o NULL, como hoy.

## Parte 2: el anexo de la reiteración

### 2.1 Qué es

Un solo PDF por reiteración, interna o externa, con una hoja A4 por dataset de la nota, en el orden de la tabla: primero los próximos a vencer y después los vencidos, como `construirNota`. Cada hoja es la del Seguimiento de ese dataset (`seguimientoPdf.js`), con dos diferencias:
- **arriba a la derecha**, «Seguimiento del dataset» y la fecha larga **de la nota**;
- **el pie**: a la izquierda, «Generado el dd/mm/aaaa a las hh:mm», sin «por»: es un envío automático y la hora es la de la generación. A la derecha, «Anexo de la Nota Digital N° 9/26 · Hoja 3 de 10». En una prueba o una vista previa, con el número como lo escribe la nota («N° XX» o el de prueba).

El Seguimiento se calcula con `hoy` = la fecha de la nota (`seguimientoDe(fuentes, fecha, { separacion: 12, letra: 8.4 })`, las opciones del PDF). Hoy son la constante privada `OPCIONES_CINTA_PDF` del controlador: hay que exportarla o moverla.

La hoja no muestra la reiteración que la acompaña, porque se genera antes de que esa nota exista. Muestra todo lo anterior.

Desde el despliegue de la spec `2026-10-24-reiteracion-en-su-anexo-design.md`, la hoja muestra también la reiteración que la acompaña, como las demás notas: es el movimiento más nuevo, cuenta en «Avisos del ciclo abierto» y tiene su marca en la cinta (en la vista previa, «XX»; en la prueba, «PRUEBA»). Los anexos generados antes no cambian.

### 2.2 Cuándo se genera y dónde se guarda

- Igual que el anexo del aviso: en `generarNota`, después de asignar el número y en la misma transacción, guardado en `notas_digitales.anexo_pdf` (MEDIUMBLOB).
- No se regenera nunca: la descarga, el envío y los reintentos usan esos bytes.
- `fuentesDe` se llama **una sola vez** con todos los ids, en lote (unas 11 consultas, sin importar cuántos datasets).
- Conviene leer las fuentes antes de abrir la transacción y dibujar adentro, donde ya se conoce el número. La corrida ya tiene dos conexiones tomadas y el pool tiene 10.
- Medido en el spike: 10 hojas pesan 105 KB y tardan menos de 1 segundo.
- **Si el anexo falla, la reiteración no se genera**, igual que si falla el anexo de un aviso: se registra el error y se reintenta en la próxima corrida. No sale una nota que diga «Anexo: … (10 hojas)» sin el anexo.

`seguimientoPdf.js` suma una forma de dibujar N hojas en un mismo documento, con el pie como parámetro. No hay `pdf-lib` y no se suma una dependencia para unir PDF. `renderSeguimiento` (la descarga de una hoja) sigue igual.

### 2.3 La nota y el email

- Renglón nuevo en la reiteración, en HTML, texto y PDF: «Anexo: seguimiento de los conjuntos de datos (N hojas).», con «1 hoja» si es una. Va en el mismo lugar que el del aviso.
- La primera línea del email de la reiteración pasa a «SE ADJUNTAN NOTA Y ANEXO EN PDF». `AVISO_ADJUNTO` hoy comparte el texto de la reiteración con la nota de autorización y la de auditoría: esas dos siguen diciendo «SE ADJUNTA NOTA EN PDF».
- `enviarNota` ya adjunta `Anexo-Nota-Digital-N-AA.pdf` cuando hay `anexo_pdf`.

### 2.4 Descargas, Libro y Seguimiento

No hay nada nuevo que hacer: con `anexo_pdf` guardado, `tiene_anexo` es verdadero, el Libro muestra el botón «Anexo», `descargarAnexo` lo entrega y el Seguimiento ofrece «Descargar la nota y su anexo». Para las notas viejas sin anexo, sigue `NOTA_SIN_ANEXO`. Hay que actualizar los comentarios y docs que dicen que la reiteración no tiene anexo (`CLAUDE.md`, `README.md`, `seguimiento.js`, el controlador).

### 2.5 Vista previa y prueba en Correos

- Se habilita «Ver anexo» para la reiteración: hoy se deshabilita con «Solo los avisos llevan anexo».
- `previewAnexo`, la ruta `…/preview/anexo` y `API.previewNotaAnexo` reciben el tipo.
- La prueba de una reiteración adjunta su anexo.
- Con datos reales, el anexo es el de la próxima corrida, con la misma selección y la misma fecha que la vista previa de la nota.
- Con datos de ejemplo, un anexo de ejemplo armado en memoria, sin consultar la base. `fuentesDe` descarta los ids de `ejemplo()` (0 y -1), así que hacen falta unas fuentes de ejemplo.

## Pruebas

**La suite completa antes y después de cada tarea** (regla del proyecto). Los tests que fijan las tablas, los adjuntos y los campos van a cambiar a propósito. Los informes del escaneo los ubicaron en:
- `notas-contenido.test.js` (columnas exactas, celdas, `colspan`, texto plano), `notas-pdf.test.js` (anchos, barrido de encabezados, maquetación) y `notas-licencias.test.js` (`colspan`);
- `notas-motor.test.js` y `notas-api.test.js` (la reiteración sin anexo, `tiene_anexo` en false, el 404 del anexo);
- `correos-frontend.test.js` (botón deshabilitado);
- `seguimiento-pdf.test.js` y `seguimiento-reglas.test.js`;
- `admin-frontend.test.js` (`cuerpoDelDataset` con `deepEqual` exacto, la vista previa de 3 `th`), `perfil-frontend.test.js`, `cambios-listas-api.test.js`, `fechas-escritura.test.js`;
- `schema.test.js`: compara `schema.sql` con la base Docker local, así que la migración se corre también en la base local.

**Tests nuevos, como mínimo:**
- validación de `requiere_nota` (obligatorio en el externo, NULL en el interno, 0 que no se vuelve NULL), propuesta y aprobación;
- el email de los 40 días sin los «No»;
- las tablas nuevas, en el PDF con `tests/pdf-lector.js`: con el caso real de la reiteración del 02/11, ningún título partido;
- el anexo: N hojas, una por dataset, en el orden de la tabla, con el pie «Anexo de la Nota Digital N° … · Hoja k de N»;
- la reiteración guarda `anexo_pdf` y el email lleva los dos adjuntos;
- el circuito y la ficha con «No».

**Simulación al final**, como en las tareas anteriores: una corrida de notas del 20/10 al 10/11/2026 sobre una base de simulación nueva, con la columna cargada. Tiene que salir la reiteración del 02/11 con su anexo, y ningún email real.

## Documentación y despliegue

- **CLAUDE.md:**
  - la columna nueva en «Base de datos»;
  - las columnas de las tablas en «Datos solicitados en las Notas Digitales»;
  - el circuito con «No», la ficha y el anexo en «Seguimiento del dataset»;
  - el mensaje copiado en la lista de copias mínimas.
- **README:** la sección de la migración.
- **Kit** `Escritorio/RPAD-deploy-requiere-nota-y-anexo/`:
  - `PASOS.txt`;
  - las dos migraciones;
  - el zip de archivos;
  - la vuelta atrás: el código anterior. La columna puede quedar, porque es aditiva.
- **Orden del despliegue:** las dos migraciones en phpMyAdmin, después los archivos y el Restart.
- Trabajo en rama aparte; scripts del frontend con `?v=` nuevo (`VERSION_ADMIN`, `VERSION_PERFIL` y los de Correos y Seguimiento).

## Decisiones mías (para que las revises)

1. El encabezado dice «Requiere nota DGMIT», en minúscula como los demás encabezados («Datos solicitados»).
2. Un externo sin dato (NULL) se ve «—» en la nota y «Sin dato» en el Seguimiento, y para lo demás se comporta como «Sí» (email de 40 días y circuito). Después de la carga no queda ninguno.
3. El servidor exige el dato en todo guardado del formulario de un externo, no solo cuando cambia: después de la carga no hay externos en NULL. «Registrar actualización» no pasa por ahí y no se ve afectado.
4. La vista previa del admin («Así va a salir en la próxima nota») suma la columna para los externos.
5. En el texto plano de la reiteración externa, «Venció» y «Situación» siguen en dos renglones.
6. No se agrega una columna a `notas_digitales_datasets`: la nota ya está guardada en bytes.
7. El anexo no incluye la reiteración que acompaña, y el pie va sin «por».
   - Desde el despliegue de la spec `2026-10-24-reiteracion-en-su-anexo-design.md`, el anexo incluye también la reiteración que acompaña; el pie sigue sin «por».
8. Si el anexo de una reiteración no se puede generar, la nota tampoco se genera, como con el aviso.
9. En la vista previa con datos de ejemplo, el anexo también es de ejemplo.
10. El filtro de la lista tiene tres opciones (Todos, Sí, No). «Sí» y «No» muestran solo externos.
11. Con «No», el renglón «Al área» del circuito se muestra solo si en el ciclo abierto ya se mandó el email de los 40 días, porque ese email existió. Si no, no se dibuja.

## Lo que queda para quien lo construye

- Cómo distinguir las proporciones de la tabla externa de 7 columnas de la interna (por ejemplo, `seccion.proporciones` o una clave por diseño).
- Las proporciones de la reiteración externa sin la segunda parte de «Informado en».
- Cómo dibujar la segunda parte de la celda «Venció» en el PDF: el spike usó un salto de línea en el mismo tamaño de letra y anduvo.
- Cómo generalizar `seguimientoPdf.js` para N hojas sin cambiar la descarga de una hoja.
- El texto exacto del mensaje de validación, el mismo en servidor y navegador.
- Las fuentes de ejemplo de la vista previa.
