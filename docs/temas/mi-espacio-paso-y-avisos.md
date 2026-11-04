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
    Cada una es una licencia de Configuración con `usuario_id` = `creado_por` = la persona (dos seguidas de distinto tipo, dos contiguas), con las reglas de siempre, sin copiarlas: las del servicio compartido `services/licenciasOficialesService.js` (ver «Configuración»).
    Queda en `usuarios_auditoria` como siempre y no sale el aviso al superadmin (el actor es la misma persona).
    Desde los feriados en todo el sistema, Configuración cuenta con el calendario (los 9 fijos y la tabla) los días libres de la persona autorizada y «vuelve el…», y Mi espacio le pasa el suyo:
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
    Anularla en Configuración, desde la spec 2026-10-28-mi-espacio-licencia-anulada, la borra también de Mi espacio (abajo); antes quedaba solo en Mi espacio, como registro personal.
    Si administración acorta o anula la que cubría una unida, la fila dice «Ya no está cubierta en Configuración del … al …: revisala con administración.» (Mi espacio lee `anulada` y las fechas de la de Configuración).
  - La anulación en Configuración (spec 2026-10-28-mi-espacio-licencia-anulada, 2.1 y 3b; el código, en «Configuración»): la fila creada que la apunta se da de baja con ella, en la misma transacción, la anule quien la anule, salvo que en Mi espacio ya haya empezado antes de hoy (`bajaPorLaAnulacion`); una corrección o un borrado de esa fila desde otra pestaña que quedó abierta da después el 404 «Licencia no encontrada» (nada revive).
    Las unidas no cambian.
    Una creada que queda anulada en Configuración (la de 3b, y las que se anularon antes de este cambio: no hay arreglo automático ni hace falta SQL) sigue contando hasta que la persona la borre, y su fila dice `TEXTO_ANULADA_EN_CONFIGURACION` («Se anuló en Configuración: acá sigue contando.
    Si ya no va, borrala.», que reemplazó a `TEXTO_ANULADA_POR_ADMINISTRACION`, «Administración la anuló…»: pudo haberla anulado la misma persona); corregirla no la vuelve a pasar (para eso, se borra y se carga de nuevo).
    Desde los días restituidos, si la fila que se da de baja es una carga de días restituidos, `bajaPorLaAnulacion` suelta también su pedido en la misma transacción (`soltarLosPedidosDeLasCargas`): sus días vuelven a estar por restituir hasta el plazo y, después, quedan perdidos, como al borrarla desde Mi espacio (decisión del controlador del plan, por la revisión de la Task 2).
  - Lo que quedó distinto en Configuración, para revisar (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2, 3.1, 3.2 y 3.3): una creada cuya licencia de Configuración (sin anular) quedó con otras fechas, las haya cambiado la misma persona u otra (se compara la fila con su licencia, no con la auditoría), conserva las suyas en Mi espacio, que siguen siendo las que cuentan, y la fila dice `textoRevisalaEnConfiguracion(desde, hasta)` con las de Configuración («En Configuración quedó del 04/01 al 08/01:
    revisala.» o, de un día, «En Configuración quedó el 17/11: revisala.», en lugar de «También en Configuración → Licencias.»; si la cambió otra persona, `'creada_cambiada'`, sigue con «En Configuración: del … al ….
    Administración la cambió …», que ya dice las fechas), salvo que otro aviso de la fila ya lo explique: un `sin_pasar` (una corrección que no se pudo copiar), una que dejó de ser de día entero (`textoSigueEnConfiguracion`) o de quien hoy no puede tener licencia (`otrasFechasParaRevisar`, la regla de la fila y del Resumen); ahí la fila queda como estaba.
    Se arregla corrigiendo una de las dos: con las mismas fechas, el aviso se va.
    Lo que avisa el Resumen (`para_revisar`, ver «El panel como datos») lo decide `revisionDelVinculo(vinculo, fila, { sinPasar, puedeTener, hoy })` (pura, nunca tira;
    `revision` en cada entrada de `vinculosDeLaLista`, con el `hoy` de sus opciones) → `{ motivo, desde, hasta }` o null, y solo lo que todavía se puede resolver:
    `'fechas'`, con las de Configuración, en una creada o una `'creada_cambiada'` con las mismas excepciones que la fila, mientras esa licencia de Configuración no terminó (después, las fechas de una creada quedan fijas);
    `'anulada'` (sin fechas), una creada anulada, mientras la de Mi espacio no terminó; y `'sin_cubrir'`, con los días fuera, una unida sin cubrir, mientras la de Mi espacio no terminó.
    La fila lo sigue diciendo siempre.
    Nunca frena una carga ni una corrección (no va en `faltantes` ni en `calculo.faltantes`, y no lo leen `pasoDeLaCorreccion`, `pasoDeLaBaja`, `calcular` ni `faltantesDe`).
    Sin emails nuevos.
  - Si Configuración la rechaza: un rechazo en `autorizado_id` (la persona a cargo que eligió el titular no sirve), con su status, no guarda nada; cualquier otro (se superpone en parte, pasa de 365 días, el rol ya no puede tener licencia) se guarda igual en Mi espacio, sin pasar, con el motivo en `sin_pasar` («No pasó a Configuración: …»).
    La persona autorizada del firmante no se frena (decisión del usuario, 27/10/2026, que reemplazó al rechazo `autorizada_sin_dias`): su licencia pasa como cualquier otra aunque no le quede ningún día hábil de la del firmante, y esos días no se presentan Notas Digitales (ver «Firma de las Notas Digitales y licencia del firmante»).
  - El firmante titular: solo las vacaciones (y, desde los días restituidos, la carga de los días restituidos, que también lo son:
    `TIPOS_CON_PERSONA_A_CARGO` y `dejaPersonaACargo`, que usan `autorizadoDelPedido`, `pasoPrevistoDe` y `pasoDeLaCorreccion`) dejan persona a cargo (corrección del usuario, 26/10/2026): el campo de Configuración «Autorizo a presentar las notas en mi nombre a:» aparece solo cuando el titular carga vacaciones (opcional y vacío), lo elige quien carga, sin una regla nueva, y un `autorizado_id` en otro tipo da 400 en ese campo (`autorizadoSoloVacaciones`).
    Las demás licencias del titular pasan sin persona a cargo y el formulario lo avisa (`AVISO_SIN_PERSONA_A_CARGO`).
    Cada licencia lleva su propia autorización, por sus fechas (dos seguidas no se unen ni se estiran).
    Sus vacaciones con persona a cargo cambian de tipo solo hasta 2 días hábiles antes de empezar, inclusive (`limiteParaCambiarTipo(desde, calendario)`, con el calendario de las Notas Digitales —desde los feriados en todo el sistema, con la tabla: unas vacaciones desde el 09/12/2026 dan el 03/12, porque el 07/12 es no laborable y la nota sale el 04/12; null con el `RangeError` del tope—: el día hábil anterior sale la nota que adelanta los datasets e informa quién queda a cargo;
    respuesta del usuario, 26/10/2026): hasta ese día, pasarlas a otro tipo les saca la persona a cargo en Configuración; después, 400 en `tipo`, «Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.».
    Al corregir, la página manda `autorizado_id` solo si se cambió el campo (sin él, el servidor conserva la persona de Configuración; cada fila creada lleva `en_configuracion: { licencia_id, autorizado_id }` para el formulario).
    `GET /api/mi-espacio/firmante` da al titular lo que `GET /usuarios/licencias` (`adminOnly`) le da a Configuración (`{ soy_titular: true, hoy, autorizables }`: las personas que puede autorizar con sus licencias, `conSusLicencias`, con el calendario: si la tabla no se puede leer, con los 9 fijos, como Configuración); a cualquier otra persona, `{ soy_titular: false }`.
  - El aviso del formulario, antes de guardar y solo si pasa (`paso.avisos` del cálculo):
    `AVISO_DEL_PASO` (en azul:
    «Las fechas pasan a Configuración → Licencias.
    Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor.
    El tipo no pasa.»), al superadmin `AVISO_DEL_PASO_SUPERADMIN`, al titular `AVISO_NOTAS_DE_HOY` si empieza hoy o antes y hoy ya salió alguna nota con su firma («Las notas de hoy ya se generaron a las 8:05 con tu firma.», desde la firma digital; desde los feriados en todo el sistema, solo si se generaron:
    `notasDeHoyDelTitular` de `services/miEspacioDatos.js` busca una nota de hoy, no de prueba, con `firmante_id` del titular, enviada o no, y se consulta solo si la licencia empieza hoy o antes;
    `notasDeHoy` de `pasoPrevistoDe`, solo el `true` literal) y `AVISO_SIN_PERSONA_A_CARGO` si no son vacaciones, a la persona autorizada del firmante una línea por cada licencia de él (sin anular, que no terminó) con la que se pisa la suya, «Sos la persona autorizada del firmante del 01/12/2026 al 18/12/2026: los días que no estés, no se presentan Notas Digitales.» (`textoAutorizadaDelFirmante`;
    las lee `delFirmanteComoAutorizada` de `services/miEspacioDatos.js` y `pasoPrevistoDe` las filtra con `comoAutorizada`; no frena: se guarda igual, decisión del usuario, 27/10/2026), y a quien audita, los días sin auditor de `GET /usuarios/licencias/sin-auditor` (al corregir una creada, con `excluir`).
    Sin pasar, lo dice `paso.sin_pasar_previsto` (unida o superpuesta).
    Al titular, `paso.firmante` es `{ soy_titular, puede_autorizar, vispera, sin_anticipo, sin_dias_habiles, notas_de_hoy }`: la víspera y las dos marcas, de `visperaDeLaLicencia` con el calendario y sus licencias de Configuración que incluyen el día hábil anterior al inicio (`delTitular`: sin la creada de la fila que se corrige, que se mueve con ella; una unida que se suelta sí cuenta), como Configuración, y `htmlDelPaso` se las pasa a `efectoEnNotas`.
  - La insignia «Cargada desde Mi espacio» de Configuración → Licencias:
    `desde_mi_espacio` en `COLUMNAS_LICENCIA`, con `EXISTS (SELECT 1 FROM mi_espacio_licencias m WHERE m.licencia_oficial_id = l.id AND m.oficial = 'creada' AND m.activo = 1)`; con `EXISTS` y no con un JOIN, porque varias unidas pueden apuntar a la misma licencia, y solo cuentan las creadas (una unida no hace de Mi espacio una licencia de administración).
    Se apaga cuando la fila deja de estar activa: al borrarla desde Mi espacio y, desde la spec 2026-10-28-mi-espacio-licencia-anulada, al anularla en Configuración (la respuesta de la anulación vuelve a leer la licencia).

