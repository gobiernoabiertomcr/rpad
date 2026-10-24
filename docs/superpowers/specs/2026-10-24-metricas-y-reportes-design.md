# Métricas y Reportes

Fecha: 24/10/2026.

Mockups en `docs/superpowers/specs/2026-10-24-metricas-y-reportes-mockups/` (HTML estático; los números son de ejemplo y este documento manda sobre ellos):
- `0-circuito-variantes-a-y-b.html`: las dos maneras de mostrar el circuito que se compararon. El usuario eligió **mezclarlas** (el circuito de A arriba y la cinta de B abajo, sin el texto dentro de la banda).
- `1-metricas.html`: la pestaña Métricas completa, con la gestión externa elegida en el circuito.
- `2-circuito-interna.html`: el circuito con la gestión interna elegida.
- `3-reportes.html`: la pestaña Reportes, dos hojas de PDF con el diseño del anexo y la sección «Para completar».
- `4-metricas-datos-reales.html`, `5-circuito-interna-datos-reales.html` y `6-reportes-datos-reales.html`: las mismas tres maquetas con los números reales al 24/10/2026, calculados con las reglas de este documento por un script descartable. Las fuentes:
  - la base local del 20/10;
  - lo que trae el dump del 24/10: el Presupuesto actualizado el 21/10 y la Nota Digital 4/26;
  - el Excel de «Recibido el» del usuario, con 27 de 32 fechas. El Presupuesto del 19/10 salió de una fuente pública: lo confirmó el usuario. Se consultó el digesto municipal y el dataset se armó con lo publicado ahí, porque el área nunca contestó.
  
  Todavía no hay notas DGMIT. Estas maquetas muestran cómo se ve la página casi sin datos, y sirven de referencia para los tests: por ejemplo, 5 de 33 actualizados a tiempo, 34 de 35 vencimientos avisados y el índice de hoy en 82 %.

## Por qué

La página de Reportes (`public/reportes.html`) se pensó con el RPAD vacío. Ahora hay casi un año de registro. El usuario quiere dos cosas:

1. **Métricas** que pongan en valor el trabajo y ayuden a mejorar los procesos. Sirven para las cuatro cosas que él marcó: un informe a superiores, mejorar el trabajo de la DDPC, tener respaldo con datos cuando un dataset figura vencido y conversar con la DGMIT para ajustar el proceso juntos.
2. **Revisar los reportes PDF**: sacar los que no sirven, cambiar otros, sumar los que faltan y que todos tengan el aspecto de los anexos de las Notas Digitales.

La idea central de las métricas es el **circuito**. Cada ciclo de un dataset es una cadena de pasos, cada uno a cargo de alguien:
- La DDPC (el RPAD) avisa.
- En gestión externa, la DGMIT y la Dirección Administrativa (DA) le mandan la nota formal al área, el área entrega los datos y la DDPC los prepara y los carga.
- En gestión interna, la DGMIT y la Dirección de Investigación Territorial (DIT) hacen el relevamiento y la DDPC lo carga.

Se mide cuánto tarda cada paso, en días hábiles.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- `reportes.html` pasa a ser **Métricas y Reportes**, con dos pestañas: Métricas (la inicial) y Reportes.
- Métricas muestra:
  - el circuito de cada gestión, con la mediana de cada tramo, el promedio, la cantidad de casos y los casos en curso;
  - la lista de casos detrás de los números;
  - los resultados del año: actualizados a tiempo, cobertura del aviso y reiteraciones;
  - el contexto: el índice de actualización mes a mes y la antigüedad de los vencidos;
  - el trabajo del RPAD;
  - lo que hoy está en la pestaña Métricas de Gestión;
  - «Para completar».
- Se puede destildar un dataset raro (por ejemplo, Parque Automotor) para ver los números sin él, con una leyenda a la vista.
- El 31/12 de cada año queda una **foto** que no cambia, para comparar años.
- «Recibido el» pasa a ser obligatorio en «Registrar actualización» desde el despliegue, sin romper lo anterior. En gestión externa se suma el **origen de los datos**: los entregó el área, o Datos Públicos los obtuvo de una fuente pública. Los «Recibido el» y los orígenes viejos se cargan una vez con un Excel y un SQL, igual que las notas DGMIT de 2026.
- Hay siete reportes PDF, todos con el diseño del anexo:
  - Métricas del año, Informe anual, Estado general, Por área (portada + Seguimiento), Avisos del RPAD, Agenda de pedidos y Datos para completar.
  - El de Cumplimiento se saca.
  - El Historial de Notificaciones pasa a ser «Avisos del RPAD».

**No objetivos**
- Los feriados móviles (Carnaval, Semana Santa, los trasladables) **no se suman**: se cuentan como días laborales. Lo pidió el usuario: «Son pocos y no cambian la ecuación».
- No hay exclusión guardada de datasets: destildar es solo una vista.
- No cambia cuándo salen las notas, los avisos ni los recordatorios.
- No cambia el Seguimiento.
- No hay métricas en el sitio público.
- No hay desglose de los tiempos por área: el usuario no lo eligió. El ranking de áreas de Gestión sí se muda, tal cual.

**Antiobjetivos** (aunque funcione, sería un fracaso)
- Que algo se lea como un reproche o un control sobre la DGMIT.
  - Sin nota DGMIT cargada, el tramo dice «pendiente de carga», nunca que la DGMIT no la mandó, y no cuenta días.
  - Mientras no haya ninguna nota DGMIT cargada, el tramo dice «Todavía no hay notas DGMIT cargadas» en lugar de una cifra.
