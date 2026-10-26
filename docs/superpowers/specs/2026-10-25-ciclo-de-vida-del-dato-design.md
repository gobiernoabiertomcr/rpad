# Ciclo de vida del dato

Fecha: 25/10/2026. Estado: spec y maquetas aprobadas por el usuario el 25/10/2026; implementada en la rama claude/ciclo-de-vida-del-dato-aba0d0 (pendiente del merge en main).

Maquetas en `docs/superpowers/specs/2026-10-25-ciclo-de-vida-del-dato-mockups/`. Para verlas, servir la carpeta con cualquier
servidor estático; los datos y los PDF de ahí son de prueba y este documento manda sobre ellos.

- `1-tarjeta.html`: la pestaña Reportes de verdad, con la tarjeta nueva.
  - Las tarjetas las arma `reportes.js` (sus funciones, cargadas en un `vm` como en los tests).
  - El menú lateral ya está como va a quedar después de Configuración y Proyectos.
- `2-hojas.html`: las dos hojas A4 en HTML, dibujadas en puntos con la letra y los colores del PDF.
  - Se pueden ver con los datos reales o con datos inventados.
  - `?variante=b` y `?variante=c` son las variantes descartadas: B, «ficha con regla», y C, «tabla».
- `3-pdf.html` y los dos `Ciclo-de-vida-del-dato-2026-prueba*.pdf`: un PDF de verdad.
  - Lo armó un script descartable con la base real de los reportes (`reportesPdfBase.js`).
  - `pdf-diagramacion.js` verifica que tenga dos hojas A4 y que nada se pise ni se salga de los márgenes.
  - Es la referencia visual de la implementación.
- `datos.js`: los números de las maquetas.
  - **Reales:** la base local (copia del dump de producción del 25/10/2026), 2026 al 25/10, calculados con las reglas de Métricas. Las cifras de cada tramo coinciden con `GET /api/metricas`.
  - **Inventados**, marcados en naranja en la maqueta:
    - las etapas 2 y 3 de la gestión externa, porque todavía no hay notas DGMIT cargadas;
    - la comparación con el año anterior, porque 2026 es el primer año con métricas.

## Por qué

En la pestaña Métricas, «El circuito» muestra una sola cifra por tramo: la mediana o el promedio, en días hábiles o corridos. El usuario quiere un reporte que dé **más detalle de cuánto tarda el dato en cada etapa**, con estadísticas, para presentarlo. La forma la eligió él:
- dos hojas A4, la primera para la gestión externa y la segunda para la interna;
- en cada hoja, un bloque por etapa;
- en cada bloque, el tramo del circuito con lo que se hace en esa etapa, y al lado sus cifras;
- arriba de todo, el circuito entero en chico, como índice de los bloques.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Un PDF nuevo, «Ciclo de vida del dato», en la pestaña Reportes (grupo «Para presentar»), de cualquier año con métricas: el en curso al día de hoy, uno cerrado al 31/12.
- Por cada etapa: qué se hace, desde dónde hasta dónde se mide, la mediana y el promedio (en días hábiles, con los corridos al lado), el caso más largo y el más corto con su dataset, cuántos ciclos se midieron, los que están en curso, las notas pendientes de carga y la comparación con el año anterior.
- Que las cifras salgan de las mismas reglas que el circuito de Métricas y que **coincidan** con la pestaña para el mismo año (la mediana y el promedio de cada tramo, con todos los ciclos).
- Que un año cerrado se lea de la foto del 31/12 (Ruling 16), con las cifras nuevas incluidas en la foto.

**No objetivos**
- No cambia la pestaña Métricas: «El circuito» queda como está (decisión del usuario).
- No respeta los casos destildados en Métricas: el reporte cuenta siempre todos los ciclos, como el Informe anual (decisión del usuario).
- No cambia ninguna regla de Métricas ni del Seguimiento: cómo se arman los ciclos, qué cuenta en cada tramo, los en curso y los pendientes.
- No hay desgloses por área ni por tema, ni tramos sumados (el usuario ya los descartó en Métricas).
- No hay migración de base: la foto es JSON y solo suma una clave.