## Hoy no están y el email

- «Hoy no están» (sección 7): la casilla «Mostrar a mis compañeros que no estoy» (marcada de entrada) hace que las ausencias de día entero se vean como «<nombre> no está» y «Vuelve el lunes 02/11» (el primer día hábil después, con los feriados), nunca el tipo ni la nota; desde la agenda con más onda (spec 2026-10-28-mi-espacio-agenda-onda, 5.1), con el nombre corto de cada uno —«Carla no está», o «Carla B.» si hay otra Carla en la administración activa:
  `nombreCorto`, ver «Mi espacio: la agenda»—, en «Hoy no están», en «Hoy y mañana» del Resumen, en la agenda y en la fila de la licencia, «Tus compañeros ven «Andrea no está».»; las franquicias y las horas a favor de menos de 7 horas no se muestran.
  «Los compañeros» son administración (`esAdmin`): solo ellos tienen la casilla (el lector y el colaborador guardan `mostrar` 0) y ven a los demás, y solo se muestran ellos, sin quien mira.
  La casilla controla solo Mi espacio (si la licencia pasa a Configuración, administración ve igual sus fechas allí; decisión del usuario).
  `GET /api/mi-espacio/ausentes?desde=&hasta=` → `{ puede_ver, ausentes: [{ nombre, desde, hasta, vuelve, texto, vuelve_texto }] }` (sin `esAdmin`, `puede_ver: false` y ninguno, sin consultar; las fechas se validan antes que nada, 400 en `fechas`, y un rango de más de 93 días da «Elegí un rango de hasta 93 días.»);
  lee las ausencias 366 días antes y después del rango para unir las seguidas o separadas solo por días no hábiles (`ausenciasUnidas`, como `unirAusencias` de Configuración pero con los feriados) y verlas enteras (`ausentesDelRango`).
  En el Resumen, «Hoy y mañana» las separa en dos grupos (decisión del usuario, 27/10/2026;
  `ausentesDeHoyYManana`): los que hoy no están (`ausentes_hoy`, con su vuelta) y los que empiezan mañana (`ausentes_manana`: el día corrido siguiente, y hoy están; quien falta hoy y mañana va solo hoy), y el próximo feriado (`proximoFeriadoDe`); desde el Resumen «Titular», cada grupo va en su columna, Hoy o Mañana, después de los eventos de ese día, y el feriado en la tercera, Próximo feriado.
  Una columna sin nada no se muestra.
  Desde la agenda, «Hoy y mañana» suma los eventos de hoy y de mañana (`hoy_y_manana.eventos`, sin los de hoy que ya terminaron) y está siempre: sin ninguno, «No tenés eventos hoy ni mañana.» y «Ver la agenda» (antes, sin nada, la sección no estaba).
