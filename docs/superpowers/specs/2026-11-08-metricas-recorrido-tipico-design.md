# Métricas: el recorrido típico en lugar de la cinta

Fecha: 08/11/2026. Decisiones del usuario del 08/11/2026, en cuatro rondas de preguntas y una maqueta que aprobó ese día.
La maqueta se vio con la página real de main y los datos de la copia local de producción del 07/11/2026, fuera del repo (`~/rpad-notas/metricas-cinta/`); los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá; los textos, al pie de la letra.

## 1. Por qué

La cinta del recorrido típico (pestaña Métricas, debajo de la banda de «El circuito») pone las medianas de cada tramo sobre un eje de días respecto del vencimiento, con un rombo, una banda celeste, un rayado amarillo, marcas y dos barras de rótulos.
El usuario pidió, con sus palabras, «algo que muestre en porcentaje, una flecha o algo así, que diga cuánto tarda el circuito», con «el Aviso anticipado por afuera porque no es parte del ciclo per se, sino que es el tiempo que se avisa para que hagan los trámites».
También: que «Preparación y carga» (siempre de menos de 3 días) se pueda leer igual, que la pieza use los colores de cada actor, como la banda, y que no se parezca a las flechas de la banda.
En el teléfono, la cinta de hoy queda con letra de unos 7,7 píxeles y se desplaza de costado.

## 2. Decisiones del usuario

1. **La forma: «la línea con hitos»** (eligió la A2 entre cinco: la flecha como la banda, una sola flecha, la línea con hitos, la barra del 100 % y antes y después del vencimiento).
   Una línea fina a escala, partida por tramo en el color de su actor, con un hito al empezar cada tramo y el del Portal al final; arriba de cada tramo, su cifra grande, su nombre y sus días.
2. **Los colores de la banda**: la redacción de la nota y la producción del relevamiento en violeta (DGMIT), la respuesta del área en verde azulado (Área), la preparación y carga en tinta (Datos Públicos) y el final en verde (Portal).
3. **El aviso anticipado va por fuera**: una regla debajo de la línea, del inicio al vencimiento, que no se suma al total.
   La redacción (y la producción) se miden desde el aviso: el aviso corre junto con el primer tramo.
4. **Una sección propia, con aire y subtítulo**: «El recorrido típico», debajo de las tarjetas de «El circuito» y antes de «Los casos», con una bajada.
   La bajada es la que propuso el usuario: «Cuánto lleva un pedido de la gestión externa, desde el pedido de la DDPC hasta la publicación en el portal.»
5. **El total es la suma de las medianas** (o de los promedios) de cada tramo, con una frase corta que dice que es una referencia.
   Se descartó la mediana de los ciclos completos, caso por caso: no cierra con la suma de las partes.
6. **Porcentajes solo en la gestión externa.**
   En la interna hay un solo tramo a escala: arriba va la cifra en días, sin porcentaje.
7. **Los casos borde** van como en la maqueta: la carga de unos días, un tramo sin casos y el aviso más largo que el circuito (sección 4).
8. **Solo la página**, y sin código para leer en el servidor una foto con la cinta de antes: se despliega el 08/11/2026, antes de la primera foto.
   El PDF de Métricas y el Informe anual siguen sin dibujarla (decisión del 05/11/2026).
9. **Se van de la página** el recuadro «i» de las aclaraciones del circuito (avisados ya vencidos, fuente pública, sin nota DGMIT) y la frase «Con «Mediana», el número grande es el del medio…».
   Siguen en el PDF de Métricas, que no cambia.
10. **La frase de abajo, corta**: «El total suma las medianas de cada tramo: es una referencia, no la duración de un caso.»

## 3. Lo que se ve

### La sección

Debajo de las tarjetas de los tramos de «El circuito», con una línea fina arriba y aire, como «Los casos»:

- el título, «El recorrido típico»;
- la bajada, «Cuánto lleva un pedido de la gestión externa, desde el pedido de la DDPC hasta la publicación en el portal.» (o «de la gestión interna»);
- el dibujo;
- los avisos de «orientativo», si hay;
- la frase de abajo.