**Antiobjetivos**
- Que algo se lea como un reproche o un control, a la DGMIT o a un área.
  - Sin nota cargada se dice «pendiente de carga», nunca que no se mandó.
  - Nunca «tardanza», «demora», «atraso», «sin respuesta» ni «sin entregar».
  - El caso más largo nombra el dataset, no el área.
- Que un caso que todavía no terminó desaparezca: los en curso van siempre al lado.
- Que el reporte diga una cosa y la pestaña Métricas otra para el mismo año y la misma combinación.
- Que una cifra de un año cerrado cambie después de sacar su foto.

## Dependencia y orden

- Va en la cola **después de Proyectos** (`feat/proyectos`), que va después de Configuración (`feat/configuracion`). Las tres tocan `public/reportes.html`, `public/js/reportes.js`, `tests/paginas.test.js` (`VERSION_REPORTES`), `tests/permisos.test.js`, `tests/reportes-frontend.test.js`, `CLAUDE.md` y `README.md`.
- Antes de implementar, traer main y releer el código (la primera tarea del plan).
- **Plazo: en producción antes del 10/01/2027.** Ese día se saca la foto de 2026, que nunca se modifica (Ruling 16). Si la foto se saca con el código anterior, no tiene las cifras nuevas: ver 3.3 para ese caso.

## 1. Qué cuenta cada etapa

### 1.1 Las etapas

Son los tramos del circuito de Métricas (`TRAMOS` y `TRAMOS_DE_LA_GESTION` de `services/metricasReglas.js`), en el mismo orden y con los mismos nombres, «desde → hasta» e insignia.

**Gestión externa**

| # | Etapa | Tramo | De → a | Insignia |
|---|---|---|---|---|
| 1 | Aviso anticipado | `aviso` | RPAD → DGMIT y DA | DDPC |
| 2 | Trámite y entrega de la nota | `tramite` | DGMIT y DA → Área | DGMIT y DA (violeta) |
| 3 | Respuesta del área | `respuesta` | Área → DDPC | Área |
| 4 | Preparación y carga | `carga` | DDPC → Portal | DDPC |

**Gestión interna**

| # | Etapa | Tramo | De → a | Insignia |
|---|---|---|---|---|
| 1 | Aviso anticipado | `aviso` | RPAD → DGMIT y DIT | DDPC |
| 2 | Producción del relevamiento | `produccion` | DGMIT y DIT → DDPC | DGMIT y DIT (violeta) |
| 3 | Preparación y carga | `carga` | DDPC → Portal | DDPC |

### 1.2 Qué ciclos cuentan

**Exactamente los de la cifra del tramo en `vistaDe`, con todos los ciclos (`sin` = []).**
- Un ciclo cuenta en una etapa si terminó esa etapa en el año, con las reglas de `medir` (`metricasReglas.js`): los avisados ya vencidos no cuentan en el aviso, la fuente pública no cuenta en la respuesta, etc.
- Los que la empezaron y todavía no la terminaron son los **en curso**, solo donde Métricas los tiene: la respuesta y la producción.
- **No se copia ninguna regla.** Las cifras nuevas se calculan con `hechosDe`, `medir`, `cifraDe`, `contextoDe` y `TRAMOS` del mismo módulo.

### 1.3 Las cifras de una etapa

Para cada etapa, con sus `n` ciclos terminados:

| Cifra | Cómo |
|---|---|
| Mediana y promedio | Los de `cifraDe` (redondeados; con n par, la mediana es el promedio de los dos del medio), una vez en días hábiles y otra en corridos. Son los mismos números que muestra «El circuito» con cada combinación de los selectores. |
| El caso más largo | El ciclo con más días hábiles en la etapa. Se muestran sus días hábiles y sus corridos, y el título de su dataset. |
| El caso más corto | El ciclo con menos días hábiles. Ídem. |
| Empates | Si varios ciclos empatan en días hábiles, se nombra uno y se suma «y N más», con N la cantidad de **los otros** ciclos empatados (los empatados menos 1). El mismo dataset puede estar más de una vez, en ciclos distintos. Para el más largo se nombra el de más días corridos; para el más corto, el de menos; si siguen empatados, el primero por título. Ejemplo real: 15 ciclos con 0 días dan «Castraciones de Animales y 14 más». |
| Un solo ciclo | Con n = 1, el más largo y el más corto son el mismo: en lugar de los dos recuadros va uno solo, a todo el ancho, «El único caso». |
| En curso | El texto de `en_curso` del tramo, en días hábiles, como en Métricas: «3 sin datos registrados todavía, hace 206 días hábiles (mediana)». No entra en el caso más largo, que es solo de los terminados. |
| Pendientes | Solo en el trámite de la nota: «10 notas pendientes de carga», el de Métricas. |
| Orientativo | Con 4 ciclos o menos, «Con tan pocos casos, es orientativo.» |
| Año anterior | La mediana en días hábiles de la misma etapa del año anterior (ver 3.4): «Año anterior: mediana de 29 días hábiles», o «Año anterior: no hay». |

