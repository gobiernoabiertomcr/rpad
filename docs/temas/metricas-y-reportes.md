# Métricas y Reportes

Cuánto tarda cada paso del circuito, la foto del 31/12, y los PDF de la pestaña Reportes.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`
- `docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md`
- `docs/superpowers/specs/2026-11-03-reiteracion-bimestral-design.md`

## Archivos

metricasController:
GET /api/metricas y su PDF, y los datos del Ciclo de vida del dato;
gestionController: solo las métricas de /gestion/metricas, el CSV y las métricas manuales;
metricasReglas (los casos, la vista, el contexto, el trabajo, las áreas y las etapas del Ciclo de vida del dato, puro), metricasCinta (la cinta del recorrido típico, pura), metricasOpciones (los años, la foto que toca y los parámetros, puro) y metricasFoto (la foto del 31/12);
reportesPdfBase (la base de los PDF) y un archivo por reporte (reportesMetricasPdf, reportesCicloDeVidaPdf, reportesInformeAnualPdf, reportesEstadoGeneralPdf, reportesPorAreaPdf, reportesAvisosPdf, reportesAgenda + reportesAgendaPdf y reportesParaCompletarPdf), y reportesNombres (los nombres de los PDF);

## Métricas y Reportes (spec 2026-10-24-metricas-y-reportes)

- Qué es:
  Herramientas → **Métricas y Reportes** (`reportes.html` + `js/reportes.js`; el archivo conserva su nombre; con su `<style>` y los tokens del Seguimiento, sin `publico.css`), para todos los roles con sesión (sin sesión, al login).
  Dos pestañas con hash y `aria-selected`, como Correos:
  Métricas (la inicial, `#metricas`) y Reportes (`#reportes`).
  Solo escribe administración: las métricas manuales («Cargar el mes»).
  Mide cuánto tarda cada paso del circuito de cada ciclo: el RPAD (la DDPC) avisa; en gestión externa, la DGMIT y la Dirección Administrativa mandan la nota formal, el área entrega y la DDPC prepara y carga; en interna, la DGMIT y la Dirección de Investigación Territorial hacen el relevamiento y la DDPC lo carga.
  Los días son hábiles (con el calendario único: de lunes a viernes, sin los 9 fijos ni los feriados de la tabla, desde la tanda 2 de los feriados en todo el sistema, spec 2026-10-27-feriados-en-notas, 5; ver «Recordatorios automáticos») o corridos.
  Antiobjetivos: que algo se lea como un reproche o un control sobre la DGMIT (sin nota cargada, «pendiente de carga», nunca que no la mandó, y sin días); que un caso que nunca termina desaparezca (los en curso se muestran siempre al lado); que un número calculado sin algunos datasets se tome por el completo; que el índice diga una cosa en la portada y otra acá.
  Nombres neutros: nunca «tardanza», «demora» ni «atraso».
