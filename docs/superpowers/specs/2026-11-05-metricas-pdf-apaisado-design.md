# El PDF de Métricas y el Informe anual, apaisados

Fecha: 05/11/2026. Decisiones del usuario del 05/11/2026; el usuario aprobó este diseño el 05/11/2026.
Las maquetas se vieron como PDF reales, con los datos del dump del 05/11/2026, fuera del repo; los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá.

## 1. Por qué

El usuario miró el PDF «Métricas del año» y lo dijo con sus palabras: «la pagina 1, 2 y 3 se verian mejor en formato apaisado. Podriamos rearmarlos y distribuir mejor todo y aprovechar mejor».
También: «me gustaria diferenciar mas lo interno de lo externo».

Medido con el dump, en A4 vertical:
- La hoja 1 deja libre un tercio, la hoja 2 más de la mitad y la hoja 3 más de la mitad.
- Las dos gestiones son dos recuadros iguales, y lo único que las distingue es un rótulo chico.
- En el Informe anual pasa lo mismo, porque dibuja con las mismas piezas.

## 2. Decisiones del usuario

1. **Solo el PDF.** Con sus palabras: «siempre te estoy hablando del PDF eh, al portal HTML no tenemos que cambiar nada».
2. **Todo apaisado:** las cinco partes de Métricas, también el contexto, el trabajo y las áreas.
   Se descartó la mezcla, con las hojas 4 a 6 verticales: al imprimir a doble faz, una apaisada queda con una vertical al dorso.
3. **Sin las cintas del recorrido típico en los PDF:** «la hoja 2 de las dos cintas la borraria porque es mostrar lo de la hoja 1 pero de otra forma».
   Todas sus cifras ya están en el circuito.
   Lo único que se pierde es ver de un vistazo dónde cae el recorrido respecto del vencimiento, y eso sigue en la página de Métricas.
4. **Las dos gestiones juntas en la hoja 1.** Se descartó una hoja por gestión: el usuario quiere verlas juntas y no quiere cambiar los títulos.
5. **La solapa con su frase:** la externa llena y la interna hueca, para que se distingan también en blanco y negro.
   Se descartaron la banda de título (más pesada) y el lomo a la izquierda (angosta las tarjetas y compite con la banda de flechas).
6. **El Portal reducido a lo justo y la letra más grande en la hoja 1:** «el texto en la pagina 1 sigue siendo muy chico. Capaz podemos ampliar un poco el texto y para que entre todo bien reducir al minimo el cuadrado de PORTAL».
7. **Los cuadrados iguales dentro de cada gestión:** cuatro en la externa y tres, más anchos, en la interna.
   Se descartaron alinear DDPC entre las dos gestiones (un cuadrado doble en la interna) e iguales en toda la hoja (solo entra con menos letra).
8. **Los comentarios sobre los ciclos pasan a «Cómo se cuenta», en la hoja 2.**
   El usuario propuso borrarlos o achicarlos.
   No se borran porque son lo único del PDF que avisa que hay ciclos que no cuentan en una cifra, y sin eso un número se puede tomar por el total: es un antiobjetivo de Métricas.
9. **El Informe anual, con el mismo diseño:** todo apaisado, con las mismas piezas, y suma Áreas y temas.
   Se simuló con el dump antes de decidir.
10. **Dos ajustes de texto del Informe:** la última hoja del primer año se llama «Logros del año», porque no hay nada con qué comparar, y el pie del índice dice «… y el último, el 31/12».
11. **Los días corridos entre paréntesis, en la hoja 1:** «debajo de cada dia habil podemos poner entre parentesis los dias corridos».
    Solo en la cifra de cada tarjeta y solo en la hoja 1.
12. **Más aire entre las dos gestiones:** de 10 a 18 puntos.

## 3. Lo que no cambia

- **La página de Métricas y Reportes:** `public/reportes.html` y `public/js/reportes.js`, con sus `?v=`, `VERSION_REPORTES` y `VERSION_FERIADOS`.
  La página sigue dibujando las cintas.
- **La tarjeta de Reportes:** dice «Unas 5 hojas», y con esto vuelve a ser cierto: con los datos del dump, el PDF pasa de 6 hojas a 5.
- **Ninguna cifra ni ningún texto armado por el servidor.** `metricasReglas.js`, `metricasCinta.js` y `metricasFoto.js` no se tocan.
- **`GET /api/metricas` y lo que manda:** los controladores solo suman, para los dos PDF, el circuito en días corridos (sección 5).
- **La foto del 31/12:** guarda números y textos armados, no el dibujo, y su forma no cambia.
  `VERSION_DE_LA_FOTO` sigue en 1.
  Un Informe anual sale con el dibujo vigente, también el de una foto sacada antes: se dibuja en cada pedido.
