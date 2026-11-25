# Mi espacio: la nota de licencia nombra a quien se encarga de las tareas

Fecha: 25/11/2026. Decisiones del usuario del 25/11/2026. **Estado: aprobado por el usuario el 25/11/2026.**
La investigación se hizo con el dump de producción del 25/11/2026 (14:26), en una copia fuera del repo; los ejemplos de acá son inventados.
Reemplaza la decisión 10 de `2026-10-27-mi-espacio-licencia-word-design.md` («En las vacaciones del firmante, la nota no nombra a la persona a cargo de las Notas Digitales»).

## 1. Por qué

Cuando el firmante titular carga unas vacaciones desde Mi espacio y elige «Autorizo a presentar las notas en mi nombre a:», la persona queda guardada en Configuración (`usuarios_licencias.autorizado_id`) y las Notas Digitales la nombran bien:
la víspera, el párrafo de la autorización; durante la licencia, la leyenda «Nota presentada por …, en nombre de …».
Pero la nota en papel de la licencia (el Word de Mi espacio) no la nombra: la decisión 10 de la spec del 27/10 lo dejó afuera y nunca lee esa persona.

El usuario quiere que la nota en papel diga quién se encarga de las tareas mientras no está.
Ni un contratado ni la planta transitoria pueden «quedar a cargo» de una Dirección: la frase no dice que la persona queda a cargo (el «a mi cargo» del final es del titular).

## 2. Lo que decidió el usuario

1. Un párrafo aparte, después del pedido y antes de «Sin otro particular, saludo a Ud. atentamente.»:
   «Asimismo, con el objetivo de mantener el correcto flujo de trabajo, durante mi licencia {nombre}, {cargo}, se encargará de las tareas de la Dirección a mi cargo.»
2. Sale cuando la licencia tiene esa persona en Configuración.

## 3. La regla

- **Cuándo:** la licencia de Mi espacio está enlazada a una de Configuración (`mi_espacio_licencias.licencia_oficial_id`), de la misma persona y sin anular, y esa tiene `autorizado_id`.
  No mira el tipo ni el estado del paso: en Mi espacio solo las vacaciones y los días restituidos del titular la llevan, y en Configuración el titular puede ponerla en cualquiera de sus licencias.
  Tampoco mira si la de Configuración todavía cubre las fechas (una unida que después se acortó, o una corrección que Configuración rechazó): la nota dice lo que está cargado.
  Sin esa persona (nadie, la de Configuración anulada o sin enlazar), la nota sale como hoy.
- **El texto** (el «se encargará» es neutro: el sistema no sabe el género de nadie):
  - `{nombre}`: `usuarios.nombre_completo` de la persona (como la firma de la nota, que también sale de `usuarios`);
  - `{cargo}`: `usuarios.cargo`; en un contratado (`vinculo = 'contrato'`), «personal contratado, cumpliendo funciones de {cargo}» (`cargoEnTexto` de `notasDigitalesContenido.js`, como en las Notas Digitales);
  - sin cargo (también un contratado sin cargo), sin la coma ni el cargo: «… durante mi licencia {nombre} se encargará de las tareas de la Dirección a mi cargo.».
  Ejemplos inventados:
  «Asimismo, con el objetivo de mantener el correcto flujo de trabajo, durante mi licencia Lucía Fernández, personal contratado, cumpliendo funciones de Analista de Datos, se encargará de las tareas de la Dirección a mi cargo.»;
  «… durante mi licencia Tomás Ibáñez, Coordinador de Sistemas, se encargará de …».
- **Dónde:** en la hoja y en el Word, el párrafo va después del cuerpo y su renglón vacío, justificado y con la sangría del primer renglón (como el cuerpo), seguido de un renglón vacío y el cierre.
  La vista del segundo paso y el Word salen de la misma estructura: no pueden decir cosas distintas.
