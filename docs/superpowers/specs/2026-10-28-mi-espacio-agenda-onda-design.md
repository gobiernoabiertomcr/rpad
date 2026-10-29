# Mi espacio: la agenda con más onda (diseño)

Fecha: 28/10/2026. Pedido del usuario: «antes de arrancar con la tanda 2 me gustaría que le demos un poco más de "onda" a la agenda en
Mi espacio». Parte de la pestaña Agenda de `mi-espacio.html` (spec 2026-10-26-mi-espacio-agenda, en producción desde el 27/10), y la
cambia solo en cómo se ve y en cómo se usa: los eventos, quién los ve, los recordatorios y los emails no cambian.

La maqueta que aprobó el usuario está en `docs/superpowers/specs/2026-10-28-mi-espacio-agenda-onda-mockups/` (datos inventados; se ve
con `python -m http.server` en esa carpeta). Cuando la maqueta y este documento no coinciden, manda el documento.

## 1. Qué es y por qué

La agenda de hoy es una grilla blanca de lunes a domingo con bordes grises, píldoras de colores y una leyenda. Funciona, pero se ve
plana y desperdicia lugar:

- los compañeros que no están se leen con el nombre completo, «Carla Inés Benítez no está», y se cortan;
- el sábado y el domingo ocupan dos columnas casi siempre vacías;
- con un solo evento en el día, el texto va en un renglón y se corta igual;
- una licencia o un compañero de varios días repite su píldora en cada día;
- en el teléfono, cada evento es una rayita de 6 px que cuesta tocar (borde abierto 4 del cierre de la agenda);
- tocar un día vacío no hace nada.

El usuario quiere la agenda «con más onda», de la misma familia que el Resumen «Titular» (la banda celeste con la ola, la letra de los
títulos en grande, un solo movimiento al abrir).

**Qué es un éxito:** abrir la pestaña y ver el mes de un vistazo (quién no está, tus licencias, los feriados y los eventos), con
más lugar para los textos, y poder agendar algo tocando el día.

## 2. Lo que decidió el usuario (28/10/2026)

1. **Los compañeros, con el primer nombre**: «Carla no está». En todos lados: la grilla, «Próximos» y «Hoy y mañana» del Resumen.
2. **Nombres repetidos**: si dos personas de administración tienen el mismo primer nombre, se suma la inicial del apellido, «Carla
   B.», solo en ese caso.
3. **Sábado y domingo**: un botón para verlos u ocultarlos, **apagado de entrada** (ocultos). Si queda algo escondido el fin de
   semana del mes, el botón muestra cuántas cosas son.
4. **Los renglones se adaptan**: con 1 cosa en el día, hasta 3 renglones; con 2, hasta 2 cada una; con 3, uno cada una.
5. **Barras continuas** para tus licencias y para los compañeros que faltan varios días, con el texto una vez por semana.
6. **Los compañeros en una sola franja**: el texto cambia cuando cambia la gente («Carla no está», después «Carla y Julián no
   están»). Ocupa un solo renglón aunque falten muchos.
7. **La franja de los compañeros, «pizarra»**: gris oscura con letra blanca (eligió entre rayada, con iniciales, pizarra y como
   estaba: «Me gusta PIZARRA!»; la de antes «se pierde»).
8. **Hoy bien marcado**: toda la celda de hoy en celeste, y los días del mes que ya pasaron, un poco más apagados.
9. **Íconos chiquitos**: una bandera para el feriado, un sol para tu licencia, una persona para el compañero, dos personas para lo
   compartido.
10. **Encabezado como el Resumen**: la banda celeste con la ola, el mes en grande y una frase corta con lo del mes («8 eventos, 4
    feriados, tu franquicia el 4 y tus vacaciones del 16 al 27.»).