Después siguen «Los casos», como hoy.
La sección cambia con los chips de gestión (externa o interna) y con «Mediana» o «Promedio», como la cinta de hoy.

### El dibujo, en la computadora

De arriba abajo:

1. **El total**, centrado entre dos líneas finas que terminan en un tope: «En total, unos **85 días corridos** (57 hábiles)», con la cifra y su unidad en negrita.
2. **La línea**, partida en dos zonas:
   - **A escala**, todos los tramos menos la carga, uno detrás del otro, cada uno de un ancho proporcional a sus días.
     Arriba de su pedazo de línea, en su color: la cifra grande (el porcentaje en la externa, los días en la interna), el nombre del tramo y sus días en las dos unidades.
     Al empezar cada tramo, un hito: un círculo blanco con el borde de su color.
   - **Al final, de ancho fijo y fuera de escala**, la preparación y carga, en tinta, con su hito, y el Portal: un círculo verde lleno con «Portal» y «datos publicados» al lado.
     La carga siempre es corta: con su ancho fijo, su texto se lee igual.
3. **El vencimiento**: una línea punteada que corta la línea a escala donde cae, contando el aviso desde el inicio.
4. **El aviso anticipado**, debajo: un rombo en el inicio, una regla hasta el vencimiento con un tope y, en el medio de la regla, «**Aviso anticipado:** 35 días corridos (24 hábiles)»; al lado del tope, «vencimiento».
   Si la regla es más angosta que su texto (menos de unos 420 px; con `sigue`, que dice más, unos 720), el texto baja a su propio renglón debajo de la regla, de a una línea hasta 280 px de ancho y de ahí más corta, y nunca pasa por «vencimiento».
   Lo decide el CSS con una consulta de contenedor sobre la regla, no el servidor.

Ejemplo (cifras inventadas), gestión externa con la mediana:

```
                ├──────────── En total, unos 85 días corridos (57 hábiles) ────────────┤
  45 %                               55 %                                  En el día
  Redacción y entrega de nota        Respuesta del área                    Preparación y carga
  38 días corridos (25 hábiles)      47 días corridos (32 hábiles)                             Portal
  ○━━━━━━━━━━━━━━━━━━━━━━━━━━━━┊━━━━━○━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━━◉ datos publicados
  ◆──── Aviso anticipado: 35 días corridos (24 hábiles) ────┤ vencimiento
```

### En el teléfono

Hasta 700 píxeles de ancho:
- arriba de cada tramo, solo la cifra grande, más chica; el nombre y los días van en una lista debajo del dibujo;
- la zona fija de la carga y el Portal se angosta, y «Portal / datos publicados» no se escribe (el círculo verde queda);
- el texto del aviso baja debajo de su regla (el mismo mecanismo de la computadora, con una regla angosta);
- la lista: un cuadradito del color de cada tramo, su nombre en negrita y, debajo, sus días, con el porcentaje en la externa: «38 días corridos (25 hábiles) · 45 %».

Nada se desplaza de costado.

## 4. Los textos y los casos

Todos los arma el servidor (Ruling 19).
Los días en la vista en corridos: «N días corridos» con los hábiles entre paréntesis, «(N hábiles)»; con 1, «1 día corrido» y «1 hábil».
Con la vista en hábiles (la foto guarda las dos), «N días hábiles», sin paréntesis.

