# Mi espacio: el evento Personal (Público)

Un evento personal que ven las personas que se elijan, de cualquier rol, solo como «Carla: Turno médico» y sin emails.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-design.md`

## El evento Personal (Público)

- El evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico; la maqueta que aprobó el usuario, con datos inventados, en `docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-mockups/`; el código de la página, en «La página», más abajo): el usuario quiere poder avisar algo personal a quien elija, de cualquier rol, sin dar detalles y sin mandarle emails a nadie (un compartido con «Todos» lo ve solo la administración, con el título y el detalle, y le manda la invitación).
  Lo que decidió el usuario el 29/10/2026: 1) **tres tipos de evento** (`TIPOS_DE_EVENTO`, `['privado', 'publico', 'laboral']`, congelada, en el orden del formulario):
  **Personal (Privado)** («Nadie más lo ve»), **Personal (Público)** («Lo ven quienes elijas, con un texto corto») y **Laboral** («Con la administración que elijas»; sus textos dicen «Con toda la administración», «Es para toda la administración.», «con toda la administración» en «Hoy y mañana», el botón «Toda la administración», la insignia «Laboral» y la leyenda «Laborales»; quién lo ve y sus emails, los de `docs/temas/mi-espacio-agenda.md`);
  2) un Público lo ven quienes elige quien lo carga, **«Todos»** (todos los usuarios activos, de cualquier rol: una marca, `publico_todos`, también para quien se da de alta después) o una por una, de la lista de todos los activos; la administración no ve los Públicos de otros por ser administración; 3) lo crea **cualquier rol**, también el lector y el colaborador; 4) los demás ven solo el nombre corto de quien lo cargó y el texto público, «Carla:
  Turno médico», con la fecha y las horas, y quien lo carga ve su título; el texto es obligatorio, de la lista (`TEXTOS_PUBLICOS`:
  Trámite personal, Turno médico, Asunto familiar, Fuera de la oficina y Capacitación o curso) o escrito en «Otro», recortado, de 1 a 60 caracteres (`LARGO_TEXTO_PUBLICO`, contados con `Array.from`); 5) puede ser cualquier cosa (la hora de fin sigue opcional); 6) **los dos personales mandan solo el recordatorio, y solo a quien lo creó**: a los que ven un Público no les llega nada (ni la invitación, ni el cambio, ni la cancelación, ni el recordatorio), y no tienen «Mi recordatorio»;
  7) los textos del Laboral (arriba); 8) no aparece en «Hoy no están» (sigue siendo solo de licencias); 9) cambiar de tipo sigue la regla de los emails del Laboral (a quien se saca de un evento no le llega nada, y a quien entra, la invitación): pasar un Laboral a Público o a Privado no le manda nada a nadie, y un Privado o un Público a Laboral le manda la invitación a la administración que entra;
  10) si se desactiva a quien cargó un Público, los demás dejan de verlo (también en «Hoy y mañana» y en la frase del mes); 11) los Públicos de otras personas, en **rosado**; 12) los nombres de los tipos, los del usuario; 13) el evento real que motivó el pedido se convierte al tipo nuevo, en el lugar, con un SQL de `database/privado/` que no se versiona (ver `docs/temas/despliegue.md`).
  Cómo se guarda (spec 6.1; decisión de la spec, 10.1, en lugar de reusar `para_todos` o de una columna `tipo`): un Público es, para el resto del código, un evento personal de quien lo creó (`compartido` 0 y `para_todos` 0, que sigue queriendo decir solo «toda la administración»), con `publico` 1, `publico_todos` y `texto_publico`, y su audiencia en `mi_espacio_evento_vistas` (ver `docs/temas/base-de-datos.md`):
  así `ELEGIDA`, el «para todos», `audienciaDe`, `emailsDelGuardado` y la corrida lo tratan como un Privado y ningún otro camino le manda un email a otra persona ni le muestra el título.
  Defensa, con su test:
  `audienciaDe` da [] y los destinatarios de la corrida (`destinatariosDe`, con `publico` en cada evento de `eventosParaLaCorrida`) son solo quien lo creó si `publico` es 1, aunque los datos vinieran mal.
  Al pasar a otro tipo se borran las filas que ya no van: las de `mi_espacio_evento_personas` al dejar de ser Laboral (`guardarPersonas`, también los recordatorios apagados) y las de `mi_espacio_evento_vistas` al dejar de ser Público (`guardarVistas`, que deja exactamente las elegidas, por diferencia y por la clave; con «Todos», ninguna), y `texto_publico` queda NULL.
  - La validación (`validarEvento`):
    `datos` trae `tipo`, `publico`, `publico_todos` y `texto_publico`; el primer error, en el orden título, fecha, desde, hasta, detalle, tipo (`campo: 'tipo'`, «Elegí el tipo de evento.»), texto público (`campo: 'texto_publico'`: vacío, solo espacios o algo que no es un texto, «Elegí qué ven los demás.»; de más de 60, «Lo que ven los demás puede tener hasta 60 caracteres.»), personas y recordatorio.
    El texto público se guarda tal cual, recortado, también con `<b>` o comillas: lo escapa quien lo dibuja.
    Las personas de un Público sin «Todos» ni ninguna dan «Elegí con quién lo compartís, o «Todos».» (`personasPublico`), y las de un Laboral, «Elegí con quién lo compartís, o «Toda la administración».» (`personas`), las dos en `personas`.
    **Un cuerpo de antes** (sin `tipo`, o con `tipo: null`: una pestaña que quedó abierta con la página anterior) se lee así: con `compartido` en el `true` literal, Laboral; si no, Privado; con `tipo`, el `compartido` del cuerpo no cuenta.
    Un Privado descarta las personas, el «Todos» y el texto que lleguen.
    Un Laboral de quien no es administración sigue dando 400 `sinPermiso` en `compartido`.
    Las personas de un Público se validan contra `personasParaElPublico` (todos los activos sin quien pide) más las `vistas` que ya tenía, si ya era Público (`personasDelPedido(…, { tipo: 'publico' })`): una persona que se desactivó sigue al guardar sin tocarla y nadie la suma de nuevo; el id propio se saca sin error.
  - Quién lo ve (spec 6.2;
    `VISTA_PUBLICA` de `services/miEspacioEventosDatos.js`, sumada a `VISIBLES` y a `VISIBLES_CON_TODOS`, para todos los roles;
    `eventosVisibles` y `eventoVisible` pasan el id de quien pide una vez por cada `?` de la condición, tres en total): un Público activo, de quien sigue activo, si es para todos o tiene una fila de quien mira en `mi_espacio_evento_vistas`.
    **A quien no lo creó le llega recortado desde la consulta** (spec 6.3: no basta con no dibujarlo):
    `leerEventos` con `quienMira` (lo pasan `eventosVisibles` y `eventoVisible`;
    `eventoPropio` no recorta) lo arma desde cero con un literal, `{ id, creado_por, creador, fecha, desde, hasta, compartido: 0, publico: 1, texto_publico }`, sin leer sus personas ni sus vistas, y uno de una cuenta que ya no está activa no sale (`c.activo AS creador_activo`, que no se expone: la defensa en JS, además de la de la consulta).
    `itemDeEvento` decide la rama antes de leer nada más del evento y le da solo `{ id, fecha, desde, hasta, es_mio: false, compartido: false, publico: true, creador, titulo, texto_publico }`, con `titulo` «Carla:
    Turno médico» (sin nombre o sin texto, la raya).
    **El orden no delata el título**: la lista de quien mira se ordena con `ORDEN_PARA_QUIEN_MIRA` (`ORDER BY e.fecha, e.desde, CASE WHEN e.publico = 1 AND (e.creado_por IS NULL OR e.creado_por <> ?) THEN '' ELSE e.titulo END, e.id`: a la misma fecha y hora, un Público ajeno va antes que los demás y, entre dos, por id), porque ordenar por el título antes de recortar dejaba adivinarlo por el lugar del evento en la agenda y en «Hoy y mañana», que conserva el orden recibido;
    `eventoPropio` (con `ORDEN`: fecha, hora, título e id) y la corrida no recortan ni reordenan.
    El ítem de quien lo creó trae `publico: true`, `publico_todos` y `texto_publico` (después de `para_todos`), `personas` y `personas_ids` de sus `vistas` (con «Todos», []) y `quien_texto` de `textoDeQuienVeElPublico` («Lo ven todos como «Turno médico»», «Lo ve Julián como «…»», «Lo ven Julián y Tomás como «…»» o, desde 3, «Lo ven 4 personas como «…»»); con datos mal (`publico` y `compartido` a la vez) manda el Público.
    Un Privado y un Laboral traen `publico: false`, entre `para_todos` y `creador`.
    El nombre corto de quien cargó un Público, y el de las personas de «Lo ven …», se arma contra **todos los usuarios activos** (`usuariosActivos` de `services/miEspacioDatos.js`, `[{ id, nombre }]` de cualquier rol, por id, en el contexto de `itemDeEvento` como `usuarios`), no contra la administración: lo puede crear un lector (decisión de la spec, 10.6).
    `vistasDe` (en lote, sin N+1) trae todas las filas, también las de cuentas desactivadas, como `personasDe` (Ruling 4 del plan:
    «Lo ven …» las nombra, como a los invitados del Laboral).
  - La API:
    `GET /mi-espacio/eventos` trae `mi_nombre_corto` (el nombre corto de quien pide, contra todos los activos, para la vista previa del formulario; null si no está) y lee `usuariosActivos` en el mismo `Promise.all`.
    **`GET /api/mi-espacio/personas/publico`** (`listarPersonasParaElPublico`, con `authMiddleware`, para todos los roles con sesión): todos los usuarios activos sin quien pide, `{ id, nombre, iniciales }`, por nombre, ni el email ni el rol (`personasParaElPublico`; así el lector y el colaborador ven la lista de los usuarios del RPAD, solo los nombres).
    `GET /mi-espacio/personas` es la de la administración, para el Laboral (403 al lector y al colaborador); el Público tiene una ruta aparte en lugar de un parámetro, que mezclaría el 403 con el 200 (decisión de la spec, 10.7).
    El cuerpo del guardado trae `tipo` y, en un Público, `para_todos` (su «Todos»), `personas` y `texto_publico`; el INSERT y el UPDATE escriben `publico`, `publico_todos` y `texto_publico`.
    **`PUT …/mi-recordatorio` sobre un Público de otra persona** da 400 `sinRecordatorio` («Este evento no tiene recordatorio para vos.», `campo` null), después del 404 y de `esTuyo` y antes de validar `sin_aviso`, de escribir nada y de `itemDeEvento` (decisión de la spec, 10.8: 400 y no 404, porque quien pide lo ve).
    El Resumen lee `usuariosActivos` aislado (`usuariosDelResumen`: si falla, [] y la consola, y el Resumen sale igual) y «Hoy y mañana» trae `publico` en cada evento: un Público ajeno, con su `titulo` «Carla:
    Turno médico», `quien` '' y `detalle` «Hoy» o «Mañana»; uno tuyo, su título y `quien` «lo ven todos como «Turno médico»».
    La frase del mes cuenta también los Públicos de otros que ve quien mira.
  - Cómo se ve (spec 4 y 5): en el formulario hay **«Tipo de evento»**, para todos los roles (tres opciones grandes; el lector y el colaborador ven dos), y un Público trae «Qué ven los demás» (las pastillas de la lista y «Otro», con su campo y su contador, «0 de 60 caracteres»), «Así lo ven los demás:» (la pastilla del evento tal como se va a ver en la agenda de los demás, rosada y con el ojo, «10:00 Carla:
    Turno médico», que cambia mientras se escriben la fecha y la hora o se elige el texto, con «En su agenda y en «Hoy y mañana» del Resumen.
    No ven el título ni el detalle.»), «Con quién» («Todos» y la lista completa, con «No les llega ningún email: lo ven en su agenda y en el Resumen.») y la ayuda del recordatorio «Te llega solo a vos.».
    Los errores, debajo de su campo, también «Escribí qué ven los demás.» con «Otro» vacío.
    **Un Laboral que creó alguien que ya no es de administración** (para no guardarlo como Privado sin avisar al corregirlo; decisión de la spec, 10.3) muestra las tres opciones con Laboral elegida y deshabilitada, con la ayuda «Ya no podés compartir eventos laborales.
    Elegí otro tipo para guardarlo.», que «Guardar» da como error si no se elige otro.
    En la grilla, «Próximos» y el día elegido, un Público tuyo va en tinta con el ojo (Lucide `eye`: el ojo dice siempre «lo ven otros») y su título, y en «Próximos» y el día elegido, debajo, su «Lo ven …»; uno de otra persona va **en rosado** con el ojo, como «Carla:
    Turno médico» (también su nombre accesible, con la hora delante:
    «10:00 Carla:
    Turno médico»), sin quién lo ve, y en el teléfono es un **anillo** rosado en lugar de un punto (el color nunca es lo único que distingue: también el ojo, el anillo y el texto).
    La leyenda tiene siete:
    «Solo vos», «Tuyos, a la vista», «Personales de otros», «Laborales», «Tus licencias y francos», «Feriados» y «Compañeros que no están» («Laborales» y «Compañeros que no están», solo para administración).
    El detalle de un Público de otra persona (`#modal-evento-ajeno`):
    «Carla:
    Turno médico», cuándo es, la insignia rosada «Personal (Público)» con el ojo y «Es un evento personal de Carla: se ve solo lo que eligió mostrar.», sin el detalle ni «Mi recordatorio», con «Cerrar».
    El rosado (tokens del `<style>` de `mi-espacio.html`):
    `--sg-rosado` (#8A3B5C: 6,00:1 sobre su fondo y 7,34:1 sobre blanco), `--sg-rosado-fondo` (#F7E3EC) y `--sg-rosado-borde` (#B5577F: 3,70:1 contra su fondo; el anillo del teléfono, 3:1 o más contra cada celda).
    El texto rosado da 4,5:1 o más sobre su fondo, también desaturado en un día que pasó (`.me-celda.paso .me-cosas`), y el borde de la pastilla, 3:1 o más contra cada celda: lo mide `tests/mi-espacio-frontend.test.js`.
    A los antiobjetivos de la agenda se suman: que el título o el detalle de un Público lleguen al navegador de otra persona (aunque no se dibujen), que a alguien que no sea quien lo creó le llegue un email por un evento personal, que un Público de una persona desactivada se siga viendo, que el Laboral cambie de comportamiento, que el rosado o el ojo sean lo único que distingue un Público de otra persona y que un nombre real o el turno real queden en el repo.

## La página

Lo puro del evento Personal (Público) (spec 2026-10-29-mi-espacio-evento-publico; ver `docs/temas/mi-espacio-agenda.md`), primero el formulario de los tres tipos:
`valoresDelEvento` trae `tipo` ('laboral' si es compartido, 'publico' si es un Público y si no 'privado'; no trae `compartido`), `texto_publico` y `otro` (un texto que no es de la lista: el de «Otro») y, en un Público, toma `para_todos` de `publico_todos` y `personas` de `personas_ids`;
`tipoDelEvento` (copia de `tipoPedido`, privada en el servidor: sin `tipo`, o con null, Laboral con `compartido` en el `true` literal y si no Privado; atada por la paridad de `erroresDelEvento`);
`valoresConElTipo(valores, tipo, original)` (al cambiar de tipo, con quién —`para_todos`, `personas` y `conocidas`— empieza de nuevo, salvo al volver al tipo con que se abrió el formulario, que trae lo suyo: el «Todos» y las personas de cada tipo son otros, y una persona de un tipo ofrecida en el otro daría 400 `personasInvalidas`; lo que ven los demás se conserva);
`erroresDelEvento(valores, hoy, { puedeCompartir })` (controla el tipo —uno inválido, `MENSAJES_EVENTO.tipo`; un Laboral sin `puedeCompartir`, el `true` literal, `MENSAJE_LABORAL_SIN_PERMISO`, sin pedir las personas— y, solo en un Público, el texto —«Otro» vacío, `MENSAJE_OTRO_VACIO`; sin texto, `textoPublico`; de más de 60, `textoPublicoLargo`—, y las personas con el mensaje de su tipo, `personasPublico` o `personas`, en el orden de `validarEvento`);
`cuerpoDelEvento(valores, { puedeCompartir })` (siempre con `tipo`; un Público trae `para_todos`, `personas` y `texto_publico` recortado, y nunca `compartido`; un Laboral, solo con `puedeCompartir`, `compartido: true`, `para_todos` y `personas`; un Privado, solo el tipo);
`tiposQueSeVen` y `htmlDeTiposDeEvento(valores, { puedeCompartir })` (`.me-opcion` con `data-tipo` y `aria-pressed`, con el nombre y la ayuda de `OPCIONES_DEL_TIPO`: los tres con `puedeCompartir`; sin él, los dos personales, salvo en un Laboral, que va con los tres y el Laboral elegido y deshabilitado);
`htmlDeTextosPublicos` (una `.sg-chip` por cada uno de `TEXTOS_PUBLICOS` y «Otro», `data-texto="otro"`, con `aria-pressed` y una sola elegida), `elegirTextoPublico` y `cuentaDelTextoPublico` («12 de 60 caracteres», recortado y con `Array.from`, y `pasado` si pasa de 60);
`htmlDeLaVistaPrevia(valores, { nombre })` (`{ dia, evento }`: el día como en la agenda, «Jue 5» o «Sin fecha», en texto plano, y la pastilla `<span class="me-ev publico-otro" data-lineas="3">` con el ojo, la hora en negrita y «Carla:
Turno médico», escapados, con el `mi_nombre_corto` del servidor o, sin él, `NOMBRE_DE_LA_VISTA_PREVIA`, «Tu nombre», y «…» sin texto);
`ayudasDelEvento(valores, { puedeCompartir })` (texto plano para `textContent`: en un Público, `AYUDA_DE_LAS_PERSONAS_DEL_PUBLICO` y `AYUDA_DEL_RECORDATORIO_PUBLICO`, «Te llega solo a vos.»; en un Laboral, `AYUDA_DE_LAS_PERSONAS_DEL_LABORAL` y `AYUDA_DEL_RECORDATORIO_COMPARTIDO`; un Laboral sin poder compartir, `MENSAJE_LABORAL_SIN_PERMISO` como ayuda del tipo); y `htmlDePersonasDelEvento`, cuyo primer botón dice «Toda la administración» en un Laboral y «Todos» en lo demás.
Después, cómo se ve:
`ICONO_DEL_OJO` (Lucide `eye`, decorativo, al lado de `iconoDelMes`) e `ICONOS_DEL_MES`, que trae `ojo` y `'publico-otro'`, los dos con ese ojo (siete claves);
`iconoDe(clase, icono)` e `iconoOPunto(clase, icono)` (el ícono que pide `icono`, si es una clave de `ICONOS_DEL_MES`; si no, el de la clase; si la clase no tiene, `iconoDe` da '' e `iconoOPunto`, el de las listas, un punto, `<i></i>`);
`claseDelEvento` ('publico-otro' un Público de otra persona, 'compartido' un Laboral, tuyo o ajeno, y 'propio' lo tuyo que no es Laboral: un Privado y un Público tuyo);
`iconoDelEvento(evento)` (`{ icono: 'ojo' }` un Público tuyo, que se suma a su cosa en `cosasPorDia`, a la fila del día elegido y a la cosa de `gruposDeProximos`;
`{}` lo demás, así el resto de los ítems no lleva la clave `icono`);
`htmlDeProximo` (un Público tuyo lleva `<span class="me-lo-ven">` con el ojo y su `quien_texto`, sin insignia; uno de otra persona nunca lleva quién, aunque llegara); y `htmlDelEventoAjeno` (un Público: la insignia `.me-insignia.rosado` con el ojo y «Personal (Público)» y «Es un evento personal de Carla: se ve solo lo que eligió mostrar.» —sin creador, «de otra persona»—, sin `detalle` aunque llegara y sin `opciones`; un Laboral, la insignia «Laboral»; los nombres, de `OPCIONES_DEL_TIPO`).
El ítem recortado de un Público ajeno no rompe ningún dibujo: todo se lee con `?.`, `esObjeto` y `comoTexto` (Ruling 5 del plan, con un test armado con el `itemDeEvento` real).
Lo que toca el DOM:
`FORMULARIOS.evento.campos` trae `tipo` (`ev-tipos`) y `texto_publico` (`ev-textos`), y `controlDelCampo(nombre, campo)` manda `texto_publico` a `ev-otro` con «Otro» elegido (la usan `conSusControles` y `mostrarFallaDelServidor`: un error del servidor va a su control y lleva el foco);
`PARRAFOS_DE_ERROR` (`ev-tipos` → `ev-tipo-error` y `ev-textos` → `ev-texto-error`, los que no siguen la forma `<id>-error`);
`abrirEvento` guarda `original` (los valores con que se abrió) y las listas de cada tipo;
`pintarQuienLoVe` dibuja el tipo (`#ev-tipos`, con la clase `dos` o `tres`), las ayudas (`#ev-tipo-ayuda`, `#ev-personas-ayuda` —vacía en el HTML— y `#ev-recordatorio-ayuda`; sin texto, vacías y ocultas), `#ev-publico` y las personas;
`pintarLoQueVenLosDemas`, `pintarLaCuentaDelOtro` y `pintarVistaPrevia` (fuera de toda región viva:
`#me-anuncio` sigue siendo la única), `alTocarUnTipo` (con quién empieza de nuevo, se limpian los errores y el foco vuelve al tipo tocado), `alTocarUnTexto` («Otro» lleva el foco a su campo) y `alEscribirElOtro`, y `alCambiarElCuando` también dibuja la vista previa;
las dos listas de personas, con `pedirUnaListaDePersonas(clave, ruta)` (`pagina.personas`, de `GET /mi-espacio/personas`, con `personasParaCompartir`, y `pagina.personasPublico`, de `GET /mi-espacio/personas/publico`, con `personasParaElPublico`: cada una una sola vez por página, y otra vez si falló) y `pedirLasPersonas(formulario, tipo)` (una vez por formulario: la del Laboral, al abrir y solo con administración; la del Público, cuando el Público se ve);
y el nombre de la vista previa, `nombreDeLaVistaPrevia` (el `mi_nombre_corto` de lo que llegó del mes o de los próximos) y, si el formulario se abre sin la agenda cargada (por ejemplo, «Nuevo evento» desde el Resumen), `pedirMiNombre` (una sola vez por página, con `GET /mi-espacio/eventos?desde=hoy&hasta=hoy`, al elegir un Público; mientras tanto o si falla, «Tu nombre»).
`pagina` trae `personasPublico`, `miNombre` y `pidiendoMiNombre`.
`pintarMesDeEventos` prende `#ag-leyenda-laborales`, como `#ag-leyenda-ausentes`, solo con `puede_compartir`;
`abrirEventoAjeno`, con un Público, oculta `#mea-grupo-recordatorio` (el `form-group` de «Mi recordatorio»), no muestra el aviso y lleva el foco a «Cerrar» (con un Laboral, el grupo vuelve, con el foco en «Mi recordatorio»), y `guardarMiRecordatorio` no hace nada con un Público (un `change` en el select oculto no manda ningún `PUT`).
Copias atadas por tests de paridad:
`TIPOS_DE_EVENTO`, `TEXTOS_PUBLICOS` y `LARGO_TEXTO_PUBLICO` (de `services/miEspacioEventosReglas.js`), `MENSAJES_EVENTO` (entero) y `erroresDelEvento` (con `validarEvento`, en los casos del tipo, el texto y las personas de cada tipo).
Solo del navegador, con tests de comportamiento:
`MENSAJE_OTRO_VACIO` («Escribí qué ven los demás.»), `MENSAJE_LABORAL_SIN_PERMISO` («Ya no podés compartir eventos laborales.
Elegí otro tipo para guardarlo.»), las cuatro ayudas, `OPCIONES_DEL_TIPO` y `NOMBRE_DE_LA_VISTA_PREVIA`.
En el HTML están `#ev-grupo-tipo` (`role="group"`, con `aria-labelledby="ev-tipo-rotulo"` y `aria-describedby="ev-tipo-ayuda ev-tipo-error"`; se ve para todos), y `#ev-publico` (oculto), que tiene `#ev-grupo-texto` con `#ev-textos` y `#ev-texto-error`, `#ev-otro-grupo` con `#ev-otro` (con `aria-describedby="ev-otro-cuenta ev-otro-error"` y sin `maxlength`) y `#ev-otro-cuenta`, y `#ev-vista-previa` (`#ev-vista-previa-dia` y `#ev-vista-previa-evento`);
la leyenda tiene siete muestras, con `#ag-leyenda-laborales` oculta de entrada.
Los estilos, en el `<style>` de `mi-espacio.html` y sin ninguna clase `ag-`: los tokens `--sg-rosado` (#8A3B5C), `--sg-rosado-fondo` (#F7E3EC) y `--sg-rosado-borde` (#B5577F);
`.me-ev.publico-otro, .me-leyenda .publico-otro`, `.me-insignia.rosado`, `.me-lo-ven`, `.me-prox-icono.publico-otro` (y `.me-prox-icono.propio`, en tinta) y `.me-fila-del-dia.publico-otro`;
`.me-opciones.tres`, `button.me-opcion:disabled` (sin `opacity`), `.me-textos`, `.me-otro`, `.me-cuenta.pasado` y `.me-vista-previa*`; en 640 px, una columna para `.me-opciones.tres` y `.me-vista-previa`, y el anillo de un Público ajeno (`.me-puntos .publico-otro`: fondo blanco con un `box-shadow` rosado); y en alto contraste, después de `.me-puntos i[class]`, el anillo con `Canvas` y `outline` en `CanvasText`.

## Reglas de los tests

Los tests de este tema usan nombres inventados y los «Test <clave>» de `crearUsuariosPrueba`.
En `schema.test.js`, el rollback de la agenda corre después del del Público.

## Archivos de tests

`mi-espacio-eventos-reglas.test.js`, `mi-espacio-eventos-api.test.js`, `mi-espacio-eventos-corrida.test.js`, `permisos.test.js`, `schema.test.js`, `mi-espacio-frontend.test.js`, `paginas.test.js`
