# Mi espacio: el paso a Configuración, «Hoy no están» y el email de vencimiento

Cómo una ausencia de día entero pasa a Configuración → Licencias, lo que quedó distinto allá, a quién se le muestra y lo que vence.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-28-mi-espacio-licencia-anulada-design.md`
- `docs/superpowers/specs/2026-10-28-mi-espacio-vacaciones-en-la-carga-design.md`
- `docs/superpowers/specs/2026-10-28-mi-espacio-agenda-onda-design.md`

## El paso a Configuración

- El paso a Configuración → Licencias (sección 6; lo deciden las reglas puras `pasoDeLaCarga`, `pasoDeLaCorreccion`, `pasoDeLaBaja`, `vinculoDe`, `textoDelVinculo`, `revisionDelVinculo` y `pasoPrevistoDe`; lo lee y lo escribe `services/miEspacioPaso.js`, en la misma transacción de la carga):
  - Qué pasa: solo las ausencias de día entero (`esDiaEntero`: vacaciones, estudios, médica, médica extraordinaria, familiar y franco, y la franquicia, las horas a favor o el uso autorizado de 7 horas), solo de quien puede tener licencia con el rol de ese momento (`puedeTenerLicencia`: superadmin, admin y editor; al lector y al colaborador no les cambia nada del sistema;
    cambiar el rol no mueve nada solo: se decide al guardar o corregir), solo lo que termina hoy o después (`validarFechasNuevas` no acepta una terminada) y solo las fechas, nunca el tipo.
    Cada una es una licencia de Configuración con `usuario_id` = `creado_por` = la persona (dos seguidas de distinto tipo, dos contiguas), con las reglas de siempre, sin copiarlas: las del servicio compartido `services/licenciasOficialesService.js` (ver `docs/temas/configuracion.md`).
    Queda en `usuarios_auditoria` como siempre y no sale el aviso al superadmin (el actor es la misma persona).
    Configuración cuenta con el calendario (los 9 fijos y la tabla) los días libres de la persona autorizada y «vuelve el…», y Mi espacio le pasa el suyo:
    `calcularLicencia`, `cargarLicenciaMia` y `corregirLicenciaMia` arman `calendarioCon` con las filas que ya leyó `contextoDe` (no leen la tabla dos veces), y `aplicarCarga`, `aplicarCorreccion` y `pasoPrevisto` lo reciben y, sin él, lo leen con su conexión.
    Si la tabla no se puede leer, Mi espacio da 500, como siempre.
  - Creada o unida (`mi_espacio_licencias.oficial`):
    `'creada'`, Mi espacio creó la de Configuración;
    `'unida'`, ya había una de administración que cubría todas sus fechas y no se creó otra (una unida nunca toca la de administración: corregirla o borrarla cambia solo Mi espacio, y si una corrección la deja fuera de ella, se suelta y se trata como nueva).
    Si se superpone en parte con una de Configuración, se guarda sin pasar, con «Se superpone con una licencia de Configuración del … al …: revisala con administración» en `sin_pasar`.
  - Corregir y borrar una creada: si no empezó, se corrige libremente y Configuración la sigue; si su licencia de Configuración empieza hoy o antes, solo se cambia el hasta (400 `soloHasta` en `desde`, como `validarEdicion`); si terminó antes de hoy, las fechas quedan fijas (`fechasFijas`); se borra, anulando la de Configuración, si empieza hoy o después (`puedeAnularse`), y si empezó antes de hoy da 409 «Ya empezó: no se puede borrar».
    Si la corrección cambia las fechas se decide contra la fila guardada; los límites, con las fechas de Configuración (una corrección que no cambia las fechas nunca da error de fechas).
    El tipo, la nota y «Mostrar» se cambian siempre sin tocar Configuración (no se borra `nota_autorizacion_id` ni sale otra nota de autorización).
    Si un cambio de tipo o de horas la deja de ser de día entero, la de Configuración se anula si todavía se puede; si no, queda y la fila lo dice (`textoSigueEnConfiguracion`); una creada futura corregida a fechas que ya terminaron se anula.
    Si administración la editó en Configuración (`tocadasPorOtros`:
    `licencia_editada` o `licencia_anulada` en `usuarios_auditoria` con otro actor), la fila dice «En Configuración: del … al …» y lo que se corrige en Mi espacio ya no se copia (si la cambió la misma persona, se sigue copiando: lo último que hace manda).
    Anularla en Configuración la borra también de Mi espacio (spec 2026-10-28-mi-espacio-licencia-anulada; abajo).
    Si administración acorta o anula la que cubría una unida, la fila dice «Ya no está cubierta en Configuración del … al …: revisala con administración.» (Mi espacio lee `anulada` y las fechas de la de Configuración).
  - La anulación en Configuración (spec 2026-10-28-mi-espacio-licencia-anulada, 2.1 y 3b; el código, en `docs/temas/configuracion.md`): la fila creada que la apunta se da de baja con ella, en la misma transacción, la anule quien la anule, salvo que en Mi espacio ya haya empezado antes de hoy (`bajaPorLaAnulacion`); una corrección o un borrado de esa fila desde otra pestaña que quedó abierta da después el 404 «Licencia no encontrada» (nada revive).
    Una unida que la apunta no se toca: con una creada y una unida que la apuntan, solo se da de baja la creada.
    Una creada que queda anulada en Configuración (la de 3b, y las que se anularon antes de esa spec: no hay arreglo automático ni hace falta SQL) sigue contando hasta que la persona la borre, y su fila dice `TEXTO_ANULADA_EN_CONFIGURACION` («Se anuló en Configuración: acá sigue contando.
    Si ya no va, borrala.»; no dice quién la anuló, porque pudo ser la misma persona); corregirla no la vuelve a pasar (para eso, se borra y se carga de nuevo).
    Si la fila que se da de baja es una carga de días restituidos, `bajaPorLaAnulacion` suelta también su pedido en la misma transacción (`soltarLosPedidosDeLasCargas`): sus días vuelven a estar por restituir hasta el plazo y, después, quedan perdidos, como al borrarla desde Mi espacio.
  - Lo que quedó distinto en Configuración, para revisar (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2, 3.1, 3.2 y 3.3): una creada cuya licencia de Configuración (sin anular) quedó con otras fechas, las haya cambiado la misma persona u otra (se compara la fila con su licencia, no con la auditoría), conserva las suyas en Mi espacio, que siguen siendo las que cuentan, y la fila dice `textoRevisalaEnConfiguracion(desde, hasta)` con las de Configuración («En Configuración quedó del 04/01 al 08/01:
    revisala.» o, de un día, «En Configuración quedó el 17/11: revisala.», en lugar de «También en Configuración → Licencias.»; si la cambió otra persona, `'creada_cambiada'`, sigue con «En Configuración: del … al ….
    Administración la cambió …», que ya dice las fechas), salvo que otro aviso de la fila ya lo explique: un `sin_pasar` (una corrección que no se pudo copiar), una que dejó de ser de día entero (`textoSigueEnConfiguracion`) o de quien hoy no puede tener licencia (`otrasFechasParaRevisar`, la regla de la fila y del Resumen); ahí la fila no dice `textoRevisalaEnConfiguracion`.
    Se arregla corrigiendo una de las dos: con las mismas fechas, el aviso se va.
    Lo que avisa el Resumen (`para_revisar`, ver `docs/temas/mi-espacio.md`) lo decide `revisionDelVinculo(vinculo, fila, { sinPasar, puedeTener, hoy })` (pura, nunca tira;
    `revision` en cada entrada de `vinculosDeLaLista`, con el `hoy` de sus opciones) → `{ motivo, desde, hasta }` o null, y solo lo que todavía se puede resolver:
    `'fechas'`, con las de Configuración, en una creada o una `'creada_cambiada'` con las mismas excepciones que la fila, mientras esa licencia de Configuración no terminó (después, las fechas de una creada quedan fijas);
    `'anulada'` (sin fechas), una creada anulada, mientras la de Mi espacio no terminó; y `'sin_cubrir'`, con los días fuera, una unida sin cubrir, mientras la de Mi espacio no terminó.
    La fila lo sigue diciendo siempre.
    Nunca frena una carga ni una corrección (no va en `faltantes` ni en `calculo.faltantes`, y no lo leen `pasoDeLaCorreccion`, `pasoDeLaBaja`, `calcular` ni `faltantesDe`).
    No manda emails.
  - Si Configuración la rechaza: un rechazo en `autorizado_id` (la persona a cargo que eligió el titular no sirve), con su status, no guarda nada; cualquier otro (se superpone en parte, pasa de 365 días, el rol ya no puede tener licencia) se guarda igual en Mi espacio, sin pasar, con el motivo en `sin_pasar` («No pasó a Configuración: …»).
    La persona autorizada del firmante no se frena (decisión del usuario, 27/10/2026): su licencia pasa como cualquier otra aunque no le quede ningún día hábil de la del firmante, y esos días no se presentan Notas Digitales (ver `docs/temas/notas-digitales.md`).
  - El firmante titular: solo las vacaciones (y la carga de los días restituidos, que también lo son:
    `TIPOS_CON_PERSONA_A_CARGO` y `dejaPersonaACargo`, que usan `autorizadoDelPedido`, `pasoPrevistoDe` y `pasoDeLaCorreccion`) dejan persona a cargo (corrección del usuario, 26/10/2026): el campo de Configuración «Autorizo a presentar las notas en mi nombre a:» aparece solo cuando el titular carga vacaciones (opcional y vacío), lo elige quien carga, sin una regla nueva, y un `autorizado_id` en otro tipo da 400 en ese campo (`autorizadoSoloVacaciones`).
    Las demás licencias del titular pasan sin persona a cargo y el formulario lo avisa (`AVISO_SIN_PERSONA_A_CARGO`).
    Cada licencia lleva su propia autorización, por sus fechas (dos seguidas no se unen ni se estiran).
    Sus vacaciones con persona a cargo cambian de tipo solo hasta 2 días hábiles antes de empezar, inclusive (`limiteParaCambiarTipo(desde, calendario)`, con el calendario de las Notas Digitales —con la tabla: unas vacaciones desde el 09/12/2026 dan el 03/12, porque el 07/12 es no laborable y la nota sale el 04/12; null con el `RangeError` del tope—: el día hábil anterior sale la nota que adelanta los datasets e informa quién queda a cargo;
    respuesta del usuario, 26/10/2026): hasta ese día, pasarlas a otro tipo les saca la persona a cargo en Configuración; después, 400 en `tipo`, «Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.».
    Al corregir, la página manda `autorizado_id` solo si se cambió el campo (sin él, el servidor conserva la persona de Configuración; cada fila creada lleva `en_configuracion: { licencia_id, autorizado_id }` para el formulario).
    `GET /api/mi-espacio/firmante` da al titular lo que `GET /usuarios/licencias` (`adminOnly`) le da a Configuración (`{ soy_titular: true, hoy, autorizables }`: las personas que puede autorizar con sus licencias, `conSusLicencias`, con el calendario: si la tabla no se puede leer, con los 9 fijos, como Configuración); a cualquier otra persona, `{ soy_titular: false }`.
  - El aviso del formulario, antes de guardar y solo si pasa (`paso.avisos` del cálculo):
    `AVISO_DEL_PASO` (en azul:
    «Las fechas pasan a Configuración → Licencias.
    Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor.
    El tipo no pasa.»), al superadmin `AVISO_DEL_PASO_SUPERADMIN`, al titular `AVISO_NOTAS_DE_HOY` si empieza hoy o antes y hoy ya salió alguna nota con su firma («Las notas de hoy ya se generaron a las 8:05 con tu firma.»; solo si se generaron:
    `notasDeHoyDelTitular` de `services/miEspacioDatos.js` busca una nota de hoy, no de prueba, con `firmante_id` del titular, enviada o no, y se consulta solo si la licencia empieza hoy o antes;
    `notasDeHoy` de `pasoPrevistoDe`, solo el `true` literal) y `AVISO_SIN_PERSONA_A_CARGO` si no son vacaciones, a la persona autorizada del firmante una línea por cada licencia de él (sin anular, que no terminó) con la que se pisa la suya, «Sos la persona autorizada del firmante del 01/12/2026 al 18/12/2026: los días que no estés, no se presentan Notas Digitales.» (`textoAutorizadaDelFirmante`;
    las lee `delFirmanteComoAutorizada` de `services/miEspacioDatos.js` y `pasoPrevistoDe` las filtra con `comoAutorizada`; no frena: se guarda igual, decisión del usuario, 27/10/2026), y a quien audita, los días sin auditor de `GET /usuarios/licencias/sin-auditor` (al corregir una creada, con `excluir`).
    Sin pasar, lo dice `paso.sin_pasar_previsto` (unida o superpuesta).
    Al titular, `paso.firmante` es `{ soy_titular, puede_autorizar, vispera, sin_anticipo, sin_dias_habiles, notas_de_hoy }`: la víspera y las dos marcas, de `visperaDeLaLicencia` con el calendario y sus licencias de Configuración que incluyen el día hábil anterior al inicio (`delTitular`: sin la creada de la fila que se corrige, que se mueve con ella; una unida que se suelta sí cuenta), como Configuración, y `htmlDelPaso` se las pasa a `efectoEnNotas`.
  - La insignia «Cargada desde Mi espacio» de Configuración → Licencias:
    `desde_mi_espacio` en `COLUMNAS_LICENCIA`, con `EXISTS (SELECT 1 FROM mi_espacio_licencias m WHERE m.licencia_oficial_id = l.id AND m.oficial = 'creada' AND m.activo = 1)`; con `EXISTS` y no con un JOIN, porque varias unidas pueden apuntar a la misma licencia, y solo cuentan las creadas (una unida no hace de Mi espacio una licencia de administración).
    Se apaga cuando la fila deja de estar activa: al borrarla desde Mi espacio y al anularla en Configuración (la respuesta de la anulación vuelve a leer la licencia).

## Hoy no están y el email

- «Hoy no están» (sección 7): la casilla «Mostrar a mis compañeros que no estoy» (marcada de entrada) hace que las ausencias de día entero se vean como «<nombre> no está» y «Vuelve el lunes 02/11» (el primer día hábil después, con los feriados), nunca el tipo ni la nota; con el nombre corto de cada uno (spec 2026-10-28-mi-espacio-agenda-onda, 5.1) —«Carla no está», o «Carla B.» si hay otra Carla en la administración activa:
  `nombreCorto`, ver `docs/temas/mi-espacio-agenda-mes.md`—, en «Hoy no están», en «Hoy y mañana» del Resumen, en la agenda y en la fila de la licencia, «Tus compañeros ven «Andrea no está».»; las franquicias y las horas a favor de menos de 7 horas no se muestran.
  «Los compañeros» son administración (`esAdmin`): solo ellos tienen la casilla (el lector y el colaborador guardan `mostrar` 0) y ven a los demás, y solo se muestran ellos, sin quien mira.
  La casilla controla solo Mi espacio (si la licencia pasa a Configuración, administración ve igual sus fechas allí; decisión del usuario).
  `GET /api/mi-espacio/ausentes?desde=&hasta=` → `{ puede_ver, ausentes: [{ nombre, desde, hasta, vuelve, texto, vuelve_texto }] }` (sin `esAdmin`, `puede_ver: false` y ninguno, sin consultar; las fechas se validan antes que nada, 400 en `fechas`, y un rango de más de 93 días da «Elegí un rango de hasta 93 días.»);
  lee las ausencias 366 días antes y después del rango para unir las seguidas o separadas solo por días no hábiles (`ausenciasUnidas`, como `unirAusencias` de Configuración pero con los feriados) y verlas enteras (`ausentesDelRango`).
  En el Resumen, «Hoy y mañana» las separa en dos grupos (decisión del usuario, 27/10/2026;
  `ausentesDeHoyYManana`): los que hoy no están (`ausentes_hoy`, con su vuelta) y los que empiezan mañana (`ausentes_manana`: el día corrido siguiente, y hoy están; quien falta hoy y mañana va solo hoy), y el próximo feriado (`proximoFeriadoDe`); cada grupo va en su columna, Hoy o Mañana, después de los eventos de ese día, y el feriado en la tercera, Próximo feriado.
  Una columna sin nada no se muestra.
  «Hoy y mañana» trae los eventos de hoy y de mañana (`hoy_y_manana.eventos`, sin los de hoy que ya terminaron) y está siempre: sin ninguno, «No tenés eventos hoy ni mañana.» y «Ver la agenda».
- El email de vencimiento (sección 9;
  `enviarAvisosDeVencimiento({ hoy })` de `services/miEspacioAvisos.js`, con `avisosDeVencimiento` de las reglas; dónde corre, en `docs/temas/calendario-y-corridas.md`).
  Lo que avisa, desde la fecha de la regla hasta el vencimiento y una sola vez (decisión del usuario): un franco (clave `franco-AAAA-MM`, en planta) o unas horas a favor (`horas-AAAA-MM`, en contrato) del mes de hoy sin usar, desde 5 días hábiles antes del último día hábil del mes (`restarDiasHabilesCon`, `ultimoDiaHabilDelMesCon`) hasta ese día;
  y, desde el primer día hábil de diciembre (`proximoDiaHabilCon`) hasta el 31/12, las horas de franquicia del año que todavía entran en algún día libre (`franquicia-AAAA`, solo en planta: los `disponibles` de `calculo.franquicia`, sin las perdidas, «Tenés 22 horas de franquicia: vencen el 31/12/2026.»;
  `mi_espacio_avisos.clave` es `varchar(40)`; spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6) y los días disponibles de la licencia ordinaria que vence el 31/12 de este año (`licencia-AAAA`).
  Un franco o unas horas a favor sin ningún día libre en todo su mes no se nombran, como las horas de franquicia que se pierden (3.7):
  `emailDe` le pasa a `avisosDeVencimiento` todas las licencias de la persona en `ocupadas` (sin ellas, ninguna ocupa un día).
  A quién: cada persona activa, con vínculo, con su arranque y con un email válido (`emailValido`), que ese día no está de licencia (`ausentesEn`: una de Configuración sin anular o una de Mi espacio activa de día entero, con «Mostrar» o sin él), con lo que todavía no se le avisó (`mi_espacio_avisos`).
  Un email por persona y por corrida, con `sendEmail` y `to: [email]` (nunca vacío: sin destinatario iría a las casillas por defecto de la DGMIT), `remitente()` y `vencimientoMiEspacioTemplate` de `services/emailTemplates.js` (`plantillaSimple`, en `marcoEmail`:
  «RPAD: lo que vence pronto en Mi espacio», «Hola, <nombre>.», un renglón por cosa, como «Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.», y «Ver en Mi espacio» → `mi-espacio.html#resumen`; nunca el tipo de una licencia médica: solo vacaciones, francos y horas).
  Si sale, se anotan sus claves (`ON DUPLICATE KEY UPDATE`, con `ahoraArgentina()`); si no, no se anota nada y sale en la próxima corrida de su tramo.
  El email lleva también los dos avisos de cada grupo por restituir (ver `docs/temas/mi-espacio-restituidos.md`).