**Nombres de los extremos** (decisión del usuario):

| Etapa | El más largo | El más corto | Por qué |
|---|---|---|---|
| Aviso anticipado | «Con más anticipación» | «Con menos anticipación» | Ahí más días es mejor. |
| Las demás | «El caso más largo» | «El caso más corto» | |

«Dato mayor» y «Dato menor» se descartaron porque no se entendían.

**Unidades y «En el día»:**
- La unidad va siempre al lado del número: «días hábiles», o «día hábil» si es 1.
- Los corridos van debajo o entre paréntesis: «40 días corridos», o «1 día corrido».
- 0 es «En el día», sin unidad ni corridos, como en Métricas.

### 1.4 Una etapa sin ciclos

Si una etapa no tiene ningún ciclo terminado en el año, el bloque no muestra cifras. Lleva un vacío que sigue al `vacio` del tramo en Métricas, pero con textos propios que arma `etapasDe`:
- **Trámite de la nota**, sin ninguna nota DGMIT en el RPAD:
  - el título de Métricas, «Todavía no hay notas DGMIT cargadas»;
  - su texto, «10 notas pendientes de carga»;
  - un renglón nuevo debajo, «Se empieza a contar cuando se carguen en el Seguimiento.».
- **Respuesta del área**, sin notas DGMIT: «Sin datos todavía» y «Se empieza a contar cuando haya notas DGMIT cargadas.» (con punto final, a diferencia de Métricas).
- **Cualquier otra:** «Sin casos en 2026».

**Nada desaparece en un bloque vacío.** Debajo del vacío van, si los hay, los mismos renglones que en un bloque con cifras: los en curso, las notas pendientes y la aclaración de la etapa. También va «Año anterior: …», que en un bloque con cifras está en el recuadro del promedio. Pasa, por ejemplo:
- en la respuesta, cuando ya haya notas DGMIT pero ninguna respuesta terminada;
- en la producción, con solo ciclos en curso.

En el índice de arriba, una etapa sin cifra lleva una raya («—») en gris y la flecha punteada, como en Métricas.

### 1.5 Las aclaraciones

Las de `circuito.aclaraciones` de la vista, con sus textos, van en el bloque al que afectan:
- **Los avisados ya vencidos**, en el aviso anticipado de cada gestión: «6 ciclos se avisaron cuando ya estaban vencidos: no cuentan en esta etapa, y sus etapas siguientes se cuentan desde ese primer aviso.». Conserva la segunda parte del texto de Métricas, porque explica desde dónde se miden el trámite y la producción.
- **Los resueltos con una fuente pública**, en la respuesta del área.
- **Los de datasets que no requieren nota DGMIT**, debajo de los bloques de la hoja externa: «8 ciclos son de datasets que no requieren nota DGMIT: cuentan solo en el aviso anticipado y en la carga.».

Los textos cortos de los bloques son una versión del texto de Métricas que dice «en esta etapa». Los arma el servidor, como todos (Ruling 19).

## 2. El PDF

La referencia visual es `Ciclo-de-vida-del-dato-2026-prueba.pdf` (y su versión con datos inventados).

### 2.1 Las hojas

- Siempre **dos hojas A4**: la 1, «Gestión externa»; la 2, «Gestión interna».
- Diagramación fija, como la hoja del Seguimiento: cada hoja entra en una sola página y los bloques se reparten **todo el alto** que queda.
- Con cuatro etapas llenas, cada bloque de la externa mide unos 120 pt. Así va a quedar cuando haya notas DGMIT; el PDF de prueba con datos inventados lo comprueba.

