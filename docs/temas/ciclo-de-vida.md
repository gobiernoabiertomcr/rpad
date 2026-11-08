# Ciclo de vida del dato

El PDF de dos hojas que dice cuánto tarda el dato en cada etapa del circuito.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-25-ciclo-de-vida-del-dato-design.md`
- `docs/superpowers/specs/2026-11-05-circuito-diseno-design.md`
- `docs/superpowers/specs/2026-11-06-metricas-anticipacion-y-corridos-design.md`

## Ciclo de vida del dato (spec 2026-10-25-ciclo-de-vida-del-dato)

- Qué es: un PDF de la pestaña Reportes de «Métricas y Reportes» (`docs/temas/metricas-y-reportes.md`) que dice cuánto tarda el dato en cada etapa del circuito, del aviso del RPAD a la carga en el portal, de cualquier año con métricas (el en curso al día de hoy; uno cerrado, al 31/12).
  Siempre dos hojas A4: la 1, la gestión externa (aviso anticipado, redacción y entrega de nota, respuesta del área y preparación y carga), y la 2, la interna (aviso anticipado, producción del relevamiento y preparación y carga), con un bloque por etapa: qué se hace y cómo se mide, la mediana y el promedio (en días corridos, con los hábiles al lado), los dos extremos con su dataset, cuántos ciclos se midieron, los en curso, las notas pendientes de carga y la mediana del año anterior.
  Lo ven todos los roles con sesión, también el lector y el colaborador.
  Cuenta siempre todos los ciclos, como el Informe anual: no sigue a los destildados ni a los selectores de la pestaña Métricas (decisión del usuario).
  La tarjeta va segunda en «Para presentar», después de Métricas del año (el grupo lleva `rp-grilla g4`), con el ícono `route` de Lucide, el texto «Cuánto tarda cada etapa del circuito, del aviso del RPAD a la carga en el portal: la mediana, el promedio y los casos más largo y más corto de cada una.
  Una hoja para cada gestión.», el selector Año (los de `fotos`, con el en curso arriba y elegido de entrada, independiente del año de la pestaña: ver `docs/temas/metricas-y-reportes.md`) y «2 hojas: la gestión externa y la interna» debajo del botón.
  Sin SQL: la foto es JSON y `etapas` es una clave más.
  Antiobjetivos: los de Métricas (nada que se lea como un reproche o un control a la DGMIT o a un área: sin nota cargada, «pendiente de carga»; los extremos nombran el dataset, no el área; nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó»), que un caso que todavía no terminó desaparezca, que el reporte diga una cosa y la pestaña Métricas otra para el mismo año y la misma combinación, y que una cifra de un año cerrado cambie después de su foto.
- Las reglas (`etapasDe(casos, { anio, al, calendario })`, `services/metricasReglas.js`, pura; nunca tira, salvo con un calendario mal armado, y da null sin año o con `al` anterior a él;
  el `calendario`, el mismo en sus dos contextos, es el de los días hábiles: sin él, o con null, `CALENDARIO_FIJO`): las etapas son los tramos del circuito (`TRAMOS_DE_LA_GESTION`), en su orden, con sus nombres, su «desde → hasta» y su insignia, y cuentan exactamente los ciclos de la cifra de cada tramo de `vistaDe` con todos los ciclos (`sin` = []).
  No copia ninguna regla: dos contextos (`contextoDe`, en días hábiles y en corridos, con mediana), `hechosDe` una vez por caso, `medir` una vez por unidad, `cifraDe` para la mediana y el promedio, `tramoDelCircuito` (en hábiles, con mediana) para el vacío, los pendientes y el orientativo, y las dos pasadas para el en curso: el de `tramoDelCircuito`, en hábiles, y el de `enCursoDelTramo`, en corridos, juntos en `textoEnCursoDeLosDos`.
  Las cuentas de las aclaraciones son las de `aclaracionesDe`, la misma de `vistaDe`, que pone en `circuito.aclaraciones` sus claves y, aparte, `pendientes` y `en_curso` (las de «Cómo se cuenta» de los PDF de Métricas, que el Ciclo de vida no lee).
  Devuelve `{ anio, al, externa:
  Etapa[4], interna:
  Etapa[3], aclaracion_de_la_hoja: { externa, interna } }`.
  Cada etapa:
  `clave`, `numero` (desde 1), `nombre`, `desde_hasta`, `responsable`, `dgmit`, `nodos` (`[desde, hasta]`: 'rpad', 'da', 'dit', 'area', 'ddpc' o 'portal'), `n`, `habiles` y `corridos` (`{ mediana, promedio }` de `cifraDe`, o null sin ciclos), `largo` y `corto` (los extremos), `vacio` (`{ titulo, texto, pie }`, solo sin ciclos) y `textos` (Ruling 19, el PDF los imprime:
  `indice` —la mediana en días corridos del circuito chico: '83', 'En el día' o '—'—, `mediana` y `promedio` —`{ numero, unidad, habiles }`: '83', 'días corridos', '53 días hábiles'; el promedio con los hábiles entre paréntesis—, `ciclos` —«de 32 ciclos»— y `notas`).
  Test de paridad: la mediana y el promedio de cada etapa, en las cuatro combinaciones de estadístico y días, son la `cifra.valor` del tramo en `vistaDe`, y `n` es su `cifra.ciclos`.
- Los extremos (`extremoDe`): el ciclo con más días hábiles en la etapa y el de menos; muestran los corridos en lo grande y los hábiles del mismo ciclo debajo.
  Los extremos se eligen por días hábiles aunque lo grande sean los corridos (spec 2026-11-06-metricas-anticipacion-y-corridos, 6): lo grande decide qué número se lee primero, no qué ciclo es el extremo.
  Por eso el más largo puede tener menos días corridos que otro ciclo de la etapa: no es un error.
  Con un empate en hábiles, el más largo nombra el de más días corridos y el más corto el de menos, y después el primero por título;
  «y N más» cuenta los otros ciclos empatados en días hábiles, no en corridos (el mismo dataset puede estar más de una vez, en ciclos distintos).
  Los rótulos: en el aviso anticipado, «Con más anticipación» y «Con menos anticipación» (ahí más días es mejor); en las demás, «El caso más largo» y «El caso más corto»; con un solo ciclo, `largo` es «El único caso» (un solo recuadro, a todo el ancho) y `corto`, null.
  Cada extremo:
  `{ rotulo, habiles, corridos, dataset_id, titulo, mas, numero, unidad, habiles_texto, dataset_texto, mas_texto }` (`numero` y `unidad`, en corridos; `habiles_texto`, «53 días hábiles»; `mas_texto`, ' y 14 más' o '', va aparte para que el PDF corte el título con «…» sin perder el sufijo; sin título, «Sin título»).
  Las unidades:
  lo grande, «días corridos» o «1 día corrido», y los hábiles «53 días hábiles» o «1 día hábil» (`diasEnPalabras`).
  Con los dos en 0, «En el día», sin unidad ni hábiles, como en Métricas; con corridos y 0 hábiles, el número en corridos y «En el día, en días hábiles».
  Los en curso no entran en los extremos: son solo de los terminados.
- Sin ciclos terminados, el bloque no tiene cifras y lleva el vacío (`vacioDeLaEtapa`, con los textos del reporte): sin ninguna nota DGMIT en el RPAD, la redacción y entrega de nota dice «Todavía no hay notas DGMIT cargadas», «N notas pendientes de carga de ciclos abiertos» (decisión del Ciclo de vida del dato: con 0 pendientes, sin texto;
  en Métricas, el cajón no dice los pendientes y el modal de la redacción dice el vacío entero, también «0 notas pendientes de carga de ciclos abiertos») y «Se empieza a contar cuando se carguen en el Seguimiento.», y la respuesta del área, «Sin datos todavía» y «Se empieza a contar cuando haya notas DGMIT cargadas.» (con punto, a diferencia de Métricas); cualquier otra, «Sin casos en 2026».
  Nada desaparece: un bloque vacío lleva igual sus notas y «Año anterior: …».
  Las notas (`textos.notas`, `[{ tipo, texto }]`, en este orden y solo las que hay;
  el tipo le dice al PDF el color): 'orientativo' («Con tan pocos casos, es orientativo.», con 4 ciclos o menos), 'en_curso' («En curso: 3 sin datos registrados todavía, hace 83 días corridos (53 hábiles, mediana)»: solo en la respuesta y la producción, con las dos unidades y la mediana, de `textoEnCursoDeLosDos`; `etapasDe` mide también los en curso en corridos), 'pendientes' (el texto de Métricas, salvo que ya lo diga el vacío: decisión del Ciclo de vida del dato, el vacío ya dice los pendientes) y 'aclaracion' (la de la etapa, que dice «en esta etapa»:
  los avisados ya vencidos en el aviso de cada gestión, «… no cuentan en esta etapa, y sus etapas siguientes se cuentan desde ese primer aviso.», y los resueltos con una fuente pública en la respuesta).
  La de los datasets que no requieren nota DGMIT va debajo de los bloques de la hoja externa (`aclaracion_de_la_hoja.externa`; la interna, '').
- El año anterior (`conAnterior(etapas, anteriores)`, pura; devuelve una copia y no cambia lo que recibe): suma `textos.anterior` a cada etapa con la mediana en días corridos de la misma etapa y la misma gestión de `anteriores` (otro resultado de `etapasDe`, o null), como lo grande de la etapa:
  «Año anterior: mediana de 45 días corridos» («de 1 día corrido», «Año anterior: mediana en el día») o «Año anterior: no hay» (antes de `PRIMER_ANIO`, sin la etapa o sin ciclos).
  Es un dato: sin flechas ni colores de mejor o peor.
- La foto del 31/12 (`services/metricasFoto.js`):
  `datosDeLaFoto` guarda también `etapas`, el `etapasDe` de los casos del año (entre `areas` y `generada`; se calcula una sola vez, porque ya trae las dos unidades y los dos estadísticos, y sin `conAnterior`).
  `VERSION_DE_LA_FOTO` es 1 y la clave es opcional:
  `PARTES_DE_LA_FOTO` no la exige y `datosLeidos` acepta claves de más.
  Se lee con `etapasDeLaFoto({ anio, datos })` (pura, recibe lo que da `leerFoto`): las guardadas, tal cual (sus `feriados` no se miran); una foto sin `etapas` (sacada con el código anterior) las calcula con sus `casos` al 31/12 (son exactamente las entradas de las cifras: con el mismo código dan lo mismo que la foto nueva) y con el calendario con el que se sacó: el de sus `feriados` (`calendarioDeFechas`) o, sin la clave, el de los 9 fijos (una foto sin esa clave contó con ellos);
  unos `feriados` que no son una lista de fechas tiran «La foto de AAAA no se puede leer».
  Es la única excepción a Ruling 16 y solo cubre una foto sacada con el código anterior (o una en la que calcularlas falló:
  `etapasParaLaFoto` deja la parte vacía y manda el error a `console.error`, así este reporte nunca frena la foto); si lo guardado no son etapas, tira «La foto de AAAA no se puede leer», como una foto rota.
- Los datos (`cicloDeVidaDe(query, { hoy })`, `controllers/metricasController.js`): el año se lee con `opcionesDeMetricas`, como en `metricasDe` (solo cuenta `anio`; un año anterior a 2026 o futuro da null): en vivo, `etapasDe(casosDe(fuentesDe(null), { hoy: al, calendario }), { anio, al, calendario })`; con foto, `etapasDeLaFoto`.
  El año anterior se lee igual, con `opcionesDeMetricas({ anio: anio - 1 })` (de su foto o, cerrado sin foto, en vivo al 31/12; antes de 2026, null).
  `fuentesDe(null)` se pide una sola vez, y ninguna si los dos años salen de su foto; el calendario también (`leerCalendario().then(exigirLaTabla)`, una promesa guardada para los dos años: el 05/01/2027, pidiendo 2027, 2026 todavía no tiene foto y los dos van en vivo con una sola lectura), y un año con foto no lee la tabla.
  Sin la tabla, lo que va en vivo tira y el reporte responde el 500 «Error al generar el Ciclo de vida del dato».
  Devuelve `{ anio, al, en_vivo, aviso_foto, etapas }`, con `conAnterior` aplicado a las etapas y el `aviso_foto` de `opcionesDeMetricas` (para la píldora del sol).
- API (`controllers/reportesController.js`):
  `GET /api/reportes/ciclo-de-vida?anio=` (`reporteCicloDeVida`, `authMiddleware` sin `adminOnly`: lector y colaborador, 200; sin sesión, 401;
  `tests/permisos.test.js`), con el patrón de Datos para completar: un solo `ahoraArgentina()` (el pie y hoy), `nombreCorto` y `disposicionDeAdjunto`.
  Sin `anio`, o con algo que no es un año, el en curso; un año sin métricas, el 404 de Métricas (`SIN_METRICAS`, «No hay métricas de ese año»).
  `pdfDeCicloDeVida(query, generado)` devuelve `{ anio, pdf }` (el año con el que se armó, para el nombre del archivo: nunca el de la consulta) o null.
  Un 500 dice «Error al generar el Ciclo de vida del dato» (`ERROR_AL_GENERAR.ciclo`).
  El archivo, `nombreDelReporte('ciclo', { anio })`:
  `Ciclo-de-vida-del-dato-AAAA.pdf` (`services/reportesNombres.js` y su copia en `reportes.js`).
  La tarjeta pide `/reportes/ciclo-de-vida` con el en curso (no se escribe) o `?anio=AAAA`.
- El PDF (`services/reportesCicloDeVidaPdf.js`, `renderCicloDeVida(datos, { hoy, generado })`, puro, con la base de `reportesPdfBase.js`; diagramación fija, como la hoja del Seguimiento: cada hoja entra en una página y los bloques se reparten todo el alto hasta `LIMITE`).
  Cada hoja, de arriba abajo: el encabezado («Ciclo de vida del dato» y la fecha larga de hoy); el título («Ciclo de vida del dato · 2026, en curso», sin «en curso» en un año cerrado —en curso es lo que dice el servidor, `en_vivo` sin `aviso_foto`, no la fecha: el 31/12 del año en curso sigue en curso—, y «Gestión externa» o «Gestión interna»);
  la píldora azul «Del 01/01/2026 al dd/mm/2026, con todos los ciclos» y, en un año cerrado sin foto, otra en el sol con el `aviso_foto` (Ruling 17), al lado si las dos entran en el ancho útil («La foto de 2026 se saca el 10/01/2027») o debajo (la del reintento, más larga;
  `dibujarPildoras`); el circuito en chico («El circuito · mediana en días corridos»: la sigla de cada nodo con su color —lo de la DGMIT en violeta y el Portal en verde— y, en cada flecha, el número de la etapa y su mediana en días corridos, '83', «En el día» o '—', llena con cifra y punteada en gris sin ella); un bloque por etapa; la aclaración de la hoja (en la externa) y el recuadro gris «Cómo se cuenta».
  El pie:
  «Generado el dd/mm/aaaa a las hh:mm por <nombre corto>» y «Ciclo de vida del dato · 2026 · Hoja k de 2».
  El bloque: a la izquierda (205 pt), el número, el nombre y la insignia, el tramo (los dos nodos y la flecha, con el «desde → hasta» en hasta dos renglones) y la descripción en gris seguida de cómo se mide en negrita; a la derecha, «Estadísticas de la etapa»: el mosaico (la mediana a todo el alto, en el color de la etapa, con «de N ciclos»; el promedio, con el año anterior a la derecha;
  los dos extremos, o «El único caso» a lo ancho) o el vacío, y debajo las notas, de hasta dos renglones cada una y con el color de su tipo.
  El orden de las notas es su prioridad (el orientativo, el en curso, los pendientes y la aclaración).
  Con los textos del servidor, un bloque tiene casi siempre hasta tres renglones de notas (en la respuesta, el orientativo, el en curso y la fuente pública;
  en el aviso, el orientativo y los dos renglones de los ya vencidos), que entran todos, enteros, también en la hoja más apretada (un año cerrado sin foto, con las dos píldoras una debajo de la otra y la aclaración de la hoja): las notas no le quitan al mosaico más que su mínimo (`MOSAICO_MINIMO`: cada extremo conserva su rótulo, su número, sus hábiles y un renglón del dataset) y, si con el aire de siempre no entran enteras, ese bloque usa el aire justo de la columna derecha (`AIRE_JUSTO`:
  5 pt más para las notas; los bloques que entran no cambian).
  El en curso, con las dos unidades, puede ocupar dos renglones («menos de 1 hábil» es lo más largo con números chicos): con el orientativo, entra entero.
  Con más de tres renglones (ese en curso junto al orientativo y la fuente pública, un caso raro), pasan a un renglón, cortadas con «…», y el en curso puede perder «, mediana)»; después, las de más abajo no van.
  Los colores: el orientativo en ámbar (`#7A5200`), el en curso en ámbar y negrita, los pendientes en violeta (`#5B4691`) y negrita, y la aclaración y el año anterior en gris.
  Los textos fijos (qué se hace en cada etapa, cómo se mide y «Cómo se cuenta», con las ventanas de 40 y 60 días de `VENTANA_DE_LA_REGLA`) están en `TEXTOS_DEL_CICLO` (congelada:
  `descripciones` y `seMide`, por gestión y clave, y `comoSeCuenta(anio)`, que empieza con «Días corridos: todos los días del calendario. Junto a ellos, los hábiles: de lunes a viernes, sin feriados ni días no laborables.» y en `PRIMER_ANIO` termina con «La comparación con el año anterior empieza en 2027.»); el resto lo manda el servidor y el PDF no recalcula nada.
  Todo texto que puede no entrar se corta antes de escribirse (`ajustar` del anexo: con el `ellipsis` de PDFKit el test mediría el texto entero), y el nombre de un extremo conserva « y N más» entero (`ajusteDelNombre`).
  Ningún texto baja de 6,2 pt; la descripción baja de 7,2 a 6,4 y, si ni así entra, se corta.
  Las formas que van adentro de otra (los nodos, las insignias y el mosaico) se dibujan con `contorno`, y los nodos con `NODOS`, los dos exportados de `reportesMetricasPdf.js`: solo el índice, cada bloque y «Cómo se cuenta» son `roundedRect` (los bloques de `pdf-diagramacion.js`).
  Conserva su dibujo y el Área en el acento (decisión del usuario del 05/11/2026): la banda de flechas y el verde azulado son solo del circuito de Métricas y del Informe anual.
  Pone primero los días corridos sin cambiar su dibujo, y no lleva el cajón «Aviso anticipado» de Métricas (decisiones del usuario del 06/11/2026; ver `docs/temas/metricas-y-reportes.md`).
  El Ciclo de vida reusa piezas de `reportesMetricasPdf.js`, y el PDF de Métricas y el Informe anual no cambian por eso: el test «el PDF de Métricas y el Informe anual no cambian» (`tests/reportes-pdf.test.js`) compara el sha256 del contenido de cada hoja (`contenidoPorHoja`, que no mira la fecha de creación) de cinco de esos PDF contra la referencia (`REFERENCIA_DE_LOS_PDF`);
  un cambio a propósito en esos PDF (por ejemplo, un texto del Informe anual) tiene que volver a tomar la referencia, comprobando con el diff de texto hoja por hoja que cambió solo eso.
- Para los tests:
  Los números de la base real no van en los tests versionados (Ruling 3).

## Archivos de tests

`permisos.test.js`, `reportes-pdf.test.js`, `metricas-reglas.test.js`, `metricas-huellas.test.js`, `metricas-foto.test.js`, `metricas-api.test.js`, `reportes.test.js`, `reportes-frontend.test.js`, `paginas.test.js`