11. **Movimiento**: la primera vez, las barras se dibujan de izquierda a derecha, como la regla del Resumen. Nada más se mueve.
12. **Tocar un día para agendar**: el espacio libre de un día abre «Nuevo evento» con esa fecha (con un «+» al pasar el mouse).
13. **El día elegido en el teléfono**: tocar un día muestra debajo de la grilla todo lo de ese día, en lugar de las rayitas.
14. No eligió que tocar una licencia lleve a la pestaña Licencias: queda como está (no se toca).

## 3. Cómo se ve

Las medidas, los colores y los textos de cada pieza están en la maqueta; acá, lo que tiene que cumplirse. Solo los tokens `--sg-*` del
`<style>` de `mi-espacio.html` y `--f-titulo` y `--f-texto` de `main.css` (como el resto de Mi espacio); ningún recurso de afuera (la
CSP no lo permite); íconos SVG de Lucide embebidos, con `aria-hidden="true"`.

### 3.1 La banda

Arriba de la pestaña, a todo el ancho, la banda celeste del Resumen (`--sg-cielo`, esquinas de arriba redondeadas y la ola abajo,
decorativa y oculta en alto contraste). Adentro:

- el mes en grande, «Octubre 2026», en Bricolage (`--f-titulo`), con las flechas ‹ › a la derecha del título (no a los costados: el
  título cambia de ancho de un mes a otro y las flechas no tienen que saltar);
- a la derecha, «Sábado y domingo», «Hoy» y «Nuevo evento»;
- debajo del mes, la frase del mes (sección 5.2), de un renglón o dos.

En 980 px o menos, todo en una columna: el mes, la frase y los botones.

### 3.2 «Sábado y domingo»

Un botón con una llave (`aria-pressed`): apagado, la grilla tiene 5 columnas, de lunes a viernes; prendido, 7. **Apagado de entrada.**
Cada navegador recuerda la elección (`localStorage`, envuelto en try/catch: sin almacenamiento, apagado), también en el teléfono.

Apagado, si el mes tiene algo un sábado o un domingo (un evento o un feriado: las licencias y los compañeros se pintan solo en días
hábiles), el botón muestra la cantidad en una pastilla en el sol («1»), y su nombre accesible la dice («Sábado y domingo: 1 cosa
escondida»). Prendido, no muestra nada. Una semana cuyos lunes a viernes son todos de otro mes no se dibuja cuando están ocultos.

### 3.3 El mes

La grilla sigue siendo una tabla, nombrada por el título del mes, con la cabeza de los días (el corto a la vista y el largo para el
lector de pantalla). La columna de hoy tiene su cabeza en tinta y negrita.

Cada día:

- **el número**, en la letra de los títulos, arriba a la izquierda (centrado en el teléfono);
- **hoy**: la celda entera en `--sg-cielo` y el número en un círculo tinta con letra blanca; `aria-current="date"`;
- **los días del mes que ya pasaron**: el número en `--sg-suave` y lo de adentro un poco desaturado (sin bajar ningún contraste de
  texto de 4,5:1);