- El email de vencimiento (sección 9;
  `enviarAvisosDeVencimiento({ hoy })` de `services/miEspacioAvisos.js`, con `avisosDeVencimiento` de las reglas; dónde corre, en «Recordatorios automáticos»).
  Lo que avisa, desde la fecha de la regla hasta el vencimiento y una sola vez (decisión del usuario): un franco (clave `franco-AAAA-MM`, en planta) o unas horas a favor (`horas-AAAA-MM`, en contrato) del mes de hoy sin usar, desde 5 días hábiles antes del último día hábil del mes (`restarDiasHabilesCon`, `ultimoDiaHabilDelMesCon`) hasta ese día;
  y, desde el primer día hábil de diciembre (`proximoDiaHabilCon`) hasta el 31/12, las horas de franquicia del año que todavía entran en algún día libre (`franquicia-AAAA`, solo en planta, desde las vacaciones al cargar una licencia: los `disponibles` de `calculo.franquicia`, sin las perdidas, «Tenés 22 horas de franquicia: vencen el 31/12/2026.»;
  `mi_espacio_avisos.clave` es `varchar(40)`, sin SQL: spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6) y los días disponibles de la licencia ordinaria que vence el 31/12 de este año (`licencia-AAAA`).
  Un franco o unas horas a favor sin ningún día libre en todo su mes no se nombran, como las horas de franquicia que se pierden (3.7):
  `emailDe` le pasa a `avisosDeVencimiento` todas las licencias de la persona en `ocupadas` (sin ellas, ninguna ocupa un día).
  A quién: cada persona activa, con vínculo, con su arranque y con un email válido (`emailValido`), que ese día no está de licencia (`ausentesEn`: una de Configuración sin anular o una de Mi espacio activa de día entero, con «Mostrar» o sin él), con lo que todavía no se le avisó (`mi_espacio_avisos`).
  Un email por persona y por corrida, con `sendEmail` y `to: [email]` (nunca vacío: sin destinatario iría a las casillas por defecto de la DGMIT), `remitente()` y `vencimientoMiEspacioTemplate` de `services/emailTemplates.js` (`plantillaSimple`, en el marco de siempre:
  «RPAD: lo que vence pronto en Mi espacio», «Hola, <nombre>.», un renglón por cosa, como «Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.», y «Ver en Mi espacio» → `mi-espacio.html#resumen`; nunca el tipo de una licencia médica: solo vacaciones, francos y horas).
  Si sale, se anotan sus claves (`ON DUPLICATE KEY UPDATE`, con `ahoraArgentina()`); si no, no se anota nada y sale en la próxima corrida de su tramo.
  Desde los días restituidos, suma los dos avisos de cada grupo por restituir (ver «Los días que restituye un asueto», abajo).

