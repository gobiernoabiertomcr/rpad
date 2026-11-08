# Métricas: los cajones con una frase, los ciclos de cada tramo y las dos unidades juntas

Fecha: 07/11/2026. Decisiones del usuario del 07/11/2026, mirando maquetas con la carcasa real y los datos del dump de ese día, fuera del repo.
Los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá; el cómo, en el plan.

## 1. Por qué

El usuario pidió simplificar los textos de los cajones de «El circuito», en la pestaña Métricas y en el PDF «Métricas del año», en las dos gestiones: «incluye mucho texto, a veces repetitivo».
Cada cajón lleva hoy, además de la cifra, «desde → hasta», las notas DGMIT pendientes de carga o los ciclos abiertos sin datos, y «Se cuenta hasta que se registra la actualización.».
También pidió la letra del PDF un poco más grande.

Mirando las maquetas, sumó dos cambios:
- en la página, las flechas de la banda de arriba abren un modal con los ciclos de su tramo, el tiempo de cada uno y la explicación;
- las dos unidades juntas en toda la pestaña, como ya está la hoja 1 del PDF, y sin el selector de días.

La foto del 10/01/2027 guarda los textos armados y no se modifica: todo lo que arma el servidor de esta spec tiene que estar en producción antes.
Si no, la foto de 2026 queda con los textos de hoy para siempre.

## 2. Decisiones del usuario

1. **Una sola frase por cajón**, «Se cuenta desde … hasta …» (sección 3), con dos lapsus del pedido corregidos: «hasta que la DDPC recibe» y el «por» repetido de la interna.
2. **Las siglas con artículo:** «la DGMIT y la DA», «la DGMIT y la DIT», «la DDPC», como las frases de la solapa del PDF («La DGMIT y la DA mandan la nota formal»).
   Descartados los nombres completos: alargan la frase en las tarjetas angostas.
3. **El cajón «Aviso anticipado» no cambia:** «Está perfecto. No tocar».
   Solo suma los hábiles entre paréntesis, que ya lleva en el PDF (decisión 6).
4. **Lo que sale del cajón no desaparece:**
   - en la página, va al modal de su tramo (sección 5);
   - en el PDF de Métricas y en el Informe anual, va a «Cómo se cuenta», en la hoja 2 (sección 6), como los comentarios que el usuario mandó ahí el 05/11.
5. **En la página, la banda abre un modal por tramo** (sección 5), con un ícono y «Ver los ciclos».
   El modal muestra, por cada ciclo, la fecha en que empezó la etapa, la fecha en que terminó y los días.
6. **Las dos unidades juntas en toda la pestaña y en todo el PDF**, como ya está la hoja 1 del PDF: primero los días corridos y entre paréntesis los hábiles (sección 4).
   El selector «Días hábiles | Días corridos» desaparece; se queda «Mediana | Promedio».
7. **El gráfico del modal va en días corridos** y no se dibuja en el teléfono.
8. **La letra de las tarjetas del PDF: 8,6 pt**, el escalón más grande de hoy, sin tocar el aire entre las dos gestiones.
   Con los datos del 07/11 hoy sale en 7,7 pt, el más chico, porque las líneas que se van alargan las tarjetas.
   Descartados 9,6 pt con menos aire y 9,6 pt con la interna en la hoja 2.
9. **El Informe anual cambia igual** que «Métricas del año»: comparten el dibujo.

Descartados también:
- los pendientes y los en curso al pie del circuito, en el recuadro «i» de la página (opción A);
- una línea corta en el cajón, sin los días (B): en el PDF no dejaba pasar de 8,3 pt;
- solo la frase, sin modal (C): en el PDF de Métricas y en el Informe, esos datos desaparecían.

## 3. Los cajones

### La frase

Cada tramo tiene su frase en una constante nueva de `services/metricasReglas.js`, `COMO_SE_CUENTA`, que la vista pone en la clave `como_se_cuenta` del tramo (no va en `TRAMOS`: `tramoDelCircuito` copia `TRAMOS` entero y la lee el Ciclo de vida):

