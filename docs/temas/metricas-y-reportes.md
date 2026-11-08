# Métricas y Reportes

Cuánto tarda cada paso del circuito, la foto del 31/12, y los PDF de la pestaña Reportes.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`
- `docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md`
- `docs/superpowers/specs/2026-11-03-reiteracion-bimestral-design.md`
- `docs/superpowers/specs/2026-11-05-metricas-frase-en-los-casos-design.md`
- `docs/superpowers/specs/2026-11-05-circuito-diseno-design.md`
- `docs/superpowers/specs/2026-11-05-metricas-pdf-apaisado-design.md`
- `docs/superpowers/specs/2026-11-06-metricas-anticipacion-y-corridos-design.md`
- `docs/superpowers/specs/2026-11-07-metricas-cajones-y-ciclos-design.md`

## Archivos

metricasController:
GET /api/metricas y su PDF, y los datos del Ciclo de vida del dato;
gestionController: solo las métricas de /gestion/metricas, el CSV y las métricas manuales;
metricasReglas (los casos, la vista, el modal de cada tramo, el contexto, el trabajo, las áreas y las etapas del Ciclo de vida del dato, puro), metricasCinta (la cinta del recorrido típico, pura), metricasGrafico (el gráfico de los ciclos de un tramo, en su modal, puro), metricasOpciones (los años, la foto que toca y los parámetros, puro) y metricasFoto (la foto del 31/12);
reportesPdfBase (la base de los PDF) y un archivo por reporte (reportesMetricasPdf, reportesCicloDeVidaPdf, reportesInformeAnualPdf, reportesEstadoGeneralPdf, reportesPorAreaPdf, reportesAvisosPdf, reportesAgenda + reportesAgendaPdf y reportesParaCompletarPdf), y reportesNombres (los nombres de los PDF).
reportesController: los reportes PDF, con sus consultas.

## Métricas y Reportes (spec 2026-10-24-metricas-y-reportes)

- Qué es:
  Herramientas → **Métricas y Reportes** (`reportes.html` + `js/reportes.js`; el archivo se llama así aunque la página diga «Métricas y Reportes»; con su `<style>` y los tokens del Seguimiento, sin `publico.css`), para todos los roles con sesión (sin sesión, al login).
  Dos pestañas con hash y `aria-selected`, como Correos:
  Métricas (la inicial, `#metricas`) y Reportes (`#reportes`).
  Solo escribe administración: las métricas manuales («Cargar el mes»).
  Mide cuánto tarda cada paso del circuito de cada ciclo: el RPAD (la DDPC) avisa; en gestión externa, la DGMIT y la Dirección Administrativa mandan la nota formal, el área entrega y la DDPC prepara y carga; en interna, la DGMIT y la Dirección de Investigación Territorial hacen el relevamiento y la DDPC lo carga.
  Los días van corridos y, entre paréntesis, hábiles (con el calendario único: de lunes a viernes, sin los 9 fijos ni los feriados de la tabla; ver `docs/temas/calendario-y-corridas.md`), en la pestaña, en el PDF de Métricas y en el Informe anual: no hay selector de días.
  Antiobjetivos: que algo se lea como un reproche o un control sobre la DGMIT (sin nota cargada, «pendiente de carga», nunca que no la mandó, y sin días); que un caso que nunca termina desaparezca (los en curso y las notas pendientes de carga no van en el cajón, pero están en el modal de su tramo y en «Cómo se cuenta» de los PDF); que un número calculado sin algunos datasets se tome por el completo; que el índice diga una cosa en la portada y otra acá.
  Nombres neutros: nunca «tardanza», «demora» ni «atraso».