- **Los otros PDF, ni un byte salvo la fecha:** Ciclo de vida del dato, Estado general, Por área, Avisos, Agenda, Datos para completar, la hoja del Seguimiento y los anexos de las Notas Digitales.
  Comparten `reportesPdfBase.js` y `seguimientoPdf.js`, así que lo nuevo entra por parámetros con la hoja vertical de entrada.
- **`NODOS` y `contorno`:** los usa el Ciclo de vida.
- **El color por actor**, aprobado en la spec 2026-11-05-circuito-diseno: RPAD y DDPC en el acento, DGMIT en violeta, Área en `COLOR_DEL_AREA`, Portal en verde.
- **El nombre de los archivos**, la API y los permisos.

## 4. La hoja

A4 apaisado: 841,89 × 595,28 puntos, con los márgenes de 15 mm.
Quedan 756,85 de ancho útil y, con el encabezado y el pie de siempre, unos 449 de alto.

`services/notasDigitalesAnexo.js` suma `HOJA_VERTICAL` y `HOJA_APAISADA`: `{ ancho, alto, izquierda, derecha, abajo, contenido }`, armadas con las medidas de 210 × 297 mm de sus constantes.
No salen de `doc.page`, que redondea a 595,28: con eso cambiaban 591 de 650 PDF de prueba.

Un documento tiene una sola hoja, y se elige al crearlo: `nuevoReporte({ titulo, hoja })`, con `HOJA_VERTICAL` de entrada.
Se descartó la hoja por página (`usarHoja`): ningún PDF mezcla orientaciones, y una pieza preparada para una hoja y dibujada en otra no se detecta.

## 5. Métricas del año, hoja por hoja

Con los datos del dump son 5 hojas, en las cuatro combinaciones.

### Hoja 1: el circuito

Título de hoy: «El circuito, del aviso del RPAD a la carga en el portal».

- **La píldora** va arriba a la derecha, en la línea del rótulo: `dibujar(y - 6, x)`, con su borde derecho en el margen.
  `prepararPildora` suma `anchoMaximo`, para que nunca toque el rótulo.
  Con muchos destildados se corta con «…», como hoy; con `anchoMaximo` se corta con `ajustar` antes de escribir, porque `tests/pdf-diagramacion.js` mediría entero un texto cortado por `renglon`.
- **De dónde sale** (`textoDeDondeSale`: «Sale de la foto del 31/12/2026, …» o el aviso de la foto) va a la derecha del título, debajo de la píldora, en hasta dos renglones de 7,2 puntos en color tinta.
  No suma alto: hoy suma un renglón aparte.
- **Cada gestión**, `prepararGestion`, en este orden:
  - La solapa, de 17 de alto: `GESTIÓN EXTERNA` o `GESTIÓN INTERNA`, en 8,6 puntos, negrita, con 0,8 de espaciado.
  - A su derecha, la frase de la gestión en 7,6 puntos, en gris; y sobre el margen derecho, la combinación con mayúscula («Mediana en días hábiles»), también en gris.
  - El panel, con el circuito adentro: 6 de aire arriba, 7 abajo y 13 a cada lado.
- **Sin aclaraciones debajo del circuito:** pasan a la hoja 2.
- **Entre las dos gestiones**, 18 puntos.

| | Solapa | Panel |
|---|---|---|
| Externa | llena: `COLOR.tinta`, letra blanca (14,76:1) | `COLOR.acentoSuave`, sin borde |
| Interna | hueca: blanca, borde `COLOR.tinta` de 1,2, letra `COLOR.tinta` | blanco, borde `COLOR.tinta` de 1,2 |

La solapa hueca se une al panel: su borde de abajo no se ve.
Se dibuja con `contorno` y líneas, nunca con `rect` de 1 punto o menos de alto, porque `tests/pdf-diagramacion.js` lo tomaría por una línea fina que cruza un texto.

Ni el panel ni la solapa usan un color de actor: `COLOR.tinta` es neutro.
El filete azul de hoy se saca, porque el azul es del RPAD.

