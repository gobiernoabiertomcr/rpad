# Notas Digitales

Las notas del RPAD a la DGMIT: datos solicitados, tablas, anexos, firma, licencia del firmante, hoja, reiteración y la página de Correos.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`
- `docs/superpowers/specs/2026-11-03-reiteracion-bimestral-design.md`
- `docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md`
- `docs/superpowers/specs/2026-10-24-reiteracion-en-su-anexo-design.md`
- `docs/superpowers/specs/2026-10-24-notas-hoja-oficio-design.md`

## Datos solicitados en las Notas Digitales

- La tabla de próximos a vencer del aviso (4 columnas en la interna:
  Conjunto de datos, Área, Frecuencia y Datos solicitados; la externa, 5, que llama "Área responsable" a la segunda y suma "Requiere nota DGMIT" entre Frecuencia y Datos solicitados;
  sin columna de fecha: en el aviso de todos los días todos vencen el mismo día, y si el aviso junta más de un vencimiento —la víspera de una licencia larga, un aviso recuperado tarde— las filas van ordenadas por vencimiento, con una fila a todo el ancho "Vencen el dd/mm/aaaa" ("Vence el …" si es uno solo) antes del primer dataset de cada uno, en el HTML, el texto y el PDF, donde esa fila viaja con la primera de su grupo;
  sale del `vencimiento` de cada dataset y no se guarda) y la de reiteración (7, con Vence o Venció; la externa, con otras 7 columnas: ver "Requiere nota DGMIT y anexo de la reiteración") llevan la columna "Datos solicitados" (el `pedido` de cada ficha, calculado el día de la nota); la sección de vencidos de un aviso también sigue con 7 (las de su gestión).
  El párrafo del aviso externo termina en "…con los datos del período que se indica en cada caso." El anexo (recuadro "DATOS SOLICITADOS") y el email a las áreas de los 40 días también lo dicen; el anexo dice "Vence el dd/mm/aaaa · faltan N días" ("Venció el … · hace N días", "Vence hoy"; la línea de tiempo termina en "Vence") y el email va sin fecha.
  Desde el 18/10/2026 ya no hay "fecha sugerida de envío" en las notas (spec 2026-10-17, sección 18).
- La frecuencia lleva "(Acumulado)" (`frecuenciaEnNota`, `services/fechasDatasetReglas.js`:
  "Trimestralmente (Acumulado)") cuando el tipo de pedido efectivo es `acumulado` y la frecuencia es de 1 a 11 meses: un acumulado pide desde el 1/1 del año del corte, así que la frecuencia y el período no coinciden.
  Va en las tablas del aviso y de la reiteración (HTML, texto y PDF), en el renglón "Frecuencia" del anexo, en el email de 40 días y en la vista previa del admin.
  No se guarda: se arma al generar la nota con el tipo efectivo de `conPedido`.
- Cada nota guarda lo que pidió en `notas_digitales_datasets` (`datos_desde`, `datos_hasta`, `datos_solicitados`): lo ya enviado no cambia.
  Las notas 1/26 y 2/26 quedan en NULL.
- La reiteración recalcula el pedido cada vez (todo lo que falta, R7), no repite el del aviso.
- Los "Qué se solicita" no llevan fechas ni períodos: los pone el sistema (el formulario avisa, sin bloquear, si el texto los trae y el tipo pone fechas).

## Requiere nota DGMIT y anexo de la reiteración (spec 2026-10-20-requiere-nota-y-anexo-reiteracion)

- Tablas de las notas externas (`columnasDe`, `services/notasDigitalesContenido.js`): el aviso (próximos a vencer) tiene 5 columnas (Conjunto de datos, Área responsable, Frecuencia, Requiere nota DGMIT y Datos solicitados; proporciones del PDF `[28, 24, 15, 10, 23]`).
  La reiteración externa, y la sección de vencidos de un aviso externo, tienen 7 columnas reorganizadas:
  Conjunto de datos, Área responsable, Frecuencia, Requiere nota DGMIT, Datos solicitados, Venció (o Vence) e Informado en.
  "Situación" deja de ser una columna: la situación de hoy (la de siempre, `situacion()`:
  "Faltan N días", "Falta 1 día", "Vence hoy", "Vencido hace N días") va en un segundo renglón de la celda de la fecha (`fila.situacion` y `seccion.columnaSituacion`; en el HTML con `<br>` y en el PDF en la misma letra; el texto plano sigue con dos renglones, "Venció: …" y "Situación: …").
  Como la tabla de 7 columnas de la interna es otra, las proporciones del PDF viajan en la sección (`seccion.proporciones`:
  `[18, 14, 10, 10, 13, 10, 25]` con la segunda parte de "Informado en" y `[24, 14, 10, 10, 15, 12, 15]` sin ella).
  La interna no cambia (aviso de 4 columnas, reiteración de 7 con "Situación").
  `COLUMNAS_DATASET` (`notasDigitalesDatos.js`) suma `d.requiere_nota`, y los ejemplos de la vista previa (`ejemplo()`) llevan Sí en el próximo y No en el vencido.
  No se guarda en `notas_digitales_datasets`: la nota queda en bytes y lo ya enviado no cambia.
- Email de los 40 días al área:
  `datasetsExternosPorArea` (`avisosDiariosService.js`) deja afuera a los `requiere_nota = 0` (`AND (d.requiere_nota IS NULL OR d.requiere_nota = 1)`), porque ese email anticipa una nota formal que ese dataset no recibe.
  La vista previa y la prueba del email en Correos usan la misma función.
  Un dataset con "No" no desaparece de ninguna nota a DGMIT.
- Anexo de la reiteración (interna y externa): un solo PDF, con una hoja A4 por dataset de la nota en el orden de la tabla (primero los próximos a vencer y después los vencidos:
  `ordenDeLaTabla`), cada una la hoja del Seguimiento de ese dataset (`seguimientoDe(fuentes, fecha, OPCIONES_CINTA_PDF, { anexo: true })`, con la fecha de la nota como hoy;
  `{ anexo: true }` deja neutral el tramo de la nota formal sin nota DGMIT: ver «Notas DGMIT»).
  Arriba a la derecha va "Seguimiento del dataset" con la fecha larga de la nota; el pie, "Generado el dd/mm/aaaa a las hh:mm" (sin "por": es automático) y "Anexo de la Nota Digital N° 9/26 · Hoja 3 de 10" (el número como lo escribe la nota, `textoNumero`:
  "XX" en la vista previa, "PRUEBA" en la prueba).
  La hoja muestra también la propia reiteración que lo acompaña, como las demás notas (spec 2026-10-24-reiteracion-en-su-anexo; antes de su despliegue no la mostraba, porque el Seguimiento se calculaba antes de que la nota existiera): es el movimiento más nuevo ("Nota Digital N° 2/27 a DGMIT", con la fecha de la nota, "Reiteración de gestión …: vence (o vencía) el dd/mm/aaaa.
  Pide: …", "Envío automático" o "Generada por …" y "Firmó …"), suma uno en "Avisos del ciclo abierto" (la lista de números termina en el suyo) y tiene su marca en la cinta ("Nota 2/27", en la fila de arriba, el día de la nota).
  Se suma en memoria y solo en el anexo:
  `seguimientosDeLaNota(datasets, fecha, fuentesPorId, propia)`, con `propia`, le agrega a una copia de las fuentes de cada dataset (las de `fuentesDeLaNota`, que nunca se modifican) la nota que arma `notaPropiaDe`, con la forma de `aNota` (`seguimientoDatos.js`) y lo que `generarNota` va a guardar (`estado` 'enviada', porque el anexo viaja en el mismo email; la sección con la regla del INSERT de `notas_digitales_datasets`; el vencimiento y el pedido del dataset; para y cc;
  `creado_por` y `firmante`, con su `nombre_completo`), y antes le saca la reiteración de la misma gestión y la misma fecha que ya estuviera: la nota nunca va dos veces en una hoja.
  En la vista previa el número es "XX" y en la prueba "PRUEBA", sin año ("Nota Digital N° XX a DGMIT", "Nota XX":
  `numeroDeNota` y `etiquetaDeNota` aceptan un número sin año).
  Si el email de la reiteración no sale nunca, su anexo guardado la muestra igual como enviada (efecto aceptado).
  El Seguimiento de la pantalla y la descarga de su PDF no cambian: ahí la nota aparece cuando ya está en la base, con su estado real (pendiente, enviada o fallida), y la pendiente o la fallida no cuentan como aviso.
  Código:
  `seguimientosDeLaNota`, `fuentesDeLaNota`, `notaPropiaDe` y `renderAnexoDeReiteracion` (`services/notasDigitalesSeguimiento.js`) y `renderAnexoDeSeguimiento` (`seguimientoPdf.js`).
- Cuándo se genera: en `generarNota`, como el anexo del aviso.
  Las fuentes (`fuentesDeLaNota`:
  `fuentesDe`, una sola llamada con todos los ids) y el `nombre_completo` de quien la genera y del firmante titular (`nombresDeLaReiteracion`) se leen antes de abrir la transacción; adentro, ya con el número, se calculan los Seguimientos con la propia reiteración (`reiteracionPropia`; el mismo momento da la hora de su movimiento y la del pie) y se dibuja el PDF; queda en `notas_digitales.anexo_pdf` y nunca se regenera (la descarga, el envío y los reintentos usan esos bytes).
  Si el anexo falla, o le falta la fuente de un dataset, la reiteración no se genera (se registra el error y se reintenta en la próxima corrida): no sale una nota que diga "Anexo: … (10 hojas)" sin el anexo.
  Las notas anteriores, y las pendientes o fallidas generadas antes del despliegue, quedan como estaban, sin anexo (`NOTA_SIN_ANEXO`).
- La nota y el email: renglón nuevo "Anexo: seguimiento de los conjuntos de datos (N hojas)." ("1 hoja" si es una; el del aviso sigue siendo "Anexo: reporte de los conjuntos de datos (N hojas).":
  `ANEXO_DE`), en el HTML, el texto y el PDF.
  La primera línea del email del aviso y de la reiteración es "SE ADJUNTAN NOTA Y ANEXO EN PDF"; la autorización y la auditoría siguen con "SE ADJUNTA NOTA EN PDF" (`AVISO_ADJUNTO`:
  `conAnexo` y `soloNota`).
  `enviarNota` adjunta `Anexo-Nota-Digital-N-AA.pdf` cuando hay `anexo_pdf`.
  Con el anexo guardado, el Libro muestra el botón "Anexo", `tiene_anexo` es verdadero, `descargarAnexo` lo entrega y el Seguimiento ofrece "Descargar la nota y su anexo".
- Vista previa y prueba en Correos:
  "Ver anexo" sirve para el aviso y la reiteración (`previewAnexo({ tipo, gestion })`, `GET /api/notificaciones/notas-digitales/preview/anexo?tipo=&gestion=`, `API.previewNotaAnexo`; con auditoría o autorización da 400).
  Con datos reales, el anexo es el del día que muestra la nota (la misma selección y fecha: ver la convención de `correos.js`); con datos de ejemplo, uno armado en memoria con `fuentesDeEjemplo` (`fuentesDe` descarta los ids de `ejemplo()`, 0 y -1).
  La prueba de una reiteración adjunta su anexo.
  En los dos, el anexo suma la propia reiteración:
  "XX" en la vista previa (con "Envío automático" y el para y el cc de `destinatarios`) y "PRUEBA" en la prueba.
  Con datos reales, desde los feriados en todo el sistema (spec 2026-10-27-feriados-en-notas, 4), una vez que salió la reiteración del mes (con la marca del mes escrita, `reiteracion_evaluada_*`) o en un mes que no toca, la vista previa y la prueba de la reiteración son las del próximo mes que toca, la fecha que anuncia el Estado: muestran la real, enviada, y además la suya con la fecha de ese día.
  Solo si la marca del mes no quedó escrita (el `UPDATE` falló después del envío) siguen siendo las del mismo día, con "XX" o "PRUEBA" en lugar de la real (es la regla que evita que la nota vaya dos veces, no un error).
- Tests:
  `tests/requiere-nota-reglas.test.js` (puro) y `requiere-nota-api.test.js` (alta, edición, aprobación y comparaciones; necesita Docker);
  las tablas nuevas están en `notas-contenido.test.js` y `notas-pdf.test.js` (con `tests/pdf-lector.js`: la reiteración real del 02/11, ningún título partido) y el anexo en `notas-seguimiento-anexo.test.js` (puro, con los casos reales:
  la propia reiteración en los movimientos, los avisos del ciclo y la cinta, sin duplicados y sin tocar las fuentes), `notas-motor.test.js` (la corrida real, la fallida, la vista previa y la prueba), `notas-api.test.js` y `seguimiento-pdf.test.js` (N hojas, una por dataset, el pie "Hoja k de N").

## La reiteración bimestral

- La reiteración de las Notas Digitales (spec 2026-11-03-reiteracion-bimestral) sale solo en enero, marzo, mayo, julio, septiembre y noviembre (`MESES_DE_REITERACION` y `esMesDeReiteracion`, `services/notasDigitalesCalendario.js`), el primer día con notas de ese mes, con una evaluación por mes y gestión, y cada gestión con su nota.
  En un mes que no toca, `correrPasos` salta solo ese paso y no escribe la marca `reiteracion_evaluada_*`, que sigue diciendo el último mes evaluado: los reintentos (también de una reiteración fallida), los avisos, la autorización y la auditoría salen igual, y no se gasta ningún número.
  `proximasFechas` anuncia con `primerDiaDeReiteracion`, que mira el resultado de `primerDiaConNotas` y no su punto de partida (un sábado de fin de mes, una licencia que termina en un mes que no toca), y de ahí salen el Estado, la vista previa y la prueba.
  Un mes que toca y se pierde (una licencia sin persona autorizada que lo cubre entero, el envío apagado, una generación que falla en todas sus corridas) espera al próximo que toca; lo que `yaTocaReiterar` manda a la reiteración, también.
  Volver al código anterior en un mes par genera en la corrida siguiente la reiteración de ese mes (el kit trae un SQL opcional que escribe la marca).
  Los tests no dependen del mes en que corren (`HOY` fijo en `tests/notas-motor.test.js`, comprobado con el reloj en diciembre y en febrero).

## Firma de las Notas Digitales y licencia del firmante

- Cada usuario carga su firma en Mi Perfil (`usuarios_firmas`).
  El superadmin elige al firmante titular en Correos (`notas_digitales_config.firmante_usuario_id`).
  Sin titular elegido, las notas usan la firma cargada en Correos, como antes.
- `services/notasDigitalesFirmas.js` decide cómo se firma cada fecha (`firmaParaFecha`).
  La víspera de la licencia del titular se anticipan los avisos (`anticipoPorLicencia`).
  Todo se cuenta con el calendario de la corrida (spec 2026-10-27-feriados-en-notas, 3: los 9 fijos y la tabla): la víspera y el último día hábil (`autorizacionPendiente`, `anticipoPorLicencia`), los días libres de la persona autorizada (`disponibilidadDelAutorizado`, `diasHabilesLibres`), sus ausencias unidas (`unirAusencias`) y el día del aviso en su fecha (`diaDelAvisoEnSuFecha`);
  por ejemplo, la víspera de una licencia desde el 09/12/2026 es el viernes 04/12 (el 07/12 es no laborable y el 08/12, fijo).
  Con persona autorizada, esos avisos (o una nota de tipo `autorizacion`) comunican la autorización (`autorizacionPendiente`); la licencia guarda esa nota (`usuarios_licencias.nota_autorizacion_id`) y durante la licencia las notas salen con las dos firmas y una leyenda que la cita.
  Durante la licencia, cada dataset adelantado vuelve a salir en un aviso en su fecha (su `cuenta_desde`, o el último día hábil anterior en que la persona autorizada está disponible), presentado por ella y con el párrafo "Este pedido ya se había adelantado por Nota Digital N° …", que cita la nota anticipada solo si se envió (si quedó pendiente o fallido, el dataset entra igual y no se nombra;
  `diaDelAvisoEnSuFecha` en `services/licenciasReglas.js`, `pendientesEnSuFecha` en `services/notasDigitalesDatos.js`, spec 7.6).
  Un `cuenta_desde` guardado que cae en un feriado de la tabla (un anticipo hecho con los 9 fijos, o un feriado cargado después) se presenta el hábil anterior dentro de la licencia; el guardado no cambia y los 20 días de la reiteración se siguen contando desde él.
  Si se recupera 20 días tarde o más (por ejemplo, una autorización cargada con la licencia avanzada), los datasets que ya tienen que reiterarse quedan afuera: los informa la reiteración.
  La reiteración da una fila por dataset y "Informado en" nombra todos sus avisos.
  La persona autorizada puede tener una licencia propia que se superponga en parte o del todo con la del titular (decisión del usuario, 27/10/2026:
  «si no está, no se presentan notas»; ni Configuración → Licencias ni Mi espacio la frenan).
  Cada día cuenta por separado (`firmaParaFecha`): los días en que ella falta son «sin autorizado» y no se generan notas.
  Lo advierten, sin frenar, el formulario del titular al elegirla (en Configuración → Licencias y en Mi espacio, `textoAusenciasAutorizado`: los días en que ella está de licencia) y, en Mi espacio, el cálculo previo de la licencia de ella (`textoAutorizadaDelFirmante`); en Configuración, la licencia de ella se carga sin aviso.
  Si en la víspera ya no le queda ningún día hábil de la licencia del titular (`autorizadoParaLicencia` da null), la autorización no se comunica y toda la licencia es «sin autorizado»: los avisos se anticipan igual y la reiteración que toque sale a la vuelta, si es un mes de reiteración, o en el próximo; si ya se había comunicado, `nota_autorizacion_id` queda como estaba y no sale ninguna nota que la revoque.
  El Estado lo muestra como advertencia:
  «está de licencia hasta el …» (`autorizado-de-licencia`) o, sin ningún día, `autorizado-no-vigente` como advertencia (desde esa decisión:
  `deLicenciaTodosLosDias` de `licenciaDelFirmante`, que solo usa el Estado).
  La misma alerta, con el mismo mensaje, sigue siendo un error si la persona autorizada está desactivada, perdió su rol o no tiene la imagen de su firma (`autorizadoHabilitado` da null): eso sí hay que arreglarlo.
  Que le quede algún día hábil se controla solo cuando el titular la elige o la cambia (`autorizado_sin_dias`, 409 en `autorizado_id`; corregir solo las fechas no la vuelve a controlar:
  `rechazoDeLaBase`).
  Sin autorizado, durante la licencia no se generan notas y la reiteración que toque sale a la vuelta, si es un mes de reiteración, o en el próximo (ver «Recordatorios automáticos»).
  Un aviso anticipado cuenta los 20 días de la reiteración desde `notas_digitales_datasets.cuenta_desde`.
- La víspera sin anticipo (spec 2026-10-27-feriados-en-notas, 4 y 6):
  `visperaDeLaLicencia(licencia, otras, calendario)` (`services/licenciasReglas.js`, pura) → `{ vispera, sin_anticipo, sin_dias_habiles }`, en este orden: sin ningún día hábil, `sin_dias_habiles` (no cambia las notas);
  si el día hábil anterior al inicio cae en otra licencia del titular sin anular (`otras`), `sin_anticipo`: empieza a continuación de otra, ese día no firma el titular y la corrida no adelanta los avisos (lo que toque avisar sale el primer día con notas: con persona autorizada, desde el primer día de la licencia, después de la nota que comunica la autorización; sin ella, a la vuelta); si no, la víspera, el día hábil anterior.
  Con fechas que no sirven (también `desde` > `hasta`) o el `RangeError` del tope, `SIN_VISPERA` (todo null o false); un calendario null o mal armado tira.
  La usan Correos → Estado (`licencia_firmante`, con `sin_anticipo` al final), Configuración → Licencias (`aRespuesta`) y Mi espacio (`paso.firmante`); sus textos los dicen `efectoEnNotas` (Configuración y su copia en Mi espacio: ver «Configuración») y `textoLicenciaFirmante` (Correos: ver la convención de `correos.js`).
  Un test de `feriados-en-notas.test.js` confirma que la corrida hace lo que dicen.
- «El primer día con notas» (spec 2026-10-27-feriados-en-notas, 4): un día hábil con el calendario en que la corrida genera notas, porque el modo del día no es «sin autorizado» (licencia del titular sin persona autorizada, o con ella de licencia, desactivada o sin firma).
  `modoDelDia(config, fecha)` (`notasDigitalesFirmas.js`) da el modo de `firmaParaFecha` sin leer las imágenes de las firmas (`firmaParaFecha` lo usa primero y lee la firma solo de ese modo), y `primerDiaConNotas(config, desde, calendario)` recorre de `desde` a `desde` + 366 (salta los días no hábiles de a uno y, en uno «sin autorizado», hasta el primer día libre de la persona autorizada o la vuelta del titular); null si no hay.
  Toda fecha que anuncia Correos → Estado sale de esa regla, en un solo lugar (`proximasFechas` de `notasDigitales.js`, que usan también la vista previa y la prueba de la reiteración y de la nota de auditoría, `diaDeVistaPrevia`; la del aviso es `fechaDeVistaPrevia`, el primer día con notas desde hoy —si no hay ninguno, hoy— con su motivo).
  Con el envío automático apagado, el Estado sigue anunciando las fechas, y el primer recordatorio que van a poner las corridas de las 14:00 no se predice (como antes).
  Las fechas:
  - el próximo aviso de cada gestión: el candidato es la apertura del mes menos la ventana, o la próxima corrida si ya pasó; si la víspera de una licencia del titular lo anticipa (`anticipoQueIncluye`: la licencia que incluye el primer día hábil del candidato, cualquiera —la en curso o próxima, o una posterior—, con su víspera desde la próxima corrida, ese día con el titular firmando, `modoDelDia`, y `anticipoPorLicencia` alcanzándolo), la víspera; si no, el primer día con notas desde el candidato;
    con persona autorizada, el aviso en su fecha si es antes o el mismo día (el primer día con notas desde su día, solo dentro de la licencia);
  - la reiteración: el primer día con notas de un mes que toca (`primerDiaDeReiteracion`), desde el 1° del mes siguiente, si la del mes ya se evaluó (`reiteracion_evaluada_*`), o desde hoy (con el firmante del 09/12 al 08/01 y la persona autorizada del 04/01 al 15/01, las de enero salen el 11/01, y así lo anuncia el Estado);
  - la nota de auditoría (`estadoAuditoria`): el canal, en el primer día con notas; cada reiteración, el primer día con notas desde 5 días hábiles después de la última, nunca antes de la primera libre, confirmada con la selección de la corrida en esa fecha (`seleccionarParaAuditoria`);
    `sin_quien_audite` se sigue contando en la próxima corrida posible;
  - la licencia del firmante (`licenciaDelFirmante`): la víspera y sus marcas (`visperaDeLaLicencia`, con la licencia del titular que incluye el día hábil anterior al inicio), el último día hábil y la vuelta, el primer día con notas después de la licencia (así ve una que sigue a otra);
  - la alerta «la corrida de ayer no corrió» (`debioCorrer`: el día hábil anterior, con el calendario).
- Límites sabidos (spec 2026-10-27-feriados-en-notas, «Límites sabidos»): la víspera es exacta (si alguien carga un feriado en la víspera el día anterior a ella, después de las 8:15, la nueva víspera ya pasó y el adelanto se pierde, como cuando se carga tarde la licencia);
  un `cuenta_desde` en un feriado que es el primer día de la licencia lo toma la reiteración solo si el aviso anticipado se envió (si quedó fallido para siempre no lo toma nadie, igual que cuando la persona autorizada falta desde el primer día);
  una licencia del titular sin días hábiles justo antes de otra (por ejemplo, del 07/12 al 08/12, y otra desde el 09/12): la corrida no adelanta los avisos de la segunda (`anticipoPorLicencia` toma la primera) y Configuración anuncia su víspera igual (pasaba también con los 9 fijos con una licencia de fin de semana;
  Mi espacio no deja cargar una licencia sin días hábiles; decisión del usuario, 28/10/2026); el formulario de Configuración → Licencias, con una fecha de inicio nueva, dice «el último día hábil anterior» sin preguntarle al servidor (en una licencia que sigue a otra anuncia un adelanto que no va a pasar; la fila guardada dice lo real, y Mi espacio lo dice antes de guardar, con su cálculo previo); y lo ya enviado no cambia (las notas, sus anexos y los `cuenta_desde` guardados).
- Personal contratado (`usuarios.vinculo = 'contrato'`): en su firma, entre el nombre y el cargo, va el renglón más chico `Personal contratado, cumpliendo funciones de`; en los párrafos (leyenda, autorización, "Propuesto por") dice `personal contratado, cumpliendo funciones de {cargo}`.
  Sale solo de `cargoEnTexto` y `renglonesDeFirma` (`services/notasDigitalesContenido.js`); quien no es contratado sale como siempre.
- Letra de la firma (pedido del usuario el 21/10/2026), en todas las notas y en las dos firmas:
  `renglonesDeFirma` devuelve `{ texto, tipo }` (`nombre`, `contratado` o `cargo`) y cada salida elige la letra por el tipo.
  PDF (`LETRA_FIRMA`, `services/notasDigitalesPdf.js`): el nombre en Helvetica negrita de 11 pt, el cargo en 10 y el renglón del personal contratado en 8;
  `dibujarFirma` termina en la letra normal de 11 pt, así el aire hasta la leyenda (0,8 renglones) y la línea CC (1,5) no cambia, y la reserva del cierre mide cada renglón con su letra (el nombre, en negrita).
  HTML (`RENGLON_FIRMA_HTML`):
  `<b>` en los 15 px de la nota, el cargo en 14 px y el renglón en 11 px.
  El texto plano no cambia.
  Mi Perfil ("Así sale en las notas", `muestraDeFirma`):
  `.firma-muestra-nombre` (15 px, 700), `.firma-muestra-cargo` (14 px) y `.firma-muestra-chico` (11 px).
  `tests/pdf-lector.js` devuelve también la letra de cada texto (`fuente`:
  Helvetica, Helvetica-Bold…).
- El cierre se mide de verdad (pedido del usuario el 21/10/2026; antes se reservaba con un alto fijo de 200 pt y un cierre que entraba pasaba a la hoja siguiente): el remitente, la firma (o las dos, con la leyenda) y la línea CC los dibuja `dibujarCierre`, y `medirCierre` dibuja ese mismo cierre en un documento borrador (sin las imágenes, que no corren el texto) y mide cuánto bajó; se reserva eso más `HOLGURA_CIERRE` (1 pt).
  El título "Justificación:" también se mide (negrita y su aire), y la reserva del último párrafo suma el aire que deja debajo.
  Las reglas de qué viaja junto no cambian (el anexo con la justificación, el título con su primer párrafo, el último párrafo o el último bloque de "Importancia" con el cierre): si el bloque entero entra, queda; si no, pasa entero a la hoja siguiente.
  Vale para todas las notas (`renderPdf`).
  Test:
  `tests/notas-pdf.test.js`, "el cierre se mide de verdad" (los cuatro tipos, interna y externa, con una firma con imagen, sin imagen y dos firmas: si la nota entera entra en la hoja sale en una, y si no, en dos).
  La línea CC vacía (autorización y auditoría) no se dibuja.
- Hoja de la nota (spec 2026-10-24-notas-hoja-oficio): el PDF de la nota sale en oficio Legal, 612 × 1008 pt (8½ × 14 pulgadas, 215,9 × 355,6 mm;
  `PAGINA` de `services/notasDigitalesPdf.js`, privada; no `216 × 356 mm`, que daría 612,28 × 1009,13 y una impresora podría tomarlo como tamaño personalizado), en todas sus hojas y para las cuatro clases de nota, la prueba y la vista previa de Correos.
  Los márgenes y el membrete no cambiaron: todo lo que depende de la hoja la lee de `PAGINA` o de `doc.page.height` (ningún alto fijo), y cada hoja tiene 26 mm más para el texto (con el membrete real, el alto útil pasa de 265 a 291 mm).
  Los anexos (el del aviso y el de la reiteración), el Seguimiento y los reportes siguen en A4, cada uno con su `size: 'A4'`:
  `DocumentoNota` no tiene tamaño (si lo tuviera, cambiarían todos los A4).
  Las notas generadas antes del despliegue (enviadas, pendientes o fallidas) conservan su PDF de 216 × 330: queda en bytes en `notas_digitales.pdf` y nunca se regenera.
  Tests:
  `tamanosPorHoja` de `tests/pdf-lector.js` (el ancho y el alto de cada hoja, con `HOJA_A4`, `HOJA_OFICIO`, `esDelTamano` y `todasDelTamano`, que exige al menos una hoja), la hoja oficio en `notas-pdf.test.js` ("renderPdf: hoja oficio Legal":
  todas las hojas de toda clase de nota, con membrete y sin él, y una nota que en la hoja de 330 mm pasaba a una segunda entra en una) y el A4 en `notas-anexo.test.js` y `seguimiento-pdf.test.js` (todas las hojas del anexo del aviso, del Seguimiento y del anexo de la reiteración);
  `notas-motor.test.js` comprueba que el `pdf` guardado del aviso y de la reiteración y la nota de prueba que se envía son oficio y sus anexos (el `anexo_pdf` y el de la prueba), A4;
  `notas-api.test.js`, que la vista previa de Correos ("Ver PDF") sale en oficio.

## La página: correos.js

- `correos.js`: pestañas Libro de Notas Digitales (la inicial), Estado, Vista previa y pruebas y Configuración (`#libro`, `#estado`, `#pruebas`, `#configuracion`); las alertas del Estado van arriba de las pestañas, con una marca en Estado.
  La vista previa y la prueba muestran la nota del día en que sale de verdad, con la misma selección que la corrida (`diaDeVistaPrevia` del servidor; spec 2026-10-27-feriados-en-notas, 4): el aviso, el de la próxima corrida con notas (`fechaDeVistaPrevia`, con `avisoDelDia`); la reiteración y la nota de auditoría, la fecha que anuncia el Estado para ese tipo y esa gestión (`proximasFechas`; si no anuncia ninguna, la de `fechaDeVistaPrevia`).
  Si no es hoy, lo avisan: con `motivo` (hoy no se generan notas, spec 2026-10-15, 7.7), «Hoy no se generan notas (…): así saldría el …»; sin él y con `otro_dia` (solo el `true` literal: hoy hay notas, pero esta sale otro día, por ejemplo porque la reiteración de este mes ya salió o porque el mes no toca), «Esta nota no sale hoy: así saldría el {fecha}.»;
  en los dos casos la segunda línea habla de «ese día» (`textoDeVistaPrevia`), y la prueba dice «Prueba enviada a … (como saldría el {fecha})» (lo arma el servidor, `mensajeDePrueba`, y `otro_dia` viaja también en su `data`).
  `textoLicenciaFirmante`, en una licencia futura con `sin_anticipo` (solo el `true` literal: empieza a continuación de otra licencia del titular), dice que los avisos no se adelantan, con los dos textos de la spec 2026-10-27-feriados-en-notas, 6 (sin persona autorizada, «… y las notas vuelven el {vuelta}.
  La reiteración que toque sale ese día si es un mes de reiteración; si no, en el próximo.», `REITERACION_A_LA_VUELTA`, que también dicen la licencia futura y la que está en curso sin persona autorizada: spec 2026-11-03-reiteracion-bimestral, 5; con ella, «… {nombre} presenta las notas por autorización, con las dos firmas, desde el primer día.»), y con `sin_dias_habiles`, que no tiene días hábiles y las notas no cambian.
  La alerta `feriados-sin-leer` llega en `estado.alertas` y se dibuja y prende la marca como las demás.
  "Ver anexo" sirve para el aviso y la reiteración (`TIPOS_CON_ANEXO`) y queda deshabilitado con la auditoría (el selector de Vista previa ofrece Aviso, Reiteración y Auditoría);
  `API.previewNotaAnexo(gestion, tipo)` pide el anexo del tipo elegido y el archivo se llama `Anexo-vista-previa-<tipo>-<gestión>.pdf` (el del aviso, sin el tipo, como siempre).
  Desde la agenda de Mi espacio, el Estado suma la línea de los recordatorios, `#nd-eventos`, justo debajo de `#nd-ultima-corrida`:
  `cargarEstado` le escribe con `textContent` el `estado.eventos.texto` que arma el servidor («Recordatorios de la agenda: última corrida hoy a las 10:30.
  Recordatorios enviados: 2.») y la oculta si queda vacía (sin `estado.eventos`, con null o con una respuesta de antes); sus alertas llegan en `estado.alertas` y se dibujan y prenden la marca como las demás (ver «Recordatorios automáticos»).
  Como `perfil.js`, al cargarse solo declara (los tests lo cargan en un `vm`).

## Archivos de tests

`requiere-nota-reglas.test.js`, `requiere-nota-api.test.js`, `notas-contenido.test.js`, `notas-pdf.test.js`, `notas-seguimiento-anexo.test.js`, `notas-motor.test.js`, `notas-api.test.js`, `seguimiento-pdf.test.js`, `feriados-en-notas.test.js`, `notas-anexo.test.js`
