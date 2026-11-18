# El dato de la quincena: contrato v1.4, «Propuestas de datasets nuevos»

Fecha: 18/11/2026. Base: main 8784663 (en producción).
Lo pidió el director: que en cada edición Datito proponga datasets para abrir.
Datito escribió el borrador del contrato v1.4, y el usuario y Claude Code lo cerraron el 18/11.

## Por qué

- El director quiere que el equipo reciba, cada quince días, ideas concretas de datos para abrir en el portal.
- Datito ya cruza la agenda, las noticias, los pedidos de acceso a la información y el catálogo: de ahí salen las ideas.
- El criterio es la Guía Práctica de Apertura de Datos del municipio: la matriz de valor y riesgo, los formatos abiertos y que nunca haya datos personales identificables.
- Es solo una propuesta, una sección más de la edición, como la agenda: nadie la tiene que aprobar ni seguir en el RPAD.
- Hoy el RPAD rechaza con 422 cualquier clave que no conoce, así que la clave nueva tiene que entrar en el RPAD antes de que Datito la mande.
- El usuario la quiere en producción antes del viernes 20/11 a las 12:00, para que salga con la edición del 23/11; el primer envío real del correo es el martes 24/11 a las 8:05.

## Objetivos, no objetivos y anti-objetivos

- Objetivo: aceptar la clave opcional `propuestas_datasets` (de 0 a 3), validarla con las reglas del contrato y mostrarla en la página y en el mail al equipo, debajo de las propuestas, con el título «Propuestas de datasets nuevos».
- Objetivo: la prioridad de cada una la calcula el RPAD, de su valor y su riesgo, con la matriz de la guía.
- No objetivo: seguir cada propuesta con un estado, cruzarla con los datasets del RPAD o consultar el portal.
- No objetivo: el RPAD no controla las reglas editoriales de Datito: no forzar propuestas, no proponer lo que ya está en el portal, no repetir sin evidencia nueva y el lenguaje.
- No objetivo: el área que genera el dato. El usuario decidió que no va.
- No objetivo: los datasets desactualizados y los datos en PDF. Ya se ven en el RPAD.
- Anti-objetivo: poner en riesgo el envío del 24/11. Una edición sin la clave entra, se ve y se manda exactamente igual que hoy, byte por byte.
- Anti-objetivo: romper el plan B de Datito. Si el 23/11 sale con la v1.3, sin la clave, tiene que entrar.
- Anti-objetivo: un dato personal. El contrato lo prohíbe y ninguna clave nueva es para una persona.
- No cambian: el recibo del POST, la lista de tarjetas, Mi espacio, el envío, los horarios, las corridas, la huella ni las tablas.

## Enfoques

- Elegido: validar la clave en el POST con las piezas de hoy (objetos cerrados, `texto`, `lista`, `unoDe` y mensajes fijos), y leer todo de `metadata` al mostrar.
  Sin migración: la edición ya se guarda entera y nunca cambia.
- Descartado: una tabla con el estado de cada propuesta (sugerida, en evaluación, abierta, descartada). El usuario quiere solo una propuesta, una sección más; se puede sumar después, porque cada propuesta queda guardada en su edición.
- Descartado: una validación tolerante, que guarde la edición y oculte la propuesta mal armada. Datito pidió 422 explícitos, valida contra el schema oficial antes de cada POST, como con la v1.3, y así el RPAD sigue con una sola manera de validar.
- Descartado: exigir la clave en las ediciones nuevas. Con `schema_version` en `'1.0'` el RPAD no distingue una edición v1.4 de una v1.3, y exigirla rompería el plan B. La exige el schema oficial v1.4, que Datito chequea.

## 1. La validación del POST (`services/datoQuincenaReglas.js`)

- La edición suma la clave de primer nivel `propuestas_datasets`, opcional como `repeticion`: si falta, la edición tiene la forma de la v1.3 y sigue valiendo.
  Si está, es una lista de 0 a 3 elementos. Más: `propuestas_datasets`, «Puede haber como mucho 3 propuestas de datasets.».
- Cada elemento es un objeto cerrado con estas once claves, todas obligatorias. Una que falta o una de más dan los errores de hoy.