Las frases son texto fijo del dibujo, fuera de `TEXTOS_DE_LA_PESTANA`, porque la página no las tiene (`FRASES_DE_LA_GESTION`):
- Externa: «La DGMIT y la DA mandan la nota formal; el área prepara los datos.»
- Interna: «La DGMIT y la DIT hacen el relevamiento.»

Salen de `T.roles` y del documento del tema.
No dicen «siempre»: hay externos sin nota requerida y resueltos con una fuente pública, y lo aclara la hoja 2.

**Las columnas:** el Portal mide lo justo para su texto, `max(ancho del nombre, ancho del rol) + punta + 2 × relleno + 1,5`.
Lo demás se reparte en partes iguales dentro de cada gestión: 4 en la externa y 3 en la interna.

**La letra de la hoja 1** tiene tres escalones, en puntos, y va el más grande con el que las dos gestiones entran en la hoja (`LETRAS_DEL_CIRCUITO`).
El mismo escalón en las dos gestiones.

| Qué | Hoy | Grande | Media | Chica |
|---|---|---|---|---|
| Nombre del nodo (`nodo`) | 8 | 11 | 10,4 | 9,8 |
| Rol del nodo (`nodoRol`) | 6,2 | 8,4 | 8 | 7,5 |
| Nombre de la etapa (`nombre`) | 7,8 | 11 | 10,2 | 9,4 |
| Cifra (`cifra`, mínimo `cifraMin`) | 13, 9 | 21, 11 | 19, 10 | 17, 10 |
| Unidad (`unidad`) | 6,6 | 9,2 | 8,6 | 8 |
| Sin cifra (`vacio`, mínimo `vacioMin`) | 8, 6,6 | 12, 8,6 | 10,8, 8 | 10, 7,6 |
| Debajo de la cifra (`debajo`) | 6,4 | 8,6 | 8,3 | 7,7 |
| «con tan pocos casos» (`orientativo`) | 6,2 | 8,4 | 8 | 7,5 |
| El resto de la tarjeta (`chico`) | 6,4 | 8,6 | 8,3 | 7,7 |
| Insignia (`insignia`) | 6,2 | 8 | 7,6 | 7 |

`BANDA.alto` pasa de 24 a 28.
La insignia sigue siendo más chica que la banda: un test lo mira.

Por qué hay escalones: con los datos del dump entra la grande, con unos 15 puntos libres.
Pero cuando se carguen las notas DGMIT pendientes, «Respuesta del área» pasa a tener cifra y sigue con sus en curso, y la tarjeta crece tres renglones.
Con la grande y la media, la interna pasaría a otra hoja, contra la decisión 4; con la chica, entran.
Se mide antes de dibujar, con el tope de la hoja ya conocido.

**Los días corridos.** Con «Días hábiles», debajo de la cifra de cada tarjeta va la misma cifra en días corridos, entre paréntesis: `(83 días corridos)`.
Va en la letra `debajo`, en negrita y en el color de la tarjeta.
Es el mismo estadístico que se pidió: con «Promedio», el promedio.

| La tarjeta | Lo que dice |
|---|---|
| `53 días hábiles`, y en corridos 83 | `(83 días corridos)` |
| `1 día hábil`, y en corridos 1 | `(1 día corrido)` |
| `En el día`, y en corridos también | nada |
| `En el día`, y en corridos 3 | `(3 días corridos)` |
| Sin cifra | nada |
| Con «Días corridos» elegido | nada: la cifra ya los dice |

El texto y la unidad son los del servidor (`cifra.texto` y `cifra.unidad`), y el dibujante solo les pone los paréntesis.
No se calcula nada nuevo: es la vista de la misma combinación con `dias: 'corridos'`, de la misma regla (`vistaDe`).
Los en curso («hace 53 días hábiles (mediana)») no llevan paréntesis: son una frase armada, y el pedido era debajo de la cifra.

Cómo llega al dibujante: `datos.circuito_en_corridos`, con la misma forma que `vista.circuito`.
- **Métricas en vivo:** `enVivo` calcula una segunda vista con los mismos casos, sin volver a leer la base, solo para el PDF y solo con «Días hábiles».
- **Métricas de un año con foto y el Informe anual:** salen de la foto, que ya guarda las cuatro combinaciones (`circuitoEnCorridosDeLaFoto`); una foto sin esa combinación no tira, y el PDF sale sin los paréntesis.
- `GET /api/metricas` no la manda: la página no la usa.
- Sin ese campo, el dibujante no escribe el paréntesis.

### Hoja 2: los resultados

Título: «Resultados del año», con la bajada de hoy a la derecha, en 8,4 puntos en gris.