| Tramo | `como_se_cuenta` |
|---|---|
| Aviso anticipado | Se cuenta desde que el RPAD avisa hasta el vencimiento. |
| Redacción y entrega de nota | Se cuenta desde que la DGMIT y la DA reciben el aviso hasta que entregan la nota. |
| Respuesta del área | Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización. |
| Producción del relevamiento | Se cuenta desde que la DGMIT y la DIT reciben el aviso hasta que entregan el relevamiento a la DDPC. |
| Preparación y carga | Se cuenta desde que la DDPC recibe la actualización hasta la carga en el portal. |

`desde_hasta` sigue igual en `TRAMOS` y en el tramo: el Ciclo de vida del dato la dibuja en sus flechas, y una foto sin `como_se_cuenta` la sigue mostrando en el cajón.
El circuito de Métricas deja de dibujarla.

### Lo que lleva un cajón

De arriba abajo, en la página y en el PDF:

```
Respuesta del área
64 días corridos
(45 días hábiles)
mediana de 12 ciclos
con tan pocos casos, es orientativo     ← con 4 casos o menos, como hoy
Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización.
12 ciclos                                ← solo con «En el día», como hoy
Área
```

- Ya no se dibujan `pendientes_texto`, los en curso, «Se cuenta hasta que se registra la actualización.» ni `desde_hasta`.
- Los hábiles, con `textoDeHabiles`, como hoy en el PDF: «(45 días hábiles)», «(1 día hábil)»; con corridos y 0 hábiles, «(En el día, en días hábiles)»; nada si las dos son «En el día».
- **Sin cifra** (`vacio`), el título del vacío y la frase.
  - El de la redacción, «Todavía no hay notas DGMIT cargadas», deja de dibujar debajo su `vacio.texto` (la cantidad de pendientes): va en el modal y en «Cómo se cuenta». El servidor no cambia `vacio`: lo lee el Ciclo de vida. La página y el PDF ya distinguen ese cajón por su `clave`.
  - El de la respuesta del área sigue con su `vacio.texto`, «Se empieza a contar cuando haya notas DGMIT cargadas»: dice por qué está vacío.
- **El cajón «Aviso anticipado»** queda como está, con los hábiles entre paréntesis debajo de «días corridos de anticipación», como en el PDF.
  Sin cifra o con «En el día» no tiene la línea, y entonces lleva la frase, como hoy lleva «desde → hasta».
- En el PDF, la frase puede tener hasta 4 renglones y nunca se corta con «…», en ninguno de los tres escalones y en la columna más angosta.

## 4. Las dos unidades

### Dónde

Todo lo que cuenta días en la pestaña Métricas, en el PDF «Métricas del año» (todas sus hojas) y en el Informe anual (todas sus hojas).

No cambian, porque no siguen al selector:
- la antigüedad de los vencidos (en días corridos, por tramos fijos) y la doble verificación (en minutos u horas);
- la cobertura del aviso y las reiteraciones (son cantidades);
- el PDF «Ciclo de vida del dato», que ya pone primero los corridos.

### Cómo se dice

Las decisiones de «En el día» y de «el mismo día» se toman con los días corridos: los hábiles nunca son más que los corridos, por ciclo ni en la mediana o el promedio redondeados.