Cada hoja, de arriba abajo:

1. **El encabezado de los reportes** (`agregarHoja`): a la derecha, «Ciclo de vida del dato» y la fecha larga de hoy.
2. **El título** (`prepararTitulo`):
   - rótulo «Ciclo de vida del dato · 2026, en curso», o «Ciclo de vida del dato · 2026» en un año cerrado;
   - título «Gestión externa» o «Gestión interna».
3. **La píldora azul:** «Del 01/01/2026 al 25/10/2026, con todos los ciclos» (en un año cerrado, «… al 31/12/2026, …»).
   - En un año cerrado que todavía no tiene foto se suma una píldora ámbar (`tono: 'sol'`) con el `aviso_foto` de `opcionesDeMetricas` (Ruling 17).
4. **El circuito, en chico:** un recuadro con el rótulo «El circuito · mediana en días hábiles».
   - Los nodos llevan solo su sigla y su color: RPAD, DGMIT y DA (o DGMIT y DIT), Área, DDPC y Portal. Lo de la DGMIT va en violeta y el Portal en verde.
   - En cada flecha va el número de la etapa (un círculo, violeta si es de la DGMIT) y su mediana en días hábiles: «27», «En el día» o «—».
   - La flecha va llena si la etapa tiene cifra y punteada en gris si no.
   - Sin los nombres de las etapas: no entraban, y el número los liga con los bloques.
5. **Un bloque por etapa** (2.2).
6. **Debajo de los bloques:** en la hoja externa, la aclaración de los datasets que no requieren nota DGMIT (1.5); en las dos, el recuadro gris «Cómo se cuenta» (2.3).
7. **El pie de los reportes:** «Generado el dd/mm/aaaa a las hh:mm por <nombre corto>» y «Ciclo de vida del dato · 2026 · Hoja k de 2».

### 2.2 El bloque de una etapa

Es un recuadro con un borde fino, partido en dos columnas: la izquierda, de unos 205 pt de ancho, y la derecha con el resto.

**Columna izquierda**
- El número de la etapa en un círculo, el nombre en negrita y la insignia del responsable.
- El tramo: el nodo de origen y el de destino (con su sigla y su color), y entre ellos la flecha, con el «desde → hasta» del tramo debajo (por ejemplo, «Del aviso al vencimiento»).
- La descripción (2.4), en gris, seguida de cómo se mide, en negrita.

**Columna derecha**
- El rótulo «Estadísticas de la etapa».
- Un mosaico de tres columnas:
  - **La mediana**, en la primera columna, ocupa todo el alto:
    - un fondo suave del color de la etapa: el acento, o violeta si es de la DGMIT;
    - el rótulo «Mediana»;
    - el número grande en el color de la etapa (24 pt), «días hábiles» debajo y los corridos;
    - abajo, «de 32 ciclos».
  - **El promedio**, arriba en las otras dos columnas: fondo gris claro, el rótulo «Promedio» y, a la derecha, el año anterior; debajo, el número (15 pt), la unidad y «(41 días corridos)» en un renglón.
  - **Los dos extremos**, debajo, uno en cada columna, con un borde fino: el rótulo («El caso más largo»…), el número (12 pt) con su unidad, los corridos y el título del dataset. El título va en uno o dos renglones según el alto que haya, y si no entra se corta con «…».
- Debajo del mosaico, en renglones chicos y solo los que haya:
  - «Con tan pocos casos, es orientativo.», en ámbar;
  - «En curso: …», en ámbar y negrita;
  - las notas pendientes de carga, en violeta;
  - la aclaración de la etapa, en gris.

Una etapa sin ciclos (1.4) muestra, en lugar del mosaico:
- el título del vacío, grande y en gris claro;
- su texto, en violeta en el trámite de la nota;
- el renglón de debajo, si lo hay;
- abajo de todo, los mismos renglones chicos de un bloque con cifras y «Año anterior: …».

### 2.3 «Cómo se cuenta»

Es un texto fijo, igual en las dos hojas:

