# El dato de la quincena: el detalle de una edición en tres pestañas

Fecha: 18/11/2026. Base: main 8c8f313 (en producción, con la v1.4).
Lo pidió el usuario después de ver los pilotos 19 y 20 con la sección nueva; eligió la dirección A «Diario» de las maquetas.

## Por qué

- El detalle de una edición (`dato-quincena.html?id=N`) es hoy una sola página muy larga: con el piloto 20, a 1024 px, mide unos 7600 px (agenda, cuatro propuestas y tres datasets nuevos, uno debajo del otro).
- Cuesta ver lo importante (la principal, su cifra, lo que hay que validar) y se ve plana: todo tiene el mismo peso.
- La usan el equipo, que elige una propuesta, la valida y copia sus textos, y el director, que mira la principal y los datasets nuevos para decidir.
- El usuario la quiere en producción antes del martes 24/11: ese día el botón «Ver la edición en el RPAD» del primer mail real lleva a esta página.

## Objetivos, no objetivos y anti-objetivos

- Objetivo: el detalle en tres pestañas, **General**, **Propuestas** y **Datasets nuevos**, con el diseño de la maqueta A aprobada.
- Objetivo: una dirección que abre la pestaña y la propuesta que se mira (`?id=N&vista=propuestas&propuesta=3`), para mandar un enlace.
- No objetivo: el mail, la lista de ediciones, la pestaña Correo de administración, Mi espacio, el POST y el recibo. No cambian.
- No objetivo: editar una edición, ni guardar la última pestaña vista.
- Anti-objetivo: tocar el mail del 24/11. El mail de una edición sin `propuestas_datasets` sigue igual byte por byte (`tests/dato-quincena-resguardo.test.js`, la parte del mail).
- Anti-objetivo: que el navegador recalcule una regla. Lo que sale de una regla (la prioridad, la matriz, los plurales) lo manda el servidor.

## Enfoques

- Elegido: A «Diario» (decisión del usuario), con las tres pestañas dibujadas juntas al cargar el detalle y la elegida a la vista (las otras con `hidden`). Cambiar de pestaña no pide nada al servidor ni vuelve a cargar la infografía.
- Descartado: B «Fichas» (propuestas plegadas una debajo de otra, datasets en filas, sin matriz): el usuario eligió A en las tres preguntas.
- Descartado: dibujar cada pestaña al elegirla. Obliga a volver a cargar la infografía y a recordar el estado de los «Copiar».
- Descartado: copiar en el navegador la tabla de prioridad para la matriz. «Una sola fuente por regla»: la matriz la manda el servidor.

## Referencia visual

La maqueta aprobada es la referencia del diseño, no código para copiar: `~/rpad-notas/dato-quincena-detalle-pestanas/web/` (fuera del repo), dirección A (`dir=A`), con las funciones `…A` de `js/pestanas-maqueta.js` y las reglas de `css/pestanas.css` que no son de B.
Se abre con su servidor estático (LEEME de esa carpeta). Usa los pilotos 19 y 20 reales: nada de eso entra al repo.

## 1. La dirección

- `?id=N` sigue abriendo el detalle, en **General**.
- `&vista=` elige la pestaña: `general`, `propuestas` o `datasets`. Otro valor, o `datasets` en una edición sin la clave, abre General y la dirección se corrige.
- `&propuesta=K` (con `vista=propuestas`) elige la propuesta de `orden` K. Sin él, o con un K que no existe, la principal (la primera, si ninguna lo es).
- Cambiar de pestaña o de propuesta reemplaza la dirección (`history.replaceState`): Atrás no recorre las pestañas, como hoy con Ediciones y Correo.
- El `#correo` de administración sigue igual. Pasar a Correo y volver a Ediciones vuelve a la misma edición, pestaña y propuesta (`urlDeEstado` y `estadoDeLaUrl` suman `vista` y `propuesta`).
- Los valores se leen con el mismo cuidado que `id`: enteros positivos sin ceros adelante y textos de una lista cerrada.

## 2. La cabecera de la edición y las pestañas

- Arriba, «Todas las ediciones», como hoy.
- La cabecera con la identidad «tipo diario» de la lista: «El dato de la quincena» y el N.º o la marca de piloto en una línea, la fecha grande en Bricolage, el título del paquete en chico y la doble línea (`4px double var(--sg-tinta)`).
- Pegadas a la doble línea, las pestañas como secciones de un diario: «General», «Propuestas» con su cantidad y «Datasets nuevos» con su cantidad; la elegida con una barra gruesa de tinta debajo.
  Se distinguen a simple vista de las pestañas de página de administración («Ediciones» y «Correo»), que quedan arriba como hoy.