| Dónde | Corridos y hábiles | Con 0 hábiles | Con los dos en 0 |
|---|---|---|---|
| La cifra (cajón y modal) | «64 días corridos» y debajo «(45 días hábiles)» | «(En el día, en días hábiles)» | «En el día», sin paréntesis |
| «Los casos» | «64 días corridos (45 hábiles) desde la nota» | «3 días corridos (en el día, en días hábiles) desde la nota» | «en el día»; el aviso, «el día del vencimiento» (como hoy) |
| «Los casos», en curso | «en curso, 150 días corridos (102 hábiles) desde el aviso» | «en curso, 3 días corridos (menos de 1 hábil) desde el aviso» | «en curso» (como hoy) |
| Actualizados a tiempo | «Los otros 9 se cargaron una mediana de 64 días corridos (45 hábiles) después.» | «… de 3 días corridos (menos de 1 hábil) después.» | «… de menos de 1 día corrido después.» |
| Los en curso | `textoEnCursoDeLosDos`, como hoy en los PDF: «hace 150 días corridos (102 hábiles, mediana)» | «hace 3 días corridos (menos de 1 hábil, mediana)» | «hace menos de 1 día corrido (mediana)» |
| La cinta (si el rótulo del aviso con los hábiles no entra en ningún lado, va el de hoy, sin el paréntesis) | «Aviso · 51 días corridos (35 hábiles) antes», «Respuesta del área · 64 días corridos (45 hábiles)», «Entrega y carga, 3 días corridos (1 hábil) después» | «(en el día, en días hábiles)» | «Aviso · el mismo día del vencimiento», «Entrega y carga, el mismo día» (como hoy) |
| El modal, cada ciclo | «64 días corridos (45 hábiles)» | «3 días corridos (en el día, en días hábiles)» | «En el día» |
| El modal, en curso | «hace 150 días corridos (102 hábiles)» | «hace 3 días corridos (menos de 1 hábil)» | «hace menos de 1 día corrido» |
| La tabla de los destildados del PDF | como «Los casos» | | |

Con un solo día, en singular: «1 día corrido (1 hábil)».

### Sin selector

- La barra de la pestaña pierde «Días hábiles | Días corridos».
- `opcionesDeMetricas` da siempre `dias: 'corridos'` y no lee `dias` de la consulta: un link viejo con `?dias=` se abre igual, en las dos unidades.
  `GET /api/metricas` y `GET /api/metricas/pdf` ignoran `dias`, y el Informe anual lee la foto en días corridos (`COMBINACION_DEL_INFORME`).
  `DIAS` y `vistaDe` siguen aceptando las dos unidades: la foto guarda las cuatro combinaciones y el Ciclo de vida usa la de hábiles.
- La página deja de tener `dias` en su estado, en su URL y en lo que le pide a la API y al PDF.
- La bajada de la pestaña: «Cuánto tarda cada paso del circuito, desde el aviso del RPAD hasta la carga en el portal, y los reportes en PDF. Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.»
- El pie del circuito: «Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio», cada cifra lo dice debajo.»
- «Cómo se cuenta» del PDF empieza con la oración de los días, como hoy: «Los días van corridos y, entre paréntesis, hábiles: de lunes a viernes, sin feriados ni días no laborables.»
  `TEXTOS_DE_LA_PESTANA.bajada` pasa a ser ese único texto, atado a la página por el test de paridad.
- La solapa de cada gestión y la píldora dicen «Mediana en días corridos y hábiles» («Promedio en…»).

### De dónde salen

El servidor arma los textos con las dos unidades; la página y los PDF los imprimen tal cual (Ruling 19).

- **Cada duración se cuenta en las dos unidades** al armar la vista: las fechas son las mismas, y `duracion` cuenta corridos o hábiles con el mismo calendario.
  Así salen «Los casos», el «después» de los actualizados a tiempo, los rótulos de la cinta, «Cómo se cuenta» y el modal, sin juntar dos textos ni dos listas por su posición.
- **Lo que tiene un número** (la cifra, el estadístico, el eje de la cinta y el gráfico del modal) va en días corridos.
  Cada tramo trae además su cifra en hábiles, como número, para el paréntesis y la cinta (sección 7).
- **Lo que ya está en el tramo no cambia** de forma ni de contenido (`vacio`, `en_curso`, `pendientes`, `pendientes_texto`, `cifra`, `anticipacion_texto`): lo lee el Ciclo de vida, que arma su propia vista en hábiles.
  Lo nuevo va en claves nuevas.
  Cambian de contenido solo los textos que ya decían una unidad y que el Ciclo de vida no lee: los de «Los casos» (`filaDe`), el «después» (`resultados.a_tiempo.despues.texto`, con su `valor` en la unidad de la vista) y los rótulos de la cinta.