## La página

Desde la licencia anulada en Configuración y las licencias de otro año (spec 2026-10-28-mi-espacio-licencia-anulada; ver «Mi espacio: licencias y horas extras»), lo puro:
`htmlDeFaltantes(faltantes, paraRevisar)` (el aviso ámbar de arriba del Resumen: los faltantes y, después, cada uno de `para_revisar`, `{ licencia_id, anio, texto, enlace }`, con su texto y su link «Ver en Licencias de 2027»; sin texto, no va; un solo faltante sin nada para revisar sigue siendo un párrafo y, si no, una lista `.me-faltantes`;
`htmlDelResumen` le pasa `resumen.para_revisar`, y un Resumen sin la clave se ve como antes), `htmlDeLaFrase` (una oración de la bajada con un `anio` entero, la de lo cargado, va en un link `.me-frase-link`; la que vence va en `<b class="vence">` desde el 1/10, con su `vence` —antes, en el color de la frase: spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.5—, como «Perdés …»), `atributosDelLinkALicencias` (los de los dos links:
`href="#licencias"`, `data-pestana="licencias"` y el año en `data-anio-licencias`; cada link, solo con un año que pasa `Number.isInteger` y, en el aviso, con el texto del link: si no, el texto solo), `htmlDeOtrosAnios` (los `otros_anios` de la lista, debajo de la cabeza de la tarjeta y antes de los filtros: cada uno en un `<p class="me-otros-anios">` con «Ver 2027», un `<button>` con el `data-anio` del selector, que atiende el mismo clic y lleva el foco al botón de ese año del selector;
un año que no es un entero, solo el texto), `htmlDelSegundoPaso` suma `lista` («Está en la lista de 2027.», escapada, en `.me-paso-dos-lista`, después de la licencia guardada; sin ella, nada) y `anioDeLaLicencia` (el año de un `'AAAA-MM-DD'` que existe, cortado como texto; lo demás, null).
Lo que toca el DOM:
`pagina.anioDeLicencias` (el año que la lista tiene que mostrar la próxima vez que se pida, o null), que `guardarLicencia` escribe con un 2xx, de una licencia y de un uso autorizado, con `anioDeLaLicencia(cuerpo.desde)`;
`tomarElAnioDeLicencias` (lo da una sola vez y lo vuelve a null; el de hoy, o ninguno, da null: la lista sin `?anio=`, la del año en curso que dice el servidor, como `anioQueTenia`, así el reloj del teléfono adelantado no pide otro año);
`mostrarPestana('licencias')` pide la lista si no está o si hay un año pendiente (una lista vieja que llega después de guardar no tapa el año de lo guardado);
`volverAPedirTodo`, con la pestaña Licencias a la vista, la vuelve a pedir en el año pendiente si hay uno (también si la carga anterior había fallado) y, si no, en el que tenía, y fuera de ella suelta la lista y deja el año para cuando se abra; e `irALicencias(anio)` (los dos links del Resumen, desde `alTocarResumen`, después del control de Ctrl, Cmd, Mayúsculas, Alt y el botón que no es el principal: si la lista ya muestra ese año, no pide nada; si no, la suelta y deja el año pendiente;
el foco va a `#tab-licencias`).
No copia nada del servidor: los textos, los años y `lista` los manda el servidor (Ruling 19).
Los estilos (`.me-faltantes a`, `.me-frase-link`, con el color de la frase, `.me-otros-anios` y su botón, subrayados como los links de la página, y `.me-paso-dos-lista`, alineada con la licencia guardada), en el `<style>` de `mi-espacio.html`, solo con los tokens `--sg-*`.
`VERSION_MI_ESPACIO` pasó a `'20261215'` (de `'20261214'`, la de los feriados en todo el sistema).