- Accesibles: `role="tablist"`, cada una `role="tab"` con `aria-selected` y `aria-controls`, cada panel `role="tabpanel"` con `aria-labelledby`; flechas, Inicio y Fin; foco visible; la del medio no se salta.
- «Datasets nuevos» no aparece si el detalle trae `propuestas_datasets: null`. Con `[]` aparece, con su cantidad en cero, y su panel dice «Esta quincena no hay propuestas de datasets.».
- En el teléfono, las tres pestañas entran en un renglón.

## 3. General

- Dos columnas: a la izquierda, la infografía grande con su pie («La infografía de la propuesta principal.»), cargada desde `blob:` como hoy; a la derecha, «La principal»: sus etiquetas, su título, su cifra clave grande, su dataset (con los enlaces de hoy) y un botón con el texto del servidor (`ver_propuestas`, sección 6) que pasa a Propuestas en la principal.
- Debajo, la nota de Datito (con raya a la izquierda) y la línea del recibo y del correo, como hoy.
- A lo ancho, la agenda en tres columnas (Lo que pasó · Lo que viene · Efemérides), como líneas de tiempo cortas; un grupo sin eventos no va; sin agenda, nada.
- Después, «Archivos» en una fila de ítems (tipo, tamaño, «Ver» y «Descargar»), con los mismos datos y botones de hoy.
- Si la edición trae datasets nuevos (una lista no vacía), un aviso corto con botón a esa pestaña.
- Administración: la caja «Correo» al final de General, con su comportamiento de hoy.
- En el teléfono: primero la principal y su cifra, después la infografía.

## 4. Propuestas

- Un índice fijo a la izquierda (~280 px): cada propuesta con su número, su título en dos renglones, la marca de principal y la de «Para validar».
  La elegida se marca con algo más que el color; elegir una la muestra, mueve el foco a su título y reemplaza la dirección.
- A la derecha, una propuesta por vez:
  - arriba, el número, las etiquetas, el título grande y la cifra clave destacada;
  - el dataset y la foto del RPAD en una tira; la repetición, si hay; «Para validar antes de publicar», bien visible;
  - en dos columnas, «Por qué hoy», «Ángulo» y «Puntos centrales» | «Texto para redes» como tarjeta de publicación, con su «Copiar»;
  - a lo ancho, el «Borrador de nota» como artículo (ancho de lectura ~68ch), con su «Copiar»; «Idea de placa»;
  - plegados (`<details>`): «Cálculo», «Contexto histórico» y «Fuentes»;
  - al pie, «Copiar la propuesta» y anterior/siguiente.
- En el teléfono, el índice pasa a una fila de chips con desplazamiento horizontal.
- Todos los «Copiar» funcionan como hoy (`data-copiar`, el anuncio en `#dq-anuncio`).

## 5. Datasets nuevos

- Arriba, la matriz valor × riesgo de la guía, como en la maqueta: riesgo en filas (Alto, Medio, Bajo), valor en columnas (Bajo, Medio, Alto), las celdas teñidas por zona («Prioridad alta» verde, «Publicar si hay recursos» azul, «Evaluar riesgos» ámbar y «No se propone» rojo y rayada), y cada dataset como un marcador con su número en su celda.
  Es una tabla real (con encabezados de fila y de columna); el rótulo de cada zona se ve en una celda y en las otras va como texto oculto.
- Al lado (debajo en el teléfono), la lista en texto: número, título, la prioridad y «Valor alto · Riesgo bajo»; tocar uno lleva a su tarjeta.
- Debajo, las tarjetas de cada dataset, con el contenido de hoy y más jerarquía.
- Con `[]`: solo la línea «Esta quincena no hay propuestas de datasets.».

## 6. Lo que suma el servidor al detalle (`services/datoQuincenaReglas.js`)

- En cada propuesta, `orden` (el número, el mismo del JSON): la dirección y el índice lo usan. `modeloDelMail` lo deja afuera del modelo, como `orden_texto` (`FUERA_DEL_MAIL`): el modelo de las propuestas no cambia.
- En cada elemento de `propuestas_datasets`, `numero` (el del JSON) y `valor` y `riesgo`, tal como llegaron (`Alto`, `Medio`, `Bajo`), para el marcador y su celda de la matriz.
- `matriz_de_prioridad`: `null` si `propuestas_datasets` es `null`; si no, las 9 celdas en el orden de la matriz (riesgo Alto, Medio, Bajo; valor Bajo, Medio, Alto), cada una `{ valor, riesgo, clave, texto, con_rotulo }`, de `prioridadDeDataset`, y la de valor Bajo con riesgo Alto con `clave: 'no_se_propone'` y `texto: 'No se propone'`.
  `con_rotulo` es `true` en una sola celda por zona, las de la maqueta aprobada: «No se propone» en riesgo Alto con valor Bajo; «Evaluar riesgos» en riesgo Alto con valor Alto; «Publicar si hay recursos» en riesgo Medio con valor Bajo; «Prioridad alta» en riesgo Bajo con valor Alto. En las demás va el texto oculto.
