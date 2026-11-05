# Métricas: la frase en «Los casos»

Fecha: 05/11/2026. Decisiones del usuario del 05/11/2026.
La maqueta se vio con la página real y los datos del dump del 05/11/2026, fuera del repo; los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá; los textos, al pie de la letra.

## 1. Por qué

En «Los casos» de Métricas, debajo de cada fecha hay un número solo, sin unidad y sin decir desde cuándo cuenta.
Leído al lado de la columna Vencimiento, parece contar desde ahí, y no: cuenta desde el aviso.

El usuario lo vio en un ciclo interno vencido en 2025 y cargado en 2026, cuyo número daba bastante menos que los días del Seguimiento para el mismo ciclo.
Pensó que Métricas contaba desde el 01/01 y, después de ver lo que se encontró, lo dijo con sus palabras: «TENES RAZON! Se cuenta desde la fecha del aviso... el problema lo tenemos con los que se vencieron antes de que implementaron el RPAD.».

## 2. Lo que se comprobó

No hay ningún recorte por año.
`duracion` (`services/metricasReglas.js`) recibe los hitos sin tope, `fuentesDe` no filtra por fecha, y el año solo decide en qué año cuenta un tramo, por su hito final.

Los tramos que empiezan en el aviso arrancan en `inicioTramos`: el aviso de la regla o, en un ciclo `heredado`, su primer aviso.
`heredado` es el ciclo sin aviso de la regla, cuyo primer aviso llegó después del vencimiento y que el RPAD no pudo avisar a tiempo: la fecha de la regla es anterior al 06/12/2025 o al alta.
Uno que sí se pudo avisar a tiempo y se avisó ya vencido («se avisó ya vencido») no tiene `inicioTramos` ni número.

Un 01/01 aparece porque ese fue el primer email de vencidos que recibieron esos internos: el resumen automático salía el día 1 de cada mes, y los datasets ya vencidos se dieron de alta en diciembre.
Los externos arrancan en diciembre de 2025, y cruzan el año sin cortarse.

El Seguimiento mide otra cosa: `diasVencido`, del vencimiento a la carga o, en un ciclo abierto, a hoy.
En Métricas, esa medida solo aparece como la mediana o el promedio de los cargados después del vencimiento, en «Actualizados a tiempo» («Los otros N se cargaron…»).

Ejemplo inventado, un interno avisado ya vencido: vence el 30/06/2025, primer aviso el 01/02/2026, se recibe y se carga el 10/09/2026.
Del aviso a los datos son 221 días corridos; del vencimiento a la carga, 437.

Ejemplo inventado, un interno avisado a tiempo: vence el 30/06/2026, aviso el 01/05/2026, se recibe el 20/07/2026.
Del aviso a los datos son 80 días corridos; del vencimiento, 20.

## 3. Decisiones del usuario

1. **Las reglas no cambian.**
   Un ciclo `heredado` sigue contando desde su primer aviso, y ninguna cifra se mueve.
   Se descartó contar desde el vencimiento: le atribuiría a la DGMIT y a la DIT días anteriores a todo aviso, incluso de antes del alta del dataset en el RPAD, y roza el antiobjetivo de que algo se lea como un reproche.
   También se descartó sacar esos ciclos de la cifra.
2. **Se aclara la fila** con la opción de la maqueta «la frase»: cada número dice su unidad y desde cuándo cuenta.
   Se descartaron el título de la columna (un externo en curso sin nota cuenta desde el aviso, no desde la nota, y necesitaría una excepción) y sumar a cada fila los días respecto del vencimiento (filas más cargadas).
3. **Nada más.**
   Con sus palabras: «No toquemos nada mas, solo quedemonos con lo que estamos viendo».
   Quedan afuera los otros hallazgos del escaneo sobre Métricas.

## 4. Los textos de la fila

Los arma `filaDe` (`services/metricasReglas.js`), y la página y el PDF los imprimen tal cual (Ruling 19).
La unidad es la de `unidadDe(valor, ctx.dias)`: «día corrido», «días corridos», «día hábil» o «días hábiles».
`dias` es `duracion(desde, hasta, ctx.dias, ctx.calendario)`, igual que hoy.

| Campo | Cuándo | Hoy | Queda |
|---|---|---|---|
| `aviso.texto` | avisado a tiempo | `60 antes` | `60 días corridos antes del vencimiento` |
| `aviso.texto` | el día del vencimiento | `el día del vencimiento` | igual |
| `aviso.texto` | avisado ya vencido, y los motivos sin aviso | `avisado ya vencido`, … | igual |
| `nota.texto` | con nota y con inicio | `61` | `61 días corridos desde el aviso` |
| `nota.texto` | con nota y sin inicio | vacío | igual |
| `nota.texto` | sin nota | `pendiente de carga` o vacío | igual |
| `recibido.texto` | interna, con datos y con inicio | `221` | `221 días corridos desde el aviso` |
| `recibido.texto` | interna, con datos y sin inicio | vacío | igual |
| `recibido.texto` | externa, con nota y sin fuente pública | `45` | `45 días corridos desde la nota` |
| `recibido.texto` | externa, otros casos con datos | vacío | igual |
| `recibido.texto` | abierto, externa con nota | `en curso, hace 20` | `en curso, 20 días corridos desde la nota` |
| `recibido.texto` | abierto, los demás | `en curso, hace 308` | `en curso, 308 días corridos desde el aviso` |
| `recibido.texto` | abierto, sin días o con 0 | `en curso` | igual |
| `recibido.texto` | cerrado sin datos | vacío | igual |
| `carga.texto` | origen `area`, sin dato o interna | `3` | `3 días corridos desde que se recibió` |
| `carga.texto` | origen `fuente_publica` | `2` | `2 días corridos desde que se obtuvo` |
| `carga.texto` | sin datos | vacío | igual |

