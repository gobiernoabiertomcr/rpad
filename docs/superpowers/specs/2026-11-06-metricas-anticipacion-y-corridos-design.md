# La anticipación, los días corridos primero y tres correcciones de Métricas

Fecha: 06/11/2026. Decisiones del usuario del 06/11/2026, mirando las maquetas con los datos del dump de ese día, fuera del repo.
Los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá.

## 1. Por qué

Una auditoría comparó la página de Métricas con los PDF «Métricas del año» y «Ciclo de vida del dato», con los datos reales: dicen lo mismo, parte por parte.
Dejó tres cosas para corregir, iguales en todos lados (secciones 3 a 5).
Mirando el resultado, el usuario sumó dos cambios de diseño (secciones 6 y 7).

La foto del 10/01/2027 guarda los textos armados y no se modifica: todo lo de las secciones 3, 4 y 7 que arma el servidor tiene que estar en producción antes.

## 2. Decisiones del usuario

1. **El aviso de la regla de un ciclo reprogramado** es el del vencimiento que rige: el usuario contó que a ese dataset le cambiaron la fecha, y que el aviso que debería contar es el de la fecha nueva.
2. **La tarjeta dice «de ciclos abiertos».** Las dos cuentas (la de la tarjeta y la de «Para completar») ya eran a propósito; lo que faltaba es decirlo.
3. **«Cómo se cuenta» suma lo del aviso.**
4. **En los PDF, primero los días corridos:** «invertir la cifra destacada: primero van los dias corridos y abajo los dias habiles», con el espacio entre los hábiles y «mediana de…», no entre las dos cifras.
5. **La hoja 1 es igual con los dos selectores de días.** El selector sigue mandando en las otras hojas.
6. **El Ciclo de vida también pone primero los corridos.** Conserva su dibujo.
7. **Los en curso, en los PDF, dicen los dos:** «hace 120 días corridos (80 hábiles, mediana)».
8. **El cajón «Aviso anticipado» tiene otro diseño,** en la página, en el PDF de Métricas y en el Informe anual: el número, «días corridos de anticipación» y una línea del aviso al vencimiento.
   El usuario descartó sumarle una frase («N de los M días corridos de la regla»), una tarjeta llena y una fila de un palito por día.
   También eligió el número a la izquierda, a la altura de los otros cajones, y un aro chico en lugar de la línea vertical de vencimiento, de un banderín o de un calendario.
9. **El Ciclo de vida no lleva el cajón nuevo.**

## 3. El aviso de la regla de un ciclo reprogramado

Hoy el aviso de la regla es el primer email o Nota Digital de la regla del ciclo con fecha hasta el vencimiento.
Un cambio que solo mueve la próxima antes de vencer sigue dentro del mismo ciclo (`docs/temas/seguimiento.md`), así que un email del vencimiento anterior queda como el aviso del nuevo, y la anticipación mide días que nadie tuvo.

**La regla nueva,** en `casoDelCiclo` (`services/metricasReglas.js`): cuenta como aviso de la regla el que tiene fecha entre la fecha de la regla y el vencimiento (`fecha_regla <= dia <= venc`).

Por qué alcanza con eso: el aviso sale el día de la regla o el hábil siguiente, nunca antes. Sobre el dump, solo un ciclo tiene un aviso anterior a su fecha de la regla.

Lo que sigue de eso, sin más código:
- El aviso que muestran «Los casos» y «Para completar» es el nuevo.
- Las reiteraciones del RPAD se cuentan desde el nuevo.
- Un email anterior de la regla que no se pudo enviar ya no da el motivo «el email no se pudo enviar».
- Un ciclo reprogramado que todavía no tuvo su aviso nuevo no tiene aviso de la regla: no cuenta en la anticipación ni en los tramos que empiezan en el aviso hasta que salga. Si su fecha de la regla todavía no llegó, tampoco falta en la cobertura.
- Si una nota DGMIT es anterior al aviso nuevo, la redacción queda en «En el día» por el piso de 0, como cualquier nota anterior a su aviso.

Sin cambios: `cicloDelAviso`, los avisos del ciclo (`avisos_rpad`), `primer_aviso`, `heredado` y el Seguimiento.

## 4. «De ciclos abiertos»

`notasPendientes` (`services/metricasReglas.js`), la que usa la tarjeta, el vacío y el Ciclo de vida:

| Cuántas | Dice |
|---|---|
| 0 | «0 notas pendientes de carga de ciclos abiertos» |
| 1 | «1 nota pendiente de carga de un ciclo abierto» |
| 7 | «7 notas pendientes de carga de ciclos abiertos» |

El título de «Para completar» ya dice cuántas son de cada clase y no cambia.

## 5. La frase de «Cómo se cuenta»

`EN_EL_ANIO` (`services/reportesMetricasPdf.js`), en el PDF de Métricas y el Informe anual:
«Un tramo cuenta en el año en que terminó; el aviso, en el año de su vencimiento.»