- Reglas (`services/metricasReglas.js`, puro: sin pool ni `Date` local, fechas `'AAAA-MM-DD'`, ninguna tira, salvo con un calendario mal armado; desde la tanda 2 de los feriados en todo el sistema, los días hábiles se cuentan con el calendario que reciben —`calendario` en las opciones de `casosDe`, `vistaDe` y `etapasDe`, y adentro, en el contexto de `contextoDe`; sin él, o con null, `CALENDARIO_FIJO`;
  las internas, `diaDelAvisoDe` y `casosDelDataset`, sin valor por defecto—): la unidad es el ciclo del Seguimiento, con su código (`ciclosDe`, `cicloDelAviso`, `notasDgmitPorCiclo` con R7, `esEmailADgmit`, `esNotaEnviada`, `momentoDeEnvioDeNota`, `unirAlta`: no hay copias de esas reglas; las métricas y el Seguimiento ubican cada aviso y cada nota DGMIT en el mismo ciclo).
  `casosDe(fuentesPorDataset, { hoy, calendario })` da un caso por ciclo (también de los dados de baja y con `venc` null; nunca de eventuales ni sin fecha) con sus hitos: el aviso de la regla (el email `externo-40` o `interno-60` con `success`, o la Nota Digital de aviso enviada con ese `vencimiento`, el primero, con fecha ≤ vencimiento;
  40 días en externa y 60 en interna, `VENTANA_DE_LA_REGLA` = `VENTANA_DIAS` del calendario, Ruling 30), el primer aviso, si se avisó ya vencido (`heredado`: solo si el RPAD no pudo avisarlo a tiempo —la fecha de la regla es anterior al 06/12/2025, `INICIO_DEL_REGISTRO`, o al alta— y el primer aviso llegó después del vencimiento), la primera nota DGMIT vigente, el «Recibido el» y el origen de la actualización que cerró el ciclo y la carga.
  Los tramos: aviso anticipado (aviso de la regla → vencimiento;
  DDPC), redacción y entrega de nota (aviso → nota DGMIT recibida;
  DGMIT y DA; su clave interna es `tramite`) y respuesta del área (nota → datos recibidos;
  Área), los dos solo en externa con «Requiere nota» Sí o sin dato, o con una nota DGMIT cargada; producción del relevamiento (aviso → datos;
  DGMIT y DIT; interna); preparación y carga (datos → carga;
  DDPC; las dos).
  `duracion(desde, hasta, dias, calendario)` con piso 0 (`diasHabilesTranscurridos` del calendario o `diasEntre`).
  Un avisado ya vencido no cuenta en la anticipación (el resto se cuenta desde ese primer aviso); un ciclo sin el aviso de la regla que no estaba vencido en su primer aviso no cuenta en los tramos que empiezan en el aviso; con origen `fuente_publica` no cuenta la respuesta del área (y la carga cuenta desde que se obtuvo la fuente);
  `venc` null no cuenta en nada que necesite el vencimiento; una reprogramación no tiene datos ni carga.
  Un tramo terminado cuenta en el año de su hito final; en curso, solo la respuesta y la producción, en un ciclo abierto («4 sin datos registrados todavía, hace 41 días hábiles (mediana)», siempre con la unidad:
  Ruling 11;
  «Preparación y carga» nunca está en curso); el tramo de la DGMIT sin nota es «pendiente de carga», sin días, y sin ninguna nota DGMIT vigente en todo el RPAD dice «Todavía no hay notas DGMIT cargadas» (`SIN_NOTAS_DGMIT`).
  La cifra (`cifraDe`): la mediana (con n par, el promedio de las dos del medio) o el promedio, redondeados, con la unidad al lado («27 días hábiles»; singular solo con 1, `unidadDe`) y debajo «mediana de 32 ciclos»; 0 es «En el día»; sin casos, «Sin casos en 2026»; con 4 o menos, «con tan pocos casos, es orientativo».
- `vistaDe(casos, { anio, al, estadistico, dias, sin, calendario })` (`al`: hoy en el año en curso, el 31/12 en uno cerrado; lo de después no cuenta):
  `circuito` (los tramos de cada gestión y las aclaraciones: los avisados ya vencidos, los resueltos con una fuente pública y, si los hay, los de «Requiere nota:
  No», «N ciclos son de datasets que no requieren nota DGMIT: cuentan solo en el aviso anticipado y en la carga.»), `resultados` (actualizados a tiempo: los cerrados por actualización en el año con carga ≤ vencimiento, con el desglose por gestión y cuánto después se cargaron los otros;
  cobertura del aviso: el denominador son los ciclos con vencimiento en el año que ya esperaban el aviso de la regla (`esperabaElAviso`: el día del aviso —la fecha de la regla o, si no es hábil, el hábil siguiente, `proximoDiaHabil` del calendario, el mismo con que lo dicen la Agenda de pedidos y el envío (desde la tanda 2 de los feriados en todo el sistema, con los feriados de la tabla)— ya pasó, y ese mismo día cuenta solo si el aviso ya salió, porque la corrida es a las 8:15;
  y el ciclo regía en el RPAD ese día: uno que dejó de regir antes —por la aprobación que lo cerró, no por la carga, o por la baja— no lo esperaba y no está en el denominador ni falta; revisión final, A-1 y A-2), sin los de antes del 06/12/2025 —Ruling 5—, y los que faltan van con su motivo —«el email no se pudo enviar», «se dio de alta con el vencimiento ya cerca» (o «se dio de alta ya vencido», si el alta fue después del vencimiento), «se avisó ya vencido», «sin el aviso de la regla»:
  Ruling 7—; reiteraciones del RPAD a la DGMIT —Ninguna, 1, 2 o más— y de la DGMIT al área —Ninguna, 1 o más—, de los ciclos que terminaron en el año y de los abiertos a `al`, con la aclaración «Hasta el 12/10, el email de los 5 días y el resumen mensual de vencidos se sumaban a cada ciclo.» si algún ciclo tuvo una reiteración por email —un email a la DGMIT posterior al inicio de sus tramos:
  el de la regla no lo es—, Ruling 21, y, con ciclos, en el mismo campo y después de ella, «Desde diciembre de 2026, la reiteración sale cada dos meses.», spec 2026-11-03-reiteracion-bimestral, 6), `casos` (una fila por ciclo que toca el año, Ruling 9) y `para_completar` (las notas DGMIT pendientes de carga —externos activos con nota requerida, avisados y sin nota, en un ciclo abierto o cerrado en el año por actualización con origen `area` o sin dato, o por reprogramación;
  nunca los cerrados por la baja:
  Ruling 10— y las actualizaciones del año sin «Recibido el» o, en externa, sin origen; no cambia con lo destildado: es una lista de tareas).