> **Cómo se cuenta.** Días hábiles: de lunes a viernes, sin los feriados nacionales fijos; entre paréntesis, los corridos. La mediana es el valor del medio: la mitad de los ciclos tardó eso o menos. El caso más largo y el más corto (en el aviso, el de más y el de menos anticipación) son los ciclos de los extremos de cada etapa. Cada ciclo cuenta en el año en que terminó la etapa; el aviso, en el año de su vencimiento, aunque todavía no haya llegado. Los que todavía no terminaron la respuesta o el relevamiento van aparte, como «en curso». La comparación con el año anterior empieza en 2027.

En 2027 en adelante, la última oración se va.

La aclaración del aviso refleja cómo cuenta `medir`: el aviso anticipado se mide del aviso al vencimiento y cuenta por el año del vencimiento, aunque sea posterior a `al`. Los en curso solo existen en la respuesta y en la producción.

### 2.4 Las descripciones

Las redactó el usuario junto con la sesión de diseño. Cada una es un texto fijo seguido de cómo se mide.

**Gestión externa**
1. **Aviso anticipado.**
   - Qué se hace: «El RPAD avisa a la DGMIT y a la Dirección Administrativa qué conjuntos de datos vencen en los próximos 40 días y qué datos hay que pedir de cada uno, por Nota Digital (hasta el 12/10/2026, por email).»
   - Cómo se mide: «Se mide del aviso al vencimiento: cuanto más grande, más anticipación.»
2. **Trámite y entrega de la nota.**
   - Qué se hace: «La DGMIT y la Dirección Administrativa preparan la nota formal que le pide los datos al área y se la hacen llegar.»
   - Cómo se mide: «Se mide del aviso del RPAD al día en que el área recibió la nota, con las notas DGMIT cargadas en el Seguimiento.»
3. **Respuesta del área.**
   - Qué se hace: «El área reúne y prepara los datos pedidos y se los entrega a Datos Públicos.»
   - Cómo se mide: «Se mide del día en que el área recibió la nota al «Recibido el». Con datos de una fuente pública, no se cuenta.»
4. **Preparación y carga.**
   - Qué se hace: «Los datos llegan en PDF, en papel o desordenados: Datos Públicos los transcribe, los ordena y los normaliza (que «Palazzo», «P. Palazzo» y «Próspero Palazzo» queden como un solo nombre) y los publica en el portal en formato abierto.»
   - Cómo se mide: «Se mide del «Recibido el» al día de la carga en el portal.»

**Gestión interna**
1. **Aviso anticipado.**
   - Qué se hace: «El RPAD avisa a la DGMIT y a la Dirección de Investigación Territorial qué conjuntos de datos vencen en los próximos 60 días y qué hay que relevar.»
   - Cómo se mide: «Se mide del aviso al vencimiento: cuanto más grande, más anticipación.»
2. **Producción del relevamiento.**
   - Qué se hace: «La DGMIT y la Dirección de Investigación Territorial hacen el relevamiento y le entregan los datos a Datos Públicos.»
   - Cómo se mide: «Se mide del aviso del RPAD al «Recibido el».»
3. **Preparación y carga.**
   - Qué se hace: «El relevamiento ya llega ordenado: Datos Públicos lo revisa para comprobar que cumpla con los estándares de datos abiertos (estructura, normalización y formatos) y lo publica en el portal en formato abierto.»
   - Cómo se mide: «Se mide del «Recibido el» al día de la carga en el portal.»

Los textos de las ventanas (40 y 60 días) salen de `VENTANA_DE_LA_REGLA`, no se escriben a mano.

### 2.5 Letra y colores

Son los de los reportes:
- Helvetica;
- `COLOR` de `notasDigitalesAnexo.js`;
- el violeta `#5B4691` y el verde `#2E6B4C` de Métricas;
- el ámbar `#7A5200`.

Los tamaños son los del PDF de prueba:

| Elemento | Tamaño |
|---|---|
| Nombre de la etapa | 9,6 pt |
| Descripción | 7,2 pt |
| Rótulos | 6,4 a 6,8 pt |
| Mediana | 24 pt |
| Promedio | 15 pt |
| Extremos | 12 pt |
| Notas | 6,6 pt |