- Las tres columnas de hoy, de 243 de ancho, con la letra más grande: título 10, número 26 (mínimo 14), su texto 9, cuerpo 8,4, barras 8,4 y notas de la columna 7,6.
- Cada ítem de «El que falta» va en hasta 3 renglones (hoy, 2), para que no se corte el motivo, que va al final.
  `ALTO_MAXIMO_DE_LA_LISTA` sigue en 260 y después dice «y N más.».
- **«Cómo se cuenta»**, en el recuadro gris, con la letra 8,4: el texto de hoy y, debajo, los comentarios de cada gestión, con el nombre en mayúsculas en color tinta (`GESTIÓN EXTERNA`, `GESTIÓN INTERNA`).
  Las palabras de los comentarios son las del servidor.
  Una gestión sin comentarios no lleva su nombre.
- **Si «Cómo se cuenta» no entra debajo de los resultados**, pasa a la hoja siguiente con el título de la hoja repetido, y no con el encabezado solo.
  Pasa desde unos 8 que faltan en la cobertura, con títulos de largo común.
- **Los casos destildados**, solo en Métricas y si los hay, van debajo, como hoy: tabla de 756,85.

### Hoja 3: el contexto y el trabajo

Título de hoy: «El contexto y el trabajo del RPAD».

- Arriba, dos columnas: a la izquierda, de 470, el índice mes a mes con su pie; a la derecha, de 270,85, la antigüedad de los vencidos y debajo la doble verificación.
  `prepararSeccion` suma `ancho`, y su `dibujar` recibe la `x`.
- Debajo, de todo el ancho: el trabajo (las cinco tarjetas), «Por mes» y las métricas manuales.
- Sin índice, el texto de hoy en su columna.

### Hojas 4 y 5: áreas y temas

Título de hoy: «Áreas y temas».

- **El ranking en dos columnas de 368,4:** llena la izquierda, sigue a la derecha y después en otra hoja, con su encabezado arriba de cada columna.
  Letra 7,6, aire 3,5 arriba y abajo, y el nombre del área en hasta 4 renglones, como las celdas de las tablas.
  La cabeza de la sección va de todo el ancho, solo en la primera hoja.
- **Temas y frecuencias** van en la columna libre de la última hoja del ranking.
  Si el ranking terminó en la columna derecha, van en una hoja nueva.
- Sin áreas, o sin temas o frecuencias, los textos de hoy.

## 6. El Informe anual

Sale de la foto, con la mediana en días hábiles y todos los datasets, como hoy.
Dibuja las mismas hojas con las mismas piezas: el circuito, los resultados, el contexto y el trabajo, y las áreas y los temas.
Con los datos del dump son 6 hojas; desde el Informe de 2027, 7.

Lo que tiene de distinto:
- Sin las métricas manuales: no están en la foto.
- Sin los destildados: una foto no se destilda.
- **Áreas y temas es nuevo.** Salen de `areas`, que la foto ya guarda y `deLaFoto` ya devuelve.
- **El pie del índice:** «Es el índice de la portada: al día (actualizados y próximos a vencer) sobre los que tienen vencimiento. Un punto por el primer día de cada mes, y el último, el 31/12.».
  El PDF de Métricas sigue con el de la página, porque en un año en curso el último punto es hoy.

**La última parte, con foto del año anterior:** título de hoy, «Comparación con 2025 y logros del año», las tres tablas de todo el ancho, «Diferencia: …» y, debajo o en la hoja que sigue, los logros.

**La última parte, el primer año:** título «Logros del año».
Arriba a la derecha, la píldora «Primer año con foto» y debajo, en gris, «Los hitos de 2026 cargados en Proyectos».
No lleva la cabeza de la sección: repetiría el título.

**Los logros van en dos columnas de 368,4:** el nombre del proyecto, y sus hitos con la fecha a la izquierda.
Cada hito sigue yendo entero.
Si los hitos de un proyecto siguen en otra columna o en otra hoja, el nombre se repite arriba.
Un nombre nunca queda solo al pie de una columna, ni un título o una cabeza de sección solos en una hoja: la cabeza de los logros viaja con el primer hito.
Un hito lleva hasta 3 renglones de título y 35 de descripción (hoy, 40), para que el nombre y el hito más alto entren debajo del título de la hoja.
Con esta columna, 35 renglones son unas 2500 letras (hoy, unas 4000): una descripción más larga se corta con «…», como hoy.