## Tests

Desde la licencia anulada en Configuración y las licencias de otro año (spec 2026-10-28-mi-espacio-licencia-anulada): en `mi-espacio-reglas.test.js`, `TEXTO_ANULADA_EN_CONFIGURACION` y `textoRevisalaEnConfiguracion`, `textoDelVinculo` de una creada con otras fechas (la cambie quien la cambie, también con la licencia de Configuración ya terminada o de un día;
con un `sin_pasar`, sin el día entero o sin un `puedeTener` que sea el `true` literal, el texto de antes) y de una anulada, `revisionDelVinculo` (cada motivo con sus fechas; lo que ya no se puede resolver, null —la licencia de Configuración terminada, la de Mi espacio terminada, también ayer—; sin un hoy que sirva, null; y que nunca tira) y la `revision` de cada entrada de `vinculosDeLaLista`;
en `mi-espacio-resumen.test.js`, `paraRevisarDe` (cada motivo con su texto, por `desde` y después por id, las fechas de la fila, los textos de un día, con los vínculos de verdad, que no es un faltante y [] sin vínculos, sin arranque, sin modalidad o sin hoy), el `anio` de lo cargado en la bajada (solo en esa oración), `otrosAniosDe` (lo terminado no, lo que termina hoy sí, lo que cruza el año no, el año de su `desde`, un año fuera del selector no, el uso autorizado y la otra modalidad sí,
y en `filasDeLicencias`) y `textoDeLaListaDe`; en `mi-espacio-api.test.js` (Docker), anularla en Configuración la borra de Mi espacio, la anule otra persona o la misma (el mensaje, `desde_mi_espacio` en false y la fila con `activo` 0, y ya no está en la lista, en la agenda propia, en lo que ven los compañeros, en el Resumen ni en `GET /feriados/afectadas`), una corrección o un borrado después de la anulación dan el 404 sin revivir nada, la anulación que no se puede (el 409)
no toca Mi espacio, una que en Mi espacio ya empezó queda con `TEXTO_ANULADA_EN_CONFIGURACION` y su aviso en `para_revisar`, una unida no se toca, con una creada y una unida que la apuntan solo se da de baja la creada, `bajaPorLaAnulacion` en la transacción de quien llama (con rollback, nada;
repetida, ninguna más), la franquicia de 7 horas que pasa a 3 deja la fila activa, la licencia de Configuración con otras fechas por SQL (la fila y el Resumen lo avisan, otra carga pasa igual y, corregida la fila, el aviso se va sin tocar Configuración), `para_revisar` cuando las cambia otra persona y en una unida sin cubrir, el Resumen que sale igual, con `para_revisar` [], si no se pueden leer los vínculos, `lista` de `GET …/nota` y `otros_anios` de `GET /mi-espacio/licencias`;
en `mi-espacio-frontend.test.js`, con los datos que arma el servidor para una persona inventada de planta con vacaciones del 04/01 al 15/01/2027 que en Configuración quedaron del 04/01 al 08/01, lo puro (`htmlDeFaltantes` con cada parte y sin ninguna, todo escapado, también en el link, y sin link con un año que no es un entero o sin el texto del link;
`htmlDelResumen`;
`htmlDeLaFrase` con el link; la lista con «Ver AAAA»;
`htmlDelSegundoPaso` con `lista`;
`anioDeLaLicencia`) y, con el DOM y el `fetch` falsos, guardar una de 2027 con Licencias abierta en 2026 (pide `?anio=2027` y el segundo paso lo dice), guardarla desde el Resumen o desde «Vence pronto» con Licencias sin abrir (al abrirla, 2027), una del año en curso sin `?anio=`, un uso autorizado de 2027, los dos links del Resumen (con el foco en la pestaña, sin pedir nada si la lista ya muestra ese año y, con Ctrl, Cmd, Mayúsculas, Alt u otro botón, nada), «Ver 2027»,
la lista que había fallado, la lista vieja que llega después de guardar y los estilos (subrayados, 4,5:1 o más y el foco visible); y en `paginas.test.js`, `VERSION_MI_ESPACIO` en `'20261215'`.

## Archivos de tests

`mi-espacio-reglas.test.js`, `mi-espacio-resumen.test.js`, `mi-espacio-api.test.js`, `mi-espacio-frontend.test.js`, `paginas.test.js`