Es del dibujo: no queda en la foto.

## 6. Los días corridos primero

### La hoja 1 de Métricas y del Informe anual

El circuito se dibuja desde la vista en días corridos, con los hábiles abajo, con cualquiera de los dos selectores.

| Corridos | Hábiles | La cifra | Debajo, pegado |
|---|---|---|---|
| 83 | 53 | `83 días corridos` | `(53 días hábiles)` |
| 1 | 1 | `1 día corrido` | `(1 día hábil)` |
| En el día | En el día | `En el día` | nada |
| 3 | En el día | `3 días corridos` | `(En el día, en días hábiles)` |
| Sin cifra | | lo de hoy | nada |

- Los hábiles van pegados a la cifra, y el espacio pasa a estar entre ellos y «mediana de…». Se resta del alto de la cifra lo que hoy deja debajo y se suma después de los hábiles: la tarjeta mide lo mismo.
- Debajo de «En el día» va «mediana en días corridos», que ya manda el servidor en esa vista.
- La solapa y la píldora dicen «Mediana en días corridos y hábiles» («Promedio en…»), en las dos gestiones. La píldora sigue diciendo lo destildado.
- En las otras hojas no cambia nada: los resultados y su bajada siguen lo elegido.

**Cómo llega:** `datos.circuito_en_corridos` y `datos.circuito_en_habiles`, con la forma de `vista.circuito`.
- En vivo, `enVivo` calcula las dos vistas con los mismos casos, solo para los PDF.
- Con foto, salen de la foto, que ya guarda las cuatro combinaciones (`circuitoEnCorridosDeLaFoto` y una igual para los hábiles).
- `GET /api/metricas` no las manda.
- Si falta alguna de las dos (una foto sin esa combinación), no tira: se dibuja lo elegido, sin los paréntesis, y la solapa dice lo elegido, como hoy.

`textoDeCorridos` se reemplaza por `textoDeHabiles(cifra, habil)`, que da la columna derecha de la tabla.

### Los en curso, en los PDF

Una función pura nueva en `metricasReglas.js`, `textoEnCursoDeLosDos(enCorridos, enHabiles, estadistico)`, con los números que ya trae cada `en_curso` (`n` y `valor`), para que el Informe los arme desde una foto sin cambiar su forma:

| Corridos | Hábiles | Dice |
|---|---|---|
| 120 | 80 | «4 sin datos registrados todavía, hace 120 días corridos (80 hábiles, mediana)» |
| 1 | 1 | «1 sin datos registrados todavía, hace 1 día corrido (1 hábil, mediana)» |
| 3 | 0 | «… hace 3 días corridos (menos de 1 hábil, mediana)» |
| 0 | 0 | «… hace menos de 1 día corrido (mediana)» |

La página no cambia: dice la frase de los días elegidos.

### El Ciclo de vida

Conserva su dibujo, y lo grande pasa a estar en corridos.

- `diasEnPalabras` da `{ numero, unidad, habiles }`: `{ numero: '83', unidad: 'días corridos', habiles: '53 días hábiles' }`.
  El campo `corridos` de `textos.mediana` y `textos.promedio` se llama `habiles`; el `corridos_texto` de los extremos, `habiles_texto`. Ningún dato guardado lo usa: `metricas_fotos` todavía no tiene filas en producción.
- `textos.indice`, el número del circuito chico, es la mediana en corridos. Su rótulo dice «El circuito · mediana en días corridos».
- Con los dos en 0, «En el día». Con corridos y 0 hábiles, el número en corridos y «En el día, en días hábiles».
- Los extremos se siguen eligiendo por días hábiles, y con empate por corridos: el orden entre ellos no cambia, aunque lo grande sea el otro número.
- La nota del en curso usa `textoEnCursoDeLosDos`, y `etapasDe` guarda también el en curso en corridos.
- «Año anterior» es la mediana en días corridos: «Año anterior: mediana de 45 días corridos».
- «Cómo se cuenta» empieza: «Días corridos: todos los días del calendario. Junto a ellos, los hábiles: de lunes a viernes, sin feriados ni días no laborables.».

Los campos numéricos `habiles` y `corridos` de cada etapa no cambian, y el test de paridad con `vistaDe` sigue valiendo.

## 7. El cajón «Aviso anticipado»

Solo en esta etapa y en las dos gestiones. Es la única donde más días es mejor, y por eso se tiene que leer distinto.

De arriba abajo:

```
Aviso anticipado
83
días corridos de anticipación
(53 días hábiles)                 ← solo en los PDF

●─────────────────────○
aviso       vencimiento

mediana de 32 ciclos
con tan pocos casos, es orientativo   ← si corresponde
DDPC
```