## 7. La base

`services/reportesPdfBase.js`, con la hoja vertical de entrada, sin cambiar las firmas de hoy:
- `nuevoReporte({ titulo, hoja })`, y lo recuerda con el documento.
- `hojaDe(doc)`, `limiteDe(doc)` y `anchoDelRecuadro(doc)`.
- `LIMITE` y `ANCHO_DEL_RECUADRO` siguen exportados con el valor vertical: los usan el Ciclo de vida y el Por área.
- `prepararTitulo`, `prepararPildora`, `prepararTarjetas`, `prepararSeccion`, `prepararParrafo`, `prepararRecuadro`, `prepararTabla`, `lugarPara` y `agregarHoja` leen la hoja del documento.
- **`nuevoFlujo(doc, y)`, el flujo en dos columnas:** cada pieza va debajo de la anterior.
  Si no entra, sigue en la otra columna y después en una hoja nueva.
  `cabeza(pieza)` dice lo que va arriba de cada columna nueva: el encabezado de la tabla o el nombre del proyecto.
  Primero elige el lugar, midiendo la cabeza y la pieza juntas, y recién ahí dibuja: una cabeza nunca queda sola.
  Una pieza que no entra en una columna vacía pasa a una hoja nueva si ahí tiene más lugar.
  Una pieza más alta que una hoja entera se saldría; no hay ninguna, porque el hito tiene su tope, una fila de la tabla tiene el suyo, y los temas y las frecuencias son catálogos cortos.

`services/seguimientoPdf.js`: `dibujarEncabezado`, `dibujarPie` y `dibujarCabezaDeSeccion` suman un parámetro final, con lo vertical de entrada, y `LINEA_DEL_PIE` sigue exportada.

`services/reportesMetricasPdf.js` deja de usar el `CONTENIDO`, `ANCHO_DEL_RECUADRO` y `LIMITE` verticales.
Se borra lo que dibujaba la cinta (`dibujarLaCinta`, `elementoDeLaCinta`, `piezaDeLeyenda`, `dibujarMarca`, `textoDeLaCinta`, `OPCIONES_CINTA_PDF`, `U` y `T.leyenda`).
`metricasCinta.js` no cambia de comportamiento: su opción `letra` queda sin uso en producción, con sus tests.
Solo se corrige su comentario de las líneas 180-181, que cita `OPCIONES_CINTA_PDF`, y va en el kit, para que producción quede igual a `main` byte por byte.

## 8. Textos

| | Texto | Dónde |
|---|---|---|
| Nuevo | Las dos frases | Solapa de la hoja 1 |
| Nuevo | `GESTIÓN EXTERNA` y `GESTIÓN INTERNA`, también en «Cómo se cuenta» | Hojas 1 y 2 |
| Nuevo | `(83 días corridos)`, con el texto y la unidad del servidor | Tarjetas de la hoja 1 |
| Cambia | «Comparación con 2025 y logros del año» → «Logros del año», el primer año | Informe |
| Cambia | El pie del índice | Informe |
| Se mueve | La bajada de los resultados: de la cabeza de la sección, al título | Hoja 2 |
| Se mueve | Los comentarios de los ciclos | De la hoja 1 a «Cómo se cuenta» |
| Se va | «GESTIÓN EXTERNA · MEDIANA EN DÍAS HÁBILES» y el de la interna: se reparte entre la solapa y la derecha | Hoja 1 |
| Se va | «RESULTADOS DEL AÑO» como cabeza: pasa a ser el título | Hoja 2 |
| Se va | Todo lo de las cintas y «El recorrido típico de un pedido» | Métricas |
| Se va | La cabeza «COMPARACIÓN CON 2025» y «Primer año con foto» como bloque, el primer año | Informe |

Lenguaje neutro: las frases no dicen «tardanza», «demora» ni «atraso».

## 9. Si crece

Se midió con lo más largo que permiten las reglas:
- **Hoja 1:** cada tarjeta puede sumar renglones.
  Con el dump entra la letra grande, con unos 15 puntos libres en días hábiles y unos 37 en corridos, que no llevan el paréntesis.
  Si no entra, baja un escalón; si con la chica tampoco entra, la interna pasa entera a la hoja siguiente: el PDF tiene una hoja más y nada se pisa (`lugarPara`).
- **Hoja 2:** con la lista de cobertura en su tope, los resultados entran en su hoja, y «Cómo se cuenta» pasa a la siguiente, con el título repetido y junto con los destildados si los hay.
  Se saca la regla de que viaja con los resultados: juntos ya no entran en una hoja, y un grupo más alto que la hoja se sale.
