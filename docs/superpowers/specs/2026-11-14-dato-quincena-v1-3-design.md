# El dato de la quincena: contrato v1.3, «Repite» y «Efemeride» en las propuestas

Fecha: 14/11/2026. Base: main 3f5abe0. Lo pidió Datito (el bot) y lo cerraron el usuario y Claude Code el 13/11.

## Por qué

Datito cambió su regla de no repetición: puede volver sobre un dataset o un tema de una edición anterior si hay datos nuevos o un hecho actual, y quiere marcarlo.
Hoy el RPAD rechaza con 422 cualquier etiqueta o clave nueva en una propuesta, y la etiqueta «Efeméride» que Datito pone en su mail se pierde al archivar.
El usuario quiere tenerlo en producción antes de la edición real del lunes 23/11, probado antes con un piloto.

## Objetivos, no objetivos y anti-objetivos

- Objetivo: aceptar y mostrar las etiquetas `Efemeride` y `Repite`, y la clave opcional `repeticion`, en la página y en el mail.
- No objetivo: el RPAD no controla la regla editorial de no repetición.
- Anti-objetivo: que una edición quede sin archivar por algo que depende de lo archivado. Eso nunca da 422: da un aviso y se guarda igual.
- Anti-objetivo: romper lo de hoy. Una edición v1.2 sigue valiendo y se ve igual; `schema_version` sigue en `'1.0'`; sin migración: todo sale de `metadata`.
- No cambian la lista de tarjetas, el envío, los horarios, las corridas ni el recibo (salvo `avisos`).

## Enfoques

- Elegido: leer todo de `metadata`, que ya se guarda entera. Los avisos y el enlace a la edición previa se calculan al leer, con una consulta por pedido.
- Descartado: columnas nuevas en `dato_quincena_propuestas`. Obliga a una migración y a un kit con SQL para un dato que ya está en el JSON guardado.

## 1. La validación del POST (`services/datoQuincenaReglas.js`)

- `ETIQUETAS`: `Principal`, `Validar`, `Agenda`, `Efemeride`, `Repite`. El mensaje `etiqueta` pasa a «Las etiquetas posibles son Principal, Validar, Agenda, Efemeride y Repite.». Sin repetidos y exactamente una `Principal`, como hoy.
- Cada propuesta puede traer la clave `repeticion`, opcional como `tipo` en la agenda: si falta, la propuesta tiene la forma de antes.
  Si está, vale `null` o un objeto cerrado con estas cuatro claves, todas obligatorias:
  - `fecha_edicion_previa`: el validador `fecha` de hoy (un día AAAA-MM-DD que exista).
  - `motivo`: `datos_nuevos` o `hecho_actual`. Otro valor: «El motivo de una repetición tiene que ser datos_nuevos o hecho_actual.»
  - `alcance`: `dataset` o `tema`. Otro valor: «El alcance de una repetición tiene que ser dataset o tema.»
  - `detalle`: `texto(1000)`.
  Otro valor que no es `null` ni un objeto: el error `objeto` de hoy («Tiene que ser un objeto.»).
- La coherencia, en cada propuesta y con las rutas desde 0, como todas:
  - `etiquetas` es una lista con `Repite` y `repeticion` falta o es `null`: `propuestas[i].repeticion`, «La propuesta tiene la etiqueta Repite pero no tiene repeticion.».
  - `repeticion` es un objeto y `etiquetas` es una lista sin `Repite`: `propuestas[i].etiquetas`, «La propuesta tiene repeticion pero no tiene la etiqueta Repite.».
  Estos dos textos los copia Datito tal cual: no se cambian.

## 2. Los avisos del recibo (201 y 200)

- `fechasPrevias(edicion)` (puro): las `fecha_edicion_previa` de las repeticiones que son objeto y anteriores a `fecha_edicion`, sin repetir.
- `leerEdicionesPrevias(fechas)` (`services/datoQuincenaDatos.js`): una consulta, `tipo = 'regular' AND fecha_edicion IN (?)`; un `Map` de fecha a `{ id, rpad_ids }`, con los `rpad_id` que citan las propuestas de esa edición en su `metadata`. Sin fechas, no consulta y da un `Map` vacío.
- `avisosDeLaEdicion(edicion, guardadas, previas)`: por cada propuesta, en su orden, primero su aviso de dataset (el de hoy, igual) y después el de su repetición, si tiene `repeticion` objeto (N es su `orden`, F la fecha en DD/MM/AAAA):
  1. F igual o posterior a la edición: «La propuesta N repite la edición del F, que no es anterior a esta: se guardó sin enlace.»
  2. Sin edición regular de esa fecha: «La propuesta N repite la edición del F, que no está en el RPAD: se guardó sin enlace.»
  3. Con esa edición, `alcance` `dataset`, `rpad_id` no `null` y ninguna propuesta de esa edición que cite ese `rpad_id`: «La propuesta N repite el dataset X de la edición del F, pero esa edición no lo tiene.» (X es el `rpad_id`).
  `previas` es opcional (un `Map` vacío): sin él, los casos 2 y 3 no se pueden saber y la función se comporta como si no hubiera ediciones previas (solo la llama el controlador, que siempre lo pasa).