Un 0 sigue siendo `en el día` en `nota`, `recibido` y `carga`.
Con «Días hábiles», la misma frase con su unidad: `1 día hábil desde la nota`.
`aviso.que`, `nota.tipo` y `recibido.origen` no cambian.

«desde que se obtuvo» no se vio en la maqueta: con una fuente pública no se recibe nada, y la documentación ya dice que esa carga cuenta «desde que se obtuvo la fuente».

## 5. El pie de la lista

La oración «Debajo de cada fecha, los días corridos del tramo o su estado.» se saca, porque cada fila ya lo dice.
En la página, el pie queda con lo de destildar (`htmlDeCasos`).
En el PDF de Métricas, la tabla de los destildados queda sin ese párrafo: se borra `textoDelPieDeLosCasos`.

## 6. Lo que no cambia

- Ninguna regla ni cifra: `inicioTramos`, `heredado`, `medir`, `cifraDe`, `etapasDe`, los resultados, las cintas y las reiteraciones.
- El Ciclo de vida del dato y el Informe anual: no imprimen estas filas.
- El Seguimiento.
- Las aclaraciones del circuito, que ya dicen que el resto de los tramos se cuenta desde ese primer aviso.
- Los permisos y las rutas de la API: la forma de `vista.casos` es la misma y solo cambia el texto.

## 7. La foto del 31/12

La foto de 2026 se saca el 10/01/2027, con las filas ya armadas, en `vistas`, y no se modifica nunca.

- **Si esto se despliega antes:** la foto guarda la frase, y las cifras son las mismas.
- **Si se despliega después:** la foto de 2026 se queda con el número solo y sin la oración del pie, para siempre.
  Por eso tiene que estar en producción antes del 10/01/2027.

No cambia la forma de la foto: `VERSION_DE_LA_FOTO` sigue en 1 y no hace falta leer con tolerancia.
Hoy no hay ninguna foto guardada.

## 8. La pantalla

`.mt-tabla` no cambia: el texto de abajo ya corta de renglón y la tabla ya tiene su desplazamiento horizontal.
En el teléfono se conserva el `min-width` de la tabla, dentro de su marco.

## 9. El PDF de Métricas

La tabla de los destildados imprime los mismos textos, sin cortarlos.
Hoy cada celda de una tabla de reportes tiene hasta 4 líneas (`LINEAS_POR_CELDA`, `services/reportesPdfBase.js`), con la fecha en la primera, y lo demás se corta con «…»: con las frases, se cortarían.
Cambiar solo los anchos no alcanza, porque son relativos y lo que se le da a una columna se le quita a otra.

`prepararTabla` suma una opción `lineas`, de entrada `LINEAS_POR_CELDA`, y solo esta tabla pasa otro valor, el menor con el que la fila más larga entra entera.
Las demás tablas siguen igual.

Solo cambia la hoja de los destildados: en `REFERENCIA_DE_LOS_PDF`, la entrada «Métricas: con una nota DGMIT, promedio en días corridos y dos destildados», con el diff de texto hoja por hoja que lo compruebe.
Las otras cuatro entradas no se tocan.

## 10. Despliegue

Sin SQL, sin Tarea Cron y sin variables nuevas.
`reportes.js` sube su `?v=` a `20261209`, junto con `VERSION_REPORTES`, y `VERSION_FERIADOS` (`20261210`) sigue siendo mayor.
Kit contra el `main` que indique la coordinadora, en producción antes del 10/01/2027.

## 11. Pruebas

- `filaDe`: cada fila de la tabla de la sección 4, en corridos y en hábiles, con el singular y el 0.
- Un ciclo `heredado`: la frase dice «desde el aviso» y el valor es el mismo de hoy.
- Las cifras no se mueven: todo lo que manda `metricasDe`, en las cuatro combinaciones, es igual antes y después, salvo los cuatro `texto` de cada fila.
- La página imprime los textos del servidor y el pie ya no dice «Debajo de cada fecha».
- El PDF con destildados imprime las frases, sin el párrafo del pie, y nada se sale de la hoja (`tests/pdf-diagramacion.js`).
- El PDF con una fila armada a mano, con lo más largo de cada celda (tres cifras, «Reiteración», el origen y «email mensual de vencidos»): ninguna línea termina en «…».
- La foto guarda y devuelve las filas con la frase.
