# Métricas: «avisado ya vencido» también cuando se pudo avisar a tiempo

Fecha: 24/11/2026. Decisiones del usuario del 24/11/2026; el usuario aprobó este diseño el 24/11/2026.
La investigación se hizo con el dump de producción del 24/11/2026, fuera del repo; los ejemplos de acá son inventados.

## 1. Por qué

Una nota DGMIT cargada en el Seguimiento no contaba en «Redacción y entrega de nota» y desaparecía del modal del tramo.
Antes de cargarla, el ciclo figuraba como «pendiente de carga», con la promesa «cuenta cuando se carga».

La causa: el vencimiento del dataset se movió por fuera del RPAD, sin un cambio registrado.
Ejemplo inventado: un externo dado de alta el 01/12/2025 con la próxima en 31/08/2026; el RPAD manda el email de 40 días el 22/07/2026.
Después la próxima se corrige a 28/02/2026, para que el dataset cierre por año natural.
Desde ahí el RPAD lee que el ciclo venció el 28/02/2026, que su fecha de la regla (19/01/2026) era posterior al alta y al inicio del registro, y que el primer aviso llegó ya vencido.

Con la regla de la spec 2026-10-24-metricas-y-reportes (sección 1.2 y «Decisiones mías»), «avisado ya vencido» (`heredado`) era solo el ciclo que el RPAD no pudo avisar a tiempo.
Uno que se pudo avisar a tiempo y se avisó ya vencido quedaba sin desde cuándo contar (`inicioTramos` null): fuera de la redacción y de la producción, sin días y sin marca.

En los hechos, ese ciclo es uno que el RPAD no pudo avisar a tiempo: cuando correspondía el aviso, tenía otra fecha.
El código no lo puede saber, porque el cambio no quedó registrado.

## 2. Lo que decidió el usuario

1. Un ciclo avisado ya vencido cuenta desde su primer aviso, se haya podido avisar a tiempo o no.
2. Salvo que haya fallado un email de la regla de ese ciclo: ahí sigue lo decidido antes, «el email que falló pesa más que "ya vencido"».
   Desde el 12/10/2026 los avisos a la DGMIT son Notas Digitales, y una Nota Digital que no se envió no es un aviso: ese caso solo puede venir de antes.
3. No romper nada: ningún texto cambia, y ningún otro ciclo cambia sus números.

## 3. La regla

En `casoDelCiclo` (`services/metricasReglas.js`), un ciclo es `heredado` si:
- no tuvo el aviso de la regla (`avisoRegla` null);
- tuvo algún aviso y el primero llegó después del vencimiento (`primerAviso > venc`);
- y el RPAD no pudo avisarlo a tiempo (`!pudoAvisar`) **o** ningún email de la regla del ciclo falló.

«Falló un email de la regla» es lo mismo que mira `motivoSinAviso` para 'email-fallido': un aviso del ciclo con `enviado` false y de la regla (`deLaRegla`).

Lo demás sigue igual:
- `inicioTramos` = el primer aviso si es `heredado`; si no, el aviso de la regla o null.
- `pudo_avisar` y `motivo_sin_aviso` se calculan como antes: la cobertura del aviso sigue diciendo «se avisó ya vencido» para ese vencimiento, porque no tuvo el aviso de la regla.

## 4. Lo que cambia, solo para los ciclos de esta clase

Todo sale de `heredado` e `inicioTramos`, que ya manejan los avisados ya vencidos:
- la redacción y entrega de nota (externa) y la producción del relevamiento (interna) se cuentan desde el primer aviso;
- en el modal del tramo, la fila cuenta, con «avisado ya vencido: desde ese primer aviso»;
- «Cómo se cuenta» y las aclaraciones del circuito los suman a «N ciclos se avisaron ya vencidos…»;
- en el modal del aviso anticipado pasan de «no tuvieron el aviso de la regla» a «se avisaron cuando ya estaban vencidos» (los dos dicen «no cuenta en la anticipación»);
- «Los casos» dice «avisado ya vencido» debajo del aviso y los días desde el aviso debajo de la nota;
- las reiteraciones del RPAD se cuentan desde ese primer aviso;
- el Ciclo de vida del dato, igual que la vista.

Los PDF no tienen una copia de la regla: el de Métricas, «Datos para completar», el Ciclo de vida del dato y el Informe anual (por la foto) leen los mismos casos (`casosDe`).
Cambian solos, con los mismos textos.

## 5. Lo que no cambia

- Ningún texto: «(venció antes de que existiera el aviso)» sigue siendo cierto, porque el RPAD no intentó el aviso de la regla de ese vencimiento.
- Los ciclos que no son de esta clase: sus números, sus filas y sus textos.
- Los pendientes de carga y «Para completar».
- El Seguimiento.
- La forma de la foto: `VERSION_DE_LA_FOTO` sigue en 1.

## 6. Los caminos que se miraron

- **Este (elegido):** sumar la condición a `heredado`. Una sola regla, y todo lo que ya sabe de los avisados ya vencidos los incluye.
- **Todos los avisados ya vencidos, también con el email fallido:** más simple (se borra una condición), pero cambia una decisión más y deja falso «(venció antes de que existiera el aviso)» en ese caso.
- **Dejar la regla y mostrar la nota con «no cuenta»:** el usuario prefirió que cuente.
- **Detectar que el vencimiento se movió por fuera** (por un aviso de la regla de otra fecha): frágil; descartado.

## 7. Verificación

- Fuera del repo, con el dump de producción: un script corre main y la rama sobre la misma copia de la base y compara cada cifra (las dos gestiones, cada tramo, mediana y promedio, corridos y hábiles), las aclaraciones, las reiteraciones y la cobertura.
  Lista los ciclos cuya fecha de inicio de los tramos cambió, con la de antes y la de después.
- Los cuatro PDF de la pestaña Reportes, con la regla de antes y con la nueva, y el texto que cambia en cada hoja.
- En los tests, los esperados que cambian son los del caso de prueba de esta clase y lo que sale de él (huellas y `REFERENCIA_DE_LOS_PDF`), cada uno con su antes y después en la entrega.

## 8. Plazo

La foto del 31/12 se saca el 10/01: el cambio tiene que estar en producción antes, para que el Informe anual de 2026 lo lleve.
