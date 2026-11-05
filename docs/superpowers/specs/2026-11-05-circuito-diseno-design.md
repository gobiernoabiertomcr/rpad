# El circuito: quién y qué, juntos

Fecha: 05/11/2026. Decisiones del usuario del 05/11/2026; el usuario aprobó este diseño el 05/11/2026.
La maqueta se vio con las páginas reales y los datos del dump del 05/11/2026, fuera del repo; los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá.

## 1. Por qué

En «El circuito» de Métricas y en «Avisos del ciclo abierto» del Seguimiento, las cajas tienen borde y las etapas son texto suelto entre ellas.
Con las palabras del usuario, «hoy parecen como 'perdidas' las etapas».

Hay dos causas, medidas en el código:
- Las cajas mandan: son lo único con forma, y la etapa no tiene contenedor.
- La etapa no tiene lugar: en una grilla de 9 columnas le quedan unos 126 píxeles de texto en la externa, a lo sumo, y en el PDF, 60 puntos.
  Cada flecha se centra sola, así que los números de dos etapas vecinas no quedan a la misma altura.
  En el PDF, el nombre va en 7 puntos, apenas más que lo que tiene al lado.

## 2. Decisiones del usuario

Eligió, mirando la maqueta:

1. **La opción C, «quién y qué, juntos», para la página de Métricas:** una banda de flechas de color dice quién actúa y, justo debajo, va una tarjeta con la etapa que le toca.
   Se descartaron la A (la misma fila de hoy, con tarjetas: sigue angosta y corta «Administrativa») y la B (dos filas, con las cajas de hoy: tarjetas más angostas).
2. **El Área con color propio:** verde azulado, `#1F6B73`, con 6,16:1 sobre blanco.
3. **La página y los dos PDF que comparten el dibujo:** el PDF de Métricas y el Informe anual.
   Aprobó la maqueta del PDF.
4. **El mismo diseño en «Avisos del ciclo abierto» de `seguimiento.html`:** «Tambien me gustaria unificar el diseño en seguimiento.html».
   Aprobó su maqueta.
5. **El PDF del Seguimiento queda como está**, con el Reporte por área y los anexos de las Notas Digitales.

## 3. Lo que no cambia

- **Ninguna cifra ni ningún texto.** `metricasReglas.js`, `metricasCinta.js`, `metricasFoto.js`, `seguimientoReglas.js`, `metricasController.js` y `seguimientoController.js` no se tocan.
- **La foto del 31/12.** Guarda números y textos armados, no el dibujo (`datosDeLaFoto`), y su forma no cambia.
  `VERSION_DE_LA_FOTO` sigue en 1.
  Un Informe anual sale con el dibujo vigente, también el de una foto sacada antes: el Informe se dibuja en cada pedido, no queda guardado en bytes como una nota.
- **`public/js/reportes.js`.** Los dos circuitos de Métricas salen solo con CSS, sobre el HTML de hoy.
  Por eso su `?v=` no sube, ni `VERSION_REPORTES` ni `VERSION_FERIADOS`.
- **`public/css/main.css`.** Lo nuevo va en el `<style>` de cada página, como el resto de los tokens `--sg-`.
- **El Ciclo de vida del dato.** Tiene su propio dibujo y usa `NODOS` y `contorno`, que no cambian: el Área sigue en el acento en ese PDF.
- **El PDF del Seguimiento, el Reporte por área y los anexos** (`seguimientoPdf.js`, `reportesPorAreaPdf.js`, `notasDigitalesAnexo.js`): ni un byte, salvo la fecha.
- **La cinta**, sus colores y su leyenda, en la página y en el PDF.
- **El orden de lectura.** El HTML sigue yendo caja, etapa, caja, etapa, y adentro de la etapa, cifra y nombre: el lector de pantalla lee lo mismo que hoy.
  A la vista, el nombre va arriba, con `order`; adentro no hay nada que se pueda enfocar.

## 4. Los colores

