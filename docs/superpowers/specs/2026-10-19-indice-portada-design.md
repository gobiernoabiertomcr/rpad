# Índice de la portada: "Al día" y el texto en orden

Fecha: 19/10/2026. Mockups: `2026-10-19-indice-portada-mockups/` (`indice.html`, con los estilos reales, e `indice-escritorio.png`).

## Por qué

En la portada, el texto del índice decía "están al día: 54 de 67", pero el cuadro de al lado mostraba "Actualizados 52" y "Próximos a vencer 2" por separado: el número del texto no aparecía en el cuadro. Además, el texto arrancaba por el porcentaje, con "con fecha de actualización" (los eventuales también tienen fechas) y "Los otros 14" sin decir de qué. La idea del usuario: que el cuadro muestre lo mismo que el texto y que el texto se entienda, en el orden registro → eventuales → índice.

## Qué se decidió (el usuario eligió entre mockups)

- **Grupo "Al día"** (actualizados + próximos), con su cantidad, igual que el texto y el reporte de Cumplimiento. No "Actualizados 54": en el resto del sitio "Actualizados" son solo los `actualizado` (el botón del listado de Datasets dice 52; los PDF también), y el nombre se repetía en la leyenda.
- **Leyenda con cantidades** debajo de Al día ("Actualizados 52", "Próximos a vencer 2") y de Vencidos, en plural ("Atrasados (gestión interna) 3", "Sin respuesta del área (gestión externa) 10"). Sale aunque una categoría tenga 0.
- **Orden por categoría** dentro de cada grupo, en el orden de la leyenda (verdes y después amarillos; rojos y después violetas), y cada una por título: así las cantidades de la leyenda se ven en el cuadro. Antes, Vencidos mezclaba los dos colores por título.
- **Texto en dos párrafos**, primero la aclaración y después la frase (en grande, con la tasa resaltada):
  - "El registro sigue 81 conjuntos de datos. De ellos, 14 tienen frecuencia de actualización eventual: se publican cuando hay novedades y no tienen vencimiento."
  - "Los otros 67 tienen fecha de vencimiento, y el **81%** está al día: 54 de 67."

## Casos que no se ven hoy (decisiones de implementación)

- Un eventual: "De ellos, 1 tiene … se publica … no tiene vencimiento."; sin eventuales, la aclaración termina en "… conjuntos de datos." y la frase empieza "Todos tienen fecha de vencimiento, y …".
- Uno solo con vencimiento: "El otro tiene …" (o "Tiene …" si no hay eventuales).
- Sin fecha: cuentan en la base sin tener fecha (`tasaDeActualizacion`), así que la frase dice "Los otros 68 deberían tener fecha de vencimiento (2 todavía no la tienen), y el 78% …". La aclaración ya no los nombra. En el cuadro siguen en su grupo, "Sin fecha", al final y solo si hay.
- Sin ninguno con vencimiento (todo eventual): no hay frase (el párrafo vacío no se dibuja).

## Alcance

- Solo `public/index.html` (el orden de los dos párrafos y la versión de `dashboard.js`) y `public/js/dashboard.js` (`textoIndice`, `gruposDelMosaico`, `htmlDeLaLeyendaDelGrupo`, `htmlDelMosaico`). `dashboard.js` tiene su propia versión en `tests/paginas.test.js` (`VERSION_PORTADA`), para no tocar las otras páginas públicas.
- Sin cambios en la API, la base ni las hojas de estilo: los márgenes actuales sirven con el orden nuevo, y la leyenda de Al día usa la clase de siempre, `.leyenda-vencidos`.
- El resto del sitio no cambia: el listado, el calendario y los reportes siguen diciendo "Actualizados" para los `actualizado`. El pie del mosaico y el `aria-label` de cada cuadrito siguen con el estado largo de cada uno.
- Tests en `tests/publico-frontend.test.js` (textos, grupos, orden, leyendas, el orden de los párrafos en `index.html`) y `tests/paginas.test.js` (la versión).