| Lo que va | Texto |
|---|---|
| Título | «El recorrido típico» |
| Bajada | «Cuánto lleva un pedido de la gestión externa, desde el pedido de la DDPC hasta la publicación en el portal.» (o «interna») |
| Total | «En total, unos » + «85 días corridos» (en negrita) + « (57 hábiles)» |
| Total, si falta un tramo | «El total se completa cuando haya casos de todos los tramos» |
| Cifra grande, externa completa | «45 %»; si redondea a 0, «menos del 1 %» |
| Cifra grande, interna o con un tramo sin casos | «38 días corridos», y debajo del nombre, «(25 hábiles)» |
| Cifra grande, un tramo de 0 días | «En el día», sin días debajo |
| Cifra grande, un tramo sin casos | «Sin casos», y debajo del nombre, «se completa cuando haya casos» |
| La redacción sin notas DGMIT cargadas | «Sin casos», y debajo, «se completa cuando haya notas DGMIT cargadas» |
| Días debajo del nombre (externa completa) | «38 días corridos (25 hábiles)» |
| Portal | «Portal» y, debajo, «datos publicados» |
| Aviso | «Aviso anticipado:» (en negrita) + « 35 días corridos (24 hábiles)»; al lado del tope, «vencimiento» |
| Aviso de 0 días | «Aviso anticipado: el mismo día del vencimiento» |
| Aviso sin regla (falta un tramo) | «Aviso anticipado: 35 días corridos (24 hábiles) antes del vencimiento» |
| Aviso sin casos | «Aviso anticipado: sin casos todavía» |
| Aviso más largo que el circuito | «Aviso anticipado: 50 días corridos (34 hábiles); la publicación llega 18 días corridos antes del vencimiento» |
| Orientativo | «Aviso anticipado: con tan pocos casos, es orientativo.» (uno por tramo con `orientativo`, con su nombre) |
| Lista del teléfono | nombre y «38 días corridos (25 hábiles) · 45 %», «en el día» o «sin casos todavía»; en la interna, sin porcentaje |
| Frase de abajo | «El total suma las medianas de cada tramo: es una referencia, no la duración de un caso.» (con «Promedio», «los promedios»); sin total, no va |

Las reglas de cada caso:

- **El porcentaje** de cada tramo es su parte del total en la unidad de la vista, redondeado por el resto mayor para que sumen 100.
  Un tramo de 0 días no lleva porcentaje: dice «En el día».
  Solo en la gestión externa y con todos los tramos con cifra.
- **El total de hábiles** es la suma de los hábiles de los tramos; si a alguno le faltan, el total va sin paréntesis.
- **La carga de unos días**: su cifra grande es su porcentaje (en la externa) o sus días (en la interna), y su pedazo de línea sigue siendo de ancho fijo.
- **Un tramo sin casos**: su pedazo de línea va en gris punteado, con un ancho del 70 % de lo que suman los tramos con cifra (al menos 1 día); no hay total, ni porcentajes, ni vencimiento, y el aviso va en un renglón sin regla.
- **El aviso más largo que el circuito** (el vencimiento cae después de la publicación): la regla llega hasta el final de la zona a escala y termina en una flecha, sin tope ni «vencimiento», y no hay línea punteada.
- **El vencimiento dentro de la carga** (el aviso dura más que los tramos a escala, pero no más que el total): la línea punteada va al final de la zona a escala.
- **Un tramo angosto**: si un tramo a escala ocupa menos del 12 % del ancho, no lleva nada arriba de su línea (ni la cifra grande, que tampoco entra), y la lista, con sus cifras, va siempre, también en la computadora.
- **Todos los tramos a escala en 0 días**: se reparten el ancho en partes iguales.
- **Sin dibujo**: si ningún tramo del circuito (sin contar el aviso) tiene cifra, la sección no se muestra.

## 5. Contratos

### El servidor: `services/metricasCinta.js`

`cintaDeMetricas(tramos, { gestion, dias, estadistico })` sigue siendo pura y nunca tira; la opción `letra`, sin uso, se va.
Recibe los tramos de una gestión de `vistaDe` y lee de cada uno `clave`, `nombre`, `cifra.valor`, `cifra.orientativo`, `habiles.valor` y `vacio.titulo`, como hoy.
Devuelve null (sin dibujo) o:

