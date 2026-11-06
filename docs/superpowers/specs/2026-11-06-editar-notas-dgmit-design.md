# Editar notas DGMIT, la regla del ciclo y «Entregada»

Aprobado por el usuario el 06/11/2026, mirando la maqueta sobre la copia de la base y probando la carga de notas.
Los números de esta spec son inventados.

## Por qué

Para corregir una nota hay que saber en qué dataset está, abrirlo y buscarla en los movimientos: una nota que pide varios datasets no se ve entera en ningún lado.
Al cargar las notas viejas hace falta ver a qué ciclo fue cada una, sin entrar dataset por dataset.
La foto de 2026 se saca el 10/01/2027 con textos ya armados: todo esto tiene que estar en producción antes.

## 1. El botón y el modal

- «Editar notas DGMIT», con borde, al lado de «Cargar nota DGMIT», en la lista y en un dataset.
- Lo ven quienes cargan notas (`Auth.puedeCargarNotasDgmit`): administración y el colaborador; el lector no.
- El modal mide lo mismo que el de la carga: 720 de ancho y 90vh de alto, y el formulario pasa a tener ese alto fijo, para que no salte al pasar de uno a otro.
- Buscador por número, dataset o área, sin tildes ni mayúsculas; filtros Vigentes (el inicial), Anuladas y Todas, con su cantidad.
- Orden por número de nota, de la más nueva a la más vieja: el año y después el número de `N/AA`. Un número que no termina así va al final. Lo ordena el servidor.
- Paginación de a 10 (`NOTAS_POR_PAGINA`), en el pie: Anterior, «Página 1 de 2», «Mostrando 1–10 de 37» y Siguiente; con una sola página, nada, como en el resto del sitio. Buscar o cambiar de filtro vuelve a la primera.
- Cada nota: un recuadro con «Nota DGMIT N°», el número grande y el tipo; a la derecha «Entregada el …», sus datasets con su ciclo, quién la cargó y cuándo, cuántas veces se corrigió, «Corregir» y «Anular». Con más de 3 datasets, se ven 2 y «Ver los N datasets».
- «Corregir» cambia al formulario de siempre, con «Volver a la lista»; cerrar o guardar vuelve a la lista. «Anular» abre el modal de siempre encima.
- El colaborador ve todas las notas y solo tiene los botones en las que cargó (`editable`, la regla de siempre). El resto de los datos ya los ve en el Seguimiento.

## 2. El ciclo de cada dataset en la lista

Lo arma el servidor con `notasDgmitPorCiclo`, la regla del Seguimiento y de Métricas; el navegador no calcula nada:

- «Ciclo abierto · venció el 31/03/2031» o «Ciclo abierto · vence el 28/02/2032».
- «Venció el 31/03/2031 · actualizado el 17/04/2031», «… reprogramado el …» o «… dado de baja el …». Sin vencimiento conocido, «Actualizado el 23/12/2030».
- «No cuenta en ningún ciclo: ya la respondió la carga del 14/08/2030» o «… es posterior a la baja del dataset».
- «Sin ciclos: este dataset no tiene vencimiento» (eventual o sin fecha). Una anulada no lleva ciclo.

`GET /api/notas-dgmit` (`authMiddleware` + `cargaNotasDgmit`) lee con `fuentesDe(null, { notasEstrictas: true })`: si fallan las notas, responde 500 y no «no hay notas». Se pide al abrir el modal, nunca al iniciar la página.

## 3. Una nota anterior al primer ciclo (el hallazgo R1)

Con 2 o más ciclos, una nota anterior al primer ciclo caía siempre en el ciclo 0, aunque ya la hubiera respondido una carga vieja, e inflaba «Respuesta del área».
Ahora vale lo que ya valía con un solo ciclo (R7): no es de ningún ciclo si es anterior a la carga que el dataset tenía al empezar el primero (`ultima_actualizacion` en `datos_anteriores` del primer cambio aprobado).
No se descarta toda nota anterior al alta: si el vencimiento es anterior al alta, una nota posterior a esa carga sí es de ese ciclo.
Si la carga no se conoce (el primer ciclo lo cerró una actualización simple de diciembre de 2025), sigue en el ciclo 0, que no tiene vencimiento y no suma en ningún tramo.
Una nota posterior a la baja, con 2 o más ciclos, tampoco es de ninguno: caía en el más viejo. Con un solo ciclo sigue R7.
La nota sigue en los movimientos y en la cinta. `cicloDelAviso` no cambia.