- **La foto** guarda la vista ya armada así, como hoy: no se rearma nada al leerla (Ruling 16).
  Sigue guardando las cuatro combinaciones, para no cambiar su forma; la página y los PDF leen las de días corridos.
  Lo del modal va solo en las vistas en días corridos: en las de hábiles, `modal` es null.
- **Los textos son más largos:** la cinta ya pasa un rótulo que no entra a otra fila o no lo dibuja, y se prueba en las combinaciones que quedan; la tabla de los destildados y la hoja 2 del PDF se miden con los textos más largos (`tests/pdf-diagramacion.js`).

## 5. El modal de cada tramo (solo en la página)

### La banda

- Cada nodo de la banda (`.mt-nodo`) que tiene tramo pasa a ser un `<button>`: RPAD, «DGMIT y Dirección Administrativa», «DGMIT y Dirección de Investigación Territorial», «Área responsable» y «Datos Públicos». El Portal sigue igual.
  El orden de los hijos de `.mt-tramos` no cambia (la grilla usa `nth-child`).
- Debajo del rol, un ícono (un círculo con un +, SVG embebido con `aria-hidden`) y «Ver los ciclos», subrayado, en blanco.
- El botón abre el modal aunque el tramo no tenga ciclos: el modal dice por qué.
- El foco se ve adentro de la flecha (el recorte de la punta taparía un contorno de afuera).
- Con `forced-colors`, el botón conserva su borde.

### Qué muestra

Todo lo arma el servidor, por tramo; la página lo dibuja.

```
Respuesta del área                                            ×
Área responsable · gestión externa
Calculado sin 1 dataset: …                     ← solo con destildados, la misma franja de la pestaña
───────────────────────────────────────────────────────────────
Se cuenta desde que la DGMIT y la DA entregan la nota hasta que la DDPC recibe la actualización.

64 días corridos                  ● 12 ciclos cuentan en la cifra   ○→ 3 en curso, todavía no cuentan
(45 días hábiles)
mediana de 12 ciclos

[gráfico: un punto por ciclo sobre los días corridos, con la mediana marcada]

Cómo se cuenta
· 3 ciclos abiertos todavía no tienen datos registrados, hace 150 días corridos (102 hábiles, mediana): cuentan cuando se registra la actualización.
· 2 ciclos se resolvieron con datos de una fuente pública: no cuentan en este tramo.
· 7 ciclos son de datasets que no requieren nota DGMIT: no cuentan en este tramo.

Los ciclos (15)
Dataset                       Nota DGMIT   Datos recibidos   Días
Dataset de ejemplo            02/03/2026   05/05/2026        64 días corridos (45 hábiles)
(área)
…                             04/02/2026   en curso          hace 150 días corridos (102 hábiles)
```

- **La cifra:** la del cajón, con los hábiles y el estadístico; el orientativo, si corresponde.
  En el aviso, el número con «días corridos de anticipación» y los hábiles.
  Sin cifra, el título y el texto del vacío («Todavía no hay notas DGMIT cargadas», «Sin datos todavía», «Sin casos en 2026»).
- **La leyenda:** cuántos ciclos cuentan en la cifra, cuántos están en curso y cuántas notas están pendientes de carga, cada una con su marca (lleno, aro con flecha, punteado): nunca solo el color. Solo las que tienen ciclos.
- **El gráfico** (desde 800 píxeles de ancho; en el teléfono no va):
  Los 800 los propuso el controlador durante la implementación y el usuario los confirmó el 08/11/2026: entre 600 y unos 760 píxeles el gráfico se achica con el modal y su letra queda en 8 o 9 píxeles, que no se leen; la lista tiene los mismos datos.
  - un punto lleno por ciclo que cuenta, en el color del tramo; un aro ámbar con una flecha por ciclo en curso, en «hace …»; las notas pendientes no van, porque no tienen días;
  - el eje en días corridos, con sus marcas y «días corridos» al final;
  - la mediana (o el promedio) como una línea con su rótulo («mediana: 64 días corridos», «mediana: en el día»); sin cifra (solo en curso), sin línea;
  - los puntos que se tocarían se apilan; una columna de más de 8 puntos dice «+N» arriba;
  - cada punto dice, al pasar el mouse, el dataset y los días en las dos unidades;
  - la geometría (las x, los niveles, las marcas del eje, el rótulo y el «+N») la arma el servidor, como la de la cinta, en un espacio fijo; nada se pisa ni se sale;
  - el gráfico tiene un nombre para el lector de pantalla que dice que la lista de abajo tiene los mismos datos;
  - sin ningún ciclo con días, no hay gráfico.