| Clave | Regla |
|---|---|
| `numero` | El índice más 1: «Las propuestas de datasets se numeran desde 1 y sin saltos.» |
| `titulo` | Texto de 5 a 120 caracteres: «Tiene que tener de 5 a 120 caracteres.» |
| `origenes` | Lista de 1 a 4 («Tiene que traer de 1 a 4 orígenes.»), sin repetidos («Este origen ya está en la propuesta.»), de `Agenda`, `Noticias`, `Pedidos de acceso` y `Cruce de datasets` («Los orígenes posibles son Agenda, Noticias, Pedidos de acceso y Cruce de datasets.»). |
| `justificacion` | Texto de 20 a 600 caracteres: «Tiene que tener de 20 a 600 caracteres.» |
| `datasets_relacionados` | Lista de 0 a 5 («Puede traer hasta 5 datasets relacionados.») de objetos cerrados `{ ckan_slug, nombre }`, sin slugs repetidos («Este dataset ya está en la lista.»). |
| `datasets_relacionados[M].ckan_slug` | Un texto con `^[a-z0-9_-]{2,100}$`: «El slug tiene que tener de 2 a 100 caracteres: letras minúsculas sin tildes, números, - y _.» |
| `datasets_relacionados[M].nombre` | `texto(200)`, el mismo tope que `dataset.nombre` de las propuestas. |
| `valor` | `Alto`, `Medio` o `Bajo`: «El valor tiene que ser Alto, Medio o Bajo.» |
| `riesgo` | `Alto`, `Medio` o `Bajo`: «El riesgo tiene que ser Alto, Medio o Bajo.» |
| `formato_sugerido` | `CSV`, `GeoJSON`, `JSON`, `KML` o `XML`: «El formato sugerido tiene que ser CSV, GeoJSON, JSON, KML o XML.» |
| `campos_sugeridos` | Lista de 3 a 15 («Tiene que traer de 3 a 15 campos sugeridos.») de `texto(64)` («Puede tener hasta 64 caracteres.»), sin repetidos («Este campo ya está en la lista.»). |
| `anonimizacion` | `null` o un texto de hasta 1000 caracteres, que no puede quedar vacío ni con solo espacios («El texto no puede quedar vacío ni con solo espacios.»): a diferencia de `texto(tope, { oNull: true })` de hoy, que acepta `""`. |
| `fuentes` | Lista de 1 a 5 («Tiene que traer de 1 a 5 fuentes.») de `direccion` (el validador y el mensaje de hoy), sin repetidas («Esta fuente ya está en la lista.»). |

- Los textos se miden con `Array.from`, como todos; vacíos, con solo espacios o con el carácter nulo dan los errores de hoy.
- La coherencia de cada elemento, solo si `valor` y `riesgo` traen valores válidos, y con un solo error de coherencia por elemento, en este orden:
  - `valor` `Bajo` con `riesgo` `Alto`: `propuestas_datasets[N].riesgo`, «Un dataset de valor bajo y riesgo alto no se propone (matriz de priorización).». Con este error, la anonimización ya no se mira.
  - Si no, y solo si `anonimizacion` no tiene ya su propio error (falta, no es texto ni `null`, vacía o de más de 1000):
    - `riesgo` `Medio` o `Alto` con `anonimizacion` en `null`: `propuestas_datasets[N].anonimizacion`, «Con riesgo Medio o Alto hace falta indicar la anonimización.»;
    - `riesgo` `Bajo` con un texto en `anonimizacion`: `propuestas_datasets[N].anonimizacion`, «Con riesgo Bajo, anonimizacion va en null.».
- Es la regla de hoy: a lo sumo un error por valor, y la coherencia se saltea cuando el valor ya tiene el suyo, como con `repeticion`.
- `propuestas_datasets` en `null` da «Tiene que ser una lista.». Los mínimos de 5 y de 20 se miden sobre el texto tal como llegó; los campos sugeridos, los slugs, los orígenes y las fuentes repetidos se comparan exactos.
- Dos elementos con el mismo `titulo`, comparado sin mayúsculas y sin los espacios de los extremos: en el segundo, `propuestas_datasets[N].titulo`, «Hay dos propuestas de datasets con el mismo título.».
- En los repetidos de una lista, el error va en el que repite (el segundo), con su índice.
- La cantidad y los elementos se suman, como hace hoy `lista`, que sigue mirando cada elemento: cinco orígenes con uno repetido dan los dos errores (el de cantidad y el del repetido).
- Las rutas, con índices desde 0, como todas. Los mensajes que escribió Datito no se cambian: los copia tal cual en su chequeo.
- Nada de esto consulta la base ni el portal: un slug que no existe no da 422 ni aviso.
- La huella no cambia de forma: es la de los bytes, como hoy. Mandar con la clave una edición ya archivada sin ella da el 409 de hoy.