- **Los destildados** cortan de hoja como hoy, y cada una repite su encabezado.
- **Las métricas manuales:** hasta 36 filas, que cortan de hoja como hoy.
- **El ranking:** corta por fila.

## 10. Despliegue

Sin SQL, sin Tarea Cron y sin variables nuevas, con Restart.
Ocho archivos de producción: `services/notasDigitalesAnexo.js`, `services/seguimientoPdf.js`, `services/reportesPdfBase.js`, `services/reportesMetricasPdf.js`, `services/reportesInformeAnualPdf.js`, `services/metricasCinta.js` (solo su comentario), `controllers/metricasController.js` y `controllers/reportesController.js`.
Ningún archivo de `public/`.

El kit va contra `a269509`, y su comprobación previa mira `correos.js?v=20261226`, `usuarios.js?v=20261224`, `mi-espacio.js?v=20261226`, `reportes.js?v=20261209` y `seguimiento.js?v=20261130`.

No hay fecha límite por la foto, porque el dibujo no queda en ella.
Conviene que esté antes del 10/01/2027, para que el primer Informe anual salga con este diseño.

## 11. Pruebas

- **`tests/pdf-diagramacion.js`:** devuelve el tamaño de cada hoja y controla los márgenes de cada una; sin aflojar lo vertical.
- **`tests/pdf-lector.js`:** suma `HOJA_A4_APAISADA`.
- **Métricas e Informe:** todas las hojas apaisadas; lo que va en cada hoja, por su contenido.
- **Hoja 1:** la solapa y la frase de cada gestión; los comentarios no están; la píldora arriba a la derecha sin tocar el rótulo, también cortada; de dónde sale sin sumar alto; las columnas iguales dentro de cada gestión; el Portal sin que se corte su texto.
- **Los escalones de la letra:** con poco texto, la grande; con la respuesta del área con cifra y en curso, las dos gestiones siguen en la hoja 1 con una más chica; con lo más largo de cada campo en días hábiles, con el paréntesis, nada se sale.
- **Los días corridos:** cada fila de la tabla de la sección 5; con «Promedio», el promedio; lo manda el PDF en vivo sin volver a leer la base; un año con foto y el Informe, de la foto; `GET /api/metricas` no trae `circuito_en_corridos`.
- **Hoja 2:** los comentarios en «Cómo se cuenta», con las palabras del servidor; una gestión sin comentarios no lleva su nombre; con la lista en su tope, nada se sale; cuando «Cómo se cuenta» salta, repite el título.
- **Hoja 3:** el índice y la antigüedad en sus columnas; sin índice, su texto.
- **Hojas 4 y 5:** el orden del ranking se conserva entre columnas y hojas, con su encabezado en cada una; con 3, 50 y 120 áreas.
- **Informe:** el título y la píldora del primer año, sin la cabeza repetida; con la comparación, el título de hoy; el pie del índice; Áreas y temas; un proyecto cuyos hitos cortan de columna repite su nombre; un hito de 35 renglones, justo debajo del título o debajo de la comparación, no se sale ni deja un título o un nombre solos.
- **`nuevoFlujo`:** columna, otra columna, hoja nueva, la cabeza en cada columna, medir antes de dibujar, y la pieza más alta que lo que queda en una columna.
- **Sin cintas:** ninguna palabra de la cinta, y lo que manda la API sigue trayendo `cinta`; la página la sigue dibujando.
- **La referencia:** `REFERENCIA_DE_LOS_PDF` se vuelve a tomar en las cinco entradas.
- **Nada se pisa ni se sale** (`verificarDiagramacion`) en todas las variantes de hoy, en las cuatro combinaciones y con lo más largo de cada campo.
- **La comparación con el código de antes, sobre el dump, fuera del repo:**
  - Lo que manda `metricasDe` y la foto simulada, idénticos.
  - Los otros PDF, idénticos por hoja: Ciclo de vida, Estado general, Por área, Avisos, Agenda, Datos para completar, Seguimiento y anexo de la reiteración.
  - Métricas y el Informe, las mismas palabras, sin encabezado ni pie, salvo las de la sección 8 y lo que suman los encabezados de tabla repetidos, cada diferencia explicada.
- **La vista:** los PDF con el dump, en las cuatro combinaciones, un año cerrado sin foto y una foto simulada, mirados como imágenes.