- `cantidades`: `{ propuestas, datasets_nuevos }`, los números de las pestañas; `datasets_nuevos` es `null` sin la clave.
- `ver_propuestas`: «Ver las N propuestas», o «Ver la propuesta» con una sola.
- `aviso_datasets_nuevos`: «Datito propone 1 dataset nuevo para abrir.» o «Datito propone N datasets nuevos para abrir.» (con `NOMBRE_DEL_BOT`), y `null` sin la clave o con `[]`; el botón del aviso dice «Ver los datasets nuevos» (o «Ver el dataset nuevo» con uno, en `ver_datasets_nuevos`).
- Nada de esto cambia el mail: `modeloDelMail` elige sus claves una por una; `numero`, `valor` y `riesgo` viajan en cada dataset nuevo del modelo y la plantilla no los dibuja. El resguardo del mail lo controla.
- Si la página recibe un detalle sin estas claves (durante el despliegue, o con una vuelta atrás del servidor), no se rompe: sin `cantidades`, las pestañas van sin número; sin `matriz_de_prioridad`, no hay matriz; sin `orden`, la posición.

## 7. Calidad

- Todo texto del servidor pasa por `esc` (también en atributos); un número va con `String`; enlaces solo `https://`; clases e íconos desde mapas con `Object.hasOwn`.
- Contraste de 4,5:1 o más; el color nunca es lo único que distingue; con `prefers-reduced-motion`, nada se mueve; nada con `ad-`.
- Sin scroll horizontal de 360 px en adelante.
- Los scripts siguen la regla de la página: al cargarse solo declaran y enganchan `DOMContentLoaded`; lo que arma HTML es puro y se prueba en el `vm`; los eventos, delegados en contenedores fijos.
- Sube `dato-quincena.js?v=` a `20261235` y `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.

## 8. Tests

- Página (vm): la dirección (`estadoDeLaUrl` y `urlDeEstado` con `vista` y `propuesta`, los valores que no sirven, `#correo`); las pestañas (cuáles hay según `null`, `[]` y lista; la elegida; los `aria-*`); General (la principal, la infografía, la agenda en grupos, los archivos, la caja del correo solo en administración); Propuestas (el índice, la elegida por dirección, anterior/siguiente, los «Copiar»); Datasets nuevos (la matriz con cada marcador en su celda, la lista, las tarjetas, la línea con `[]`); el escapado de todo texto del servidor; las teclas.
- Servidor: `valor`, `riesgo`, `matriz_de_prioridad` (las 9 celdas, en su orden) y `ver_propuestas` (1 y varias); `null` sin la clave.
- `tests/fixtures/dato-quincena-respuestas.json`: las respuestas del detalle suman las claves nuevas.
- El resguardo (`tests/dato-quincena-resguardo.test.js`): la parte del mail no cambia. La de la página deja de servir, porque la página cambia a propósito: se reemplaza por los tests de arriba y su fixture pierde la parte de la página (`pagina`). El mail sigue sin regenerarse.
- La suite completa en verde.

## 9. Documentos

- `docs/temas/dato-quincena.md`: la página (pestañas, dirección, cada panel) y las claves nuevas del detalle; lo vigente, un renglón por oración, renglones de hasta 600 bytes y el documento debajo de 60 KB (hoy, ~50 KB).

## 10. Despliegue

- Un kit sin SQL, con Restart (cambia el servidor), contra 8c8f313: `public/dato-quincena.html`, `public/js/dato-quincena.js`, `services/datoQuincenaReglas.js` y `services/datoQuincenaCorreoReglas.js` (cambió `FUERA_DEL_MAIL`), con su vuelta atrás: los cuatro de 8c8f313.
- `PASOS.txt` empieza comprobando `dato-quincena.js?v=20261234` y deja `20261235`.
- Antes del martes 24/11: lejos de las 8:05, las 14:00, los :00 y los :30, y de las rutinas de Datito (el lunes 23/11 desde las 6:30 llega la edición del 23/11).
- Después: mirar la edición del 09/11, un piloto con datasets nuevos (19 o 20) y uno viejo sin la clave, en las tres pestañas, en la computadora y en el teléfono.

## Decisiones de la sesión

- El servidor manda los números (`orden`, `numero`), las cantidades de las pestañas, `valor`, `riesgo`, la matriz con la celda de cada rótulo y los textos con plural: la maqueta los sacaba de la posición, del texto y de una copia de la tabla.
- El rótulo de cada zona va en la misma celda que en la maqueta aprobada; lo marca el servidor (`con_rotulo`).
- Cambiar de pestaña o de propuesta reemplaza la dirección y no suma al historial.
- La parte de la página del resguardo se retira a propósito (la página cambia); la del mail queda.
- La propuesta que se abre por defecto es la principal.