- Que un caso que nunca termina (Parque Automotor) desaparezca de la página y deje un promedio que se ve mejor de lo que es. Los casos en curso se muestran siempre al lado.
- Que un número calculado sin algunos datasets se tome por el completo.
- Que el índice de actualización diga una cosa en la portada, otra en el Estado general y otra en Métricas.
- Que el navegador recalcule reglas: el servidor calcula y la página dibuja, como en el Seguimiento.
- Que el cambio de «Recibido el» rompa algo hecho antes, por ejemplo que un cambio pendiente sin ese dato no se pueda aprobar.
- Que se modifiquen registros viejos para meterles «Recibido el», como reescribir el JSON de `cambios_pendientes`.
- Que salga un email real durante las pruebas, o que una prueba llame a `/api/cron/*`.
- Que un archivo versionado lleve nombres de personas (los mockups usan «Usuario Ejemplo»).

## Dependencia y orden

- **Todo va junto** (lo decidió el usuario): una rama (`feat/metricas-y-reportes`), un despliegue. La implementación **empieza cuando `feat/nota-dgmit` esté en main**, y esta rama se pone al día con main antes de empezar.
- Lo que se usa de notas DGMIT (spec `2026-10-24-notas-dgmit-design.md`):
  - las tablas `notas_dgmit` (`numero`, `tipo` solicitud o reiteración, `recibida`, `anulada`) y `notas_dgmit_datasets`;
  - `fuentesDe(…).notasDgmit`;
  - la regla de a qué ciclo pertenece una nota (el que regía en `recibida 00:00:00`, con `cicloDelAviso`) y las vigentes (las no anuladas con `recibida` ≤ hoy);
  - el rol `colaborador`, `puedeCargarNotasDgmit(rol)` / `Auth.puedeCargarNotasDgmit()`;
  - el formulario «Cargar nota DGMIT» del Seguimiento.
- Si al llegar a main algo de eso cambió, quien construye lo adapta, y solo pregunta si cambia lo que se ve.

## 1. Cómo se cuenta

### 1.1 Días hábiles

- **Calendario:** el del RPAD, es decir lunes a viernes sin los 9 feriados nacionales fijos (`esDiaHabil`, `services/notasDigitalesCalendario.js`).
- **Duración de un tramo:** `diasHabilesTranscurridos(desde, hasta)`, que no cuenta el día de inicio y sí el de fin.
- **Lo que dice la página:** «Los días son hábiles: de lunes a viernes, sin los feriados nacionales fijos.»

### 1.2 El ciclo y sus hitos

La unidad es el **ciclo** del Seguimiento (`ciclosDe`, `services/seguimientoReglas.js`): el tiempo en que rige un vencimiento. Se reutilizan `fuentesDe(null)`, que carga todos los datasets en unas pocas consultas, `ciclosDe` y `cicloDelAviso`. Las reglas nuevas van en un módulo puro nuevo, por ejemplo `services/metricasReglas.js`: sin pool, sin `Date` local, fechas como texto, y ninguna función tira error.

Si `fuentesDe` necesita más campos, se suman sin cambiar lo que ya devuelve. Por ejemplo, del historial `vencimiento` y `recibido_el`, y de las notas `cuenta_desde`. Los tests del Seguimiento tienen que seguir pasando igual.

Cada ciclo tiene estos hitos:

| Hito | De dónde sale |
|---|---|
| **Aviso de la regla** | El aviso a la DGMIT que fija la regla: **40 días en externa y 60 en interna** (lo eligió el usuario: «es la regla que usamos ahora»). Sale del email viejo `externo-40` o `interno-60` con `success`, o de la Nota Digital de tipo `aviso` enviada de su gestión, con `notas_digitales_datasets.vencimiento` igual al vencimiento del ciclo. Si hay dos, cuenta el primero. La fecha es la del envío real, en hora argentina: `enviado_at` del email o `enviada_at` de la nota. Un aviso adelantado por la licencia del firmante cuenta en la fecha en que salió. Las notas de prueba no cuentan. |
| **Primer aviso, ya vencido** | Cuenta esa primera notificación a la DGMIT: un email `*-vencido`, la sección de vencidos de una Nota Digital o una reiteración de un dataset nunca avisado. Vale solo para un ciclo **que el RPAD no pudo avisar a tiempo**: la fecha del aviso por regla (vencimiento − 40 o 60 días corridos) es anterior al 06/12/2025, cuando empieza el registro de envíos, o al alta del dataset. Y además el primer aviso llegó después del vencimiento. El ciclo queda marcado como **avisado ya vencido**. Un ciclo que sí se podía avisar a tiempo y no tuvo el aviso de la regla (por ejemplo, porque falló el email de 40 días) no es «avisado ya vencido»: ver la viñeta de abajo. |
| **Nota DGMIT recibida** | Solo en externa. La primera nota DGMIT vigente del ciclo (por `recibida`), sea solicitud o reiteración. |
| **Datos recibidos** | El «Recibido el» de la actualización que cierra el ciclo. Sale del historial o del cambio (`datos_nuevos.recibido_el`) en las nuevas, y de la importación (sección 4) en las viejas. En interna es el día en que la DIT avisa que el relevamiento está listo (lo deja en el Drive o lo manda por email). Si los datos salieron de una fuente pública, es el día en que Datos Públicos obtuvo la fuente, no el día en que terminó de transcribirla. |
| **Origen de los datos** | Solo en externa: `area` (los entregó el área) o `fuente_publica` (Datos Públicos los obtuvo de una fuente pública: el PDF del digesto, el Boletín Oficial, la web de Vialidad…). Se registra con la actualización (sección 4). |
| **Carga** | El «Cargado en el portal» de la actualización que cierra el ciclo (`cierre` de `ciclosDe` con `como = 'actualizacion'`). |