Ningún texto baja de 6,2 pt. Las formas anidadas (los recuadros, los mosaicos y los nodos) se dibujan como en el PDF de Métricas, de modo que `pdf-diagramacion.js` no las tome como bloques que se pisan.

## 3. El servidor

### 3.1 Las reglas

En `services/metricasReglas.js` (puro) se agrega una función exportada, **`etapasDe(casos, { anio, al })`**.
- Recibe los casos de `casosDe`.
- Devuelve `{ externa: Etapa[], interna: Etapa[] }`, en el orden de `TRAMOS_DE_LA_GESTION`.
- Calcula con `contextoDe`, `hechosDe`, `medir` (una vez en hábiles y otra en corridos) y `cifraDe`, sin copiarlos.
- Arma también los textos: los rótulos de los extremos, «de N ciclos», el vacío, la aclaración de la etapa, el en curso, los pendientes y el orientativo.
- Ninguna función tira.

Cada `Etapa`:

```
{ clave, nombre, desde_hasta, responsable, dgmit,
  n, orientativo,
  habiles: { mediana, promedio }, corridos: { mediana, promedio },    // null si n = 0
  largo: { habiles, corridos, dataset_id, titulo, mas, rotulo },      // null si n = 0
  corto: { habiles, corridos, dataset_id, titulo, mas, rotulo },      // null si n = 0
  textos: { ... },          // los que imprime el PDF, armados acá (Ruling 19)
  en_curso, pendientes_texto, vacio, aclaracion }
```

La forma exacta de `textos` queda para quien lo construye.

**Test de paridad:** la mediana y el promedio de cada etapa, con cada combinación de días, son los mismos que la `cifra.valor` de `vistaDe` con esa combinación y `sin` = [].

### 3.2 Los datos del reporte

`controllers/metricasController.js` suma una función exportada que lee el año igual que `metricasDe`: `opcionesDeMetricas`, con un año anterior a 2026 o futuro, da null y el controlador responde 404 `SIN_METRICAS`. Devuelve:

```
{ anio, al, en_vivo, aviso_foto, etapas: { externa, interna }, anterior: { externa, interna } | null,
  aclaraciones de la hoja (la de «no requieren nota DGMIT») }
```

- **En vivo:** `etapasDe(casosDe(await fuentesDe(null), { hoy: al }), { anio, al })`.
- **Con foto:** las `etapas` guardadas en la foto (3.3).

### 3.3 La foto del 31/12

- `datosDeLaFoto` (`services/metricasFoto.js`) guarda una parte más, `etapas`: el resultado de `etapasDe` con los casos del año. Se calcula una sola vez, porque ya trae las dos unidades y los dos estadísticos.
- `VERSION_DE_LA_FOTO` sigue en 1. `etapas` es una clave opcional: `datosLeidos` ya acepta claves de más, y `PARTES_DE_LA_FOTO` no la exige.
- **Una foto sin `etapas`** (sacada antes del despliegue) se lee calculándolas con los `casos` que guardó: `etapasDe(datos.casos, { anio, al: 31/12 })`.
  - Los casos guardados son exactamente las entradas de las cifras (un test lo garantiza: `vistaDe(datos.casos)` reproduce la vista guardada), así que con el mismo código da lo mismo que habría guardado.
  - Es la única excepción a Ruling 16 y solo cubre una foto sacada antes de este despliegue. Si el plazo se cumple, en producción no va a haber ninguna.
- El test de las claves exactas de la foto (`tests/metricas-foto.test.js`) suma `etapas`.

### 3.4 El año anterior

- La comparación es la mediana en días hábiles de la misma etapa y la misma gestión del año anterior, leída como se lee ese año: de su foto o, si es un año cerrado sin foto, en vivo al 31/12 (Ruling 17).
- Para un año anterior a `PRIMER_ANIO` (2026), o si la etapa no tuvo ciclos ese año, dice «Año anterior: no hay».
- No hay flechas ni colores que digan «mejor» o «peor»: es un dato.

### 3.5 La ruta, el controlador y el nombre

- **La ruta:** `GET /api/reportes/ciclo-de-vida?anio=` (`routes/index.js`, en el bloque de `/reportes/*`), con `authMiddleware` y sin `adminOnly`.
  - La ven todos los roles con sesión, también el lector y el colaborador. Sin sesión, 401.
  - Sin `anio`, el en curso. Un año sin métricas, 404 `SIN_METRICAS`.