## 2. La prioridad

- Una sola función pura, en `services/datoQuincenaReglas.js`, da la clave y el texto de la prioridad a partir de `valor` y `riesgo`:

| valor \ riesgo | Bajo | Medio | Alto |
|---|---|---|---|
| Alto | `alta`, «Prioridad alta» | `evaluar`, «Evaluar riesgos» | `evaluar`, «Evaluar riesgos» |
| Medio | `si_hay_recursos`, «Publicar si hay recursos» | `si_hay_recursos`, «Publicar si hay recursos» | `evaluar`, «Evaluar riesgos» |
| Bajo | `si_hay_recursos`, «Publicar si hay recursos» | `si_hay_recursos`, «Publicar si hay recursos» | (422 en el POST) |

- Valor Medio con riesgo Alto da «Evaluar riesgos»: lo decidió el usuario, porque el borrador de Datito no lo cubría.
- No se guarda: se calcula al mostrar, de la `metadata` archivada, que no cambia.
- Datito copia la misma tabla en su chequeo. Si alguna vez cambia, cambia en los dos lados.

## 3. El recibo (201 y 200)

No cambia: ni claves nuevas ni avisos nuevos. La prioridad no viaja en el recibo.

## 4. El detalle (`detalleDeLaEdicion`, para la página y el mail)

- Suma `propuestas_datasets`, después de `propuestas`:
  - `null` si la edición no trae la clave (todas las archivadas hasta hoy y las v1.3);
  - `[]` si llegó vacía;
  - si no, cada elemento con sus textos ya armados:
    - `numero_texto`: «Dataset nuevo N»;
    - `titulo`, `origenes`, `justificacion`, `formato`, `campos` y `anonimizacion`, como llegaron;
    - `prioridad`: `{ clave, texto }` de la sección 2;
    - `valor_y_riesgo`: «Valor alto · Riesgo bajo», con los valores en minúscula;
    - `datasets_relacionados`: cada uno `{ nombre, url }`, con `url` igual a `https://datos.comodoro.gov.ar/dataset/<ckan_slug>`;
    - `fuentes`, como llegaron.
- El servidor arma todos los textos; la página y el mail los imprimen tal cual.
- `tests/fixtures/dato-quincena-respuestas.json` (el contrato del detalle) suma la clave: `null` en el caso de hoy, y un caso con tres propuestas y otro con `[]`.

## 5. La página (`public/js/dato-quincena.js`, `public/dato-quincena.html`)

- Una sección propia, al final de la columna, después de «Las propuestas»: `<section class="dq-nuevos">` con su `h3.dq-seccion-titulo` «Propuestas de datasets nuevos».
- Con `null`, no hay sección: el HTML del detalle queda igual que hoy.
- Con `[]`, el título y una línea: «Esta quincena no hay propuestas de datasets.».
- Cada propuesta, una tarjeta blanca en una lista ordenada, con este orden:
  1. arriba, «Dataset nuevo N» y los orígenes en etiquetas neutras (`.dq-etiqueta`);
  2. el título en `h4`;
  3. la prioridad, en una etiqueta con su color y su ícono, y al lado `valor_y_riesgo`;
  4. «Por qué abrirlo», con la justificación;
  5. «Formato sugerido»;
  6. «Campos sugeridos», cada uno en monoespaciada;
  7. si hay anonimización, una caja «Cómo anonimizar» con el estilo de «Para validar»;
  8. si hay, «Datasets relacionados en el portal», con el nombre y el enlace al portal;
  9. «Fuentes», con sus enlaces.
- La clase y el ícono de la prioridad salen de un mapa con la clave del servidor y `Object.hasOwn`, nunca del texto.
  Colores: `alta` en verde (`--sg-verde-fondo` y `--sg-verde`), `si_hay_recursos` en azul (`--sg-azul-fondo` y `--sg-azul`), `evaluar` en ámbar (`--sg-sol` y `--sg-ambar`).
  El texto dice siempre la prioridad: el color nunca es lo único que la distingue.