- **«Cómo se cuenta»:** lo que no está en la cifra y cómo se cuentan algunos de los que sí, para ese tramo y con las cantidades de ese tramo (no las de toda la gestión):

| Tramo | Lo que va |
|---|---|
| Aviso anticipado | los avisados ya vencidos con vencimiento en el año: «no cuentan en la anticipación»; los demás vencimientos del año que esperaban el aviso de la regla y no lo tuvieron (los de «Cobertura del aviso», por cualquier motivo): «no tuvieron el aviso de la regla: no cuentan en la anticipación» |
| Redacción y entrega de nota | las notas pendientes de carga de ciclos abiertos (sin días): «cuentan cuando se cargan»; los avisados ya vencidos que cuentan: «se cuentan desde ese primer aviso»; los que no requieren nota: «no cuentan en este tramo» |
| Respuesta del área | los en curso, con las dos unidades: «cuentan cuando se registra la actualización»; los resueltos con una fuente pública: «no cuentan en este tramo»; los que no requieren nota |
| Producción del relevamiento | los en curso; los avisados ya vencidos que cuentan: «se cuentan desde ese primer aviso» |
| Preparación y carga | los resueltos con una fuente pública que cuentan: «la carga se cuenta desde que se obtuvo» |

  Cada línea, con su singular («1 ciclo abierto todavía no tiene…: cuenta…»). Las que dan 0 no van; un tramo sin ninguna no lleva la sección.
  Los avisados ya vencidos que cuentan en el tramo son los mismos que la lista marca.
- **«Los ciclos (N)»:** los que cuentan en la cifra (de más días corridos a menos; con empate, de más hábiles a menos y después por título), después los en curso (igual) y al final las notas pendientes (por la fecha del aviso).
  - El dataset, con el link a su Seguimiento, y su área debajo.
  - Las dos fechas de la etapa, con el nombre de cada punta: «Aviso» y «Vencimiento»; «Aviso» y «Nota DGMIT»; «Nota DGMIT» y «Datos recibidos»; «Aviso» y «Datos recibidos»; «Datos recibidos» y «Carga en el portal».
  - Un avisado ya vencido dice debajo de su aviso «avisado ya vencido: desde ese primer aviso».
  - En curso: «en curso» en la fecha final y «hace 150 días corridos (102 hábiles)».
  - Pendiente: «pendiente de carga» en la fecha final y «—» en los días.
  - Sin ciclos: «Sin ciclos en 2026.»
  - En el teléfono, la tabla se desplaza de costado dentro de su marco, como la de «Los casos».
- Son los ciclos de la cifra: los destildados no están, como no están en la cifra. Los que cuentan son `cifra.ciclos`; los en curso, `en_curso.n`; las pendientes, `pendientes`.

### Cómo se usa