- **El controlador:** el handler va en `controllers/reportesController.js`, con el patrón de «Datos para completar».
  - `ahoraArgentina()` una vez, `nombreCorto` y `disposicionDeAdjunto`.
  - Un 500 dice el mensaje fijo de `ERROR_AL_GENERAR.ciclo`: «Error al generar el Ciclo de vida del dato».
- **El dibujante:** `services/reportesCicloDeVidaPdf.js`, puro (sin pool).
  - `renderCicloDeVida(datos, { hoy, generado })`, con la base de `reportesPdfBase.js`.
  - Las piezas de `reportesMetricasPdf.js` que reuse (por ejemplo `contorno`, que hoy es privada, y los colores) se exportan en su lugar.
  - El PDF de Métricas y el Informe anual tienen que quedar idénticos. Hoy ningún test lo comprueba, así que el plan suma uno:
    - compara el contenido de cada hoja con `contenidoPorHoja` de `tests/pdf-lector.js`, que no mira la fecha de creación del PDF;
    - la referencia se toma con main ya traído, después del merge de Proyectos, que cambia un texto del Informe anual.
  - Los textos fijos (las descripciones y «Cómo se cuenta») van en una constante exportada del dibujante.
- **El nombre:** `nombreDelReporte('ciclo', { anio })` → `Ciclo-de-vida-del-dato-AAAA.pdf` (`services/reportesNombres.js` y su copia en `reportes.js`).

## 4. La pestaña Reportes

- **La tarjeta** «Ciclo de vida del dato» va segunda en «Para presentar», después de «Métricas del año». El grupo pasa a cuatro columnas (`rp-grilla g4`, que ya existe).
  - Ícono: `route` de Lucide.
  - Texto: «Cuánto tarda cada etapa del circuito, del aviso del RPAD a la carga en el portal: la mediana, el promedio y los casos más largo y más corto de cada una. Una hoja para cada gestión.»
- **El campo Año:** el selector de los años de `fotos`, con el en curso arriba y elegido de entrada, como en «Métricas del año».
  - Es independiente de la pestaña Métricas: no lleva los selectores ni los destildados.
  - El en curso no se escribe en la ruta.
- **Debajo del botón:** «2 hojas: la gestión externa y la interna».
- **Lo que hay que sumar en `reportes.js`:** `GRUPOS_DE_REPORTES`, `ICONOS_DE_REPORTES`, `REPORTES_POR_DEFECTO`, `htmlDeTarjetaDeReportes`, `pedidoDeReporte`, la copia de `nombreDelReporte`, `TARJETAS_CON_ANIO`, `CONTROLES_DE_REPORTES` y `conReporteElegido`. Hay que actualizar también los comentarios que dicen «siete».
  - Sin la clave nueva en `conReporteElegido`, que hoy solo acepta un año para `metricas`, `informe` y `completar`, el selector de año de la tarjeta no haría nada.
- **Versión:** sube `VERSION_REPORTES` (`tests/paginas.test.js` y el `?v=` de `reportes.html`). A esa altura, Proyectos ya la habrá subido: se usa la siguiente libre.
- **Nada más:** `api.js`, `main.js` y `main.css` no cambian.

## 5. Pruebas

Correr `npm test` completo antes y después; Docker es necesario para las de integración.