- El contexto, el trabajo y las áreas (también en `metricasReglas.js`), con el reloj del RPAD: el estado de un día según las aprobaciones, como lo mostraba la portada ese día (Ruling 12).
  `indiceMesAMes`: un punto por el primer día de cada mes del año (tomado a fin de mes, un vencimiento no se vería) y el último es `al`; el de hoy da lo mismo que `tasaDeActualizacion` (test); un día con más del 10 % de estado desconocido (ciclos con `venc` null) no tiene índice y no se dibuja.
  `antiguedadDeVencidos` (por días corridos: menos de 90, de 90 a 365 y más de 365, y «Al 1/1/2026 eran 20: de esos, 11 ya se actualizaron.») y `estadosAl` (cuántos en cada estado), juntos en `contextoDelAnio`.
  `trabajoDelAnio`: avisos y notas a la DGMIT enviados (cada uno una vez aunque trate de varios datasets), actualizaciones registradas, cambios auditados (revisados en el año, también las altas que une `unirAlta`; no cuentan los `crear` rechazados ni los aprobados que no se pueden unir, porque `fuentesDe` no los trae:
  Ruling 13), datasets nuevos, pedidos resueltos con una fuente pública (sin los «Requiere nota:
  No», donde es lo normal), las series por mes y la doble verificación en tiempo corrido («una mediana de 3 minutos», en horas desde 120 minutos), que sigue a mediana o promedio.
  `areasYTemas`: el ranking de áreas que estaba en Gestión (`cumplimientoPorArea`, la misma regla de `/gestion/metricas`) y los datasets por tema principal y por frecuencia, en barras horizontales.
- Selectores y destildados (spec 1.5 a 1.7): el año («2026 (en curso)» y debajo los anteriores;
  `PRIMER_ANIO` = 2026), «Mediana | Promedio» y «Días hábiles | Días corridos» (de entrada, mediana y hábiles), y en el circuito, «Gestión externa | Gestión interna».
  Afectan a todo lo que cuenta días; no a la antigüedad (va por meses), la cobertura ni las reiteraciones (son cantidades); la doble verificación sigue a mediana o promedio.
  Destildar: la casilla «Contar» de una fila de los casos saca el dataset entero de todas las cuentas de la pestaña y del PDF de Métricas (también del índice y del ranking), con la franja ámbar «Calculado sin 1 dataset:
  Parque Automotor.» y «Volver a todos», el chip «Casos: todos menos 1» y, en el PDF, la píldora; las filas destildadas se ven tachadas y en gris.
  Todo viaja en la URL y no se guarda:
  `?anio=&estadistico=&dias=&gestion=&sin=12,45#reportes` (los de entrada no se escriben; la API recibe el año, los selectores y `sin`, no la gestión ni la pestaña).
  `opcionesDeMetricas` (`services/metricasOpciones.js`, puro) los lee con tolerancia: lo que no sirve cae al de entrada o se ignora (un destildado que no es un entero positivo); un año anterior a 2026 o futuro da 404.