| Quién | Banda | Tarjeta | Borde de la tarjeta |
|---|---|---|---|
| RPAD y Datos Públicos | `--sg-tinta` | `#F4F8FC` | `#CFE0EF` |
| DGMIT (con DA o con DIT) | `--sg-violeta` | `--sg-violeta-fondo` | `#D6CCEB` |
| Área | `--sg-del-area`, `#1F6B73` | `--sg-del-area-fondo`, `#E8F4F5` | `#BFDDE0` |
| Portal | `--sg-verde` | sin tarjeta | |

Una etapa sin cifra lleva el fondo `--sg-sutil` y el borde punteado `--sg-gris`, como su línea de hoy.
En la página, si es del Área, su fondo es `#F1F8F9` y su borde punteado, `#1F6B73`.
En el PDF, una tarjeta sin cifra va siempre en gris, con el nombre en su color: es la maqueta que se aprobó.

Los textos sobre esos fondos cumplen 4,5:1: `--sg-suave` da 4,89 sobre `--sg-violeta-fondo`, `--sg-ambar` da 5,86 y `#1F6B73` da 5,48 sobre `#E8F4F5`.
El color nunca es lo único que distingue: la banda dice el nombre y la tarjeta conserva su insignia.

Con alto contraste (`forced-colors`) la banda pierde el fondo: la forma de flecha se saca y queda una caja con borde, como la de hoy, separada de la siguiente.
Al imprimir la página, la banda conserva su fondo (`print-color-adjust`): sin él, el texto blanco no se vería.

## 5. La página de Métricas

Solo CSS en `public/reportes.html`, sobre las clases de hoy (`.mt-tramos`, `.mt-nodo`, `.mt-flecha`, `.mt-resp`).

Desde 961 píxeles:
- La grilla tiene dos filas. En la primera van las bandas: `.mt-nodo`, con forma de flecha (`clip-path`) y el texto en blanco.
- En la segunda van las tarjetas: cada `.mt-flecha`, debajo de la banda de la que sale.
- Las columnas son iguales y la del Portal, más angosta (0,62), sin tarjeta debajo.
- La primera banda no tiene muesca y la última no tiene punta.
- `.t`, el nombre de la etapa, sube al principio de la tarjeta con `order` y reserva dos renglones, para que las cifras queden a la misma altura.
- `.l`, la línea, no se dibuja: la flecha ya es la banda.
  Se queda en el HTML, porque `reportes.js` no cambia.
- La insignia va al pie de la tarjeta.

Hasta 960 píxeles, una sola columna: banda, su tarjeta, banda, su tarjeta.
La banda es un rectángulo redondeado, sin forma de flecha.

Las clases de la etapa y del nodo del Área se eligen por lugar (`nth-child` de la gestión externa), porque el HTML no las distingue.

## 6. La página del Seguimiento

Lo mismo en `public/seguimiento.html`, con tres columnas (1, 1 y 1,1): el RPAD, la DGMIT y el Área, con el nombre largo del área en su banda.

El estado del Área («Vence en 25 días», «Vencido hace 40 días») hoy va adentro de su caja.
Pasa a su propia tarjeta, debajo de la banda del Área: `.sg-estado-area`, con `.vencido` si `area.vencido` es verdadero (fondo `--sg-rojo-fondo` y texto `--sg-rojo`).
`.sg-estado` a secas ya existe: son los estados de la página (cargando, no encontrado, error).
Es el único cambio de HTML: `htmlDelCircuito` (`public/js/seguimiento.js`) saca `<div class="e">` del nodo y agrega esa tarjeta como sexto hijo de `.sg-tramos`.
`<div class="sg-nodo area">` sigue marcando al vencido, aunque ya no pinte nada: lo lee `tests/seguimiento-frontend.test.js`.

El tramo de la nota conserva sus dos estados, ahora como tarjeta: `.registrada` en violeta y `.fuera` con el borde punteado.
`.sg-directo`, el email al área, sigue debajo, igual que hoy.