| Archivo | Qué prueba |
|---|---|
| `tests/metricas-reglas.test.js` (puro) | `etapasDe` sobre `tests/metricas-casos.js` y casos sintéticos: la paridad con `vistaDe` (3.1); los extremos y sus empates («y N más», el desempate por corridos y título); los nombres de los extremos del aviso; el vacío; el en curso; los pendientes; el orientativo; que no tira con entradas raras. |
| `tests/metricas-foto.test.js` (Docker) | La foto guarda `etapas`; una foto sin `etapas` se lee calculándolas de sus casos y da lo mismo. |
| `tests/reportes-pdf.test.js` (puro, con `pdf-lector.js` y `pdf-diagramacion.js`) | Dos hojas A4, una por gestión. Los textos de cada bloque, el encabezado, el pie «Hoja k de 2», la píldora y «Cómo se cuenta». Que nada se pise ni se salga, con datos reales y con las cuatro etapas llenas (incluido el título de dataset más largo y la aclaración más larga). Sin NaN, null ni undefined. Ninguna palabra de la lista de tono. El PDF de Métricas y el Informe anual, idénticos a antes. |
| `tests/reportes.test.js` (Docker, por HTTP) | El lector lo descarga; sin sesión, 401; un año sin métricas, 404; el `Content-Disposition` con el nombre; el 500 con su mensaje fijo. |
| `tests/reportes-frontend.test.js` (vm) | Ocho tarjetas, la nueva segunda en «Para presentar» con `g4`; su ruta y su nombre; la paridad de `nombreDelReporte`; el selector de año. |
| `tests/permisos.test.js` | La ruta nueva en las listas del lector, del colaborador y de 401. |
| `tests/paginas.test.js` | `VERSION_REPORTES`. |

Los números de la base real no van en los tests versionados (Ruling 3).

## 6. Documentación y despliegue

- **`CLAUDE.md`:**
  - una sección «Ciclo de vida del dato»;
  - en «Métricas y Reportes», «ocho tarjetas» y el reporte en la lista de los PDF;
  - la parte `etapas` de la foto y el plazo del 10/01/2027;
  - la convención de `reportes.js` (la tarjeta y la copia del nombre).
- **`README.md`:** la lista de reportes y el Changelog.
- **Kit `RPAD-deploy-ciclo-de-vida-del-dato` en el Escritorio:**
  - `PASOS.txt` en ASCII y `vuelta-atras/`;
  - **sin SQL**: subir los archivos y hacer Restart;
  - **antes del 10/01/2027**.
  - La vuelta atrás es volver a los archivos anteriores. Una foto sacada con este código guarda `etapas` de más, y el código anterior la lee igual.

## Decisiones mías (para que las revises)

- **Los extremos** se eligen por días hábiles, y los corridos que se muestran son los del mismo ciclo.
  - En el desempate, el más largo nombra el de más días corridos y el más corto, el de menos; después, el primero por título.
  - «y N más» cuenta los otros ciclos empatados.
  - Con un solo ciclo va un recuadro, «El único caso».
- **Un bloque sin cifras** igual muestra los en curso, las notas pendientes, la aclaración y el año anterior (1.4).
- **«Cómo se cuenta»** aclara que el aviso cuenta por el año de su vencimiento, aunque todavía no haya llegado. Es como lo cuenta Métricas.
- **El texto de los avisados ya vencidos** conserva «y sus etapas siguientes se cuentan desde ese primer aviso».
- **Los en curso** no entran en el caso más largo: van en su renglón propio. Por ejemplo, en el relevamiento interno el caso más largo es de 105 días hábiles, pero hay 3 en curso hace 206.
- **El año anterior** muestra solo la mediana en días hábiles. En 2026 dice «Año anterior: no hay», y «Cómo se cuenta» aclara que la comparación empieza en 2027.
- **El circuito de arriba** lleva solo las siglas y la mediana, porque los nombres de las etapas no entraban.
- **Un año cerrado sin foto** lleva una segunda píldora con el aviso de la foto, como la pestaña.
- **La foto sigue en la versión 1**, con `etapas` opcional. Una foto sin `etapas` se lee calculándolas de sus casos (3.3).
- **El selector de año** de la tarjeta arranca en el en curso.
- **El archivo** se llama `Ciclo-de-vida-del-dato-AAAA.pdf`.
- **Quién lo ve:** todos los roles con sesión.

## Lo que queda para quien lo construye

- La forma exacta de `textos` en cada `Etapa` y qué exporta `reportesMetricasPdf.js` para el dibujante, siempre que el PDF de Métricas y el Informe anual queden idénticos.
- Las medidas finas del bloque. La referencia es el PDF de prueba. Las condiciones: dos hojas siempre, nada que se pise, ningún texto bajo 6,2 pt, y que entren las cuatro etapas llenas con dos renglones de notas cada una.
- Si la función de 3.2 vive en `metricasController.js` o en un servicio propio, mientras reuse la lectura del año de Métricas sin copiarla.