```js
{
  forma: 'recorrido',                 // FORMA_DE_LA_CINTA: la página no dibuja una cinta sin ella (sección 5, la foto)
  titulo: 'El recorrido típico',
  bajada: 'Cuánto lleva un pedido de la gestión externa, desde el pedido de la DDPC hasta la publicación en el portal.',
  total: { antes: 'En total, unos ', cifra: '85 días corridos', despues: ' (57 hábiles)' },
  partes: [                           // los tramos a escala, en orden; los anchos suman 100
    { clave: 'tramite', actor: 'dgmit', ancho: 44.71, angosta: false, grande: '45 %',
      nombre: 'Redacción y entrega de nota', dias: '38 días corridos (25 hábiles)' },
    { clave: 'respuesta', actor: 'area', ancho: 55.29, angosta: false, grande: '55 %',
      nombre: 'Respuesta del área', dias: '47 días corridos (32 hábiles)' }
  ],
  carga: { clave: 'carga', actor: 'ddpc', grande: 'En el día', nombre: 'Preparación y carga', dias: '' },
  portal: { nombre: 'Portal', texto: 'datos publicados' },
  vencimiento: { x: 41.18 },          // % de la zona a escala, o null
  aviso: { rotulo: 'Aviso anticipado:', texto: '35 días corridos (24 hábiles)', ancho: 41.18, sigue: false, vencimiento: 'vencimiento' },
  orientativos: [],                   // 'Aviso anticipado: con tan pocos casos, es orientativo.'
  lista: [{ actor: 'dgmit', nombre: 'Redacción y entrega de nota', texto: '38 días corridos (25 hábiles) · 45 %' }, …],
  lista_siempre: false,               // true con un tramo angosto
  aclaracion: 'El total suma las medianas de cada tramo: es una referencia, no la duración de un caso.',
  descripcion: 'El recorrido típico de un pedido de la gestión externa: en total, unos 85 días corridos (57 hábiles). …'
}
```

- `actor`: 'dgmit' (redacción y producción), 'area' (respuesta), 'ddpc' (carga) o 'gris' (un tramo sin cifra).
- `ancho`: el ancho de cada tramo a escala, en porcentaje con dos decimales; el último absorbe el redondeo.
- `aviso.ancho`: el largo de la regla en porcentaje de la zona a escala; 100 con `sigue`; null sin regla (falta un tramo o el aviso no tiene cifra), y entonces la página escribe `rotulo` y `texto` en un renglón.
- `total`: sin total, `{ antes: 'El total se completa cuando haya casos de todos los tramos', cifra: '', despues: '' }`.
- `descripcion`: el `aria-label` del dibujo, con todo lo que dice en una frase: el total, cada tramo con sus días y su porcentaje, y el aviso.
- `cintasDeLaVista(vista, { dias, estadistico })` no cambia: `{ externa, interna }`.
- Desaparecen `ancho`, `alto`, `linea`, `ticks`, `banda`, `rayado`, `gris`, `segmentos`, `marcas`, `rotulos`, `eje`, `alturas` y `ALTURAS_DE_LA_CINTA`.

### La API

`GET /api/metricas` sigue mandando `cinta: { externa, interna }`, ahora con la forma nueva.
Las vistas no cambian: `vista.circuito.aclaraciones` se sigue mandando (la usa el PDF de Métricas) y las 11 claves de cada tramo quedan igual (`tests/metricas-huellas.test.js`).

### La foto del 31/12

La foto sigue guardando las cuatro cintas ya armadas, con la forma nueva; `VERSION_DE_LA_FOTO` sigue en 1 y `deLaFoto` no cambia.
Todavía no hay ninguna foto: la primera se saca el 10/01/2027, y esta entrega va a producción el 08/11/2026 (lo dijo el usuario), así que ninguna foto va a tener la forma de antes.
Por eso no hay código para leer la forma de antes en el servidor (decisión del usuario del 08/11/2026).
Si igual llegara una, la página no dibuja nada y oculta la sección (`htmlDeCinta` devuelve ''): nunca da error.

### La página: `public/js/reportes.js` y `public/reportes.html`

- `htmlDeCinta(cinta)` (pura) reemplaza a `svgDeCinta` y a `htmlDeLeyendaDeCinta`: HTML y CSS, sin SVG.
  Imprime lo que manda el servidor, sin calcular nada: los anchos, la x del vencimiento y el largo de la regla van en `style="width:…%"` y `style="left:…%"`, como las barras de Resultados.
  `actor` pasa por una lista blanca ('dgmit', 'area', 'ddpc', 'gris'); un número, por `coordenada`; todo texto, por `escaparTexto`.
  Sin cinta, o con una que no es la forma nueva, devuelve ''.