- Es el modal de siempre (`.modal-overlay` y `.modal` de `css/main.css`): `role="dialog"`, `aria-modal`, el título como nombre.
- Mientras está abierto, el resto de la página queda inerte (`inert`), como en Configuración: ni el foco ni el lector de pantalla salen del modal.
- Se cierra con la ×, con Escape y con un clic afuera; el foco vuelve al botón de la banda que lo abrió.
- Al abrirse, el foco va a la × cuando termina la transición de entrada, como en el Seguimiento.
- Con `prefers-reduced-motion`, el modal aparece sin achicarse ni agrandarse.
- La × de este modal tiene 4,5:1 o más sobre el blanco (la de `main.css` no llega a 3:1).
- Sus estilos van en el `<style>` de `reportes.html`: `main.css` no cambia (subiría su versión en las 14 páginas).
- Un año con foto abre el modal con lo que guarda la foto.
  Una foto sin `modal` en sus tramos (ninguna en producción hoy) dibuja la banda sin botones.

## 6. Los PDF

### La hoja 1

- Los cajones, como en la sección 3.
- El paréntesis de los hábiles sale de la cifra en hábiles del tramo (sección 7).
  Una foto sin ella (ninguna hoy) lo saca, como hoy, de la otra vista (`circuitoDeLaHoja`).
- Los escalones de la letra (`LETRAS_DEL_CIRCUITO`) no cambian: entra el más grande que quepa.
  Con los datos del 07/11 entra el de 8,6 pt (hoy entra el de 7,7).
  Un año con más texto puede bajar de escalón, como hoy.

### «Cómo se cuenta» (hoja 2)

Empieza con la oración de los días (sección 4) y, en cada gestión, primero lo que sale de los cajones y después las aclaraciones de hoy:

- «3 notas DGMIT de ciclos abiertos están pendientes de carga: cuentan en la redacción y entrega de nota cuando se cargan.» («1 nota DGMIT de un ciclo abierto está pendiente de carga: cuenta …»)
- «3 ciclos abiertos todavía no tienen datos registrados, hace 150 días corridos (102 hábiles, mediana): cuentan en la respuesta del área cuando se registra la actualización.» («1 ciclo abierto todavía no tiene datos registrados, …: cuenta …»; en la interna, «en la producción del relevamiento»)

Las arma el servidor y quedan en la vista, como las aclaraciones de hoy: `circuito.aclaraciones.externa` suma `pendientes` y `en_curso`, y `circuito.aclaraciones.interna`, `en_curso` (la interna no tiene notas DGMIT), con la forma `{ n, texto }` de las otras.
El recuadro «i» de la página no las muestra: dibuja solo las tres de hoy.
Sin pendientes ni en curso, no van esas líneas; una gestión sin nada no lleva su nombre, como hoy.

### Las otras hojas

Con las dos unidades donde hay días (sección 4).

### El Informe anual

Igual: la hoja 1, «Cómo se cuenta» y las otras hojas, desde la foto en días corridos con los hábiles entre paréntesis (hoy, fuera de la hoja 1, va fijo en días hábiles).
La comparación con el año anterior no compara días (cantidades y porcentajes): no cambia.

## 7. La API y la foto

`GET /api/metricas` manda la vista en días corridos, con los textos en las dos unidades.
Cada tramo de `vista.circuito` suma, sin tocar lo que ya tiene:

- `como_se_cuenta`: la frase (sección 3).
- `habiles`: la cifra del tramo en días hábiles, con la forma de `cifra` (o null sin cifra, o en una vista en hábiles).
- `habiles_texto`: lo de debajo de la cifra, de `textoDeHabiles(cifra, habiles)` («(45 días hábiles)»; '' cuando no va nada).
  `textoDeHabiles` pasa de `services/reportesMetricasPdf.js` a `services/metricasReglas.js`, y el PDF lo importa.
