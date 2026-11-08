# Métricas: el modal de cada tramo

Lo que se abre al tocar un tramo de la banda de Métricas: sus ciclos, con los rótulos de sus fechas y de sus días, el número de la nota DGMIT y el gráfico.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-07-metricas-cajones-y-ciclos-design.md`
- `docs/superpowers/specs/2026-11-08-metricas-modal-rotulos-design.md`

Solo en la página (spec 2026-11-07-metricas-cajones-y-ciclos, 5): el PDF no lo lleva.

- La banda: cada nodo con tramo (RPAD, «DGMIT y Dirección Administrativa», «DGMIT y Dirección de Investigación Territorial», «Área responsable» y «Datos Públicos») es un `<button>` (`htmlDeNodo`, con `data-tramo` y `data-gestion`) con un círculo con un + y «Ver los ciclos»; el Portal sigue siendo un `<div>`.
  El orden de los hijos de `.mt-tramos` no cambia (la grilla usa `nth-child`).
  El botón abre el modal aunque el tramo no tenga ciclos: el modal dice por qué.
  El foco se ve adentro de la flecha (el recorte de la punta taparía un contorno de afuera) y, con `forced-colors`, el botón conserva su borde.
- Lo arma el servidor (`modalDelTramo`, `services/metricasReglas.js`), solo en la vista en días corridos: `tramo.modal` es `{ quien, leyenda, como_se_cuenta, lista, puntas, rotulo_de_los_dias, ciclos, vacio, grafico }`; cada ciclo es `{ dataset_id, titulo, area, estado, desde, desde_nota_dgmit, hasta, hasta_nota_dgmit, hasta_texto, dias_texto, nota }`; la página lo dibuja (`htmlDelModal`).
- De arriba abajo: el nombre del tramo, que es el nombre del diálogo; quién y la gestión («Área responsable · gestión externa»); con destildados, la franja «Calculado sin…» de la pestaña, sin «Volver a todos»; la frase; la cifra del cajón con la leyenda al lado; el gráfico; «Cómo se cuenta», solo si tiene líneas; y «Los ciclos (N)».
- Sin cifra, el título y el texto del vacío, en todos los tramos: también en la redacción, donde el texto repite los pendientes que ya dicen la leyenda y «Cómo se cuenta», porque así lo pide la spec (ruling del 08/11/2026).
- La leyenda dice cuántos cuentan en la cifra, cuántos están en curso y cuántas notas están pendientes de carga, cada una con su marca (lleno, aro con flecha o punteado: nunca solo el color); solo las que tienen ciclos.
- Los ciclos son los de la cifra: los destildados no están.
  Los que cuentan son tantos como `cifra.ciclos`; los en curso, como `en_curso.n`; las notas pendientes, como `pendientes`.
  Van primero los que cuentan (de más días corridos a menos; con empate, de más hábiles a menos y después por título), después los en curso (igual) y al final las notas pendientes (por la fecha del aviso).
  Cada fila: el dataset con el link a su Seguimiento y su área debajo; las dos fechas de la etapa, en las columnas con los rótulos del servidor (`puntas`, según el tramo y la gestión); y los días en las dos unidades («64 días corridos (45 hábiles)», «En el día», «hace 150 días corridos (102 hábiles)» en curso, «—» en una pendiente), en la columna con su rótulo (`rotulo_de_los_dias`).
  Los rótulos:

  | Gestión | Tramo | Empieza | Termina | Días |
  |---|---|---|---|---|
  | las dos | Aviso anticipado | Pedido DDPC vía RPAD | Vencimiento del dato | Días de anticipación |
  | externa | Redacción y entrega de nota | Pedido DDPC vía RPAD | Entrega de nota DGMIT | Días de redacción y entrega |
  | externa | Respuesta del área | Entrega de nota DGMIT | Datos recibidos | Días de circuito y producción |
  | externa | Preparación y carga | Datos recibidos | Carga en el portal | Días de preparación y carga |
  | interna | Producción del relevamiento | Pedido DDPC vía RPAD | Entrega del relevamiento | Días de producción |
  | interna | Preparación y carga | Entrega del relevamiento | Carga en el portal | Días de preparación y carga |

  La primera columna dice «Dataset».
  La carga es el único tramo cuyo rótulo cambia con la gestión: en la interna empieza donde termina la producción y lleva su mismo rótulo, «Entrega del relevamiento».
  Ese rótulo vale también para un ciclo resuelto con datos de una fuente pública: la producción ya cuenta así todo dato recibido.
  Sin ciclos, «Sin ciclos en 2026.» y sin tabla.
- «avisado ya vencido: desde ese primer aviso» va debajo del aviso solo en las filas con días (las que cuentan y las en curso) de la redacción y de la producción (decisión del usuario del 08/11/2026): una nota pendiente de carga no tiene días contados desde ningún lado.
  La línea «N ciclos se avisaron ya vencidos: se cuentan desde ese primer aviso.» de «Cómo se cuenta» cuenta esas mismas filas.
- El número de la nota DGMIT («(N° 7/26)», con el «°» del Seguimiento) va en la misma celda que la fecha de la nota: en la redacción, junto a la entrega de la nota (`hasta`), y en la respuesta del área, junto a la primera fecha (`desde`).
  Lo llevan las filas que tienen esa fecha: en la redacción, las que cuentan; en la respuesta, las que cuentan y las en curso.
  Una nota pendiente de carga no tiene número ni fecha: su celda dice «pendiente de carga».
  Es el número de la primera nota DGMIT vigente del ciclo, la misma que da la fecha, tal como está cargado.
  Lo arma el servidor (`numeroDeLaNotaDgmit`): sin número, o con uno de solo espacios, es '' y la celda dice solo la fecha.
- La fecha y el número van en un `<span class="nro">` que no se corta (`white-space: nowrap`, en el `<style>` de `reportes.html`), por decisión del usuario del 08/11/2026 (spec 2026-11-08-metricas-modal-rotulos, 2.3): si el paréntesis pudiera bajar al renglón de abajo, en el modal de 900 píxeles quedaría separado de su fecha en casi todas las filas, y el usuario eligió la fecha y el número en un renglón.
  La columna del dataset se angosta lo que haga falta y, si la tabla no entra, se desplaza de costado en su marco.
- La foto del 31/12 guarda el modal de las vistas en corridos tal como lo arma el servidor el día en que se saca, el 10/01 (el plazo, en `docs/temas/despliegue.md`).
  Una foto sin `rotulo_de_los_dias` ni las claves de los números dibuja «Días» (`COLUMNA_DE_LOS_DIAS`) y la fecha sola: son claves nuevas, así que `VERSION_DE_LA_FOTO` sigue en 1 y la foto se lee con tolerancia.
- Estos rótulos son solo del modal: «Los casos» de la pestaña y «Los casos destildados» del PDF de Métricas tienen sus propios encabezados, porque son otra tabla, con una fila por ciclo y todos sus momentos.
  Los PDF y el Ciclo de vida del dato no llevan esta tabla.
- «Cómo se cuenta» del modal, con las cantidades del tramo (no las de toda la gestión), cada línea con su singular y sin las de 0:
  aviso, los avisados ya vencidos que vencen en el año y los vencimientos de la cobertura sin el aviso de la regla;
  redacción, las notas pendientes, los avisados ya vencidos y los de datasets que no requieren nota;
  respuesta, los en curso (con las dos unidades), los resueltos con una fuente pública y los que no requieren nota;
  producción, los en curso y los avisados ya vencidos;
  carga, los resueltos con una fuente pública («la carga se cuenta desde que se obtuvo»).
  Los filtros de la fuente pública y de los que no requieren nota repiten los de `aclaracionesDe`, que no cambia porque la usa el Ciclo de vida: un test ata las cantidades.
- El gráfico (`graficoDelTramo`, `services/metricasGrafico.js`, puro): un punto lleno por ciclo que cuenta, en el color del tramo, y un aro ámbar con una flecha por ciclo en curso, sobre los días corridos y con un `<title>` que dice el dataset y los días en las dos unidades; las notas pendientes no van, porque no tienen días.
  La mediana o el promedio va como una línea con su rótulo («mediana: 64 días corridos», «mediana: en el día»); sin cifra (solo en curso), sin línea; sin ningún ciclo con días, no hay gráfico.
  Los puntos que se tocarían se apilan, y una columna de más de 8 dice «+N».
  Toda la geometría (las x, los niveles, el eje con sus marcas y «días corridos», el rótulo de la línea y los «+N») la arma el servidor en un espacio de `GRAFICO.ancho` de ancho, y nada se sale ni se pisa, salvo la línea con los puntos de su columna (`tests/metricas-grafico.test.js`).
- Cuando la línea cruza la columna de un «+N», el «+N» va al lado de la línea y no arriba (ruling del 07/11/2026): la spec pide las dos cosas y no pueden valer juntas; gana que nada se pise.
- El gráfico se muestra desde 800 píxeles de ancho de pantalla (`@media (max-width: 799px)` lo oculta; decisión del usuario del 08/11/2026): más abajo, el SVG se achica y su letra queda en 8 o 9 píxeles, que no se leen.
  La lista tiene los mismos datos, y el gráfico tiene un nombre para el lector de pantalla que lo dice.
- Cómo se usa: el modal de siempre (`.modal-overlay` y `.modal` de `css/main.css`; `#mt-modal-tramo`, hijo de `body` después de `.app-container`), con `role="dialog"`, `aria-modal` y el título como nombre.
  Mientras está abierto, `.app-container` queda `inert` (ni el foco ni el lector de pantalla salen del modal) y `body` no se desplaza.
  El foco va a la × cuando termina la entrada; se cierra con la ×, con Escape o con un clic que empezó en el velo, y el foco vuelve al botón de la banda que lo abrió (`enfocarElBotonDelTramo`; si ya no está, al chip de la gestión elegida).
  Volver a pedir las métricas o cambiar de pestaña (`hashchange`) lo cierra.
  Con `prefers-reduced-motion`, aparece sin achicarse ni agrandarse.
  La × tiene 4,5:1 o más sobre el blanco (la de `main.css` no llega a 3:1); los estilos van en el `<style>` de `reportes.html`, para no cambiar `main.css`.
- En el teléfono, el cuerpo del modal se desplaza adentro (`overscroll-behavior: contain`) con la × a la vista, la tabla se desplaza de costado en su marco (`.mt-modal-tabla`, con la tabla de 600 píxeles como mínimo y los días en un renglón) y la página de atrás no se mueve.
- Una foto sin `modal` en sus tramos dibuja la banda sin botones.
- El modal pesa: va solo en las vistas en corridos, y «Datos para completar», que también pasa por `metricasDe`, lo recibe sin usarlo.