- El controlador (`recibirEdicion`) lee las previas después de guardar, con la `metadata` guardada, como hoy los avisos: el 200 de una repetida los arma de nuevo.

## 3. El detalle (`detalleDeLaEdicion`, para la página y el mail)

- Recibe `previas` (opcional, un `Map` vacío). Lo leen y lo pasan `ver` (controlador) y el mail (`services/datoQuincenaCorreo.js`), con `leerEdicionesPrevias(fechasPrevias(edicion))`.
- En cada propuesta:
  - `etiquetas`: los textos para mostrar: `Efemeride` pasa a «Efeméride»; las demás, igual. `principal` sigue mirando el valor del JSON.
  - `repeticion`: `null` (sin la clave, o `null`) o `{ texto, motivo, id_edicion }`:
    - `texto`: «Repite el dataset de la edición del DD/MM/AAAA.» o «Repite el tema de la edición del DD/MM/AAAA.».
    - `motivo`: «Datos nuevos: <detalle>» o «Hecho actual: <detalle>», con el detalle tal como llegó.
    - `id_edicion`: el id de la regular de esa fecha si está en `previas` y es anterior a la edición; si no, `null`.
  - `para_copiar`: el título lleva las etiquetas para mostrar entre corchetes; con repetición, suma el bloque «<texto>\n<motivo>» después del renglón de la foto y antes de «Para validar antes de publicar».
- El servidor arma los textos; la página y el mail los imprimen tal cual.

## 4. La página (`public/js/dato-quincena.js`, `public/dato-quincena.html`)

- «Efeméride» no lleva clase propia: usa el estilo neutro de `.dq-etiqueta`, como cualquier etiqueta sin color.
- `CLASE_DE_LA_ETIQUETA` suma `Repite` (`dq-et-repite`: fondo blanco, borde de 1 px por dentro en `var(--sg-borde-control)`, texto `var(--sg-texto)`), con el ícono `history` de Lucide, decorativo como el de Validar.
- La caja de la repetición, después de la foto y antes de «Para validar»: `<div class="dq-repite">` con el ícono y el `texto` en negrita, como enlace a `dato-quincena.html?id=<id_edicion>` solo si `idDeEdicion` lo acepta, y abajo el `motivo`. Fondo `var(--sg-sutil)`, borde de 1 px `var(--sg-linea)`, radio de 12 px y los márgenes de `.dq-validar`. Sin `repeticion`, nada.
- La agenda no cambia.
- Sube el `?v=` de `dato-quincena.js` y `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.
- Todo texto pasa por `esc`; el color nunca es lo único que distingue (las etiquetas dicen su nombre); contraste de 4,5:1 o más.

## 5. El mail (`services/emailTemplates.js`)

- `PASTILLAS_DEL_DATO_QUINCENA`: «Efeméride» queda como está (la de la agenda, que ahora usan también las propuestas); `Repite`: fondo blanco, `COLORES.texto` y un borde de 1 px `#76879F` (la pastilla admite un borde).
- La caja de la repetición en la tarjeta, después del renglón de la foto y antes de «Para validar»: un recuadro neutro (fondo `#F4F7FA`, borde `#DAE3ED`), con tablas y estilos en línea, el `texto` en negrita (enlace a `${RPAD_URL}/dato-quincena.html?id=<id>` solo con un id entero positivo) y abajo el `motivo`.
- La versión de texto: el bloque «<texto>\n<motivo>» en el mismo lugar.
- `modeloDelMail` ya copia cada propuesta del detalle: `repeticion` llega sola.

## 6. Documentos

- `docs/temas/dato-quincena.md`: las etiquetas, `repeticion`, la coherencia, los avisos y el detalle.
- `docs/temas/dato-quincena-correo.md`: la caja y las pastillas del mail.
- Lo vigente, un renglón por oración; `tests/documentos.test.js` controla los topes.

## 7. Tests

- Reglas: las cinco etiquetas; `repeticion` ausente, `null` y objeto; cada clave mal; los dos casos de coherencia; una edición v1.2 que sigue valiendo; `fechasPrevias`; los tres avisos, sin aviso, y su orden junto al de dataset; el detalle (etiquetas para mostrar, repetición con y sin id, `para_copiar`).
- API: un POST con repetición da 201 con sus avisos; la repetida, 200 con los mismos; los 422 de coherencia con campo y mensaje; el GET del detalle trae `id_edicion`.
- Página (vm): las etiquetas con su clase y su ícono, la caja con y sin enlace, el escapado y sin caja cuando no hay repetición.
- Mail: las pastillas, la caja con y sin enlace, la versión de texto y el escapado.
- `tests/fixtures/dato-quincena-respuestas.json` (el contrato del detalle) suma `repeticion` en cada propuesta y un caso con repetición.

## 8. Lo que queda al implementador

Los nombres internos, el orden de las funciones y los casos concretos de cada test.

## 9. Despliegue

Sin SQL: un kit con los archivos cambiados contra 3f5abe0.
Después: el contrato v1.3 y el schema oficial (JSON Schema 2020-12) para Datito, y el piloto 11 con cuatro propuestas (una con enlace, una «Efeméride», una con el aviso de edición inexistente y una con el del dataset).