- El fondo de la sección es un verde muy claro, distinto del celeste de la agenda, con contraste de 4,5:1 o más en todo texto.
- Los rótulos fijos («Propuestas de datasets nuevos», «Esta quincena no hay propuestas de datasets.», «Por qué abrirlo», «Formato sugerido», «Campos sugeridos», «Cómo anonimizar», «Datasets relacionados en el portal» y «Fuentes») son constantes de la página.
- Todo texto del servidor pasa por `esc`; un enlace va solo si es `https://` (`esEnlaceSeguro` y `enlaceDeAfuera`, como las fuentes de hoy).
- Sin «Copiar» y sin cambios en la tarjeta de la lista: quedan para otra entrega, si hacen falta.
- Sube el `?v=` de `dato-quincena.js` y `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`, a `20261234`, el siguiente número libre.

## 6. El mail (`services/emailTemplates.js` y `modeloDelMail`)

- `modeloDelMail` suma `propuestas_datasets`: `null` si el detalle trae `null`, y si no la lista del detalle, con la `franja` «Dataset nuevo N de M» en cada una.
- La plantilla dibuja la sección después de las propuestas y antes del botón «Ver la edición en el RPAD»:
  - con `null`, nada: el bloque es `null` y `marcoEmail` lo salta;
  - con `[]`, el título de sección «Propuestas de datasets nuevos» y la línea «Esta quincena no hay propuestas de datasets.»;
  - si no, el título de sección y una tarjeta por propuesta.
- La tarjeta, con tablas y estilos en línea, sin emojis:
  - una franja verde clara con «Dataset nuevo N de M»;
  - los orígenes en pastillas neutras;
  - el título;
  - la prioridad en una pastilla de su color (los pares de `ETIQUETAS` y de `COLORES.respaldo`) y al lado `valor_y_riesgo`;
  - «Por qué abrirlo», «Formato sugerido» y «Campos sugeridos» en monoespaciada, separados por comas;
  - la anonimización en el aviso ámbar de hoy (`avisoDestacado`);
  - los datasets relacionados y las fuentes como enlaces, solo si son `https://`.
- Entre una tarjeta y otra, 16 px con una fila de alto fijo, como hoy.
- La versión de texto suma el mismo bloque después de las propuestas y antes del renglón del botón.
- Todo texto de Datito va escapado. `escapeHtml` tira con lo que no es texto: todo pasa antes por `textoDelDato` o `listaDelDato`, como hoy.
- Una edición sin la clave da el mismo `subject`, `html` y `text` que hoy, byte por byte.

## 7. Documentos

- `docs/temas/dato-quincena.md`: la clave, sus reglas y mensajes, la prioridad y el detalle.
- `docs/temas/dato-quincena-correo.md`: la sección del mail y su versión de texto.
- Lo vigente, un renglón por oración. `tests/documentos.test.js` controla los topes (`dato-quincena.md` tiene margen).
- Sin tema nuevo: no cambian `CLAUDE.md` ni `.claude/rules/`.

## 8. Tests

- Antes de tocar el código, se guardan como fixtures el mail (`subject`, `html` y `text`) y el HTML del detalle de la página que arma main 8784663 para la edición del fixture de hoy.
  Después del cambio, la misma edición sin la clave tiene que dar exactamente eso: es el resguardo del envío del 24/11.
- Reglas:
  - la clave ausente, `[]`, 1 y 3 elementos válidos, y 4 elementos;
  - cada clave que falta, de más y con mal tipo;
  - cada tope, por debajo y por encima;
  - cada valor cerrado;
  - cada repetido, con el error en el segundo;
  - la numeración con salto;
  - los títulos repetidos con otras mayúsculas y espacios;
  - el slug inválido;
  - los tres casos de coherencia y que no se miren con un valor o un riesgo inválidos;
  - los mensajes exactos;
  - los 9 casos de la prioridad;
  - una edición v1.3 que sigue valiendo.
- Detalle: `null`, `[]` y la lista con todos sus textos, la `url` de cada dataset relacionado y la prioridad.
- API:
  - un POST con tres propuestas da 201, con el recibo igual que hoy;
  - un POST con valor Bajo y riesgo Alto da 422, con su campo y su mensaje, y no guarda nada;
  - el GET del detalle trae la clave;
  - un POST v1.3 sigue dando 201.
- Página (vm): sin sección con `null`, la línea con `[]`, las tarjetas con su orden, la clase de la prioridad por el mapa, sin enlace en lo que no es `https://` y el escapado.
- Mail: la sección con `null`, `[]` y tres propuestas, en HTML y en texto, su lugar (después de las propuestas y antes del botón), el escapado y los enlaces solo `https://`.
- La suite completa en verde.