- La foto del 31/12 (spec 3;
  `services/metricasFoto.js`, tabla `metricas_fotos`): la saca sola la corrida de las 8:15 (`sacarFotoSiCorresponde({ hoy, calendario })`, después de las Notas Digitales y aislada: un error no frena nada; desde la tanda 2 de los feriados en todo el sistema, con el calendario de la corrida, que mira solo si toca sacar una) desde el 10/01 del año siguiente (`DIA_DE_LA_FOTO`), sea o no día hábil, «al 31/12»: hoy = 31/12 y todos los datasets;
  cuenta lo que tiene fecha del año aunque se haya registrado hasta el 10/01, y nada de después.
  Cada corrida saca la del año cerrado más viejo (desde 2026) que todavía no la tiene (`fotoQueToca`, Ruling 18: una por corrida), con `INSERT IGNORE`: una foto nunca se pisa ni se modifica, y no hay botón para rehacerla (lo registrado después del 10/01 con fecha del año anterior ya no entra).
  Cuenta los días hábiles con los 9 fijos y los feriados de la tabla (spec 2026-10-27-feriados-en-notas, 2 y 5) y nunca con los 9 fijos por una falla: si la corrida cayó a los 9 fijos (`calendario.error !== null`), `exigirLaTabla` tira antes de leer las fuentes y no se guarda nada;
  la última corrida de Correos → Estado dice «No se pudo sacar la foto del año: no se pudieron leer los feriados de Configuración → Feriados» (`MENSAJE_METRICAS_SIN_FERIADOS`), la corrida responde 207 y la del día siguiente la vuelve a intentar (con los 9 fijos, la foto quedaría así para siempre).
  Guarda los números ya calculados (`datosDeLaFoto(fuentes, { anio, generada, calendario })`;
  `VERSION_DE_LA_FOTO` = 1):
  `casos` (los que tocan el año, `casosQueTocanElAnio`), `vistas` y `cintas` de las cuatro combinaciones por `claveDeLaVista` ('mediana-habiles', …), `contexto` con `estados`, `trabajo` por estadístico, `areas`, `etapas` (las del Ciclo de vida del dato, desde su despliegue: es opcional y la versión sigue en 1;
  una foto sin ellas las calcula con sus `casos`, ver «Ciclo de vida del dato»), `feriados` (desde la tanda 2 de los feriados en todo el sistema: los días que la tabla sacó de los hábiles, de lunes a viernes y fuera de los 9 fijos, del 01/01/2025, `FECHA_MINIMA_FERIADO`, al 31/12 del año siguiente, `feriadosDelCalendario`; con la precarga, 28 fechas en la de 2026;
  también opcional y con la versión en 1: una foto sin ellos se sacó con los 9 fijos) y `generada` (Ruling 16): un año con foto se lee de ahí, nunca se recalcula y no se destilda (`sin` = []).
  Un cambio de forma de la foto después del despliegue tiene que subir la versión o leer con tolerancia: una foto que no se puede leer tira (500), no pasa por «no hay foto».
  Un año cerrado sin foto se ve en vivo «al 31/12», con el aviso «La foto de 2026 se saca el 10/01/2027» y, pasado ese día, «La foto de 2026 todavía no se sacó: se reintenta en la próxima corrida.» (Ruling 17: un año cerrado nunca desaparece del selector).
- La pestaña Métricas (la página dibuja lo que manda el servidor: ver la convención de `reportes.js`): la barra (el año, los selectores, «Casos: todos» y «Descargar PDF»), la franja de lo destildado, «En esta página» (El circuito, Resultados del año, Contexto, El trabajo del RPAD, Áreas y temas y Para completar (N), con el `total` del servidor), el circuito (nodos y flechas como en el Seguimiento: lo de la DGMIT en violeta `#5B4691` y el Portal en verde;
  en el teléfono, en una columna), la cinta del recorrido típico, los casos («Ver los casos»), los resultados, el contexto (el índice y la antigüedad en SVG y HTML, sin Chart.js, con los valores también en texto), el trabajo (columnas por mes con chips para la serie, las métricas manuales de `/gestion/metricas-manuales` con «Cargar el mes» solo para administración y el CSV de siempre, `/gestion/metricas/csv`),
  áreas y temas y «Para completar» (con el link «Cargar nota DGMIT» → `seguimiento.html?id=N#cargar-nota`, solo con `Auth.puedeCargarNotasDgmit()`, y el link al Seguimiento de cada actualización sin «Recibido el»).