- **Si un ciclo no tuvo el aviso de la regla y no estaba vencido en su primer aviso,** no cuenta en los tramos que empiezan en el aviso. Por ejemplo, si el email de 40 días falló o solo salió el de 60. En la cobertura cuenta como no avisado (sección 2.2).
- **Un ciclo con `venc` null** (las actualizaciones simples de diciembre de 2025) no cuenta en nada que necesite el vencimiento.
- **Un ciclo que cerró por reprogramación** no tiene datos recibidos ni carga, así que no cuenta en los tramos que terminan ahí. Sí cuenta en los que terminaron antes, como la anticipación o el trámite de la nota.

### 1.3 Los tramos

| Tramo | Responsable (insignia) | Desde → hasta | Gestión |
|---|---|---|---|
| Aviso anticipado (nombre elegido por el usuario; en el texto, «la anticipación») | DDPC | aviso de la regla → vencimiento | las dos |
| Trámite y entrega de la nota | DGMIT y DA | aviso (de la regla o el primero, ya vencido) → nota DGMIT recibida | externa con «Requiere nota» Sí o sin dato |
| Respuesta del área | Área | nota DGMIT recibida → datos recibidos | externa con «Requiere nota» Sí o sin dato |
| Producción del relevamiento | DGMIT y DIT | aviso (de la regla o el primero, ya vencido) → datos recibidos | interna |
| Preparación y carga en el portal | DDPC | datos recibidos → carga | las dos |

- **Nombres neutros** (lo eligió el usuario): nunca «tardanza», «demora» ni «atraso» en Métricas.
- **Ciclos avisados ya vencidos:** no cuentan en la anticipación, que daría negativo. Debajo del circuito se muestra: «N ciclos se avisaron cuando ya estaban vencidos (vencieron antes de que existiera el aviso): no cuentan en la anticipación, y el resto de sus tramos se cuenta desde ese primer aviso.»
- **Piso de 0:** si un hito llegó antes que el anterior, el tramo cuenta 0 días. Por ejemplo, la nota DGMIT antes del aviso de 40 (la DGMIT ya había actuado con el aviso viejo de 60), los datos antes de la nota o el relevamiento antes del aviso.
- **Respuesta del área:** se cuenta desde la primera nota DGMIT del ciclo, aunque después haya reiteraciones.
- **«Requiere nota DGMIT: No»** (TMDA, empleados municipales): solo anticipación y carga. Los tramos de la DGMIT y del área no les corresponden, y la página lo aclara.
- **Datos de una fuente pública** (pedido del usuario): a veces el área no contesta y Datos Públicos arma igual el dataset con una fuente pública, como el Presupuesto, sacado del PDF del digesto. En los ciclos con origen `fuente_publica`:
  - la respuesta del área **no se cuenta**: no fue el área la que entregó;
  - debajo del circuito se muestra aparte: «2 ciclos se resolvieron con datos de una fuente pública»;
  - el trámite de la nota DGMIT se cuenta igual, si hubo nota;
  - la preparación y carga se cuenta desde el día en que se obtuvo la fuente, así que incluye la transcripción: es trabajo de la DDPC y se tiene que ver.

### 1.4 Terminados, en curso y la cifra

- **Terminado:** un tramo terminó en el año en que ocurrió su hito final, y cuenta en ese año.
- **En curso:** un tramo que empezó y no terminó, en un ciclo abierto. Cuenta en el año de hoy (o en el de la foto, «al 31/12»). Se muestra cuántos son y la mediana de días hábiles que llevan hasta hoy.
  - El sistema recién sabe que llegaron los datos cuando se registra la actualización, así que **«Preparación y carga» nunca está en curso**.
  - En la respuesta del área y en la producción del relevamiento, los abiertos dicen «4 sin datos registrados todavía, hace 41 (mediana)», con la aclaración «Se cuenta hasta que se registra la actualización». Lo eligió el usuario: la carga suele tardar pocos días y la diferencia es chica.
- **El tramo de la DGMIT es distinto:** un ciclo avisado sin nota DGMIT cargada es «**pendiente de carga**» y se cuenta **sin días** («3 notas pendientes de carga»), porque no se sabe si la nota salió. Se cuentan los ciclos abiertos de externos con «Requiere nota» Sí o sin dato que ya tuvieron un aviso.
- **Sin ninguna nota DGMIT vigente cargada en todo el RPAD:**
  - el tramo de la DGMIT dice «Todavía no hay notas DGMIT cargadas»;
  - el de respuesta del área, «Se empieza a contar cuando haya notas DGMIT cargadas».
- **La cifra**, como en el mockup:
  - la **mediana**, grande; con una cantidad par, el promedio de las dos del medio, redondeado;
  - **la unidad, siempre, debajo de la cifra** (pedido del usuario): «días hábiles», y en el aviso anticipado «días hábiles antes del vencimiento». Una cifra nunca va sola;
  - **una mediana de 0 se escribe «En el día»** (pedido del usuario), con «mediana · promedio N días hábiles» debajo. Pasa sobre todo en la preparación y carga, cuando la DDPC carga el mismo día en que recibe los datos: es un logro y se tiene que leer así, no como «0»;
  - debajo, chicos, el **promedio** redondeado y la **cantidad de ciclos**;
  - la aclaración fija: «El número grande es la mediana: en la mitad de los casos, ese número de días hábiles o menos.»
  - Sin casos, no hay cifra: «Sin casos en 2026».
  - Con 4 casos o menos, se suma «con tan pocos casos, es orientativo».

### 1.5 Destildar casos