## 4. La regla del ciclo

En cada ciclo de un dataset, la primera nota es la Solicitud y las que siguen son Reiteraciones.
Revierte la decisión de la spec 2026-10-24-notas-dgmit, donde la solicitud repetida solo se avisaba.

- Frena al guardar, en la carga y en la corrección: 409 en el campo `tipo`.
- Frena la anulación de una Solicitud que dejaría a una Reiteración sin solicitud: 409 en el campo `motivo`, y el mensaje pide anular antes las reiteraciones o corregir la nota.
- Con el mismo día, primero la Solicitud.
- Mira cada dataset de la nota, y también los que una corrección le saca. El mensaje nombra al primero que no cumple y cuántos más.
- Solo frena lo que el cambio empeora (`problemaDeLaSecuencia`, antes contra después): un ciclo que ya no cumplía no traba una corrección que no lo empeora. Así, corregir el número de una nota vieja nunca se frena.
- No alcanza a las notas que no son de ningún ciclo, ni a los eventuales y sin fecha, que no tienen ciclos.
- Una reprogramación ya vencida abre un ciclo nuevo: su primera nota es una Solicitud.
- Lo que ya no cumple siempre se puede corregir y anular, mientras no empeore: una nota de antes de la regla no queda trabada.
- Cargar en cualquier orden de fecha tiene salida, y el mensaje la dice: una Reiteración que llega antes que su Solicitud se carga después de ella.
- Para cargar una Solicitud anterior a la que ya está: se corrige la que está con los datos de la anterior y la otra se carga como reiteración. O se anula la que está: una anulada puede repetir el número.
- Una pestaña con la página anterior manda el mismo cuerpo y recibe el mismo 409 en `tipo` o en `motivo`: ya lleva esos errores a su campo.
- Una Reiteración cuya Solicitud es anterior al 01/01/2025, la fecha mínima, no se puede cargar como tal: se carga como Solicitud, la primera nota de ese ciclo en el sistema. El usuario lo aceptó al elegir que frene.
- Se bloquean las filas de `datasets` hasta el final de la transacción: dos cargas simultáneas no pasan las dos.
- La nota tiene un solo tipo aunque pida varios datasets (decisión del usuario): una nota que fuera la primera en un dataset y no en otro se frena.
- El formulario avisa antes en el ciclo abierto, sin frenar: una Solicitud cuando ya hay nota y una Reiteración cuando no hay ninguna. El servidor decide.

## 5. «Entregada»

La fecha de una nota DGMIT se dice «Entregada» en todo el sistema: formulario («Fecha de entrega»), Seguimiento, movimientos, circuito, Generador de Notas, reportes, PDF y anexos que se generen de ahora en adelante.
Lo ya enviado no cambia: queda en bytes.
La columna y el campo de la API siguen llamándose `recibida`: es un contrato y no se ve.
«Recibido el» no cambia: es otra cosa, el día en que llegaron los datos.

## Antiobjetivos

- Que algo se lea como un reproche o un control sobre la DGMIT.
- Calcular ciclos en el navegador.
- Un tipo de nota por dataset: toca la base, Métricas y el Generador.

## Plan

Primero el servidor (R1, la regla, el listado), después «Entregada», después el botón y el modal; tests de cada parte.
Antes de mergear: la suite, una revisión contra esta spec, y la comparación contra `a2d0f22` de las cifras y de los PDF, con cada diferencia explicada.
Sin SQL. El kit comprueba las versiones que hay en producción y no se despliega entre las 8:05 y las 14:00.