- La cinta (`services/metricasCinta.js`, `cintaDeMetricas` y `cintasDeLaVista`, pura, como `seguimientoCinta.js`): las cifras del circuito una detrás de la otra alrededor del vencimiento, en un espacio de 1000 × 156 (línea útil de x = 30 a x = 970;
  `ALTURAS_DE_LA_CINTA`), con el eje en los días elegidos, la banda celeste antes del vencimiento, el rayado después y las marcas (aviso, nota DGMIT, datos y carga).
  Las marcas a menos de 18 unidades se juntan en una (Ruling 14: no es el 11 del Seguimiento;
  «Entrega y carga juntas»), con el rótulo de lo que pasó («Entrega y carga, el mismo día» solo si la cifra es 0).
  Ningún texto se sale del dibujo ni se pisa (a la izquierda de su marca si no entra a la derecha; si no, otra fila o no va).
  Si a la cadena le falta un tramo sin cifra, se dibuja hasta donde se sabe y el resto va en gris con «La cinta se completa cuando haya …».
  La pantalla la dibuja en SVG y el PDF con PDFKit, con los mismos números (el PDF, con su letra:
  `OPCIONES_CINTA_PDF` de `reportesMetricasPdf.js`).
  Es orientativa, no un ciclo real, y lo dice.
- Los textos los arma el servidor (Ruling 19): las cifras y sus textos, los plurales, los en curso y pendientes, las aclaraciones, lo que se dice sin casos o sin datos, los textos del índice, de la antigüedad, del trabajo y de «Para completar», y el botón del Informe anual sin foto (Ruling 34).
  La página y los PDF los imprimen tal cual.
- API (`controllers/metricasController.js`;
  `authMiddleware` sin `adminOnly`: lector y colaborador, 200; sin sesión, 401;
  `tests/permisos.test.js`):
  `GET /api/metricas?anio=&estadistico=&dias=&sin=` (`metricasDe`:
  `{ anio, al, en_vivo, aviso_foto, anios, fotos, vista, cinta: { externa, interna }, contexto, trabajo, areas, sin_titulos, sin_texto }`;
  `sin_texto`: la franja ya armada, «Calculado sin 1 dataset:
  Parque Automotor.» —`textoDeLaFranja`—, con la misma leyenda que la píldora del PDF —`sinLosDestildados`—;
  `fotos`:
  `fotosDeMetricas`, cada año con `con_foto` y `aviso_informe`, lo que dice sin foto el botón del Informe anual:
  «Disponible desde el 10/01/2027» y, pasado ese día, el aviso de la foto; un año sin métricas, 404 «No hay métricas de ese año») y `GET /api/metricas/pdf` (lo mismo en el PDF, con las métricas manuales del año leídas en vivo, también en un año con foto:
  Ruling 23).
  Desde la tanda 2 de los feriados en todo el sistema, `metricasConOpciones` lee el calendario (`exigirLaTabla(await leerCalendario())`) solo en vivo, después de los años con foto y antes de las fuentes: un año con foto no lee la tabla; sin la tabla, lo que va en vivo tira y `GET /api/metricas`, su PDF y «Datos para completar» (que pasa por `metricasDe`) responden el 500 de siempre, nunca cifras contadas con los 9 fijos.
  `gestionController` (desde «Proyectos», solo las métricas) sigue sirviendo `/gestion/metricas`, el CSV y las métricas manuales.