- **El número** tiene la letra y el lugar de la cifra de los otros cajones, y sigue el selector en la página: «53» y «días hábiles de anticipación».
- **«De anticipación»** lo manda el servidor: `anticipacion_texto` del tramo `aviso`, `${unidad} de anticipación` («1 día hábil de anticipación»). Con «En el día», sin cifra o en otro tramo, no está. Se guarda en la foto con el resto de la vista, y `VERSION_DE_LA_FOTO` sigue en 1 porque es una clave más.
- **La línea** es un dibujo fijo, no una escala: no mide los días. Empieza con un punto lleno y termina en un aro chico, en el color de la etapa.
- **«Aviso» y «vencimiento»** van debajo de cada punta. En la página, el lector de pantalla las lee; la línea, no.
- **«Del aviso al vencimiento» no va,** porque ahora lo dice el dibujo.
- **El color no cambia:** azul, del RPAD.
- **Sin cifra,** el cajón es como hoy, sin línea.
- **«La cinta» de la página no cambia.**

**En la página:** `htmlDeFlecha` y `reportes.html`, con la línea como borde para que se vea con `forced-colors`. Hasta 960 píxeles, en una columna, igual.

**En el PDF:** `etapaDe` dibuja este cuerpo cuando el tramo trae `anticipacion_texto`. Se mide antes de dibujarse, como lo demás, y los textos pasan por `pieza`. La línea va con `moveTo` y `lineTo`, nunca con un `rect` chico. Lo que `tests/pdf-diagramacion.js` no admita se resuelve ahí, sin aflojar el test.

## 8. Lo que no cambia

- Las cifras, salvo el ciclo de la sección 3.
- La página, salvo el cajón y «de ciclos abiertos». Lo grande sigue lo elegido.
- `GET /api/metricas`, salvo los textos de la sección 4 y `anticipacion_texto`.
- Los otros PDF, ni un byte salvo la fecha: Estado general, Por área, Avisos, Agenda, Datos para completar, el Seguimiento y los anexos. «Datos para completar» no usa `notasPendientes`.
- La cantidad de hojas de los PDF con los datos de hoy.

## 9. Pruebas

- **El aviso:** un email anterior a la fecha de la regla no es el aviso; uno en la fecha, sí; sin uno nuevo, no hay aviso de la regla; lo mismo con una Nota Digital. Las reiteraciones y el aviso que se muestra salen del nuevo. Un email fallido anterior no da el motivo.
- **«De ciclos abiertos»:** 0, 1 y varias, en la tarjeta, el vacío y el Ciclo de vida.
- **`textoDeHabiles` y `textoEnCursoDeLosDos`:** cada fila de las tablas.
- **La hoja 1:** con los dos selectores da lo mismo; el orden cifra, hábiles y estadístico; los hábiles pegados y el espacio después; la solapa y la píldora; sin las vistas, lo de hoy sin paréntesis; con «Promedio», el promedio.
- **El cajón:** el orden; sin «Del aviso al vencimiento»; con «En el día» o sin cifra, sin línea; en la página, los textos escapados y ningún cálculo en el navegador.
- **El Ciclo de vida:** lo grande en corridos en la mediana, el promedio, los extremos y el circuito chico; el rótulo; «Año anterior» y «Cómo se cuenta»; la paridad con `vistaDe`; los extremos, elegidos por hábiles.
- **La foto:** `datosDeLaFoto` guarda lo nuevo; el Informe arma los dos en curso desde ella.
- **Nada se pisa ni se sale** (`verificarDiagramacion`) en las cuatro combinaciones, en vivo y con foto, con lo más largo de cada campo.
- **`REFERENCIA_DE_LOS_PDF`** se vuelve a tomar, comprobando con el diff de texto que cambió solo esto.
- **Sobre el dump, fuera del repo, contra `3a55679`:** lo que manda `metricasDe` y los PDF, con cada diferencia explicada: el ciclo reprogramado, los textos y el dibujo. Los otros PDF, idénticos por hoja. La vista: Firefox y el panel a 1320, 1120 y 961 píxeles y en el teléfono, con alto contraste y los PDF mirados como imágenes.

## 10. Despliegue

Sin SQL, sin Tarea Cron y sin variables nuevas, con Restart. Tiene que estar en producción antes del 10/01/2027, fuera del horario de los crons.
`reportes.js` sube su `?v=` y `VERSION_REPORTES`; `VERSION_FERIADOS` sigue siendo mayor.
El kit va contra `3a55679`, y su comprobación previa mira `reportes.js?v=20261210`, `seguimiento.js?v=20261133` y `notas.js?v=20261205`.
Los documentos: `docs/temas/metricas-y-reportes.md` y `docs/temas/ciclo-de-vida.md`.

## Antiobjetivos

- Una marca o una palabra que se lea como un reproche o un control.
- Que la línea parezca una escala con los días.
- Que la página calcule algo.
- Nombres neutros: nunca «tardanza», «demora» ni «atraso».