- **La fecha de la nota:** sigue siendo el día de la última vez que se guardó la licencia, y cuenta también el cambio de la persona: el día más nuevo entre `mi_espacio_licencias.updated_at` (como hoy) y `usuarios_licencias.autorizado_at` (DATETIME en hora argentina: se toma su día tal cual).
  Corregir solo la persona no mueve `updated_at` (el `UPDATE` de Mi espacio escribe los mismos valores), y sin esto la nota saldría con la persona nueva y la fecha vieja.
  Límite sabido: quitar la persona deja `autorizado_at` en NULL, y la nota (ya sin el párrafo) vuelve a la fecha del último guardado de Mi espacio.
- **Lo que no cambia:** las Notas Digitales, la carga, Configuración, la página (`htmlDeLaNota` arma la hoja en el servidor), la nota de un pedido de restitución (la B: no es una licencia) y el nombre del archivo.

## 4. El código

- `services/miEspacioDatos.js`, `datosDeLaNota`: en la misma consulta, `LEFT JOIN usuarios_licencias` (por `licencia_oficial_id`, la misma persona y `anulada = 0`) y `LEFT JOIN usuarios` de la persona a cargo.
  Devuelve además `encargo` = `{ nombre, cargo, vinculo }` o null, y `guardada` pasa a ser el día más nuevo de los dos.
- `services/miEspacioNota.js`:
  - `notaDeLicencia` recibe la opción `encargo` (opcional): `{ nombre, cargo, vinculo }`; sin ella, con null o con algo que no sirve (no es un objeto, o sin nombre), no hay párrafo, y la nota sale igual (nunca da error por esto).
  - La estructura suma la clave `encargo`: el texto del párrafo o null. `notaDeRestitucion` la da siempre null.
  - `htmlDeLaNota` dibuja el párrafo si `encargo` es un texto no vacío (con las clases `sangria justificado`).
- `services/miEspacioNotaWord.js`, `parrafosDe`: lo mismo en el Word.
- `controllers/miEspacioController.js`, `leerLaNota`: le pasa `encargo` a `notaDeLicencia`.
- Sin SQL, sin cambios en la página ni en sus versiones.

## 5. Tests

- `tests/mi-espacio-nota.test.js`: el párrafo de planta, de un contratado, sin cargo y de un contratado sin cargo; sin `encargo`, con null y con uno que no sirve, sin párrafo; `encargo` en la estructura (las claves exactas suman `encargo`); la hoja con el párrafo en su lugar y escapado; la nota B con `encargo` null.
- `tests/mi-espacio-nota-word.test.js`: el Word con el párrafo entre el cuerpo y el cierre, justificado y con sangría; las comparaciones con los Word de las maquetas siguen iguales (sin persona, no hay párrafo).
- `tests/mi-espacio-api.test.js`: unas vacaciones del titular con persona a cargo dan el párrafo en `…/nota` y en `…/word`; sin persona o con la de Configuración anulada, no; la fecha se mueve al día del cambio de la persona (un cambio a las 22:30 o a la 01:30 da ese día; corregir solo la persona desde Mi espacio da hoy) y no vuelve atrás si la licencia se corrigió después.
- `npm test` completo antes y después.

## 6. Despliegue

Sin SQL ni Tarea Cron: subir `services/miEspacioDatos.js`, `services/miEspacioNota.js`, `services/miEspacioNotaWord.js` y `controllers/miEspacioController.js`, y Restart.

## Decisiones mías (para revisar)

- El nombre y el cargo salen de `usuarios` (como la firma de la nota y los formularios), no de la firma de Mi Perfil (`usuarios_firmas`) como en las Notas Digitales.
- La persona se nombra aunque ya no sirva para las Notas Digitales (desactivada, sin firma o de licencia): la nota dice lo que está cargado, y el Estado de Correos ya avisa ese caso.
- La fecha cuenta el cambio de la persona (sección 3), con el límite de quitarla.
- «durante mi licencia» también en los días restituidos: son vacaciones.