- **Qué se destilda:** datasets, no ciclos sueltos. La casilla «Contar» de una fila destilda el dataset entero.
- **Dónde vive:** en la URL (por ejemplo `?sin=12,45`). No se guarda en la base y viaja en el link.
- **A qué afecta:** a todas las cuentas de la pestaña Métricas y al PDF de Métricas.
- **La leyenda:** mientras haya algo destildado, la franja ámbar arriba de la página dice «Calculado sin 1 dataset: Parque Automotor.», con el link «Volver a todos». El PDF lleva la misma leyenda en una píldora.
- **La foto del 31/12** se calcula siempre con todos.

### 1.6 El período

- **El selector:** el año calendario. Por defecto, el año en curso, «2026 (en curso)», del 1/1 a hoy. Debajo, los años anteriores.
- **Los años anteriores** salen de su foto.
- **El primer año** que muestra el selector es 2026. Lo de diciembre de 2025 cuenta si terminó en 2026.

## 2. La pestaña Métricas

Sigue el mockup `1-metricas.html`, con el lenguaje visual del Seguimiento, que es el que más le gusta al usuario: tarjetas blancas de 16 px de radio, títulos en Bricolage, chips, el circuito con nodos y flechas y la cinta.

### 2.1 Arriba

- **Controles:** el selector de año, el chip «Casos: todos» («todos menos 1» si hay algo destildado) y el botón «Descargar PDF».
- **La franja de lo destildado**, si la hay.
- **El índice de la página:** El circuito, Resultados del año, Contexto, El trabajo del RPAD, Áreas y temas y Para completar (este último con la cantidad pendiente).

### 2.2 Las secciones