- Los reportes (spec 5;
  `controllers/reportesController.js`, todos con `authMiddleware` sin `adminOnly`): ocho tarjetas en dos grupos (`htmlDeReportes`, `pedidoDeReporte`), cada una baja su PDF con `API.pedirArchivo` + `descargarBlob`.
  **Para presentar** (`rp-grilla g4` desde el Ciclo de vida del dato):
  Métricas del año (`GET /api/metricas/pdf`, `services/reportesMetricasPdf.js`: el circuito con los resultados, las cintas y los destildados, el contexto y el trabajo, y las áreas y temas, cada parte desde una hoja nueva, «Unas 5 hojas», Ruling 24; la píldora dice lo elegido;
  un año con foto sale de la foto), Ciclo de vida del dato (`GET /api/reportes/ciclo-de-vida?anio=`, `reportesCicloDeVidaPdf.js`: cuánto tarda cada etapa del circuito, con todos los ciclos, en dos hojas, la gestión externa y la interna; ver «Ciclo de vida del dato»), Informe anual (`GET /api/reportes/informe-anual?anio=`, `reportesInformeAnualPdf.js`: solo para un año con foto —sin ella, 404—, con mediana en días hábiles, la comparación con la foto del año anterior —`comparacionDe`;
  «Primer año con foto» si no hay— y los logros del año: los hitos de Herramientas → Proyectos con fecha en el año —los de los proyectos activos y los logros del área—, por proyecto, `logrosPorProyecto`, con «Los hitos de AAAA cargados en Proyectos» a la derecha; sin las métricas manuales, que no están en la foto) y Estado general de los datasets (`GET /api/reportes/estado-general`, `reportesEstadoGeneralPdf.js`: el contenido de siempre con el diseño nuevo).
  **Para trabajar:** Por área (`GET /api/reportes/por-area/:areaId`, `reportesPorAreaPdf.js`: una portada con el área, sus contactos —los de `CAMPOS_CONTACTO`, Ruling 25—, las cinco tarjetas y sus datasets por grupo, y detrás una hoja del Seguimiento por cada dataset activo; sin hojas de los dados de baja; pie «Reporte por área · Hoja k de N»), Avisos del RPAD (`GET /api/reportes/avisos?desde=&hasta=`, por defecto del 1/1 a hoy, `reportesAvisosPdf.js`;
  reemplaza al Historial de notificaciones: los emails viejos a la DGMIT y al área y las Notas Digitales de aviso y de reiteración, con la fecha, qué fue —los títulos del Seguimiento:
  `tituloDeEmail`, `tituloDeNotaADgmit`—, la gestión, los datasets —«24 datasets: …», Ruling 29— y el estado —`ESTADO_DE_NOTA`, `RESULTADO_DE_EMAIL`—; el título, los totales y la píldora cuentan solo lo enviado, con la regla del Seguimiento, y lo que no salió va en la tabla con su estado y un renglón aparte, Ruling 28; sin direcciones de email, sin las notas de prueba, sin el texto técnico de los errores y sin las de auditoría y autorización;
  un período que no vale, 400 «Elegí un período válido.»), Agenda de pedidos (`GET /api/reportes/agenda?meses=&gestion=`, `services/reportesAgenda.js` —puro— y `reportesAgendaPdf.js`: los próximos 3, 6 o 12 meses —6 de entrada—, las dos gestiones o una, mes por mes y con los vencidos aparte al principio; un vencimiento por dataset, la próxima actual;
  cada fila con el área, la frecuencia de `frecuenciaEnNota`, «Requiere nota DGMIT» en los externos, el pedido y la fecha aproximada del aviso según la regla, `fechaDeAvisoPorRegla`, que en un vencido es «—», Ruling 27;
  desde la tanda 2 de los feriados en todo el sistema, el día hábil sale del calendario, `fechaDeAvisoPorRegla(vencimiento, gestion, calendario)` y `agendaDe(datasets, { hoy, meses, gestion, calendario })`, que `reporteAgenda` lee una vez y exige con la tabla —sin ella, el 500 de siempre—:
  el aviso interno del 31/12/2026 dice el 03/11 y el externo, el 24/11, los días en que salen) y Datos para completar (`GET /api/reportes/para-completar?anio=`, `pdfDeParaCompletar` y `reportesParaCompletarPdf.js`: la `vista.para_completar` de `metricasDe` del año pedido, leído como en `GET /api/metricas` —por defecto el en curso; un año sin métricas, el mismo 404—;
  la tarjeta elige el año con los de la API y propone el último año cerrado sin foto (entre el 01/01 y el día de la foto, o mientras la corrida la reintenta) o, si no hay, el en curso, Ruling 39; el rótulo dice el `al` de esas métricas, «al 31/12/2026» en un año cerrado; el archivo lleva siempre el día de hoy).
  Un 500 de estos reportes dice un mensaje fijo por reporte (`ERROR_AL_GENERAR`); el error completo, solo en `console.error`.
  El Estado general dice «El 82% de los que tienen vencimiento están al día:
  A de B» (sin espacio, Ruling 38).
  Se sacaron el reporte de Cumplimiento (tarjeta, `GET /reportes/cumplimiento` y sus tests: el ranking está en Métricas) y el Historial de notificaciones (`GET /reportes/historial-notificaciones`), y con ellos `API.getReporteHistorialUrl` y `getReporteCumplimientoUrl` (los dos dan 404:
  `tests/reportes.test.js`).
  Los nombres de los archivos, en `nombreDelReporte` (`services/reportesNombres.js`, con hoy en Argentina):
  `Metricas-RPAD-AAAA.pdf`, `Ciclo-de-vida-del-dato-AAAA.pdf`, `Informe-anual-RPAD-AAAA.pdf`, `estado-general-dd-mm-aaaa.pdf`, `Reporte-area-<id>-AAAA-MM-DD.pdf`, `Avisos-RPAD-AAAA-MM-DD.pdf`, `Agenda-de-pedidos-AAAA-MM-DD.pdf` y `Datos-para-completar-AAAA-MM-DD.pdf` (`Content-Disposition` con `disposicionDeAdjunto`).