- Reglas (`services/metricasReglas.js`, puro: sin pool ni `Date` local, fechas `'AAAA-MM-DD'`, ninguna tira, salvo con un calendario mal armado; los días hábiles se cuentan con el calendario que reciben —`calendario` en las opciones de `casosDe`, `vistaDe` y `etapasDe`, y adentro, en el contexto de `contextoDe`; sin él, o con null, `CALENDARIO_FIJO`;
  las internas, `diaDelAvisoDe` y `casosDelDataset`, sin valor por defecto—): la unidad es el ciclo del Seguimiento, con su código (`ciclosDe`, `cicloDelAviso`, `notasDgmitPorCiclo` con R7, `esEmailADgmit`, `esNotaEnviada`, `momentoDeEnvioDeNota`, `unirAlta`: no hay copias de esas reglas; las métricas y el Seguimiento ubican cada aviso y cada nota DGMIT en el mismo ciclo).
  `casosDe(fuentesPorDataset, { hoy, calendario })` da un caso por ciclo (también de los dados de baja y con `venc` null; nunca de eventuales ni sin fecha) con sus hitos: el aviso de la regla (el primero de su clase —el email `externo-40` o `interno-60` con `success`, o la Nota Digital de aviso enviada— con fecha hasta el vencimiento y que, además, dice ese vencimiento o tiene fecha desde la fecha de la regla;
  40 días en externa y 60 en interna, `VENTANA_DE_LA_REGLA` = `VENTANA_DIAS` del calendario, Ruling 30), el primer aviso, si se avisó ya vencido (`heredado`: solo si el RPAD no pudo avisarlo a tiempo —la fecha de la regla es anterior al 06/12/2025, `INICIO_DEL_REGISTRO`, o al alta— y el primer aviso llegó después del vencimiento), la primera nota DGMIT vigente, el «Recibido el» y el origen de la actualización que cerró el ciclo y la carga.
  El aviso de la regla es el del vencimiento que rige (`casoDelCiclo`, decisión del usuario del 06/11/2026; spec 2026-11-06-metricas-anticipacion-y-corridos, 3): `dia <= venc && (vencimiento === venc || dia >= fecha_regla)`.
  Un cambio que solo mueve la próxima antes de vencer sigue en el mismo ciclo (`docs/temas/seguimiento.md`): sin esa condición, el email del vencimiento anterior quedaría como el aviso del nuevo, y la anticipación mediría días que nadie tuvo.
  La Nota Digital dice de qué vencimiento es (`vencimiento`, en `avisosPorCiclo`) y puede salir antes de la fecha de la regla, adelantada por la licencia del firmante o para que la firme la persona autorizada: sigue siendo el aviso de su ciclo, y sin ella el ciclo figuraría sin aviso.
  El email no dice su vencimiento, y por eso le queda la ventana: de la fecha de la regla al vencimiento.
  Un ciclo al que le movieron la próxima antes de vencer y que todavía no tuvo el aviso del vencimiento nuevo no tiene aviso de la regla: no cuenta en la anticipación ni en los tramos que empiezan en el aviso hasta que salga y, si su fecha de la regla todavía no llegó, tampoco falta en la cobertura.
  Con el aviso nuevo, lo que muestran «Los casos» y «Para completar» es ese, las reiteraciones del RPAD se cuentan desde él, un email anterior que no se pudo enviar no da el motivo «el email no se pudo enviar» y una nota DGMIT anterior a él deja la redacción en «En el día», por el piso de 0.
  Los tramos: aviso anticipado (aviso de la regla → vencimiento;
  DDPC), redacción y entrega de nota (aviso → nota DGMIT recibida;
  DGMIT y DA; su clave interna es `tramite`; el nombre, «Redacción y entrega de nota», con «redactan» en la descripción del Ciclo de vida, es decisión del usuario del 28/10/2026) y respuesta del área (nota → datos recibidos;
  Área), los dos solo en externa con «Requiere nota» Sí o sin dato, o con una nota DGMIT cargada; producción del relevamiento (aviso → datos;
  DGMIT y DIT; interna); preparación y carga (datos → carga;
  DDPC; las dos).
  `duracion(desde, hasta, dias, calendario)` con piso 0 (`diasHabilesTranscurridos` del calendario o `diasEntre`).
  Un avisado ya vencido no cuenta en la anticipación (el resto se cuenta desde ese primer aviso); un ciclo sin el aviso de la regla que no estaba vencido en su primer aviso no cuenta en los tramos que empiezan en el aviso; con origen `fuente_publica` no cuenta la respuesta del área (y la carga cuenta desde que se obtuvo la fuente);
  `venc` null no cuenta en nada que necesite el vencimiento; una reprogramación no tiene datos ni carga.
  Cada duración se cuenta en las dos unidades, con las mismas fechas y el mismo calendario; «En el día» y «el mismo día» se deciden con los corridos, porque los hábiles nunca son más.
  Cada número de «Los casos» dice las dos unidades y desde cuándo cuenta («64 días corridos (45 hábiles) desde la nota», «1 día corrido (1 hábil) desde que se recibió», «3 días corridos (en el día, en días hábiles) desde la nota», «en curso, 150 días corridos (102 hábiles) desde el aviso», «en curso, 3 días corridos (menos de 1 hábil) desde el aviso»; lo arma `filaDe`, con `cantidadDeLasDos` y `haceDeLasDos`).
  Un ciclo `heredado` (sin aviso de la regla, que el RPAD no pudo avisar a tiempo y cuyo primer aviso llegó después del vencimiento) cuenta desde ese primer aviso, no desde el vencimiento (decisión del usuario del 05/11/2026): contarlo desde el vencimiento le atribuiría a la DGMIT y a la DIT días anteriores a todo aviso, incluso de antes del alta.
  Por eso un número de Métricas puede ser menor que los días del Seguimiento para el mismo ciclo: el Seguimiento mide en días corridos del vencimiento a la carga o, en un ciclo abierto, a hoy.
  En Métricas, los días del vencimiento a la carga solo están en «Actualizados a tiempo»: la mediana o el promedio de los cargados después del vencimiento, en las dos unidades («Los otros 9 se cargaron una mediana de 64 días corridos (45 hábiles) después.»; `despues.valor`, en la unidad de la vista).
  Un tramo terminado cuenta en el año de su hito final; en curso, solo la respuesta y la producción, en un ciclo abierto (`en_curso` del tramo, en la unidad de la vista: «4 sin datos registrados todavía, hace 58 días corridos (mediana)», siempre con la unidad:
  Ruling 11;
  «Preparación y carga» nunca está en curso); el tramo de la DGMIT sin nota es «pendiente de carga», sin días, y sin ninguna nota DGMIT vigente en todo el RPAD dice «Todavía no hay notas DGMIT cargadas» (`SIN_NOTAS_DGMIT`).
  Métricas no dibuja `en_curso.texto`, que sigue en el tramo: el modal del tramo y «Cómo se cuenta» de los PDF dicen los en curso con las dos unidades («hace 150 días corridos (102 hábiles, mediana)», `haceEnCursoDeLosDos`).
  `pendientes_texto` y `vacio.texto` del tramo de la DGMIT (los dos de `notasPendientes`) cuentan las notas pendientes de carga de los ciclos abiertos: «7 notas pendientes de carga de ciclos abiertos», «1 nota pendiente de carga de un ciclo abierto», «0 notas pendientes de carga de ciclos abiertos».
  Siguen en el tramo porque los lee el Ciclo de vida; el cajón de Métricas no los dibuja: los dicen el modal de la redacción y «Cómo se cuenta» de los PDF.
  «Para completar» suma los ciclos cerrados en el año y su título dice cuántas son de cada clase: las dos cuentas son a propósito (spec 2026-11-06-metricas-anticipacion-y-corridos, 4).
  La cifra (`cifraDe`): la mediana (con n par, el promedio de las dos del medio) o el promedio, redondeados, con la unidad al lado («64 días corridos»; singular solo con 1, `unidadDe`) y debajo «mediana de 32 ciclos»; 0 es «En el día»; sin casos, «Sin casos en 2026»; con 4 o menos, «con tan pocos casos, es orientativo».
  El tramo del aviso trae además `anticipacion_texto`, lo que va debajo del número en el cajón «Aviso anticipado»: la unidad y «de anticipación» («días corridos de anticipación», «día hábil de anticipación»; el número va aparte), o null con «En el día», sin cifra y en los demás tramos.
  La foto lo guarda con el resto de la vista: es una clave más, y `VERSION_DE_LA_FOTO` sigue en 1.
