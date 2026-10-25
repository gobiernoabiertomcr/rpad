# La reiteración en su propio anexo

Fecha: 24/10/2026.

Cambia una decisión de la spec `2026-10-20-requiere-nota-y-anexo-reiteracion-design.md` (sección 2 y decisión 7): «La hoja no muestra la reiteración que la acompaña, porque se genera antes de que esa nota exista. Muestra todo lo anterior.» Va en la misma entrega que la hoja oficio (`2026-10-24-notas-hoja-oficio-design.md`, rama `feat/notas-hoja-oficio`), por decisión del usuario.

## Por qué

Revisando la simulación de la hoja oficio, el usuario vio que cada hoja del anexo de una reiteración lista las notas anteriores del dataset pero no la propia reiteración. Por ejemplo, el anexo de la Nota 2/27 lista la 9/26, la 7/26 y la 2/26, pero no la 2/27, que es la nota con la que viaja. Pasa en todas las reiteraciones, y «Avisos del ciclo abierto» tampoco la cuenta.

Hoy el anexo ya se dibuja dentro de la transacción, con el número de la nota asignado. Lo que no tiene el número es el Seguimiento de cada dataset, que se calcula antes.

## Objetivos

En cada hoja del anexo de una reiteración, interna y externa, la propia reiteración (decisiones del usuario: «como las demás» y «en toda la hoja»):
- **Es el movimiento más nuevo de «Los últimos movimientos»**, igual que las otras notas:
  - título: «Nota Digital N° 2/27 a DGMIT»;
  - la fecha de la nota;
  - «Reiteración de gestión externa: vencía el dd/mm/aaaa. Pide: …»;
  - quién: «Envío automático» (o «Generada por …» si la generó una persona) y «Firmó …».
- **Suma en «Avisos del ciclo abierto»:** la cantidad sube en uno y la lista de números termina en el suyo.
- **Tiene su marca en la cinta:** la fila de arriba, el día de la nota, con la etiqueta «Nota 2/27».

En la vista previa («Ver anexo») y en la prueba de Correos pasa lo mismo, con el número como lo escribe la nota. En la vista previa es «XX»: «Nota Digital N° XX a DGMIT», «Nota XX». En la prueba es «PRUEBA».

## No objetivos

- No cambian el Seguimiento de la pantalla ni la descarga de su PDF. Ahí la nota aparece sola cuando ya existe en la base, con su estado real: pendiente, enviada o fallida.
- No cambia el anexo del aviso, que es el de las fichas.
- No cambia nada de lo que se guarda ni de la base. Los anexos ya generados no cambian.
- Con dos firmas, el movimiento sigue diciendo «Firmó <titular>», como hoy en todas las notas del Seguimiento: no se suma quién la presentó.
- Las reiteraciones pendientes o fallidas siguen sin contar como aviso en la pantalla, la lista «Sin elegir» y Gestión.
- No cambia la hoja oficio de la nota ni el A4 del anexo.

## Antiobjetivos

- Que la nota aparezca dos veces en una hoja. Puede pasar con la vista previa abierta el mismo día después de la reiteración real.
- Que la nota sumada llegue al Seguimiento de la pantalla, a la descarga del PDF o a los casos de los tests (las fuentes se copian, nunca se modifican).
- Que el anexo cambie en algo más que la nota sumada: tiene que mantener la misma diagramación, una hoja A4 por dataset y el mismo pie.
- Que una vista previa o una prueba diga «N° null/ll» o no tenga etiqueta en la cinta.
- Que no se genere una reiteración que hoy sí se genera, o al revés. Si falta la fuente de un dataset, la reiteración sigue sin generarse, como hoy.

## Cómo

- **Dónde se suma.** La nota se agrega en memoria a una copia de las fuentes de cada dataset, solo al armar el anexo (`seguimientosDeLaNota`, `services/notasDigitalesSeguimiento.js`).
- **La forma de la nota.** Es la misma que `fuentesDe` le da a una nota leída de la base (`aNota`, `services/seguimientoDatos.js`), con lo que `generarNota` va a guardar:
  - `tipo` «reiteracion», `gestion`, `fecha`, `numero` y `anio`;
  - `estado` «enviada»: el anexo viaja en el mismo email, así que quien lo lee recibió la nota;
  - el momento de envío: la fecha de la nota con la hora de la generación;
  - `vencimiento`: el del dataset, que es el del ciclo abierto;
  - `seccion`: «vencido» o «proximo», con la misma regla del INSERT de `notas_digitales_datasets`;
  - `datos_solicitados`: el pedido del dataset;
  - `para` y `cc` de la nota;
  - `creado_por` y `firmante`, con el `nombre_completo` de `usuarios`, como los leerá `fuentesDe` después.