- La base de los PDF (`services/reportesPdfBase.js`, spec 5.1), el lenguaje de los anexos:
  A4 explícito (`nuevoReporte`:
  `DocumentoNota` no tiene tamaño y sin él saldría LETTER), Helvetica, márgenes de 15 mm, `COLOR` y los ayudantes de `notasDigitalesAnexo.js`, y el encabezado, el pie y la cabeza de sección del Seguimiento, sin copiarlos.
  Los elementos se miden antes de dibujarse (`prepararTitulo`, `prepararPildora` —con su `ancho`, y su `dibujar(y, x)` la pone en una x, de entrada el margen—, `prepararTarjetas`, `prepararSeccion`, `prepararParrafo`, `prepararRecuadro` —gris o con el borde azul a la izquierda— y `prepararTabla`, que corta de hoja, repite su encabezado y su `cabeza` y lleva su `aclaracion` con la última fila;
  `lugarPara` y `dibujarJuntos`): nada pasa de `LIMITE` y un título nunca queda solo al final de una hoja (Ruling 22).
  El pie, «Generado el dd/mm/aaaa a las hh:mm por <nombre corto>» y «<Reporte> · Hoja k de N», se dibuja al cerrar (`cerrarReporte`;
  `hojasDe` numera las hojas que suma otro dibujante, como las del Seguimiento).
  Los dibujantes son puros (sin pool) y leen lo del servidor con `esObjeto`, `objeto`, `lista`, `esNumero` y `texto`.
- La pestaña Métricas de la vieja página Gestión se mudó acá con sus tests (`textoPorcentaje`, `htmlDelRanking`), las tortas de temas y frecuencias pasaron a barras y Chart.js se fue (`tests/paginas.test.js`).
  `gestionController` arma la tasa y el ranking con `cumplimientoPorArea`.
  La página quedó solo con los proyectos y desde «Proyectos» es Herramientas → Proyectos (ver «Proyectos»): un link viejo a `gestion.html#metricas` llega por la redirección y avisa «Las métricas de Gestión ahora están en Herramientas → Métricas y Reportes.» (link a `reportes.html#metricas`).
- Tests:
  `metricas-reglas.test.js` (puro, sobre `tests/metricas-casos.js` —los casos de `seguimiento-casos.js` más lo importado— y casos sintéticos), `metricas-cinta.test.js` (las cuatro combinaciones y las dos gestiones: que nada se pise ni se salga), `metricas-opciones.test.js` (puro), `metricas-foto.test.js` y `metricas-api.test.js` (Docker;
  la foto con un hoy fijo, nunca `/api/cron/*`), `reportes-agenda.test.js` (puro), `reportes-pdf.test.js` (los ocho PDF con `tests/pdf-lector.js` y `tests/pdf-diagramacion.js`: los textos, el pie, la cantidad de hojas, el A4 y que nada se pise), `reportes.test.js` (por HTTP), `reportes-frontend.test.js` (la página en un `vm`, con las paridades), `estados-api.test.js` (la tasa) y `schema.test.js` (las dos tablas, la migración, la vuelta atrás y el SQL de los «Recibido el» viejos);
  los de los feriados de la tabla, en «Recordatorios automáticos» (los tests de la tanda 2).
  Los números de la base real («5 de 33 ciclos actualizados a tiempo», «35 de 36 vencimientos avisados», «82%» hoy) se verificaron una vez contra la base de la rama y no van en tests versionados (Ruling 3: los datos reales no se versionan).

## La página: reportes.js