- `modal` (null en las vistas en hábiles): `{ quien, leyenda, como_se_cuenta, lista, puntas, ciclos, vacio, grafico }`:
  - `quien`: «Área responsable · gestión externa»;
  - `leyenda`: `[{ marca: 'cuenta' | 'en_curso' | 'pendiente', texto }]`, solo las que tienen ciclos;
  - `como_se_cuenta`: los textos de su «Cómo se cuenta» ([] si no hay);
  - `lista`: «Los ciclos (15)», el título de la lista;
  - `puntas`: los nombres de las dos fechas («Nota DGMIT», «Datos recibidos»);
  - `ciclos`: `[{ dataset_id, titulo, area, estado, desde, hasta, hasta_texto, dias_texto, nota }]`, en el orden de la lista; `estado` 'cuenta', 'en_curso' o 'pendiente'; las fechas como 'AAAA-MM-DD' o null; `hasta_texto`, «en curso» o «pendiente de carga» ('' con fecha); `dias_texto`, como en la tabla de la sección 4 («—» en una pendiente); `nota`, «avisado ya vencido: desde ese primer aviso» o '';
  - `vacio`: «Sin ciclos en 2026.» sin ningún ciclo, o '';
  - `grafico`: la geometría ya armada (el ancho y el alto del espacio, el eje con sus marcas y su rótulo, la línea del estadístico con su rótulo o null, los puntos con su x, su y, su estado y su título, y los «+N») o null.

`circuito.aclaraciones.externa` suma `pendientes` y `en_curso`, y `circuito.aclaraciones.interna`, `en_curso` (sección 6).

La foto guarda todo eso dentro de la vista: son claves nuevas, `VERSION_DE_LA_FOTO` sigue en 1 y una foto sin ellas se lee con tolerancia (sin el modal, sin esas líneas de «Cómo se cuenta» y con el paréntesis de la otra vista).
`metricas_fotos` todavía no tiene filas en producción.

El modal pesa: va solo en las vistas en días corridos, y «Datos para completar», que también pasa por `metricasDe`, lo recibe sin usarlo.

## 8. Lo que no cambia

- El PDF «Ciclo de vida del dato»: sigue con `desde_hasta`, sus notas de pendientes y en curso, y su dibujo.
- Las reglas de qué cuenta y cuándo: solo cambian los textos y dónde se muestran.
- «Para completar», el PDF «Datos para completar» y el Seguimiento.
- El cajón «Aviso anticipado» (salvo los hábiles), el recuadro «i» del circuito y el dibujo de la cinta (salvo los rótulos).

## 9. Pruebas

- Las frases de `COMO_SE_CUENTA` y cada forma de la tabla de la sección 4 (plural, 1, con 0 hábiles, con los dos en 0), en cada lugar.
- El tramo: las claves de hoy, iguales a las de antes con los mismos casos; las nuevas, con su forma (el test de las claves exactas cambia).
- Los ciclos de cada tramo: los que cuentan son tantos como `cifra.ciclos`; los en curso, como `en_curso.n`; las pendientes, como `pendientes`; el orden; las fechas de cada punta.
- «Cómo se cuenta» del modal: las cantidades por tramo y los marcados en la lista, iguales.
- La geometría del gráfico: nada se pisa ni se sale; el «+N»; sin cifra, sin línea; sin puntos, sin gráfico.
- La página: el cajón sin pendientes ni en curso; la banda con botones (y el Portal sin); el modal puro, con todo escapado; sin el selector de días; la URL y los pedidos sin `dias`; los textos atados al PDF por paridad.
- Los PDF: la hoja 1 con las frases y sin «Se cuenta hasta…»; las 5 frases enteras en los 3 escalones y en la columna más angosta; «Cómo se cuenta» con lo que sale de los cajones; las dos unidades en las otras hojas; nada se pisa ni se sale (`tests/pdf-diagramacion.js`); `REFERENCIA_DE_LOS_PDF` se vuelve a tomar.
- El Ciclo de vida: igual que antes con los mismos casos.
- La foto: guarda lo nuevo y lee una foto sin ello.
- Números inventados; ningún nombre real.

## 10. Despliegue

- Sin SQL.
- Antes del 10/01/2027.
- El kit se arma contra `1bf2710` e incluye la paginación de «Editar notas DGMIT» (`seguimiento.js?v=20261134`), que está en main sin desplegar.
- Sube `reportes.js?v=` y, con él, `VERSION_FERIADOS` (`tests/paginas.test.js` exige que sea mayor y no queda margen): `configuracion.html`, con su `feriados.js?v=`, va también en el kit.