- **El circuito** (una tarjeta), con el selector «Gestión externa» / «Gestión interna» adentro:
  - **El circuito:** nodos y flechas como en «Avisos del ciclo abierto» del Seguimiento. En cada flecha van la mediana, el nombre del tramo, «desde → hasta», el promedio con los ciclos y los en curso o pendientes.
    - Nodos de la externa: RPAD (Datos Públicos avisa), DGMIT y Dirección Administrativa (Mandan la nota formal), Área responsable (Prepara los datos), Datos Públicos (Limpia y estructura) y Portal (Datos publicados).
    - Nodos de la interna: RPAD, DGMIT y Dirección de Investigación Territorial (Hacen el relevamiento), Datos Públicos y Portal.
    - Lo de la DGMIT va en violeta (#5B4691), como en notas DGMIT, y el Portal en verde.
  - **La cinta del «recorrido típico»:** las medianas una detrás de la otra alrededor del vencimiento, con el eje en días hábiles, la banda celeste antes del vencimiento, el rayado después, las marcas (aviso, nota DGMIT, datos y carga) y su leyenda.
    - **Sin texto dentro de la banda** (pedido del usuario): el dato real de cuándo se carga respecto del vencimiento está en «Actualizados a tiempo».
    - La aclaración: «La cinta pone las medianas una detrás de la otra: es orientativa, no un ciclo real.»
    - El eje lleva el rótulo «días hábiles respecto del vencimiento», y la marca del aviso dice «Aviso · 27 días hábiles antes».
    - **Marcas que caen juntas:** se dibuja una sola, como en la cinta del Seguimiento, donde las marcas que se pisan se juntan. Por ejemplo, si la carga es «En el día», la entrega y la carga van en una sola marca: «Entrega y carga, el mismo día» (verde con borde azul), con su renglón en la leyenda. Lo eligió el usuario.
    - **Si a la cadena le falta un tramo sin cifra,** como hoy los de la DGMIT y el área, que no tienen notas cargadas, la cinta dibuja solo hasta donde se sabe: el aviso y el vencimiento. El resto de la banda va en gris, con «La cinta se completa cuando haya notas DGMIT cargadas». *(Decisión mía.)*
    - **No se suman tramos** para tapar el hueco. Por ejemplo, no hay un «del aviso a la entrega» con la nota y la respuesta juntas: el usuario lo descartó.
  - **La aclaración de los avisados ya vencidos.**
  - **Los casos** («Ver los casos» / «Ocultar los casos»): una fila por ciclo del año.
    - Columnas: Contar, Dataset (con el área), Vencimiento, Aviso, Nota DGMIT (número y tipo), Recibido el y Carga.
    - Debajo de cada fecha, los días del tramo o su estado: «en curso, hace N», «pendiente de carga» o «avisado ya vencido».
    - Los destildados se ven tachados y en gris.
- **Resultados del año**, con las dos gestiones juntas:
  - **Actualizados a tiempo:**
    - La cifra grande: «5 de 32 ciclos», con un medidor. Son los ciclos cerrados por actualización en el año con carga ≤ vencimiento.
    - El texto: «Los otros 27 se cargaron una mediana de 38 días hábiles después (promedio 74).»
    - El desglose: «Externa: 4 de 26 · Interna: 1 de 6».
    - No cuentan los cerrados por reprogramación ni los que tienen `venc` null.
  - **Cobertura del aviso:**
    - La cifra grande: «41 de 43 vencimientos», con un medidor. Son los ciclos con vencimiento en el año que **tuvieron el aviso de la regla antes del vencimiento**.
    - El denominador son los ciclos con vencimiento en el año cuya fecha de aviso por regla (vencimiento − 40 o 60 días corridos) ya pasó. Quedan afuera los eventuales y los sin fecha.
    - Los que no lo tuvieron se listan con el motivo que se pueda saber: «se dio de alta con el vencimiento ya cerca», «el email no se pudo enviar», «se avisó ya vencido».
  - **Reiteraciones por ciclo**, en dos grupos de barras:
    - Del RPAD a la DGMIT: los avisos del ciclo posteriores al aviso de la regla (o al primero, si se avisó ya vencido). Agrupados en Ninguna, 1 y 2 o más.
    - De la DGMIT al área: las notas DGMIT de tipo reiteración del ciclo. Agrupadas en Ninguna y 1 o más.
    - Cuentan los ciclos que terminaron en el año y, en el año en curso, los abiertos.
- **Contexto:**
  - **Índice de actualización, mes a mes:** una línea, una sola serie, sin leyenda. Un punto **por el primer día de cada mes** del año hasta hoy, y el último punto es hoy.
    - Es el mismo índice que la portada: al día (actualizados más próximos) sobre el total sin los eventuales.
    - **¿Por qué el primer día?** Las próximas siempre son fin de mes y el día del vencimiento todavía cuenta como al día. Tomado a fin de mes, un vencimiento nunca se vería en el punto de su mes. Con los datos reales, el índice da 81 % el 1/1/2026, cae a 50 % el 1/2 (el vencimiento del 31/01, el de casi todos los externos) y llega al 82 % de hoy.
    - **El punto de hoy tiene que dar lo mismo que `tasaDeActualizacion`** de la portada y del Estado general (test).
    - Los meses pasados se reconstruyen con los ciclos del Seguimiento (*decisión mía*): un dataset estaba al día ese día si existía, no era eventual y el ciclo que regía ese día vencía ese día o después.
    - Un mes en el que no se puede saber para una parte importante de los datasets (por ciclos con `venc` null) no se dibuja, en lugar de inventarse.
    - Al pasar el mouse o el foco por un punto, se ve el valor.
  - **Antigüedad de los vencidos:** barras horizontales en ámbar.
    - Grupos: menos de 3 meses (menos de 90 días corridos), de 3 a 12 meses y más de un año, con «Hoy: 13 datasets vencidos».
    - Debajo: «Al 1/1/2026 eran 20: de esos, 11 ya se actualizaron.»
- **El trabajo del RPAD:**
  - **Totales del año:**
    - avisos y notas a la DGMIT: emails a la DGMIT con `success` y Notas Digitales de aviso y de reiteración enviadas, sin las de prueba;
    - actualizaciones registradas;
    - cambios auditados;
    - datasets nuevos;
    - pedidos resueltos con una fuente pública: las actualizaciones externas del año con origen `fuente_publica`, sin contar los datasets con «Requiere nota: No», en los que es lo normal.
  - **Un gráfico de columnas por mes,** con chips para elegir la serie.
  - **Las métricas manuales** de Gestión (reuniones y capacitaciones, consultas atendidas, notas enviadas fuera del RPAD), con «Cargar el mes» solo para administración, como hoy.
  - **La doble verificación:** la mediana del tiempo entre la propuesta y la revisión, en tiempo corrido (minutos u horas: son cortos), con el promedio y la cantidad. Viene de «Días prom. aprobación» de Gestión.
  - **El CSV** de métricas de Gestión se muda acá.
- **Áreas y temas**, lo que hoy está en Gestión:
  - el ranking de áreas (tabla con barra);
  - los datasets por tema y por frecuencia, con un chip para cambiar entre los dos. Pasan de tortas a **barras horizontales**: con tantas categorías se leen mejor.
- **Para completar:**
  - las notas DGMIT pendientes de carga, con el dataset, el área y el aviso del RPAD (fecha y número de Nota Digital) y el link «Cargar nota DGMIT», que abre el formulario del Seguimiento con ese dataset;
  - las actualizaciones sin «Recibido el» (o, en externa, sin origen), con un link al Seguimiento del dataset. Esos datos no se cargan desde la página: los viejos se completan con el Excel de la sección 4 y los nuevos ya los pide el formulario.
  - El link «Cargar nota DGMIT» lo ve solo quien puede cargar (`Auth.puedeCargarNotasDgmit()`). El resto ve la lista sin el link.
  - *(Decisión mía)* Entran los ciclos abiertos y los cerrados en el año. De los cerrados, solo los que tienen origen `area` o sin dato: un ciclo resuelto con una fuente pública puede no haber tenido nota.

### 2.3 Cómo se arma

- **El servidor calcula todo**, incluidos los textos y las posiciones de la cinta, y la página solo dibuja, como el Seguimiento.
- **Endpoints sugeridos:** `GET /api/metricas?anio=&sin=` y lo que haga falta para «Para completar». Son de solo lectura y llevan `authMiddleware`, sin `adminOnly`.
- **El JS de la página** declara solo al cargarse (lo carga un test en un `vm`). Lo que arma HTML es puro y recibe quién mira por parámetro.
- **Los gráficos** se dibujan en SVG o HTML con los números del servidor, como la cinta y las columnas de la portada. Esta página no usa Chart.js (*decisión mía*).
- **Accesibilidad:**
  - cada gráfico lleva su título y sus valores también en texto o en una tabla;
  - nunca solo el color: cada tramo tiene su insignia con el responsable;
  - foco visible;
  - las pestañas con `aria-selected` y un hash, como en Correos (`#metricas`, `#reportes`).
- **En el teléfono:**
  - el circuito pasa a una columna (nodo, flecha hacia abajo, nodo…);
  - la cinta conserva su ancho mínimo con desplazamiento horizontal, como en el Seguimiento;
  - las tablas se desplazan de costado.

## 3. La foto del 31/12

- **Dónde se guarda:** una tabla nueva, aditiva; por ejemplo `metricas_fotos`, con `anio` (único), `al` (`'AAAA-12-31'`), `datos` (JSON validado) y `created_at`.
- **Qué guarda:**
  - los números de cada sección;
  - el estado de los datasets al 31/12: cuántos en cada estado, el índice, los vencidos con su antigüedad;
  - **la lista de casos con sus fechas**, para poder ver años después de dónde salió cada número aunque algo se haya corregido.
- **Cuándo se saca:** la saca sola la corrida de las 8:15 (`ejecutarNotificacionesDiarias`), **el 10 de enero** del año siguiente. Lo decidió el usuario, para que entren los datos del año que se registran en los primeros días de enero. Es la primera corrida con hoy ≥ 10/01 si todavía no hay foto de ese año.
  - Calcula todo «al 31/12»: hoy = 31/12 y todos los datasets. Cuenta todo lo que tenga fecha de ese año (avisos, notas DGMIT recibidas, «Recibido el», cargas), aunque se haya registrado entre el 1/1 y el 10/1.
  - Va aislada, como los otros pasos (`try/catch`): un error no frena las notas, queda en los errores de la corrida y se reintenta al día siguiente.
  - No depende de que sea día hábil.
  - **No se modifica nunca** y no hay botón para rehacerla. Lo que se registre después del 10/01 con fecha del año anterior ya no entra (el kit lo recuerda: los Excel de la sección 4 van antes).
- **Cómo se ve:**
  - Entre el 1/1 y el 10/1, el año que terminó se ve calculado en vivo «al 31/12», con la aclaración «La foto de 2026 se saca el 10/01/2027».
  - Después, el selector muestra los años con foto. Elegir uno muestra su foto: no se recalcula y no se puede destildar.
- **Pruebas:** se llama a la función del servicio con un hoy fijo. Nunca a `/api/cron/*`.

## 4. «Recibido el»

**Obligatorio desde el despliegue**:
- `POST /datasets/:id/actualizar` sin `recibido_el` responde 400, con un mensaje como «Indicá cuándo se recibieron los datos.».
- El modal «Registrar actualización» lo marca obligatorio. El mensaje se copia en `admin-fechas.js`, con su test.
- Siguen las validaciones de hoy: no puede ser futuro ni posterior a la carga.
- Vale también para los externos con «Requiere nota: No», donde «Recibido el» es el día en que la DDPC obtuvo los datos de la fuente.

**El origen de los datos**, solo en gestión externa y obligatorio junto con la fecha:
- En el modal: «¿Quién entregó los datos?», con las opciones «Los entregó el área» y «Los obtuvo Datos Públicos de una fuente pública».
- La fecha se llama «Recibido el» o «Obtenido el», según lo elegido.
- Con «Requiere nota DGMIT: No», viene elegida la fuente pública, y se puede cambiar.
- En gestión interna no se pregunta: siempre entrega la DGMIT y la DIT.
- Viaja en el cambio (`datos_nuevos.origen_datos`, por ejemplo). Se ve en la comparación de Mi Perfil y en el detalle del movimiento del Seguimiento, como «Recibido el».
- `aprobarCambio` lo guarda junto con `recibido_el`, de forma aditiva: por ejemplo, una columna nueva en `historial_actualizaciones`.
- El servidor lo exige en externa (400 con su mensaje), y el mensaje se copia en `admin-fechas.js` con su test.

**La edición no registra actualizaciones** (lo decidió el usuario):
- Si una edición del formulario de Gestión de Datasets cambia a la vez «Cargado en el portal» y la próxima, el servidor responde 400: «Para registrar una actualización, usá «Registrar actualización».». El formulario lo avisa antes de enviar.
- Así, toda actualización pasa por el formulario que pide la fecha y el origen y que escribe el historial.
- Corregir una sola de las dos fechas sigue siendo posible.
- En 2026, 4 de las 32 actualizaciones vinieron por la edición.

**Sin romper lo anterior** (pedido del usuario):
- `aprobarCambio` sigue aprobando un cambio pendiente que no lo trae.
- Las filas viejas no se tocan.
- Las métricas cuentan un ciclo sin el dato como «sin dato» en los tramos que lo necesitan, y lo listan en «Para completar».

**Los datos viejos**, con dos Excel que el usuario ya está completando. Se generaron el 24/10/2026 con la base del 20/10 y están en `Escritorio/RPAD-metricas/`:
- **`RPAD - Recibido el - para completar.xlsx`:** una fila por cada una de las 32 actualizaciones aprobadas sin «Recibido el» (enero a octubre de 2026). Tiene las columnas fijas ID del cambio, ID del dataset, dataset, área, gestión, vencimiento que se cumplió y cargado en el portal. Para completar trae el origen de los datos (solo externa; ya viene «Fuente pública» con «Requiere nota: No»), «Recibido el (u obtenido el)» y las observaciones. Una columna de control avisa lo que falta o está mal.
- **`RPAD - Notas DGMIT 2026 - para completar.xlsx`:** reemplaza al del 21/10 (`Escritorio/RPAD-propuesta-nota-dgmit/`), que solo tenía los 11 ciclos abiertos.
  - Hoja «Solicitudes»: una fila por ciclo externo avisado que terminó en 2026 o sigue abierto, 31 ciclos de 27 datasets. Trae el vencimiento, el primer aviso del RPAD, la cantidad de avisos y el estado del ciclo. Para completar: el número de nota (como texto), la fecha de recepción por el área y las observaciones.
  - Hoja «Reiteraciones»: 60 filas libres. El dataset se elige de una lista y el ciclo lo asigna la regla de notas DGMIT por la fecha.
  - Se importa con la importación de notas DGMIT (sección 9 de su spec).
- Al implementar se regenera la lista de «Recibido el» si hay actualizaciones nuevas sin el dato. Los generadores están en el scratchpad de la sesión que escribió este documento. Lo que el usuario ya completó se respeta.
- Cada Excel se importa una sola vez.
- **Dónde se guardan «Recibido el» y el origen viejos:** de forma aditiva, por `cambio_id`. Por ejemplo, una tabla `actualizaciones_recibido (cambio_id, recibido_el, origen_datos, created_at)`. Nunca reescribiendo `datos_nuevos`.
- Si un Excel trae algo de personas en las observaciones, el SQL va a `database/privado/`, que no se versiona.
- Las actualizaciones simples de diciembre de 2025 no entran.

## 5. La pestaña Reportes

Sigue el mockup `3-reportes.html`. Son siete tarjetas en dos grupos y cada una descarga un PDF con `API.pedirArchivo` y `descargarBlob` (JWT en el encabezado).

**Para presentar**
1. **Métricas del año:**
   - Lo mismo que la pestaña Métricas, para el año elegido: los dos circuitos, los resultados, el contexto, el trabajo del RPAD y áreas y temas.
   - Respeta los destildados y lo dice.
   - Un año con foto sale de la foto.
   - Unas 4 hojas.
2. **Informe anual:**
   - Solo para un año con foto: hasta entonces, el botón dice «Disponible desde el 1/1/AAAA+1».
   - Lleva la foto del 31/12, la comparación con la foto del año anterior («Primer año con foto» si no hay) y los **logros del año**.
   - Los logros son los hitos con fecha en ese año de Gestión → Proyectos (`proyecto_hitos`), agrupados por proyecto. No hay que escribir nada nuevo.
3. **Estado general de los datasets:**
   - El mismo contenido de hoy: las 5 tarjetas, la línea del índice, las aclaraciones de eventuales y sin fecha y la tabla de todos los datasets.
   - Cambia solo el diseño.

**Para trabajar**

4. **Por área:**
   - Una portada con el área, sus contactos, las 5 tarjetas y la lista de sus datasets con su estado.
   - Detrás, **una hoja de Seguimiento por cada dataset activo del área**: la misma hoja que se descarga del Seguimiento, con el dibujante de hojas del anexo de la reiteración. El pie dice «Reporte por área · Hoja k de N».
   - Sin hojas de los dados de baja.
5. **Avisos del RPAD** (reemplaza al Historial de Notificaciones):
   - Una constancia de todos los avisos de un período, con «Desde» y «Hasta» validados. Por defecto, del 1/1 a hoy.
   - Incluye los emails viejos, a la DGMIT y al área, y las Notas Digitales de aviso y de reiteración, con fecha, qué fue, gestión, datasets y estado.
     - «Qué fue» usa los textos del Seguimiento: «Email a DGMIT: …», «Nota Digital N° …», «Email al área: anticipo de la nota formal».
   - Arriba, totales.
   - **Sin direcciones de email**, sin las notas de prueba y sin el texto técnico de los errores.
   - Quedan afuera las notas de auditoría y de autorización, porque no son avisos del pedido de datos.
6. **Agenda de pedidos:**
   - Qué vence en los próximos **3, 6 o 12 meses** (6 por defecto), mes por mes, con las dos gestiones o una sola.
   - Un vencimiento por dataset: la próxima actual, sin proyectar los siguientes. Al principio, aparte, los vencidos, que se siguen pidiendo. *(Decisión mía.)*
   - Por cada dataset: área, frecuencia (`frecuenciaEnNota`), «Requiere nota DGMIT» en los externos, datos que se van a pedir (el `pedido` para ese vencimiento) y la fecha aproximada del aviso del RPAD según la regla (*decisión mía*).
   - Sirve para que la DGMIT y la DA planifiquen.
7. **Datos para completar:** lo mismo que la sección «Para completar» de Métricas.

**Se saca** el Reporte de Cumplimiento: la tarjeta, su endpoint y sus tests.
- El selector de período nunca funcionó.
- El ranking de áreas ya está en Métricas.
- El test de que la tasa es la misma en todos lados pasa a comparar la portada, el Estado general y Métricas.

**El Historial de Notificaciones** se reemplaza por Avisos del RPAD: su endpoint se saca o se reemplaza, y sus tests se adaptan.

### 5.1 El diseño de los PDF

El de los anexos de las Notas Digitales y la hoja del Seguimiento (mockup, «Así se verían los PDF»):
- **Formato:** A4, Helvetica, márgenes de 15 mm. Se reutilizan los ayudantes de `services/notasDigitalesAnexo.js` (`COLOR`, `renglon`, `prepararGrilla`…) y `DocumentoNota`.
- **El encabezado:** «DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN / Municipalidad de Comodoro Rivadavia» a la izquierda. A la derecha, el nombre del reporte y la fecha larga. Debajo, una raya fina con el acento azul.
- **Elementos:**
  - un rótulo chico en mayúsculas espaciadas, como «MÉTRICAS · AÑO 2026, EN CURSO»;
  - el título grande en negrita;
  - una píldora;
  - recuadros grises o con borde azul a la izquierda;
  - grillas de datos con líneas finas;
  - las insignias de estado con los colores del Seguimiento.
- **El pie:** «Generado el dd/mm/aaaa a las hh:mm por <nombre corto>» y «<Reporte> · Hoja k de N».
- **Pruebas:** con `tests/pdf-lector.js`: los textos, el pie, la cantidad de hojas y que nada se pise.

## 6. La página y el menú

- `reportes.html` conserva el nombre de archivo y pasa a decir **«Métricas y Reportes»**: el título, el `h1` y el link de Herramientas en el menú de las 14 páginas (`tests/paginas.test.js`). Lleva su `<style>`, como el Seguimiento.
- **Gestión** se queda solo con Proyectos: se va la pestaña Métricas.
  - Los endpoints de Gestión que usa la página nueva siguen andando: `/gestion/metricas`, el CSV y las métricas manuales.
  - Los tests de `gestion.js` (`textoPorcentaje`, `htmlDelRanking`) acompañan al código que se muda.
  - Si Proyectos ya no usa Chart.js, se saca su `<script>` y se actualiza CLAUDE.md.
- **Quién la ve:** todos los que tienen sesión, es decir superadmin, admin, editor, lector y colaborador. Sin sesión, al login.
  - Todos los GET van con `authMiddleware` y sin `adminOnly` (`tests/permisos.test.js`: lector y colaborador, 200; sin sesión, 401).
  - Lo que escribe (las métricas manuales) sigue siendo de administración.

## 7. Pruebas

- **Reglas puras sobre casos reales:**
  - Se arman como `tests/seguimiento-casos.js`, con los nombres de las personas cambiados.
  - Cubren:
    - un ciclo completo externo;
    - uno interno;
    - uno avisado ya vencido;
    - uno sin aviso de 40 porque el email falló;
    - una nota DGMIT antes del aviso (0 días);
    - un externo con «Requiere nota: No»;
    - un cierre por reprogramación;
    - una actualización simple de diciembre de 2025;
    - un dataset que nunca contesta (en curso);
    - un dataset con varios ciclos en el año;
    - una nota DGMIT anulada (no cuenta);
    - años sin casos;
    - 4 casos o menos («orientativo»).
- **Destildar** saca al dataset de todas las cuentas.
- **El índice:** el punto de hoy coincide con `tasaDeActualizacion` de la portada y del Estado general.
- **La foto:** se saca una sola vez por año, a partir del 10/01, con hoy = 31/12. Antes del 10/01 no se saca, lo registrado entre el 1 y el 10 de enero con fecha del año entra, y un error no frena las notas.
- **«Recibido el» y el origen:**
  - 400 sin el dato (el origen, solo en externa), y un cambio pendiente viejo sin el dato se aprueba igual;
  - con origen `fuente_publica`, el ciclo no cuenta en la respuesta del área y suma en «pedidos resueltos con una fuente pública»;
  - una edición que mueve juntas la carga y la próxima da 400, y una que mueve una sola, no.
- **Permisos y páginas:** los de la sección 6. El JS de la página, cargado en un `vm`.
- **Los PDF** de los siete reportes.
- **La suite:** `npm test` completo antes y después de cada cambio (regla del proyecto).

## 8. Documentación y despliegue

- **CLAUDE.md y README:**
  - la página, las reglas de las métricas, la foto, «Recibido el» obligatorio, los reportes nuevos y los que se sacan;
  - Gestión, solo con Proyectos;
  - la cantidad de tablas.
- **El kit de despliegue**, como los anteriores:
  - las migraciones aditivas (la foto, el origen en el historial y la importación de «Recibido el») **antes** del código;
  - después, los archivos y Restart;
  - después, los SQL de los dos Excel, cuando el usuario los devuelva completos. Tienen que entrar antes del 10/01 para que cuenten en la foto del año.
- No hace falta una tarea de cron nueva: la foto va en la corrida de las 8:15.
- El kit avisa los dos cambios que se notan en la administración:
  - «Registrar actualización» pide la fecha y, en externa, el origen;
  - la edición ya no deja mover juntas la carga y la próxima.

## Decisiones mías (para que las revises)

- **El índice mes a mes** de los meses pasados se reconstruye con los ciclos del Seguimiento. Un mes sin datos suficientes no se dibuja.
- **«Avisado ya vencido»** es solo el ciclo que el RPAD no pudo avisar a tiempo (sección 1.2). Los demás ciclos sin el aviso de la regla quedan fuera de los tramos y figuran en la cobertura como no avisados.
- **«Para completar»:** los ciclos cerrados resueltos con una fuente pública no se listan como «nota pendiente de carga».
- **El origen se guarda** en una columna nueva del historial y en la tabla de la importación (los nombres los elige quien construye).
- **Destildar** saca datasets enteros, no ciclos sueltos, y afecta a toda la pestaña Métricas (también el índice y el ranking).
- **Cifra:** con 4 casos o menos, «es orientativo»; sin casos, «Sin casos en 2026».
- **Piso de 0** en los tramos cuando un hito llegó antes que el anterior.
- **Respuesta del área:** se cuenta desde la primera nota DGMIT del ciclo (solicitud o reiteración, la primera que haya).
- **Gestión y «Requiere nota»:** se usan los de hoy del dataset, salvo que el ciclo tenga una nota DGMIT cargada. En ese caso, los tramos de la DGMIT y del área cuentan aunque hoy diga «No».
- **«Para completar»** incluye los ciclos abiertos y los cerrados en el año.
- **El selector de años** empieza en 2026.
- **La doble verificación** se mide en tiempo corrido, no en días hábiles: son minutos u horas.
- **Agenda de pedidos** suma la fecha aproximada del aviso del RPAD.
- **Avisos del RPAD** deja afuera las notas de auditoría y de autorización.
- **Gráficos:** sin Chart.js en esta página. Se dibujan en SVG o HTML, como la cinta.
- **Las tortas** de Gestión pasan a barras (el usuario vio la maqueta y la aprobó).

## Lo que queda para quien lo construye

- Los nombres de los módulos, los endpoints y las tablas nuevas, y la forma exacta del JSON de la foto, mientras guarde números y casos.
- Cómo se reparte el cálculo entre `fuentesDe` y el módulo nuevo, sin cambiar lo que ya devuelve el Seguimiento.
- El diseño fino de cada hoja de PDF y cuántas hojas lleva cada reporte, con el lenguaje del anexo.
- El orden de las tareas del plan y qué parte se prueba con base (Docker) y qué parte en puro.