- `reportes.js` («Métricas y Reportes»): al cargarse solo declara (`tests/reportes-frontend.test.js` lo carga en un `vm`).
  Lo que arma HTML (la barra, la franja de lo destildado, «En esta página», el circuito, el SVG de la cinta y el del índice, los casos, los resultados, el contexto, el trabajo, las áreas, «Para completar» y las tarjetas de Reportes:
  `htmlDeBarra`, `htmlDeFlecha`, `svgDeCinta`, `htmlDeReportes`, `pedidoDeReporte`, …) es puro y recibe quién mira por parámetro; lo que toca el DOM o la API va aparte, al final.
  Lo elegido viaja en la URL (`estadoDeLaUrl`, `urlDeEstado`: los de entrada no se escriben).
  Pide los datos con `API.pedirJson` y los PDF con `API.pedirArchivo` + `descargarBlob` (JWT en el encabezado).
  No recalcula nada: cifras, textos (plurales, «En el día», los vacíos), en curso, pendientes, la cinta (con sus x, su línea, sus alturas, sus rótulos y sus anclajes) y el índice los manda el servidor (Ruling 19); todo texto del servidor pasa por `Utils.escapeHtml` y un número se escribe con `String` (un 0 es «0»).
  Las fechas, con `Utils.fechaCorta`;
  «hoy», con `Utils.hoyEnArgentina()`.
  La franja de lo destildado imprime `sin_texto` de la API (la arma `textoDeLaFranja`).
  Copias mínimas:
  `ESTADISTICOS`, `DIAS` y `GESTIONES` (los selectores: los valores, copia de los de `services/metricasReglas.js` y atados; los rótulos, solo del navegador) y los de entrada de `ESTADO_POR_DEFECTO` (mediana, días hábiles, gestión externa y ningún destildado: los de `opcionesDeMetricas`; el año va null y el servidor usa el de hoy), `nombreDelReporte` (copia de la de `services/reportesNombres.js`, con los ocho nombres, `'ciclo'` incluido:
  `API.pedirArchivo` no da el `Content-Disposition`), `MESES_AGENDA` y `GESTIONES_AGENDA` (copia de `MESES_DE_LA_AGENDA` y `GESTIONES_DE_LA_AGENDA` de `services/reportesAgenda.js`, con los de entrada de `REPORTES_POR_DEFECTO` atados a `MESES_POR_DEFECTO`) y `PERIODO_INVALIDO` (copia de `MENSAJE_PERIODO_INVALIDO` de `services/reportesAvisosPdf.js`), todas atadas por tests de paridad;
  `esFechaDeTexto` (copia de `esFechaIso`) solo tiene tests de comportamiento.
  La tarjeta `ciclo` (el Ciclo de vida del dato, segunda en «Para presentar») elige su año con `anioDeMetricasDelAnio`, como Métricas del año, pero sin el de la pestaña Métricas (`REPORTES_POR_DEFECTO.ciclo` es null: sin elegir, el en curso) y pide solo el año (`pedidoDeReporte`: sin la combinación ni los destildados);
  `TARJETAS_CON_ANIO`, `CONTROLES_DE_REPORTES` (`'rp-ciclo'`) y `conReporteElegido` la conocen (ver «Ciclo de vida del dato»).
  Los textos fijos de la pestaña que repite el PDF de Métricas (`TEXTOS_DE_LA_PESTANA` de `services/reportesMetricasPdf.js`) y los del de «Datos para completar» (`TEXTOS_DE_PARA_COMPLETAR` de `services/reportesParaCompletarPdf.js`) están atados al HTML y a `reportes.js` por los tests «reportes.js y el PDF de Métricas: los mismos textos» y «… de Datos para completar: los mismos textos»: si cambia uno de la pestaña, fallan.
  Desde los feriados en todo el sistema (tanda 2; spec 2026-10-27-feriados-en-notas, 6), la bajada de los días hábiles (`BAJADA_DE_LOS_DIAS.habiles`, la de `#mt-bajada` de `reportes.html` y `TEXTOS_DE_LA_PESTANA.bajada.habiles`, que imprimen el PDF de Métricas y el Informe anual) dice «Los días son hábiles: de lunes a viernes, sin feriados ni días no laborables.», y `VERSION_REPORTES` pasó a `'20261208'` (no más:
  `tests/paginas.test.js` exige `VERSION_FERIADOS` mayor; entonces era `'20261209'` y, desde los días restituidos, es `'20261210'`).

## Archivos de tests

`reportes-frontend.test.js`, `paginas.test.js`, `permisos.test.js`, `reportes.test.js`, `metricas-reglas.test.js`, `metricas-cinta.test.js`, `metricas-opciones.test.js`, `metricas-foto.test.js`, `metricas-api.test.js`, `reportes-agenda.test.js`, `reportes-pdf.test.js`, `estados-api.test.js`, `schema.test.js`