- **otro mes**: fondo `--sg-sutil` y el número en `--sg-suave` (hoy es `--sg-gris`, 2,8:1: se corrige);
- **feriado**: el fondo ámbar claro de hoy (#FFFBEB);
- **sábado y domingo**, cuando se ven: un fondo apenas más gris que el blanco;
- **el «+»**: con el mouse encima del día aparece un «+» redondo arriba a la derecha (una pista visual, no un control aparte: ver 4.1).

### 3.4 Las barras

En cada semana, encima de lo de cada día, hasta dos carriles:

1. **tus licencias** (las de Mi espacio, como hoy): verde (`--sg-verde-fondo`, letra `--sg-verde`, el borde de 3 px a la izquierda),
   con el sol y el texto del servidor («Vacaciones», «Franquicia, 2 h»);
2. **los compañeros que no están**: la franja **pizarra**, `--sg-suave` de fondo con letra blanca (5,8:1), con la persona y el texto
   del día («Carla no está», «Carla y Julián no están»).

Si en la semana no hay ninguna licencia tuya, los compañeros van en el primer carril; sin ninguno de los dos, no hay carriles.

- Una barra es un **tramo**: días seguidos de la misma semana (columnas visibles contiguas) con la misma licencia o con el mismo texto
  de compañeros. El texto va una vez, al principio de cada tramo; la barra cruza los bordes de los días.
- Se pintan los días que manda el servidor (`dias` de cada licencia y de cada compañero, los hábiles con los feriados), así que un
  feriado o un fin de semana visible cortan la barra: es lo que corresponde (ese día no es de licencia).
- Un tramo que llega al último día visible de la semana y sigue en el primero de la semana siguiente (el día hábil que viene es de la
  misma licencia o tiene el mismo texto de compañeros) termina recto a la derecha; el que viene de la semana anterior empieza recto a
  la izquierda y sin el borde de color. Si no, los extremos son redondeados.
- Al pasar el mouse, el `title` dice la licencia con sus fechas («Vacaciones. Hasta el viernes 27/11») o, en los compañeros, hasta
  cuándo no está cada uno; para el lector de pantalla, ver la sección 6.

### 3.5 Lo de cada día

Debajo de los carriles, lo que no es una barra: los feriados («Feriado: …», con la bandera) y los eventos (la hora en negrita y el
título; los compartidos y los de otra persona con las dos personas, los tuyos solos sin ícono), con los colores de hoy.

**Los renglones** (decisión 4): cada día tiene 4 lugares, menos los carriles de su semana. Con `k` cosas y `L` lugares:

- si `k` ≤ 3 y `k` ≤ `L`, se ven todas, cada una con un renglón, y los lugares que sobran se reparten en orden hasta el tope (3
  renglones con 1 cosa, 2 con 2, 1 con 3 o más). Con 4 lugares: 1 cosa, 3 renglones; 2 cosas, 2 y 2; 3 cosas, 1 cada una.
- si no, se ven `L − 1` (al menos una), de un renglón, y «y N más», que despliega el resto en la celda como hoy.

El texto que no entra se corta con «…» al final de su último renglón, y el `title` lo dice entero.

### 3.6 La leyenda y «Próximos»

- **La leyenda**, debajo del mes, como hoy, con una muestra de cada color que lleva su ícono; «Compañeros que no están» solo para
  quien los ve (como hoy).
- **«Próximos»** no cambia de forma: suma el ícono de cada cosa delante del título y los compañeros con el primer nombre («Carla no
  está», «Hasta el viernes 13/11»; «De Julián», «Con Carla»).

### 3.7 El movimiento

Una sola vez por carga de la página, la primera vez que el mes se dibuja y se ve (si la pestaña abre en otra, al entrar a la Agenda):
las barras se dibujan de izquierda a derecha, semana por semana, en alrededor de un segundo. Como en el Resumen: con transiciones de
CSS (nada de `@keyframes` ni `animation`, que `tests/paginas.test.js` no deja), un atributo que deja las barras sin dibujar y se saca
dos cuadros después, y la demora de cada barra en una variable en su `style`. Cambiar de mes, prender el fin de semana o volver a
pedir el mes después de guardar no se mueve. Con `prefers-reduced-motion: reduce`, o sin `requestAnimationFrame`, nada se mueve.

### 3.8 El teléfono (640 px o menos)

- La grilla queda de 5 o 7 columnas, más baja: el número centrado, las barras como **líneas finas** (verde y pizarra, sin texto) y lo
  de cada día como **puntos de color** debajo del número (tinta, violeta, ámbar). Sin «+».
- **Tocar un día lo elige** (un anillo alrededor del número) y debajo de la grilla aparece **el día elegido**: su fecha («Miércoles 28
  de octubre (hoy)»), «Nuevo evento» con esa fecha y la lista de lo de ese día con letra legible y filas de 44 px o más (el ícono, la
  hora o «Todo el día», el texto y, en un evento, quién está). Un evento de la lista se abre como en la grilla. Al abrir, el elegido es
  hoy; al cambiar de mes, hoy si es el mes de hoy y si no el 1. Si ese día no se ve (un sábado o un domingo con el fin de semana
  oculto), el primer día visible que lo sigue en la grilla y, si no hay ninguno, el último visible que lo precede (hoy sábado 31/10 →
  el viernes 30; el 1/11, domingo → el lunes 2). La misma regla vale para el día donde arranca el foco del teclado (4.1).
- «Próximos» va **después** del mes (hoy va antes: el día elegido ya muestra hoy).
- En la compu el día elegido no se ve.

## 4. Cómo se usa

### 4.1 Tocar un día

- **En la compu**: un clic en cualquier lugar de un día que no sea un evento ni «y N más» abre «Nuevo evento» con esa fecha: también
  sobre un feriado o sobre el pedazo de una barra (la barra es parte del día; tocar una licencia no lleva a Licencias, decisión 14).
- **En el teléfono**: tocar un día lo elige (3.8).
- **Con el teclado** (decisión mía, sección 9): el número de cada día es un botón; el mes es una sola parada del tabulador (`tabindex`
  móvil: las flechas van de día en día y de semana en semana, Inicio y Fin al primero y al último día visible de la semana, y el foco
  arranca en hoy o en el 1). Enter o Espacio hacen lo mismo que el toque de ese tamaño de pantalla: en la compu, «Nuevo evento» con
  esa fecha; en el teléfono, elegirlo. Su nombre accesible lo dice («Nuevo evento el jueves 22/10» o «Ver el jueves 22/10») y cambia
  si cambia el tamaño. Los eventos de la celda siguen siendo botones, como hoy.

### 4.2 Lo demás

‹ › y «Hoy» como hoy (sin poner el mes en la dirección). Un evento propio abre «Editar evento» y uno de otra persona su detalle, como
hoy. Los formularios y los modales no cambian.

## 5. El servidor

Como en todo Mi espacio (Ruling 19), los textos y los nombres los arma el servidor; la página cuenta solo lo que es de dibujo (las
semanas, los tramos, los renglones y cuántas cosas quedaron en el fin de semana).

### 5.1 El nombre de los compañeros

Una regla pura (en `services/miEspacioReglas.js` o `miEspacioEventosReglas.js`, a elección del plan), con las personas de
administración activas (superadmin, admin y editor, `activo = 1`):

- el nombre corto es la primera palabra de `nombre_completo`;
- si otra persona de esa lista tiene la misma primera palabra (comparada sin mayúsculas ni tildes), se le suma un espacio, la inicial
  del último apellido y un punto: «Carla B.»;
- si aun así se repite (mismo nombre e inicial), el nombre completo;
- una persona que no está en la lista (por ejemplo, quien creó un evento y ya no es de administración) se compara contra la lista.

La lista es la de toda la administración activa, no la del mes: el nombre de alguien no cambia de un mes a otro.

Dónde va el nombre corto: todo lo que la agenda y el Resumen dicen de **otra** persona de administración:

- `GET /mi-espacio/eventos`: los compañeros (`nombre` y `texto` de cada uno: «Carla no está») y, en los eventos, `creador`,
  `quien_texto` («De Julián») y `quien_largo` («Lo creó Julián. Están: vos y Carla.»). **`personas` sigue con los nombres
  completos**: el formulario de un evento propio los usa para mostrar a los invitados que ya no están en la lista para compartir, al
  lado de los nombres completos de esa lista;
- el Resumen: «Hoy y mañana» (los compañeros y el «de …» de los eventos);
- la fila de una licencia: «Tus compañeros ven «Andrea no está».» (el nombre de la persona como la ven los demás).

No cambian: la lista para compartir (`GET /mi-espacio/personas`, con el nombre completo para elegir bien), el encabezado de la página,
Configuración y los emails (la invitación, el cambio, la cancelación y el recordatorio siguen con el nombre completo).

`quien_texto` de un evento tuyo compartido con **una** persona pasa a nombrarla, «Con Carla» (hoy, «Con 1 persona»); con más, sigue
«Con 4 personas» (decisión mía, sección 9).

### 5.2 Lo nuevo de `GET /mi-espacio/eventos`

- **`companeros_por_dia`**: `[{ fecha, texto }]`, por fecha, un día por cada día hábil del rango en que falta algún compañero, con
  «Carla no está» o «Carla y Julián no están» («A, B y C no están»; los nombres por orden alfabético en castellano). Sale de los
  mismos compañeros de `ausentes` (sus `dias`), así que solo lo recibe quien los ve (a los demás, `[]`). La página arma los tramos
  comparando el `texto` de días seguidos.
- **`frase_del_mes`**: si el pedido trae `mes=AAAA-MM` (el que muestra la página; un mes que no es del rango pedido o no sirve, se
  ignora), la frase de la banda; si no, `null`. Se arma con lo que ve quien pide:
  - «N eventos» (los eventos del mes que ve, cualquier día; «1 evento»);
  - «N feriados» (los días del mes con algún feriado, también en un fin de semana; «1 feriado»);
  - cada una de tus licencias que toca el mes, por fecha, con su nombre y su artículo y sus fechas recortadas al mes: «tus vacaciones
    del 16 al 27», «tu franquicia el 4» (las vacaciones y las horas a favor, «tus»; las demás, «tu»: «tu licencia por estudios», «tu
    licencia médica», «tu licencia médica extraordinaria», «tu licencia por el grupo familiar», «tu franco compensatorio», «tu
    franquicia», «tu uso autorizado»);
  - todo junto con comas y «y», con mayúscula al principio y punto al final; sin nada, «Nada cargado en noviembre. Tocá un día para
    agendar algo.».
  - Los compañeros no van en la frase.

Lo que ya devolvía no cambia de forma, salvo los nombres de 5.1. Los tests que fijan las claves de la respuesta suman las dos nuevas.

### 5.3 Lo que no cambia en el servidor

La corrida de cada media hora, la reserva de los recordatorios, los cuatro emails, la validación de un evento, quién ve qué, las
tablas y las rutas. Sin SQL ni migración.

## 6. Accesibilidad

- La grilla sigue siendo una tabla con su cabeza; la región viva sigue siendo solo `#me-anuncio` (nada que se vuelve a dibujar lleva
  `aria-live` ni `role="status"`).
- **Las barras, para el lector de pantalla**: cada día dice lo suyo, aunque el texto visible vaya una vez por tramo (un texto oculto a
  la vista en cada día de la barra: «Vacaciones», «Carla no está»).
- Los íconos son decorativos (`aria-hidden`); el color nunca es lo único que distingue (cada cosa tiene su texto y su ícono).
- El foco visible de siempre (anillo tinta de 3 px con el halo `--sol-fuerte`); en el número de un día, también.
- Contraste de texto de 4,5:1 o más en todo, también en los días pasados y en el teléfono; los puntos y las líneas del teléfono, de
  3:1 o más contra el fondo de la celda.
- En alto contraste (`forced-colors`), las barras y los puntos se siguen viendo (con borde o con `CanvasText`, no solo con un fondo:
  hoy las rayitas desaparecen).
- Todo texto del servidor pasa por `Utils.escapeHtml`; un número va con `String`.

## 7. No objetivos y antiobjetivos

**No objetivos:** cambiar los eventos (todo el día, que se repiten, colores elegidos por la persona), las vistas de semana o de día,
exportar, que tocar una licencia lleve a Licencias, los emails, la corrida, «Hoy y mañana» más allá del nombre, y la Agenda de pedidos
de Reportes (es otra cosa).

**Antiobjetivos** (los de la agenda siguen valiendo: un evento personal visto por otro, el tipo de una licencia en la agenda de otro):

- que un compañero que no está se pierda de vista (por eso la pizarra);
- que algo quede escondido sin aviso (el fin de semana oculto avisa cuántas cosas hay);
- que un nombre corto confunda a dos personas;
- un movimiento que moleste (una sola vez, nada en bucle, nada con «reducir movimiento»);
- que la página recalcule lo que manda el servidor (días hábiles, textos, nombres).

## 8. Lo que tiene que pasar antes, y el despliegue

- **Antes**: el arreglo «Mi espacio: licencia anulada en Configuración» (otra sesión) entra primero en main y cambia lo que muestra la
  agenda (una licencia anulada deja de verse) y los mismos archivos (`mi-espacio.js`, `mi-espacio.html`, `VERSION_MI_ESPACIO`). El
  plan arranca leyendo ese main y ajustándose.
- **Despliegue**: sin SQL, sin cron, sin variables de entorno ni Run NPM Install: subir los archivos y Restart. `VERSION_MI_ESPACIO`
  sube (y `mi-espacio.js?v=` con ella).
- **Tests**: cambian las aserciones de HTML de la grilla, de «Próximos» y de la cabecera de la pestaña en
  `tests/mi-espacio-frontend.test.js` y `tests/paginas.test.js` (los ids y su orden, la leyenda, los cortes de 980 y 640 px, las
  reglas de los cinco colores y la de las rayitas del teléfono) y las listas de claves de `GET /mi-espacio/eventos` y los textos con
  nombres en `tests/mi-espacio-eventos-reglas.test.js` y `tests/mi-espacio-eventos-api.test.js`. Las paridades, la lógica de las
  fechas, el formulario, el detalle ajeno, el foco y la corrida siguen sin cambiar. `tests/paginas.test.js` deja escribir en un
  `style` solo `--n`, `--p`, `--demora` y `--duracion`: si la página escribe otra variable (por ejemplo, la de los renglones), el
  test la suma.

## 9. Decisiones mías (para que el usuario las revise)

1. El fin de semana prendido u oculto se recuerda por navegador (`localStorage`), no en la base.
2. El nombre corto se compara contra toda la administración activa, no contra el mes; si nombre e inicial se repiten, el nombre
   completo.
3. El nombre corto también en los eventos de la agenda y del Resumen («De Julián», «Lo creó Julián»), no solo en los compañeros que
   no están; la lista para compartir y los emails, con el nombre completo.
4. «Con Carla» en lugar de «Con 1 persona».
5. El teclado: el número de cada día es un botón con `tabindex` móvil (una parada para todo el mes); en la compu abre «Nuevo evento»
   con esa fecha y en el teléfono elige el día.
6. En el teléfono, «Próximos» va después del mes, porque el día elegido ya muestra hoy.
7. Las flechas del mes, a la derecha del título (no a los costados).
8. La frase del mes no nombra a los compañeros; cuenta los días con feriado, no los nombres.
9. Las barras se cortan en un feriado o en un fin de semana visible (se pintan los días hábiles de cada licencia, como hoy).
10. Los días que ya pasaron: el número en `--sg-suave` y lo de adentro algo desaturado; los de otro mes, con el número en
    `--sg-suave` en lugar del `--sg-gris` de hoy, que no llega a 4,5:1.
11. Un clic en un feriado o en el pedazo de una barra también abre «Nuevo evento» de ese día (las barras se dibujan por día, que es
    además lo que necesita el lector de pantalla: sección 6).
12. Si hoy (o el 1) cae en un fin de semana oculto, el día elegido del teléfono y el foco del teclado arrancan en el primer día visible
    que lo sigue en la grilla o, si no hay, en el último que lo precede.
13. `personas` de un evento propio sigue con el nombre completo (lo usa el formulario); el nombre corto va en `creador`,
    `quien_texto` y `quien_largo`.

## 10. Lo que queda para el plan

Las funciones y sus nombres (sin la palabra «agenda» a secas en el código: `evento`, `mes`, `mi_espacio_`), cómo se arma el HTML de
las barras dentro de la tabla, las medidas finas, el nombre de la clave de `localStorage`, en qué archivo va la regla del nombre corto
y cómo se pasa la lista de administración a cada lugar sin consultas de más.