`seguimiento.js` sube su `?v=` a `20261130`, con `VERSION_SEGUIMIENTO`.
`seguimiento.html` suma los tokens `--sg-violeta-fondo` (copia del de Métricas), `--sg-del-area` y `--sg-del-area-fondo`.

## 7. El PDF de Métricas y el Informe anual

`piezaDelCircuito` (`services/reportesMetricasPdf.js`), el dibujante que comparten, dibuja lo mismo que la página: la banda con `NODOS` (las siglas: «DGMIT y DA», «DDPC») y debajo la tarjeta con los mismos datos que hoy.
`elementosDelCircuito`, `piezaDeLaGestion`, los textos y las aclaraciones no cambian.

- La banda es un contorno de líneas y curvas, y la tarjeta usa `contorno`: `tests/pdf-diagramacion.js` no admite un `roundedRect` adentro de un recuadro.
- La tarjeta común va en blanco, porque el recuadro ya es celeste.
  La de la DGMIT va en `#F5F2FB` y la del Área en `#F0F8F9`, cada una con su insignia sobre un fondo de su color (`piezaDeInsignia` suma `fondo`).
- El color del Área es una constante nueva del circuito, `COLOR_DEL_AREA`, no un cambio en `NODOS`: si no, cambiaría el Ciclo de vida.
- Las medidas son las de la maqueta aprobada: letra del nombre 7,8; cifra 13; banda de 24 de alto como mínimo.

Con los datos del dump, el circuito de las dos gestiones juntas queda más bajo: la externa baja y la interna sube unos puntos.
Nada cambia de hoja.

Con los casos de los tests, baja de 344,3 a 331,2, y el Informe anual sigue con 3 hojas.
En el PDF de «con una nota DGMIT» los resultados vuelven a la hoja 1, porque ahora entran: de 5 hojas pasa a 4, con las mismas palabras.

`REFERENCIA_DE_LOS_PDF` se vuelve a tomar en las cinco entradas.
Se comprueba, para cada una, que el texto de todo el PDF tiene las mismas palabras que antes, sin el encabezado y el pie de cada hoja: con una hoja menos, salen una vez menos.

## 8. Despliegue

Sin SQL, sin Tarea Cron y sin variables nuevas, con Restart.
Cuatro archivos de producción: `public/reportes.html`, `public/seguimiento.html`, `public/js/seguimiento.js` y `services/reportesMetricasPdf.js`.
El kit va después de `RPAD-deploy-metricas-frase-casos`, y su comprobación previa mira `reportes.js?v=20261209` y `seguimiento.js?v=20261129`.
No hay fecha límite: el dibujo no queda en la foto.

## 9. Pruebas

- La página de Métricas: el HTML de `htmlDeCircuito` no cambia, y los tests actuales pasan sin tocarlos.
- El Seguimiento: `.e` va en `.sg-estado-area` y no en el nodo; `.vencido` solo con `area.vencido`; `sg-nodo area` sigue; los demás textos, iguales; `#loading`, `#not-found` y `#sg-error` se siguen viendo como hoy.
- Las dos páginas: los tokens del Área tienen el mismo valor que `COLOR_DEL_AREA` y las dos traen su bloque de `forced-colors`.
- El PDF: el orden banda, nombre, cifra; los nombres de las etapas y las cifras alineados entre columnas; el Portal sin tarjeta; un tramo que no llega no tira; ninguna línea cortada con «…» con lo más largo de cada campo; nada se pisa ni se sale (`tests/pdf-diagramacion.js`).
- La comparación con el código de antes, sobre el dump del día, en las cuatro combinaciones:
  - lo que manda `metricasDe` y `verSeguimiento`, idéntico;
  - el PDF del Ciclo de vida y el del Seguimiento, idénticos por hoja;
  - el PDF de Métricas, con las mismas palabras, sin el encabezado y el pie de cada hoja.
- La vista: Firefox y el panel, a 1320, 1120 y 961 píxeles y en el teléfono, sin desplazamiento horizontal; con los datasets de cada estado (externo vencido, al día, con nota DGMIT, sin nota requerida, interno, dado de baja, sin ciclo).