## 9. Lo que queda al implementador

Los nombres internos, el orden de las funciones, cómo se arma cada validador y los casos concretos de cada test.

## 10. Despliegue y fechas

- Antes del merge, una simulación local con el dump de producción del 18/11 (el usuario lo dejó en Descargas; nunca al repo), cargado en una base copia con otro nombre (no la compartida):
  el RPAD con el código nuevo recibe un piloto sin la clave, uno con `[]` y uno con tres propuestas; se miran la página de cada uno y «Enviarme una prueba» en Mailpit; y un 422 con valor Bajo y riesgo Alto no guarda nada.
- Un kit sin SQL, con Restart, contra 8784663: los archivos de `services/` y `public/` que cambien, y su vuelta atrás (los mismos archivos de 8784663).
  Su `PASOS.txt` empieza comprobando que producción tiene `mi-espacio.js?v=20261233` y `dato-quincena.js?v=20261232`.
- El usuario lo despliega antes del viernes 20/11 a las 12:00, fuera de las 8:05 y las 14:00 y lejos de los :00 y los :30 (la Tarea Cron de la agenda corre cada media hora); `PASOS.txt` lo dice.
  Después le avisa a Datito la hora y el commit.
- Hasta ese aviso, Datito no manda a producción ninguna edición ni piloto con la clave.
  Hoy el servidor la rechaza: 422 «La edición tiene errores.», con `propuestas_datasets` y «Esta clave no está en el formato de la edición.»; la edición no se archiva y, si es una regular, el correo del RPAD no sale.
- Después del despliegue, Datito hace dos pilotos: uno sin la clave (la v1.3 sigue entrando) y otro con tres propuestas, una de cada prioridad. Los dos dan 201 y «Los pilotos no se envían por correo.».
- El piloto con tres propuestas queda archivado como los demás: el usuario mira su página en Herramientas → El dato de la quincena y se manda «Enviarme una prueba» (el mail real del RPAD, solo a su casilla y con «[PRUEBA] »), que es la única forma de ver la sección en el mail antes del 23/11.
- El piloto con la v1.4 es el que dice que la edición del 23/11 puede salir con la sección.
  Si sale bien antes del viernes a las 12:00, el 23/11 sale con la v1.4. Si falla, vale el plan B de Datito (el 23/11 con la v1.3) y no hace falta volver atrás, porque la v1.3 sigue entrando.
- Volver atrás, si hiciera falta por otro motivo: primero Datito deja de mandar la clave (si no, sus ediciones dan 422) y después se reponen los archivos de 8784663. Las ediciones archivadas con la clave quedan guardadas: con el código anterior simplemente no se muestra la sección.

## 11. Para Datito (fuera del repo)

- En la carpeta de notas de la sesión: el contrato final v1.4, con «Todavía no lo uses», y el schema oficial `schema-edicion-v1_4.json` (JSON Schema 2020-12, con la clave obligatoria, como la pidió Datito).
- Tres JSON de ejemplo con lo que responde el RPAD: con `[]`, con tres propuestas (una de cada prioridad) y con valor Bajo y riesgo Alto (422).
- El usuario se los pasa apenas apruebe esta spec. Si algo cambia en la revisión del código, se corrigen antes del despliegue.

## Decisiones de la sesión

- El RPAD no exige la clave (sección «Enfoques»): Datito lo aceptó por el plan B.
- Una fuente que no es `https://` da el mensaje de hoy de todas las direcciones, y no uno nuevo.
- `nombre` de un dataset relacionado, hasta 200 caracteres, como `dataset.nombre`. Datito proponía 150.
- `ckan_slug` con la regla de nombres de CKAN, que admite el guion bajo. Datito proponía `^[a-z0-9-]+$`.
- Los topes que el borrador no tenía: la anonimización, hasta 1000; cada campo sugerido, hasta 64.
- La comparación de títulos repetidos no mira las mayúsculas ni los espacios de los extremos, pero sí las tildes.
- Sin «Copiar» y sin cambios en la tarjeta de la lista, para llegar al viernes.
- Una anonimización vacía o de solo espacios es un error, como cualquier otro texto: la página y el mail nunca muestran una caja vacía.
- Un solo error de coherencia por propuesta: con valor Bajo y riesgo Alto, solo el de `riesgo`.