## La página

La licencia anulada en Configuración y las licencias de otro año (spec 2026-10-28-mi-espacio-licencia-anulada; la anulación, arriba; `para_revisar` y `otros_anios`, en `docs/temas/mi-espacio.md`), lo puro:
`htmlDeFaltantes(faltantes, paraRevisar)` (el aviso ámbar de arriba del Resumen: los faltantes y, después, cada uno de `para_revisar`, `{ licencia_id, anio, texto, enlace }`, con su texto y su link «Ver en Licencias de 2027»; sin texto, no va; un solo faltante sin nada para revisar sigue siendo un párrafo y, si no, una lista `.me-faltantes`;
`htmlDelResumen` le pasa `resumen.para_revisar`, y un Resumen sin la clave se ve sin nada para revisar), `htmlDeLaFrase` (una oración de la bajada con un `anio` entero, la de lo cargado, va en un link `.me-frase-link`; la que vence va en `<b class="vence">` desde el 1/10, con su `vence` —antes, en el color de la frase: spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.5—, como «Perdés …»), `atributosDelLinkALicencias` (los de los dos links:
`href="#licencias"`, `data-pestana="licencias"` y el año en `data-anio-licencias`; cada link, solo con un año que pasa `Number.isInteger` y, en el aviso, con el texto del link: si no, el texto solo), `htmlDeOtrosAnios` (los `otros_anios` de la lista, debajo de la cabeza de la tarjeta y antes de los filtros: cada uno en un `<p class="me-otros-anios">` con «Ver 2027», un `<button>` con el `data-anio` del selector, que atiende el mismo clic y lleva el foco al botón de ese año del selector;
un año que no es un entero, solo el texto), `htmlDelSegundoPaso` trae `lista` («Está en la lista de 2027.», escapada, en `.me-paso-dos-lista`, después de la licencia guardada; sin ella, nada) y `anioDeLaLicencia` (el año de un `'AAAA-MM-DD'` que existe, cortado como texto; lo demás, null).
Lo que toca el DOM:
`pagina.anioDeLicencias` (el año que la lista tiene que mostrar la próxima vez que se pida, o null), que `guardarLicencia` escribe con un 2xx, de una licencia y de un uso autorizado, con `anioDeLaLicencia(cuerpo.desde)`;
`tomarElAnioDeLicencias` (lo da una sola vez y lo vuelve a null; el de hoy, o ninguno, da null: la lista sin `?anio=`, la del año en curso que dice el servidor, como `anioQueTenia`, así el reloj del teléfono adelantado no pide otro año);
`mostrarPestana('licencias')` pide la lista si no está o si hay un año pendiente (una lista vieja que llega después de guardar no tapa el año de lo guardado);
`volverAPedirTodo`, con la pestaña Licencias a la vista, la vuelve a pedir en el año pendiente si hay uno (también si la carga anterior había fallado) y, si no, en el que tenía, y fuera de ella suelta la lista y deja el año para cuando se abra; e `irALicencias(anio)` (los dos links del Resumen, desde `alTocarResumen`, después del control de Ctrl, Cmd, Mayúsculas, Alt y el botón que no es el principal: si la lista ya muestra ese año, no pide nada; si no, la suelta y deja el año pendiente;
el foco va a `#tab-licencias`).
No copia nada del servidor: los textos, los años y `lista` los manda el servidor (Ruling 19).
Los estilos (`.me-faltantes a`, `.me-frase-link`, con el color de la frase, `.me-otros-anios` y su botón, subrayados como los links de la página, y `.me-paso-dos-lista`, alineada con la licencia guardada), en el `<style>` de `mi-espacio.html`, solo con los tokens `--sg-*`.

## Archivos de tests

`mi-espacio-reglas.test.js`, `mi-espacio-resumen.test.js`, `mi-espacio-api.test.js`, `mi-espacio-frontend.test.js`, `paginas.test.js`