- **Con el número.** El Seguimiento de cada dataset pasa a calcularse dentro de la transacción, ya con el número. Las fuentes se siguen leyendo antes de abrirla, en una sola llamada, y si falta la de un dataset, la reiteración no se genera.
- **Vista previa y prueba.** El número es «XX» o «PRUEBA», sin año. La regla que arma «N° n/aa» (`numeroDeNota`, `services/seguimientoReglas.js`) y la de la etiqueta de la cinta (`etiquetaDeNota`, `services/seguimientoCinta.js`) aceptan un número sin año. Las notas de la base que no son de prueba siempre tienen año.
- **Sin duplicados.** Si las fuentes de un dataset ya traen una reiteración de la misma gestión con la misma fecha (la vista previa abierta después de la real), se saca antes de sumar la propia.
- **Efecto aceptado:** si el email de la reiteración no sale nunca, el anexo guardado (que administración puede descargar) la muestra como enviada.

## Pruebas

- **Puros, con los casos reales** (`tests/seguimiento-casos.js`). Con la nota sumada:
  - el primer movimiento es ella (título, fecha, detalle y quién);
  - los avisos del ciclo suman uno y terminan en su número;
  - la cinta tiene su marca arriba, con «Nota n/aa».

  Sin la nota, el resultado es idéntico al de hoy, y los casos no quedan modificados.
- **Puros:** `numeroDeNota` y `etiquetaDeNota` con un número sin año.
- **El PDF:** `renderAnexoDeSeguimiento` con la nota sumada, también con «PRUEBA», mantiene la diagramación (`verificarDiagramacion`) y una hoja por dataset.
- **Corrida real** (Docker): en cada hoja del anexo, «Nota Digital N° n/aa a DGMIT» aparece una sola vez y la cinta muestra «Nota n/aa». El próximo a vencer y el vencido dicen la cantidad de avisos que corresponde. El día en que se envía, la nota guardada leída con `fuentesDe` coincide con la que se sumó, salvo el id y el momento.
- **Fallida:** el anexo la muestra sin «Pendiente de envío.» ni «No se pudo enviar.». El Seguimiento de la pantalla la muestra «No se pudo enviar.» y no la cuenta como aviso.
- **Vista previa y prueba:** «N° XX» y «Nota XX», «N° PRUEBA» y «Nota PRUEBA», también con datos de ejemplo. La vista previa abierta después de la reiteración real no la muestra dos veces.
- **El anexo del aviso** no cambia.
- **El test que compara la vista previa con la corrida** (`tests/notas-motor.test.js`, el que reemplaza «N° 2/26» por «N° XX») pasa a reemplazar todas las apariciones del número.
- `npm test` completo antes y después.

## Simulación corta (pedido del usuario)

- **Alcance:** la corrida principal, del 25/10/2026 al 05/01/2027, con la licencia del titular y la persona autorizada; sin las escenas. Se usan las mismas barreras y la misma base de origen que la simulación de la hoja oficio.
- **Control nuevo:** en cada anexo de reiteración (02/11, 01/12 y 04/01), cada hoja lista su propia nota una sola vez, como movimiento más nuevo. Los avisos del ciclo la cuentan. Sigue el control de siempre: notas en 612 × 1008, anexos en A4, nada fuera de los márgenes.
- **Muestras:** en la carpeta del Escritorio, con las de antes guardadas aparte.

## Documentación y despliegue

- **Documentación:**
  - `CLAUDE.md` (sección del anexo de la reiteración: la hoja muestra la reiteración que acompaña);
  - el comentario de `services/notasDigitalesSeguimiento.js`;
  - la spec del 20/10: una línea que remita a esta;
  - la entrada del Changelog del README de esta entrega.
- **Despliegue:** el kit suma los archivos que cambien (servicios), sin SQL y con Restart. Se arma con los archivos de main del momento.

## A cargo de quien implementa

- Los nombres de los ayudantes nuevos.
- Cómo se lee el `nombre_completo` (una consulta antes de la transacción).
- En qué archivo de tests va cada prueba.