- Se van `svgDeCinta`, `htmlDeLeyendaDeCinta`, `nombreDeLaMarca`, `iconoDeLaMarca`, `rectangulo`, `NOMBRES_DE_LOS_HITOS`, `LEYENDA_DE_LA_CINTA`, `LEYENDA_FIJA`, `TIPOS_DE_MARCA` y `COLORES`, si nadie más los usa, y `htmlDeAclaraciones`.
- `reportes.html`:
  - `#mt-cinta` y `#mt-aclaracion-cinta` pasan debajo de la frase del pie, antes de «Los casos»; `#mt-cinta` deja de tener `tabindex` y `role` (ya no se desplaza de costado);
  - se van `#mt-leyenda`, `#mt-aclaraciones` y el `<p class="mt-pie">` de «Con «Mediana»…»;
  - el CSS de `.mt-cinta-svg`, `.mt-cinta-marco svg` y `.mk-*` se cambia por el de la sección nueva, con los tokens de hoy (`--sg-violeta`, `--sg-del-area`, `--sg-tinta`, `--sg-verde`, `--f-titulo`, `--f-texto`).
- `dibujarElCircuito` escribe `htmlDeCinta(cinta)` en `#mt-cinta`, lo oculta sin cinta y escribe `cinta.aclaracion` en `#mt-aclaracion-cinta`.
- `TEXTOS_DE_LA_PESTANA.pieDelCircuito` sigue en el PDF de Métricas.

### Accesibilidad

- El dibujo es un `role="img"` con el `aria-label` de `descripcion`; el título es un `<h3>`.
- El color nunca es lo único: cada tramo tiene su nombre escrito (arriba o en la lista).
- Contraste: el violeta, el verde azulado, la tinta y el verde sobre blanco pasan 4,5:1; el gris de los textos (`--sg-suave`) también.
- La línea y los hitos son bordes, para que se vean en alto contraste (`forced-colors`) y al imprimir (`print-color-adjust: exact`).
- Nada se mueve.

## 6. Fuera de alcance

- La cinta del Seguimiento de un dataset (`services/seguimientoCinta.js`).
- Los PDF de Métricas y del Informe anual: no cambian, y `REFERENCIA_DE_LOS_PDF` tampoco.
- Las reglas de cada tramo (`medir`, `vistaDe`), las tarjetas de «El circuito», el modal de cada tramo y «Los casos».
- La mediana de los ciclos completos, caso por caso.

## 7. Tests

- `tests/metricas-cinta.test.js` se reescribe para la forma nueva, con cifras inventadas: los textos de la sección 4, los anchos que suman 100, el redondeo por el resto mayor, el vencimiento, cada caso borde, la vista en hábiles, el promedio, datos raros que no tiran y `cintasDeLaVista`.
  Se va `REALES`: eran cifras de producción del 24/10/2026 en un repo público.
- `tests/reportes-frontend.test.js`: `htmlDeCinta` (lo que imprime, el escape, la lista blanca, los ceros, nada de `NaN`, `null` ni `undefined`, una forma vieja da ''), los ids de la página sin `mt-leyenda` ni `mt-aclaraciones`, y el pie de la mediana fuera de la página pero en el PDF.
- `tests/metricas-reglas.test.js`: la cinta de la externa nombra «Redacción y entrega de nota» con notas DGMIT y, sin ellas, también la nombra, en gris, con «se completa cuando haya notas DGMIT cargadas»; ninguna dice «trámite».
- `tests/reportes-pdf.test.js`: el PDF de Métricas no dice «El recorrido típico» ni «En total, unos».
- `tests/paginas.test.js`: las versiones (sección 8).

## 8. Despliegue

- En producción **antes del 10/01/2027**: la foto de 2026 guarda la cinta que esté ese día.
- Sin SQL, con Restart (cambia el servidor).
- Cambia `reportes.js`: `VERSION_REPORTES` pasa a 20261215 y `VERSION_FERIADOS` a 20261216 (tiene que quedar mayor), así que el kit lleva también `configuracion.html`.
- Archivos: `services/metricasCinta.js`, `public/js/reportes.js`, `public/reportes.html` y `public/configuracion.html`.
- Documentación: `docs/temas/metricas-y-reportes.md` (la cinta, la página y la foto) y las menciones de `README.md`.