- `vistaDe(casos, { anio, al, estadistico, dias, sin, calendario })` (`al`: hoy en el año en curso, el 31/12 en uno cerrado; lo de después no cuenta):
  `circuito` (los tramos de cada gestión, con las claves de «Los cajones del circuito», abajo, y las aclaraciones: las de `aclaracionesDe` —los avisados ya vencidos, los resueltos con una fuente pública y, si los hay, los de «Requiere nota:
  No», «N ciclos son de datasets que no requieren nota DGMIT: cuentan solo en el aviso anticipado y en la carga.»— y, en claves aparte, `externa.pendientes` y `en_curso` de las dos gestiones), `resultados` (actualizados a tiempo: los cerrados por actualización en el año con carga ≤ vencimiento, con el desglose por gestión y cuánto después se cargaron los otros;
  cobertura del aviso: el denominador son los ciclos con vencimiento en el año que ya esperaban el aviso de la regla (`esperabaElAviso`: el día del aviso —la fecha de la regla o, si no es hábil, el hábil siguiente, `proximoDiaHabil` del calendario, el mismo con que lo dicen la Agenda de pedidos y el envío, con los feriados de la tabla— ya pasó, y ese mismo día cuenta solo si el aviso ya salió, porque la corrida es a las 8:05;
  y el ciclo regía en el RPAD ese día: uno que dejó de regir antes —por la aprobación que lo cerró, no por la carga, o por la baja— no lo esperaba y no está en el denominador ni falta), sin los de antes del 06/12/2025 —Ruling 5—, y los que faltan van con su motivo —«el email no se pudo enviar», «se dio de alta con el vencimiento ya cerca» (o «se dio de alta ya vencido», si el alta fue después del vencimiento), «se avisó ya vencido», «sin el aviso de la regla»:
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
  `areasYTemas`: el ranking de áreas (`cumplimientoPorArea`, la misma regla de `/gestion/metricas`) y los datasets por tema principal y por frecuencia, en barras horizontales.
- Selectores y destildados (spec 1.5 a 1.7): el año («2026 (en curso)» y debajo los anteriores;
  `PRIMER_ANIO` = 2026), «Mediana | Promedio» (de entrada, mediana) y, en el circuito, «Gestión externa | Gestión interna».
  El estadístico afecta a todo lo que cuenta días; no a la antigüedad (va por meses), la cobertura ni las reiteraciones (son cantidades); la doble verificación sigue a mediana o promedio.
  No hay selector de días (spec 2026-11-07-metricas-cajones-y-ciclos, 4): `opcionesDeMetricas` da siempre `dias: 'corridos'` y no lee `dias` de la consulta.
  Un link viejo con `?dias=` se abre igual, en las dos unidades, y la dirección lo pierde; `GET /api/metricas` y su PDF lo ignoran.
  `DIAS` y `vistaDe` siguen aceptando las dos unidades: la foto guarda las cuatro combinaciones y el Ciclo de vida usa la de hábiles.
  Destildar: la casilla «Contar» de una fila de los casos saca el dataset entero de todas las cuentas de la pestaña y del PDF de Métricas (también del índice y del ranking), con la franja ámbar «Calculado sin 1 dataset:
  Parque Automotor.» y «Volver a todos», el chip «Casos: todos menos 1» y, en el PDF, la píldora; las filas destildadas se ven tachadas y en gris.
  Todo viaja en la URL y no se guarda:
  `?anio=&estadistico=&gestion=&sin=12,45#reportes` (los de entrada no se escriben; la página le manda a la API el año, el estadístico y `sin`, no la gestión ni la pestaña; si llega `gestion`, `opcionesDeMetricas` la lee y nadie la usa).
  `opcionesDeMetricas` (`services/metricasOpciones.js`, puro) los lee con tolerancia: lo que no sirve cae al de entrada o se ignora (un destildado que no es un entero positivo); un año anterior a 2026 o futuro da 404.
- La foto del 31/12 (spec 3;
  `services/metricasFoto.js`, tabla `metricas_fotos`): la saca sola la corrida de la mañana (`sacarFotoSiCorresponde({ hoy, calendario })`, después de las Notas Digitales y aislada: un error no frena nada; con el calendario de la corrida, que mira solo si toca sacar una) desde el 10/01 del año siguiente (`DIA_DE_LA_FOTO`), sea o no día hábil, «al 31/12»: hoy = 31/12 y todos los datasets; cuenta lo que tiene fecha del año aunque se haya registrado hasta el 10/01, y nada de después.
  Cada corrida saca la del año cerrado más viejo (desde 2026) que todavía no la tiene (`fotoQueToca`, Ruling 18: una por corrida), con `INSERT IGNORE`: una foto nunca se pisa ni se modifica, y no hay botón para rehacerla (lo registrado después del 10/01 con fecha del año anterior ya no entra).
  Cuenta los días hábiles con los 9 fijos y los feriados de la tabla (spec 2026-10-27-feriados-en-notas, 2 y 5) y nunca con los 9 fijos por una falla: si la corrida cayó a los 9 fijos (`calendario.error !== null`), `exigirLaTabla` tira antes de leer las fuentes y no se guarda nada;
  la última corrida de Correos → Estado dice «No se pudo sacar la foto del año: no se pudieron leer los feriados de Configuración → Feriados» (`MENSAJE_METRICAS_SIN_FERIADOS`), la corrida responde 207 y la del día siguiente la vuelve a intentar (con los 9 fijos, la foto quedaría así para siempre).
  Guarda los números ya calculados (`datosDeLaFoto(fuentes, { anio, generada, calendario })`;
  `VERSION_DE_LA_FOTO` = 1):
  `casos` (los que tocan el año, `casosQueTocanElAnio`), `vistas` y `cintas` de las cuatro combinaciones por `claveDeLaVista` ('mediana-habiles', …), `contexto` con `estados`, `trabajo` por estadístico, `areas`, `etapas` (las del Ciclo de vida del dato: es opcional y la versión sigue en 1;
  una foto sin ellas las calcula con sus `casos`, ver `docs/temas/ciclo-de-vida.md`), `feriados` (los días que la tabla sacó de los hábiles, de lunes a viernes y fuera de los 9 fijos, del 01/01/2025, `FECHA_MINIMA_FERIADO`, al 31/12 del año siguiente, `feriadosDelCalendario`; con la precarga, 28 fechas en la de 2026;
  también opcional y con la versión en 1: una foto sin ellos se sacó con los 9 fijos) y `generada` (Ruling 16): un año con foto se lee de ahí, nunca se recalcula y no se destilda (`sin` = []).
  La página lee las vistas en días corridos; el PDF de Métricas y el Informe anual leen también las de hábiles (`circuitosDeLaFoto` y `circuitoDeLaHoja`): con las dos, la solapa y la píldora dicen «días corridos y hábiles», y una foto sin `habiles_texto` saca de la vista en hábiles el paréntesis de cada cifra.
  Las cuatro vistas guardan también las claves nuevas de cada tramo (`como_se_cuenta`, `habiles`, `habiles_texto` y `modal`) y las aclaraciones `pendientes` y `en_curso`; en las de hábiles, `habiles` y `modal` son null y `habiles_texto`, ''.
  Son claves nuevas: `VERSION_DE_LA_FOTO` sigue en 1 y una foto sin ellas se lee con tolerancia (ver «Los cajones del circuito»).
  Un cambio de forma de la foto después del despliegue tiene que subir la versión o leer con tolerancia: una foto que no se puede leer tira (500), no pasa por «no hay foto».
  Un año cerrado sin foto se ve en vivo «al 31/12», con el aviso «La foto de 2026 se saca el 10/01/2027» y, pasado ese día, «La foto de 2026 todavía no se sacó: se reintenta en la próxima corrida.» (Ruling 17: un año cerrado nunca desaparece del selector).
- La pestaña Métricas (la página dibuja lo que manda el servidor: ver «La página: reportes.js»): la barra (el año, los selectores, «Casos: todos» y «Descargar PDF»), la franja de lo destildado, «En esta página» (El circuito, Resultados del año, Contexto, El trabajo del RPAD, Áreas y temas y Para completar (N), con el `total` del servidor), el circuito (una banda de flechas con quién actúa, donde cada nodo con tramo es un botón que abre su modal, y, debajo, la tarjeta de cada etapa; lo de la DGMIT en violeta `#5B4691`, el Área en verde azulado `#1F6B73` y el Portal en verde;
  en el teléfono, en una columna; solo CSS, sobre el HTML de nodos y flechas: `.mt-flecha` sigue siendo la etapa y `.l` no se dibuja), la cinta del recorrido típico, los casos («Ver los casos»), los resultados, el contexto (el índice y la antigüedad en SVG y HTML, sin Chart.js, con los valores también en texto), el trabajo (columnas por mes con chips para la serie, las métricas manuales de `/gestion/metricas-manuales` con «Cargar el mes» solo para administración y el CSV `/gestion/metricas/csv` (Tipo, Año, Mes y Cantidad por mes)),
  áreas y temas y «Para completar» (con el link «Cargar nota DGMIT» → `seguimiento.html?id=N#cargar-nota`, solo con `Auth.puedeCargarNotasDgmit()`, y el link al Seguimiento de cada actualización sin «Recibido el»).
- La cinta (`services/metricasCinta.js`, `cintaDeMetricas` y `cintasDeLaVista`, pura, como `seguimientoCinta.js`): las cifras del circuito una detrás de la otra alrededor del vencimiento, en un espacio de 1000 × 156 (línea útil de x = 30 a x = 970;
  `ALTURAS_DE_LA_CINTA`), con el eje en días corridos, la banda celeste antes del vencimiento, el rayado después y las marcas (aviso, nota DGMIT, datos y carga).
  Las marcas a menos de 18 unidades se juntan en una (Ruling 14: no es el 11 del Seguimiento;
  «Entrega y carga juntas»), con el rótulo de lo que pasó («Entrega y carga, el mismo día» solo si la cifra es 0).
  Ningún texto se sale del dibujo ni se pisa (a la izquierda de su marca si no entra a la derecha; si no, otra fila o no va).
  Los rótulos y los segmentos dicen los hábiles del tramo entre paréntesis (`tramo.habiles`, con `cantidadDeLasDos`): «Aviso · 51 días corridos (35 hábiles) antes», «Respuesta del área · 64 días corridos (45 hábiles)», «Entrega y carga, 3 días corridos (1 hábil) después»; con 0 corridos, «el mismo día», sin paréntesis.
  El paréntesis va después del rótulo (decisión del usuario del 08/11/2026): un rótulo, también el del aviso y el de la carga, que con los hábiles no entra en ningún lado, o que con ellos le saca el lugar a otro, va con el texto sin el paréntesis, y solo si así tampoco entra, no va.
  Así la cinta nunca escribe menos rótulos que sin los hábiles: soltar el paréntesis antes que el rótulo es a propósito, porque los hábiles ya están en el cajón, en el modal y en el `<title>` de cada segmento.
  Sin `habiles` en los tramos (una foto sin esa clave), los rótulos van sin paréntesis.
  Si a la cadena le falta un tramo sin cifra, se dibuja hasta donde se sabe y el resto va en gris con «La cinta se completa cuando haya …».
  Solo la dibuja la página, en SVG: el PDF de Métricas y el Informe anual no la llevan, porque sus cifras ya están en el circuito (decisión del usuario del 05/11/2026).
  La foto la sigue guardando y la API la sigue mandando; la opción `letra` de `cintaDeMetricas` queda sin uso en producción.
  Es orientativa, no un ciclo real, y lo dice.
- Los textos los arma el servidor (Ruling 19): las cifras y sus textos en las dos unidades, los plurales, los en curso y pendientes, las aclaraciones, las frases de los cajones, el modal de cada tramo con la geometría de su gráfico, lo que se dice sin casos o sin datos, los textos del índice, de la antigüedad, del trabajo y de «Para completar», y el botón del Informe anual sin foto (Ruling 34).
  La página y los PDF los imprimen tal cual.
- API (`controllers/metricasController.js`;
  `authMiddleware` sin `adminOnly`: lector y colaborador, 200; sin sesión, 401;
  `tests/permisos.test.js`):
  `GET /api/metricas?anio=&estadistico=&sin=` (un `dias` no se lee; `metricasDe`, con la vista en días corridos y los textos en las dos unidades:
  `{ anio, al, en_vivo, aviso_foto, anios, fotos, vista, cinta: { externa, interna }, contexto, trabajo, areas, sin_titulos, sin_texto }`;
  `sin_texto`: la franja ya armada, «Calculado sin 1 dataset:
  Parque Automotor.» —`textoDeLaFranja`—, con la misma leyenda que la píldora del PDF —`sinLosDestildados`—;
  `fotos`:
  `fotosDeMetricas`, cada año con `con_foto` y `aviso_informe`, lo que dice sin foto el botón del Informe anual:
  «Disponible desde el 10/01/2027» y, pasado ese día, el aviso de la foto; un año sin métricas, 404 «No hay métricas de ese año») y `GET /api/metricas/pdf` (lo mismo en el PDF, con las métricas manuales del año leídas en vivo, también en un año con foto:
  Ruling 23).
  `metricasConOpciones` lee el calendario (`exigirLaTabla(await leerCalendario())`) solo en vivo, después de los años con foto y antes de las fuentes: un año con foto no lee la tabla; sin la tabla, lo que va en vivo tira y `GET /api/metricas`, su PDF y «Datos para completar» (que pasa por `metricasDe`) responden un 500 con su mensaje fijo, nunca cifras contadas con los 9 fijos.
  `gestionController` sirve `/gestion/metricas`, el CSV y las métricas manuales.
- Los reportes (spec 5;
  `controllers/reportesController.js`, todos con `authMiddleware` sin `adminOnly`): ocho tarjetas en dos grupos (`htmlDeReportes`, `pedidoDeReporte`), cada una baja su PDF con `API.pedirArchivo` + `descargarBlob`.
  **Para presentar** (`rp-grilla g4`):
  Métricas del año (`GET /api/metricas/pdf`, `services/reportesMetricasPdf.js`: en A4 apaisado, el circuito; los resultados con «Cómo se cuenta» y los destildados; el contexto y el trabajo; y las áreas y temas, cada parte desde una hoja nueva, «Unas 5 hojas», Ruling 24; la píldora dice el estadístico y lo destildado;
  un año con foto sale de la foto; ver «El PDF apaisado»), Ciclo de vida del dato (`GET /api/reportes/ciclo-de-vida?anio=`, `reportesCicloDeVidaPdf.js`: cuánto tarda cada etapa del circuito, con todos los ciclos, en dos hojas, la gestión externa y la interna; ver `docs/temas/ciclo-de-vida.md`),
  Informe anual (`GET /api/reportes/informe-anual?anio=`, `reportesInformeAnualPdf.js`: solo para un año con foto —sin ella, 404—, con mediana en días corridos y, entre paréntesis, hábiles, en todas sus hojas (lee de la foto la vista `mediana-corridos`, `COMBINACION_DEL_INFORME`), las mismas hojas que Métricas del año, la comparación con la foto del año anterior —`comparacionDe`;
  El Informe anual: las cifras salen de la foto y los logros, de los hitos en vivo (un hito borrado o cargado después cambia el PDF de un año cerrado).
  sin foto del año anterior, la hoja se llama «Logros del año», con la píldora «Primer año con foto»— y los logros del año: los hitos de Herramientas → Proyectos con fecha en el año —los de los proyectos activos y los logros del área—, por proyecto, `logrosPorProyecto`, en dos columnas, con «Los hitos de AAAA cargados en Proyectos» a la derecha;
  sin las métricas manuales, que no están en la foto; ver «El PDF apaisado») y Estado general de los datasets (`GET /api/reportes/estado-general`, `reportesEstadoGeneralPdf.js`: la píldora del índice, las cinco tarjetas, la tasa con sus aclaraciones y la tabla de todos los datasets activos —Título, Área, Frecuencia, Datos al, Próx. Act. y Estado—).
  **Para trabajar:** Por área (`GET /api/reportes/por-area/:areaId`, `reportesPorAreaPdf.js`: una portada con el área, sus contactos —los de `CAMPOS_CONTACTO`, Ruling 25—, las cinco tarjetas y sus datasets por grupo, y detrás una hoja del Seguimiento por cada dataset activo; sin hojas de los dados de baja;
  pie «Reporte por área · Hoja k de N»), Avisos del RPAD (`GET /api/reportes/avisos?desde=&hasta=`, por defecto del 1/1 a hoy, `reportesAvisosPdf.js`: los emails viejos a la DGMIT y al área y las Notas Digitales de aviso y de reiteración, con la fecha, qué fue —los títulos del Seguimiento:
  `tituloDeEmail`, `tituloDeNotaADgmit`—, la gestión, los datasets —«24 datasets: …», Ruling 29— y el estado —`ESTADO_DE_NOTA`, `RESULTADO_DE_EMAIL`—; el título, los totales y la píldora cuentan solo lo enviado, con la regla del Seguimiento, y lo que no salió va en la tabla con su estado y un renglón aparte, Ruling 28; sin direcciones de email, sin las notas de prueba, sin el texto técnico de los errores y sin las de auditoría y autorización;
  un período que no vale, 400 «Elegí un período válido.»), Agenda de pedidos (`GET /api/reportes/agenda?meses=&gestion=`, `services/reportesAgenda.js` —puro— y `reportesAgendaPdf.js`: los próximos 3, 6 o 12 meses —6 de entrada—, las dos gestiones o una, mes por mes y con los vencidos aparte al principio; un vencimiento por dataset, la próxima actual;
  cada fila con el área, la frecuencia de `frecuenciaEnNota`, «Requiere nota DGMIT» en los externos, el pedido y la fecha aproximada del aviso según la regla, `fechaDeAvisoPorRegla`, que en un vencido es «—», Ruling 27;
  el día hábil sale del calendario, `fechaDeAvisoPorRegla(vencimiento, gestion, calendario)` y `agendaDe(datasets, { hoy, meses, gestion, calendario })`, que `reporteAgenda` lee una vez y exige con la tabla —sin ella, un 500 con el mensaje fijo del reporte—: el aviso interno del 31/12/2026 dice el 03/11 y el externo, el 24/11, los días en que salen) y Datos para completar (`GET /api/reportes/para-completar?anio=`, `pdfDeParaCompletar` y `reportesParaCompletarPdf.js`:
  la `vista.para_completar` de `metricasDe` del año pedido, leído como en `GET /api/metricas` —por defecto el en curso; un año sin métricas, el mismo 404—; la tarjeta elige el año con los de la API y propone el último año cerrado sin foto (entre el 01/01 y el día de la foto, o mientras la corrida la reintenta) o, si no hay, el en curso, Ruling 39; el rótulo dice el `al` de esas métricas, «al 31/12/2026» en un año cerrado; el archivo lleva siempre el día de hoy).
  Un 500 de estos reportes dice un mensaje fijo por reporte (`ERROR_AL_GENERAR`); el error completo, solo en `console.error`.
  El Estado general dice «El 82% de los que tienen vencimiento están al día:
  A de B» (sin espacio, Ruling 38).
  No existen el reporte de Cumplimiento (tarjeta, `GET /reportes/cumplimiento`: el ranking está en Métricas) ni el Historial de notificaciones (`GET /reportes/historial-notificaciones`: lo cubre Avisos del RPAD), ni `API.getReporteHistorialUrl` ni `getReporteCumplimientoUrl` (las dos rutas dan 404:
  `tests/reportes.test.js`).
  Los nombres de los archivos, en `nombreDelReporte` (`services/reportesNombres.js`, con hoy en Argentina):
  `Metricas-RPAD-AAAA.pdf`, `Ciclo-de-vida-del-dato-AAAA.pdf`, `Informe-anual-RPAD-AAAA.pdf`, `estado-general-dd-mm-aaaa.pdf`, `Reporte-area-<id>-AAAA-MM-DD.pdf`, `Avisos-RPAD-AAAA-MM-DD.pdf`, `Agenda-de-pedidos-AAAA-MM-DD.pdf` y `Datos-para-completar-AAAA-MM-DD.pdf` (`Content-Disposition` con `disposicionDeAdjunto`).
- La base de los PDF (`services/reportesPdfBase.js`, spec 5.1), el lenguaje de los anexos:
  A4 explícito (`nuevoReporte`:
  `DocumentoNota` no tiene tamaño y sin él saldría LETTER), vertical de entrada u `hoja: HOJA_APAISADA`, una sola forma por documento (`hojaDe`, `limiteDe`, `anchoDelRecuadro`; `LIMITE` y `ANCHO_DEL_RECUADRO` son los de la vertical y `HOJA_*` salen de 210 × 297 mm, no de `doc.page`, que redondea y cambiaría los bytes de los demás PDF), Helvetica, márgenes de 15 mm, `COLOR` y los ayudantes de `notasDigitalesAnexo.js`, y el encabezado, el pie y la cabeza de sección del Seguimiento, sin copiarlos.
  Los elementos se miden antes de dibujarse (`prepararTitulo`, `prepararPildora` —con su `ancho`, y su `dibujar(y, x)` la pone en una x, de entrada el margen—, `prepararTarjetas`, `prepararSeccion`, `prepararParrafo`, `prepararRecuadro` —gris o con el borde azul a la izquierda— y `prepararTabla`, que corta de hoja, repite su encabezado y su `cabeza` y lleva su `aclaracion` con la última fila;
  `lugarPara`, `dibujarJuntos` y `nuevoFlujo`, dos columnas que siguen en otra hoja, con su cabeza arriba de cada una): nada pasa de `limiteDe` y un título nunca queda solo al final de una hoja (Ruling 22).
  El pie, «Generado el dd/mm/aaaa a las hh:mm por <nombre corto>» y «<Reporte> · Hoja k de N», se dibuja al cerrar (`cerrarReporte`;
  `hojasDe` numera las hojas que suma otro dibujante, como las del Seguimiento).
  Los dibujantes son puros (sin pool) y leen lo del servidor con `esObjeto`, `objeto`, `lista`, `esNumero` y `texto`.
  `tests/pdf-diagramacion.js` controla los márgenes de cada hoja por su tamaño: un texto cortado por `renglon` lo mide entero, y por eso `prepararPildora` con `anchoMaximo` corta con `ajustar`.
- `textoPorcentaje` y `htmlDelRanking` arman el ranking de áreas; los temas y las frecuencias van en barras, sin Chart.js (`tests/paginas.test.js`).
  `gestionController` arma la tasa y el ranking con `cumplimientoPorArea`.
  `gestion.html` redirige a Herramientas → Proyectos (ver `docs/temas/proyectos.md`): un link viejo a `gestion.html#metricas` llega por la redirección y avisa «Las métricas de Gestión ahora están en Herramientas → Métricas y Reportes.» (link a `reportes.html#metricas`).
  Los tests de la foto, con un hoy fijo, llaman al servicio o al controlador de la corrida, o la guardan con `datosDeLaFoto` y un `INSERT`: nunca a `/api/cron/*`.
  `tests/reportes-pdf.test.js` compara el contenido de cada hoja del PDF de Métricas y del Informe anual contra `REFERENCIA_DE_LOS_PDF`: un cambio a propósito en esos PDF (por ejemplo, un texto del Informe anual) tiene que volver a tomar la referencia (ver `docs/temas/ciclo-de-vida.md`).
  `metricas-reglas.test.js` corre sobre `tests/metricas-casos.js` (los casos de `tests/seguimiento-casos.js` más lo importado) y casos sintéticos, y `reportes-pdf.test.js` lee los ocho PDF con `tests/pdf-lector.js` y `tests/pdf-diagramacion.js`.
  Los tests con los feriados de la tabla están en `tests/feriados-en-metricas.test.js` (ver `docs/temas/calendario-y-corridas.md`).
  Los números de la base real no van en tests versionados (Ruling 3: los datos reales no se versionan).

## El PDF apaisado

Métricas del año y el Informe anual, en A4 apaisado (spec 2026-11-05-metricas-pdf-apaisado).
Son solo del PDF: la página no cambia.

- **El circuito** (`dibujarElCircuito`): las dos gestiones juntas en la hoja 1.
  Cada una con su solapa, su frase y su panel (`prepararGestion`): la externa llena y la interna hueca, en `COLOR.tinta`, para que se distingan en blanco y negro sin usar un color de actor.
  Las frases son del dibujo (`FRASES_DE_LA_GESTION`), no de la pestaña.
  El Portal mide lo justo para su texto y las demás columnas son iguales dentro de cada gestión.
  Dibuja la misma banda que la página, con las siglas; el color del Área, `COLOR_DEL_AREA`, no está en `NODOS` para no cambiar el Ciclo de vida.
- **La letra** (`LETRAS_DEL_CIRCUITO`): tres escalones (la cifra en 21, 19 o 17 pt; los textos de las tarjetas en 8,6, 8,3 o 7,7), y va el más grande con el que las dos gestiones entran en la hoja.
  Hay escalones porque una tarjeta crece con su texto (el orientativo, «En el día» con sus ciclos, una frase de tres renglones o, sin cifra, el porqué del vacío): sin ellos, la interna se iría de hoja, y el usuario las quiere juntas.
  Los pendientes y los en curso no van en las tarjetas (van en «Cómo se cuenta»): con los datos de la copia local del 07/11 y del 08/11/2026, las dos gestiones entran con el primero (8,6 pt, lo que pidió el usuario).
  Una externa con una tarjeta que junta el orientativo y una frase de tres renglones baja al segundo: es a propósito, porque la spec 2026-11-07-metricas-cajones-y-ciclos (6) no cambia los escalones ni el aire entre las dos gestiones («Un año con más texto puede bajar de escalón»).
  Si con la más chica tampoco entran, la interna pasa entera a la hoja siguiente.
- **Las dos unidades** (spec 2026-11-06-metricas-anticipacion-y-corridos, 6, y 2026-11-07-metricas-cajones-y-ciclos, 4): todo el PDF va en días corridos con los hábiles entre paréntesis, sin selector.
  En la hoja 1, cada cifra va en días corridos y, pegados debajo, los hábiles entre paréntesis (`habiles_texto` del tramo: «(53 días hábiles)»; con corridos y 0 hábiles, «(En el día, en días hábiles)»; nada si las dos son «En el día»).
  El aire va entre los hábiles y «mediana de…», no entre las dos cifras: `grupoDeLaCifra` le resta a los hábiles lo que la cifra deja debajo de su letra y lo suma después, y la tarjeta mide lo mismo.
  La solapa de cada gestión y la píldora dicen «Mediana en días corridos y hábiles» («Promedio en…»); la píldora sigue diciendo lo destildado.
  Salen de `datos.circuito_en_corridos` y `datos.circuito_en_habiles`, con la forma de `vista.circuito` (`circuitoDeLaHoja`).
  En vivo, `enVivo` con `conCircuitos`: la misma regla (`vistaDe`) con los mismos casos y destildados, sin volver a leer la base, y la vista en corridos no se calcula de nuevo.
  Con foto, `circuitosDeLaFoto` (`controllers/metricasController.js`, que usa también el Informe anual), de las cuatro combinaciones que la foto ya guarda.
  Una foto sin `habiles_texto` saca el paréntesis de la otra vista (`textoDeHabiles(cifra, habil)`, de `services/metricasReglas.js`); si además falta la otra vista, no tira: va sin paréntesis y la solapa dice «Mediana en días corridos».
  Solo las piden los PDF: `GET /api/metricas` no las manda.
  Los en curso y las notas pendientes de carga no van en la hoja 1: van en «Cómo se cuenta» (abajo).
  Las otras hojas imprimen los textos del servidor, que ya traen las dos unidades: «Los casos» destildados, el «después» de «Actualizados a tiempo» y los en curso.
- **El aviso anticipado:** su cajón tiene otro cuerpo; ver la sección del cajón «Aviso anticipado», abajo.
- **Los resultados** (`dibujarLosResultados`): «Cómo se cuenta» empieza con la oración de los días («Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.», `T.bajada`), el pie del circuito (`T.pieDelCircuito`), «Un tramo cuenta en el año en que terminó; el aviso, en el año de su vencimiento.» (`EN_EL_ANIO`, del dibujo: no queda en la foto) y las siglas.
  Debajo, las aclaraciones de cada gestión, con su nombre (`aclaracionesDe` del PDF): primero lo que salió de los cajones y después los avisados ya vencidos, los resueltos con una fuente pública y los de datasets que no requieren nota DGMIT.
  Lo que salió de los cajones: en la externa, «6 notas DGMIT de ciclos abiertos están pendientes de carga: cuentan en la redacción y entrega de nota cuando se cargan.»; en las dos, «3 ciclos abiertos todavía no tienen datos registrados, hace 150 días corridos (102 hábiles, mediana): cuentan en la respuesta del área cuando se registra la actualización.» (o «en la producción del relevamiento»).
  Las arma el servidor con su singular (`circuito.aclaraciones`); las de 0 no van, y una gestión sin ninguna no lleva su nombre.
  Una foto sin `pendientes` ni `en_curso` en sus aclaraciones no tiene esas líneas.
  No se sacan del PDF, aunque parezcan de más: son lo único que avisa que hay ciclos que no cuentan en una cifra, y sin eso un número se puede tomar por el total.
  «Cómo se cuenta» no viaja con los resultados, porque juntos pueden no entrar en una hoja; si no entra, salta con el título repetido.
- **El contexto** (`elementosDelContexto`): el índice a la izquierda; la antigüedad y la doble verificación a la derecha.
  El Informe lleva su propio pie del índice (`TEXTOS_DEL_INFORME.pieDelIndice`), sin «el de hoy».
- **Las áreas** (`dibujarLasAreas`): el ranking en dos columnas (`nuevoFlujo`), con los temas y las frecuencias en la columna libre o en otra hoja.
- **Sin cintas:** ver «La cinta», arriba.

Un hito del Informe lleva hasta 35 renglones de descripción, para que el nombre del proyecto y el hito más alto entren debajo del título de la hoja.
`nuevoFlujo` no corta una pieza: los temas y las frecuencias son catálogos cortos (hoy, 12 temas, sin API que los cargue); una lista de más de unos 35 renglones se saldría de la hoja.
La cantidad de hojas de la tarjeta de Reportes, «Unas 5 hojas», es la de los datos del 05/11/2026.

## El cajón «Aviso anticipado»

En la página, el PDF de Métricas y el Informe anual, en las dos gestiones (spec 2026-11-06-metricas-anticipacion-y-corridos, 7); el Ciclo de vida no lo lleva.
Es la única etapa donde más días es mejor, y por eso se lee distinto.
Va cuando el tramo trae `anticipacion_texto`; con «En el día» o sin cifra, el cajón es como el de los demás tramos: sin línea y con la frase de cómo se cuenta.

- De arriba abajo: el número, con la letra y el lugar de la cifra de los otros cajones; la frase del servidor («días corridos de anticipación»); los hábiles entre paréntesis (`habiles_texto`); la línea, con «aviso» y «vencimiento» debajo de cada punta; el estadístico y, si corresponde, el orientativo.
- La línea es un dibujo fijo, no una escala: mide lo mismo con 3 días que con 83.
  El número ya dice los días; una línea que creciera con ellos se leería como una escala, y eso es un antiobjetivo de la spec.
  Empieza en un punto lleno y termina en un aro chico, en la tinta de la tarjeta.
- No lleva la frase de cómo se cuenta («Se cuenta desde que el RPAD avisa hasta el vencimiento.»), porque lo dice el dibujo; el modal del tramo sí la dice.
- En la página (`htmlDeFlecha`, con la clase `anticipa`), el número, la frase («días corridos de anticipación») y los hábiles entre paréntesis (`.h`).
  La línea son bordes (`.mt-anticipa-punto`, `.mt-anticipa-linea` y `.mt-anticipa-aro`), para que se vea con `forced-colors`, donde el punto sigue lleno con `CanvasText`.
  El lector de pantalla la salta (`aria-hidden`) y lee «aviso» y «vencimiento» (`ANTICIPACION_DESDE` y `ANTICIPACION_HASTA`, atadas a `TEXTOS_DE_LA_PESTANA.anticipacion`).
  Hasta 960 píxeles va en una columna, como las demás tarjetas, y «La cinta» no cambia.
- En el PDF, `etapaDe` dibuja `cuerpoDeLaAnticipacion`: todo se mide antes de dibujarse, como lo demás, para que `LETRAS_DEL_CIRCUITO` elija el escalón, y los textos pasan por `pieza`.
  La línea va con `moveTo` y `lineTo`: un `rect` fino sería, para `tests/pdf-diagramacion.js`, una línea que cruza la tarjeta.

## Los cajones del circuito

En la página, el PDF de Métricas y el Informe anual, en las dos gestiones (spec 2026-11-07-metricas-cajones-y-ciclos, 3); el Ciclo de vida no cambia.

- De arriba abajo: el nombre del tramo; la cifra en días corridos y, debajo, los hábiles entre paréntesis (`habiles_texto`); el estadístico con los ciclos; con 4 casos o menos, el orientativo; la frase de cómo se cuenta (`como_se_cuenta`); con «En el día», los ciclos; y la insignia de quién está a cargo.
- Las frases (`COMO_SE_CUENTA`, `services/metricasReglas.js`), con las siglas con artículo (decisión del usuario del 07/11/2026: los nombres completos alargan la frase en las tarjetas angostas):
  aviso, «Se cuenta desde que el RPAD avisa hasta el vencimiento.»;
  redacción, «Se cuenta desde que la DGMIT y la DA reciben el aviso hasta que entregan la nota.»;
  respuesta, «Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización.»;
  producción, «Se cuenta desde que la DGMIT y la DIT reciben el aviso hasta que entregan el relevamiento a la DDPC.»;
  carga, «Se cuenta desde que la DDPC recibe la actualización hasta la carga en el portal.».
- La frase va en su propia clave, no en `TRAMOS`: `tramoDelCircuito` copia `TRAMOS` entero y lo lee el Ciclo de vida, que sigue dibujando `desde_hasta` en sus flechas.
  Por eso `desde_hasta` está igual en `TRAMOS` y en el tramo, aunque Métricas no lo dibuje: solo una foto sin `como_se_cuenta` lo muestra en el cajón.
- Sin cifra, el título del vacío y la frase.
  En la respuesta del área va además su `vacio.texto` («Se empieza a contar cuando haya notas DGMIT cargadas»), que dice por qué está vacía; en la redacción, no: su `vacio.texto` son los pendientes de carga, que van en el modal.
- Los pendientes de carga, los en curso y «Se cuenta hasta que se registra la actualización.» no van en el cajón, y no se borran: un caso que nunca termina no puede desaparecer (antiobjetivo).
  Van en el modal de su tramo y en «Cómo se cuenta» de los PDF (`circuito.aclaraciones.externa.pendientes` y `en_curso` de las dos gestiones, cada una `{ n, texto }`, con su singular y las dos unidades).
  El recuadro «i» de la página dibuja solo las tres de siempre: los avisados ya vencidos, los resueltos con una fuente pública y los que no requieren nota.
- En el PDF, la frase puede tener hasta 4 renglones y nunca se corta con «…»: las cinco entran enteras en los tres escalones y en la columna más angosta.
- El tramo suma, después de las 11 claves de siempre, `como_se_cuenta`, `habiles` (la cifra del tramo en días hábiles, con la forma de `cifra` y los mismos ciclos; null sin cifra y en la vista en hábiles), `habiles_texto` (`textoDeHabiles(cifra, habiles)`; '' sin `habiles`) y `modal` (null en la vista en hábiles).
- Las 11 de siempre (`clave`, `nombre`, `desde_hasta`, `responsable`, `dgmit`, `cifra`, `vacio`, `en_curso`, `pendientes`, `pendientes_texto` y `anticipacion_texto`) no cambian de forma ni de contenido, aunque Métricas no dibuje algunas: las lee el Ciclo de vida del dato (`etapaDelReporte` llama a `tramoDelCircuito`).
  `tests/metricas-huellas.test.js` lo controla, con las aclaraciones de `aclaracionesDe` y las etapas: `tramoDelCircuito`, `TRAMOS` y `aclaracionesDe` no cambian.
- Una foto sin las claves nuevas se lee igual y nada tira: el cajón dibuja `desde_hasta`, el PDF saca el paréntesis de la otra vista y la banda de la página va sin botones.

## El modal de cada tramo

Solo en la página (spec 2026-11-07-metricas-cajones-y-ciclos, 5): el PDF no lo lleva.

- La banda: cada nodo con tramo (RPAD, «DGMIT y Dirección Administrativa», «DGMIT y Dirección de Investigación Territorial», «Área responsable» y «Datos Públicos») es un `<button>` (`htmlDeNodo`, con `data-tramo` y `data-gestion`) con un círculo con un + y «Ver los ciclos»; el Portal sigue siendo un `<div>`.
  El orden de los hijos de `.mt-tramos` no cambia (la grilla usa `nth-child`).
  El botón abre el modal aunque el tramo no tenga ciclos: el modal dice por qué.
  El foco se ve adentro de la flecha (el recorte de la punta taparía un contorno de afuera) y, con `forced-colors`, el botón conserva su borde.
- Lo arma el servidor (`modalDelTramo`, `services/metricasReglas.js`), solo en la vista en días corridos: `tramo.modal` es `{ quien, leyenda, como_se_cuenta, lista, puntas, ciclos, vacio, grafico }`; la página lo dibuja (`htmlDelModal`).
- De arriba abajo: el nombre del tramo, que es el nombre del diálogo; quién y la gestión («Área responsable · gestión externa»); con destildados, la franja «Calculado sin…» de la pestaña, sin «Volver a todos»; la frase; la cifra del cajón con la leyenda al lado; el gráfico; «Cómo se cuenta», solo si tiene líneas; y «Los ciclos (N)».
- Sin cifra, el título y el texto del vacío, en todos los tramos: también en la redacción, donde el texto repite los pendientes que ya dicen la leyenda y «Cómo se cuenta», porque así lo pide la spec (ruling del 08/11/2026).
- La leyenda dice cuántos cuentan en la cifra, cuántos están en curso y cuántas notas están pendientes de carga, cada una con su marca (lleno, aro con flecha o punteado: nunca solo el color); solo las que tienen ciclos.
- Los ciclos son los de la cifra: los destildados no están.
  Los que cuentan son tantos como `cifra.ciclos`; los en curso, como `en_curso.n`; las notas pendientes, como `pendientes`.
  Van primero los que cuentan (de más días corridos a menos; con empate, de más hábiles a menos y después por título), después los en curso (igual) y al final las notas pendientes (por la fecha del aviso).
  Cada fila: el dataset con el link a su Seguimiento y su área debajo; las dos fechas de la etapa, con el nombre de cada punta (`puntas`: «Aviso» y «Vencimiento», «Aviso» y «Nota DGMIT», «Nota DGMIT» y «Datos recibidos», «Aviso» y «Datos recibidos», «Datos recibidos» y «Carga en el portal»); y los días en las dos unidades («64 días corridos (45 hábiles)», «En el día», «hace 150 días corridos (102 hábiles)» en curso, «—» en una pendiente).
  Sin ciclos, «Sin ciclos en 2026.» y sin tabla.
- «avisado ya vencido: desde ese primer aviso» va debajo del aviso solo en las filas con días (las que cuentan y las en curso) de la redacción y de la producción (decisión del usuario del 08/11/2026): una nota pendiente de carga no tiene días contados desde ningún lado.
  La línea «N ciclos se avisaron ya vencidos: se cuentan desde ese primer aviso.» de «Cómo se cuenta» cuenta esas mismas filas.
- «Cómo se cuenta» del modal, con las cantidades del tramo (no las de toda la gestión), cada línea con su singular y sin las de 0:
  aviso, los avisados ya vencidos que vencen en el año y los vencimientos de la cobertura sin el aviso de la regla;
  redacción, las notas pendientes, los avisados ya vencidos y los de datasets que no requieren nota;
  respuesta, los en curso (con las dos unidades), los resueltos con una fuente pública y los que no requieren nota;
  producción, los en curso y los avisados ya vencidos;
  carga, los resueltos con una fuente pública («la carga se cuenta desde que se obtuvo»).
  Los filtros de la fuente pública y de los que no requieren nota repiten los de `aclaracionesDe`, que no cambia porque la usa el Ciclo de vida: un test ata las cantidades.
- El gráfico (`graficoDelTramo`, `services/metricasGrafico.js`, puro): un punto lleno por ciclo que cuenta, en el color del tramo, y un aro ámbar con una flecha por ciclo en curso, sobre los días corridos y con un `<title>` que dice el dataset y los días en las dos unidades; las notas pendientes no van, porque no tienen días.
  La mediana o el promedio va como una línea con su rótulo («mediana: 64 días corridos», «mediana: en el día»); sin cifra (solo en curso), sin línea; sin ningún ciclo con días, no hay gráfico.
  Los puntos que se tocarían se apilan, y una columna de más de 8 dice «+N».
  Toda la geometría (las x, los niveles, el eje con sus marcas y «días corridos», el rótulo de la línea y los «+N») la arma el servidor en un espacio de `GRAFICO.ancho` de ancho, y nada se sale ni se pisa, salvo la línea con los puntos de su columna (`tests/metricas-grafico.test.js`).
- Cuando la línea cruza la columna de un «+N», el «+N» va al lado de la línea y no arriba (ruling del 07/11/2026): la spec pide las dos cosas y no pueden valer juntas; gana que nada se pise.
- El gráfico se muestra desde 800 píxeles de ancho de pantalla (`@media (max-width: 799px)` lo oculta; decisión del usuario del 08/11/2026): más abajo, el SVG se achica y su letra queda en 8 o 9 píxeles, que no se leen.
  La lista tiene los mismos datos, y el gráfico tiene un nombre para el lector de pantalla que lo dice.
- Cómo se usa: el modal de siempre (`.modal-overlay` y `.modal` de `css/main.css`; `#mt-modal-tramo`, hijo de `body` después de `.app-container`), con `role="dialog"`, `aria-modal` y el título como nombre.
  Mientras está abierto, `.app-container` queda `inert` (ni el foco ni el lector de pantalla salen del modal) y `body` no se desplaza.
  El foco va a la × cuando termina la entrada; se cierra con la ×, con Escape o con un clic que empezó en el velo, y el foco vuelve al botón de la banda que lo abrió (`enfocarElBotonDelTramo`; si ya no está, al chip de la gestión elegida).
  Volver a pedir las métricas o cambiar de pestaña (`hashchange`) lo cierra.
  Con `prefers-reduced-motion`, aparece sin achicarse ni agrandarse.
  La × tiene 4,5:1 o más sobre el blanco (la de `main.css` no llega a 3:1); los estilos van en el `<style>` de `reportes.html`, para no cambiar `main.css`.
- En el teléfono, el cuerpo del modal se desplaza adentro (`overscroll-behavior: contain`) con la × a la vista, la tabla se desplaza de costado en su marco (`.mt-modal-tabla`, con la tabla de 600 píxeles como mínimo y los días en un renglón) y la página de atrás no se mueve.
- Una foto sin `modal` en sus tramos dibuja la banda sin botones.
- El modal pesa: va solo en las vistas en corridos, y «Datos para completar», que también pasa por `metricasDe`, lo recibe sin usarlo.

## La página: reportes.js

- `reportes.js` («Métricas y Reportes»): al cargarse solo declara (`tests/reportes-frontend.test.js` lo carga en un `vm`).
  Lo que arma HTML (la barra, la franja de lo destildado, «En esta página», el circuito, el SVG de la cinta y el del índice, los casos, los resultados, el contexto, el trabajo, las áreas, «Para completar» y las tarjetas de Reportes:
  `htmlDeBarra`, `htmlDeFlecha`, `htmlDeNodo`, `tramoDeLaGestion`, `htmlDelModal`, `svgDelGrafico`, `svgDeCinta`, `htmlDeReportes`, `pedidoDeReporte`, …) es puro y recibe quién mira por parámetro; lo que toca el DOM o la API va aparte, al final.
  Lo elegido viaja en la URL (`estadoDeLaUrl`, `urlDeEstado`: los de entrada no se escriben).
  Pide los datos con `API.pedirJson` y los PDF con `API.pedirArchivo` + `descargarBlob` (JWT en el encabezado).
  No recalcula nada: cifras, textos (plurales, «En el día», los vacíos, las dos unidades), en curso, pendientes, la cinta (con sus x, su línea, sus alturas, sus rótulos y sus anclajes), el modal de cada tramo (con la geometría de su gráfico) y el índice los manda el servidor (Ruling 19); todo texto del servidor pasa por `Utils.escapeHtml` y un número se escribe con `String` (un 0 es «0»).
  Las fechas, con `Utils.fechaCorta`;
  «hoy», con `Utils.hoyEnArgentina()`.
  La franja de lo destildado imprime `sin_texto` de la API (la arma `textoDeLaFranja`).
  Copias mínimas:
  `ESTADISTICOS` y `GESTIONES` (los selectores: los valores, copia de los de `services/metricasReglas.js` y atados; los rótulos, solo del navegador; sin `DIAS`, porque no hay selector de días) y los de entrada de `ESTADO_POR_DEFECTO` (mediana, gestión externa y ningún destildado, sin `dias`: los de `opcionesDeMetricas`; el año va null y el servidor usa el de hoy), `nombreDelReporte` (copia de la de `services/reportesNombres.js`, con los ocho nombres, `'ciclo'` incluido:
  `API.pedirArchivo` no da el `Content-Disposition`), `MESES_AGENDA` y `GESTIONES_AGENDA` (copia de `MESES_DE_LA_AGENDA` y `GESTIONES_DE_LA_AGENDA` de `services/reportesAgenda.js`, con los de entrada de `REPORTES_POR_DEFECTO` atados a `MESES_POR_DEFECTO`) y `PERIODO_INVALIDO` (copia de `MENSAJE_PERIODO_INVALIDO` de `services/reportesAvisosPdf.js`), todas atadas por tests de paridad;
  `esFechaDeTexto` (copia de `esFechaIso`) solo tiene tests de comportamiento.
  `RADIO_DEL_PUNTO` y `FLECHA_DEL_EN_CURSO` son copias de `GRAFICO.radio` y `GRAFICO.flecha` (`services/metricasGrafico.js`), atadas por un test: el servidor mide los puntos con ellas y la página los dibuja.
  El modal (ver «El modal de cada tramo») lo abren `abrirModalDelTramo` y la delegación de clics en `#mt-circuito`, y lo cierra `cerrarModalDelTramo`; `pagina.modal` dice cuál está abierto.
  `claveDelFoco` reconoce `data-tramo`: un botón de la banda que tiene el foco lo conserva cuando el circuito se vuelve a dibujar.
  La tarjeta `ciclo` (el Ciclo de vida del dato, segunda en «Para presentar») elige su año con `anioDeMetricasDelAnio`, como Métricas del año, pero sin el de la pestaña Métricas (`REPORTES_POR_DEFECTO.ciclo` es null: sin elegir, el en curso) y pide solo el año (`pedidoDeReporte`: sin la combinación ni los destildados);
  `TARJETAS_CON_ANIO`, `CONTROLES_DE_REPORTES` (`'rp-ciclo'`) y `conReporteElegido` la conocen (ver `docs/temas/ciclo-de-vida.md`).
  Los textos fijos de la pestaña que repite el PDF de Métricas (`TEXTOS_DE_LA_PESTANA` de `services/reportesMetricasPdf.js`) y los del de «Datos para completar» (`TEXTOS_DE_PARA_COMPLETAR` de `services/reportesParaCompletarPdf.js`) están atados al HTML y a `reportes.js` por los tests «reportes.js y el PDF de Métricas: los mismos textos» y «… de Datos para completar: los mismos textos»: si cambia uno de la pestaña, fallan.
  La oración de los días (`BAJADA_DE_LOS_DIAS`, el final de `#mt-bajada` de `reportes.html` y `TEXTOS_DE_LA_PESTANA.bajada`, con que empieza «Cómo se cuenta» del PDF de Métricas y del Informe anual) dice «Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.».
  El pie del circuito (`TEXTOS_DE_LA_PESTANA.pieDelCircuito`, también en el HTML) dice «Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio», cada cifra lo dice debajo.».
  `tests/paginas.test.js` exige que `VERSION_FERIADOS` sea mayor que `VERSION_REPORTES`.

## Archivos de tests

`reportes-frontend.test.js`, `paginas.test.js`, `permisos.test.js`, `reportes.test.js`, `metricas-reglas.test.js`, `metricas-huellas.test.js`, `metricas-grafico.test.js`, `metricas-cinta.test.js`, `metricas-opciones.test.js`, `metricas-foto.test.js`, `metricas-api.test.js`, `reportes-agenda.test.js`, `reportes-pdf.test.js`, `estados-api.test.js`, `schema.test.js`
