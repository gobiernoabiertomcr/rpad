# Mi espacio: la planilla de horas extras de contrato

Cada persona de contrato carga por día a qué hora se fue y el sistema calcula las horas. Incluye «Sumar al mes anterior».

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-design.md`
- `docs/superpowers/specs/2026-10-27-mi-espacio-horas-design.md`
- `docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md`

## La planilla de contrato

  - La planilla de contrato (spec 2026-10-27-mi-espacio-horas, secciones 3 y 7; la maqueta que eligió el usuario, en `docs/superpowers/specs/2026-10-27-mi-espacio-horas-mockups/`): una persona de contrato no carga horarios sueltos sino, por cada día, a qué hora se fue (y, si quiere, a qué hora entró), y el sistema calcula las horas extras; planta carga horarios sueltos y no tiene planilla.
    Las reglas (decisión del usuario, 27/10/2026): la jornada es de 8:00 a 15:00, la misma para todas las personas de contrato (`SALIDA_DE_LA_JORNADA` = '15:00', fija en el código); en un día hábil (`esDiaHabilCon`, con los feriados de la tabla) cuenta solo la salida, desde las 15:00, de a media hora, y una media hora vale desde su minuto 16 (`TOLERANCIA_DIA_HABIL` = 14:
    `floor((salida − 15:00 + 14) / 30) / 2`, 0 antes de las 15:00; 15:15 da 0, 15:16 da 0,5 y 16:16 da 1,5), y la entrada es opcional y no cuenta (el ingreso no se controla); en un feriado, un sábado o un domingo (también los 9 fijos) la entrada es obligatoria y cuentan todos los minutos de la entrada a la salida, con 10 de tolerancia (`TOLERANCIA_DIA_INHABIL`:
    `floor((salida − entrada + 10) / 30) / 2`; 79 minutos dan 1 y 80, 1,5; desde la hora en que entra, aunque sea antes de las 8:00); la salida es del mismo día (no pasa la medianoche) y, con entrada, va después de ella, también en un día hábil; un solo horario por día.
    Las horas de un mes son horas a favor del mes siguiente, 1 a 1, con todo lo demás de la spec 2026-10-26-mi-espacio-licencias-y-horas, 3.6 (ver `docs/temas/mi-espacio.md`).
    «Días de franco» es solo una forma de decirlo, en la planilla y en la pestaña (`enDiasDeFranco`: cada 7 horas, `JORNADA`, un día, y lo que sobra en horas:
    «2 días de franco y 4,5 horas», «3 días de franco», «4,5 horas»; singular solo con 1): no hay un franco de contrato, y las horas a favor se siguen usando desde «Cargar licencia» → «Horas a favor», de a media hora, 7 horas el día entero.
    Las funciones (puras; ninguna tira):
    `horaSalidaValida` ('HH:MM' con cualquier minuto), `tipoDeDia` ('habil', 'feriado' —uno del Set o de los 9 fijos, aunque caiga sábado o domingo— o 'finde'), `horasDeLaSalida({ fecha, entrada, salida }, feriados)` (de a 0,5, o null sin una salida válida, en un día que no es hábil sin entrada o con la salida antes o igual que la entrada), `horasPorMesDeSalidas` (un Map por mes, como `horasPorMes`;
    un día que da 0 deja su mes en 0, pero `horasAFavorDe` saca los meses en 0: no queda una fila «0 h» salvo que su mes de uso tenga usos, Ruling 5 del plan), `textoDeLaSumaDelMes(mes, horas, hoy)` (la frase de la banda:
    «En noviembre vas a tener 2 días de franco y 4,5 horas a favor.» en el mes en curso y «En octubre tuviste 1 día de franco y 3,5 horas a favor.» si el mes en que se usan ya pasó (si es el de hoy, «tenés»), «a favor» solo con horas sueltas; sin horas, «Todavía no sumaste horas extras en octubre.» o «En septiembre no hiciste horas extras.»), `mesDeLaPlanilla(valor, hoy)` (sin valor, el mes de hoy; un 'AAAA-MM' del primero de `rangoDeFechas` —enero de hace dos años— al de hoy;
    lo demás, una lista incluida, null), `licenciaDeDiaEnteroEn(estado, fecha, feriados)` (la licencia de día entero de Mi espacio de ese día —`esDiaEntero`, de la modalidad y en un día hábil; también una anterior al arranque—, o null) y `validarSalida(dia, { hoy, estado, feriados })` → `{ datos: { fecha, entrada, salida, nota, borrar }, error }`: primero el formato de la fecha;
    un día con la entrada, la salida y la nota vacías es un borrado (`borrar: true`) y pasa siempre, también un día de licencia, uno que no llegó o uno fuera del rango (así se quita cualquier salida guardada: decisión de la spec); si no, en este orden: la fecha, del 01/01 de hace dos años a hoy (antes, `textoRango` hasta hoy; un día que todavía no llegó, `diaQueNoLlego`, «Ese día todavía no llegó.»;
    hoy se carga), que no sea un día de licencia de día entero (`diaDeLicencia`, «Ese día tenés una licencia de día entero: no se cargan horas.»: decisión del usuario), las horas 'HH:MM' (`horaSalida`, «Escribí la hora como 16:45.», la entrada primero;
    no se recortan), la salida (`salidaQueCuenta`, «Falta la salida: es la que cuenta.», en un día hábil, o `salidaFalta`), la entrada en un día que no es hábil (`entradaFeriado` o `entradaFinde`), la salida después de la entrada (`salidaAntes`) y la nota, recortada, de hasta 200 caracteres.
    `avisosDeSalidas(estado, feriados)` → `[{ clave: 'salida:AAAA-MM-DD', fecha, texto, aviso }]` (solo contrato, uno por día, por fecha): las salidas guardadas que dejaron de cerrar por algo posterior, con `texto` para los faltantes del Resumen y `aviso` para su fila: un día que pasó a ser feriado y no tiene entrada («Revisá tus horas extras del lunes 12/10: ahora es feriado y falta la entrada.» y «Ahora es feriado: falta la entrada.»;
    esa salida no suma hasta que se pone la entrada) y un día en que después se cargó una licencia de día entero («Revisá tus horas extras del viernes 09/10: ese día tenés una licencia de día entero.» y «Ese día tenés una licencia de día entero: revisá esta salida.»; esa salida sigue sumando, así no cambian las horas a favor del mes siguiente, hasta que se la quita).
    **Nunca frenan nada**: van aparte de `faltantes`, así `problemaDeLaCarga` no los ve y una licencia nunca se rechaza por una salida («el sistema no frena licencias», del usuario).
    La baja de un feriado no deja aviso: el día pasa a ser hábil y la salida cuenta desde las 15:00.
    Con «Sumar al mes anterior» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 3; decisiones del usuario, 30/10/2026: a una persona de contrato la pueden autorizar a sumar las horas de unos días a las del mes anterior, para llegar al día entero), cada salida tiene la marca `al_mes_anterior` (el tilde «Sumar a {mes anterior}», en cualquier día de cualquier mes;
    Mi espacio no controla la autorización ni la fecha de hoy): marcada, sus horas (las de `horasDeLaSalida`) suman enteras al mes anterior al de su fecha.
    En la cuenta:
    `mesDeLaSalida(fila)` (el 'AAAA-MM' de la fecha o, con el `true` literal, `mesMas(ese, -1)`; null sin una fecha) es el mes en que cuenta cada salida y `horasPorMesDeSalidas` suma ahí, así `horasAFavorDe`, `noUtilizadasDe`, los faltantes, el Resumen, «Vence pronto», «Cargar licencia» y el email de vencimiento se acomodan solos (un día que se destilda después de usar sus horas deja el faltante ámbar de esas horas (`horas:AAAA-MM`): no frena nada).
    `repartoDelMes(salidas, mes, feriados)` → `{ propias, entran, van }`: las horas de los días sin marcar del mes, los marcados del mes siguiente que suman a él y los marcados del mes que suman al anterior (las dos listas por fecha, `{ fecha, horas, fila }`, con `horas` null si no dan horas), con `propias` más las horas de `entran` igual a lo de `horasPorMesDeSalidas` para ese mes.
    `textoDeLoQueSeMueve(mes, entran, van)` es la segunda línea de la banda:
    «Incluye 1,5 h de febrero.» y «1,5 h del martes 02/02 suman a enero.» («suma» con 1 h; con dos días, «… del martes 02/02 y del jueves 04/02 suman a enero.»; con tres o más, «4 h de 3 días suman a enero.»), separadas por un espacio y solo con los días que dan horas; sin nada, ''.
    `textoDeLaSumaDelMes` elige el verbo mirando el mes en que se usan las horas, el siguiente al de la planilla («tuviste» si ya pasó, «tenés» si es el de hoy, «vas a tener» si todavía no llegó: la planilla de enero mirada en febrero dice «En febrero tenés 1 día de franco.»); sin horas, dice lo mismo que arriba («Todavía no sumaste horas extras en octubre.», «En septiembre no hiciste horas extras.»).
    `validarSalida` trae `al_mes_anterior` en `datos`:
    `true` o `false`, tal cual; sin la clave, null (el guardado conserva lo guardado); en un borrado, false; cualquier otro valor (también null, 1 o 'true'), 400 `alMesAnterior`, «Elegí si este día suma al mes anterior.», en `al_mes_anterior`, controlado después de la nota.

## La planilla en la API

- La planilla de contrato en la API (spec 2026-10-27-mi-espacio-horas, sección 8;
  `verPlanilla` y `guardarSalidas`, en `RUTAS_MI_ESPACIO`, y el `GET`, también en las lecturas del lector y del colaborador):
  `GET /api/mi-espacio/salidas?mes=AAAA-MM` (sin `mes` o vacío, el en curso; un mes que no pasa `mesDeLaPlanilla` —otro formato, anterior a enero de hace dos años, posterior al de hoy o repetido, que Express da como lista— da 400 `MENSAJES_MI_ESPACIO.mes`, «Elegí un mes válido.», en `mes`, antes de leer nada; sin modalidad, 200 `{ modalidad: null, mensaje }`; en planta, 400 `planillaSoloContrato`, «La planilla es para las personas de contrato.», con `campo` null; leer no pide el arranque;
  un 500, «Error al obtener la planilla») → lo que arma `planillaDelMes(estado, calculo, { mes, hoy, feriados, filasFeriados })` (`services/miEspacioResumen.js`, pura) con lo de `contextoDe`:
  `{ modalidad: 'contrato', mes, mes_texto, hoy, anterior, siguiente, dias, fines_de_semana, suma: { horas, cifra, texto } }` (`anterior`, null en enero de hace dos años, y `siguiente`, null en el mes de hoy;
  `dias`, los de lunes a viernes —hábiles y feriados, también los que no llegaron— y los sábados y domingos con una salida;
  `fines_de_semana`, los demás sábados y domingos hasta hoy, para «Sumar el día»; cada día, `{ fecha, fecha_texto, fecha_larga, tipo, feriado, finde_texto, licencia: { texto, entera } | null, futuro, hoy, entrada, salida, nota, horas, horas_texto, aviso }`, con el nombre del feriado —los de la tabla que rigen y los 9 fijos, el fijo primero;
  si no, «Feriado»—, la licencia con el nombre de la insignia de su fila de Licencias, `NOMBRES_TIPO`, o, en las por horas, «Horas a favor, el día entero», «2 h a favor», «Uso autorizado, el día entero» o «Uso autorizado, 3 h» —Ruling 7 del plan—, `horas_texto` '1,5 h', '0' o '' y el `aviso` de `avisosDeSalidas`;
  `suma.horas` es la de `horasPorMesDeSalidas`, la que dan las horas a favor).
  `PUT /api/mi-espacio/salidas` con `{ dias: [{ fecha, entrada, salida, nota }] }`, cada día con su estado completo (todo vacío, borrarlo), **todos o ninguno**, en una transacción (`enTransaccion`) que bloquea la fila de la persona y lee el estado y las filas de los feriados con su conexión (dos guardados a la vez se ordenan: un doble envío deja una fila por día).
  Los controles, en orden: la modalidad y el arranque (`frenoDeLasHorasExtras`) y planta (`planillaSoloContrato`), con `campo` null;
  `dias`, una lista de 1 a `MAXIMO_DIAS_POR_GUARDADO` (100) días (`sinDias`, «No hay cambios para guardar.», también si no es una lista, o `muchosDias`, «Guardá de a 100 días como mucho.», en `dias`); sin fechas repetidas (`diaRepetido`, «Ese día está dos veces.», en `fecha`, con la forma de los errores de los días);
  y `validarSalida` de todos: si alguno falla, no se guarda ninguno y responde 400 `{ success: false, error, campo, fecha, errores: [{ fecha, campo, mensaje }] }`, por fecha (los sin una fecha válida, con `fecha` null, primero) y con el primero también en `error`, `campo` y `fecha`.
  Si pasan todos, un `INSERT … ON DUPLICATE KEY UPDATE … activo = 1` por día, o la baja lógica de un borrado, y 200 `{ success: true, data: { guardados }, message }` («Horas extras guardadas: 3 días.», «1 día»;
  `guardados` cuenta los días del pedido).
  Un 500, «Error al guardar las horas extras» (en la consola, solo la pila).
  No toca Configuración ni manda emails.
  Las rutas de los horarios sueltos:
  `POST` y `PUT /mi-espacio/horas-extras…` a una persona de contrato dan 400 `contratoEnLaPlanilla` («Las personas de contrato cargan sus horas en la planilla.», `campo` null; después del 404 de la corrección y de los frenos de la modalidad y el arranque), así nadie de contrato crea horarios que ya no cuentan;
  `DELETE` no se frena (un horario viejo se puede quitar); y `GET /mi-espacio/horas-extras` da, en contrato, el `dias_por_mes` de las salidas (`diasDeLasSalidas`:
  cada una `{ id, fecha, fecha_texto, tipo_texto, horario, entrada_texto, horas, horas_texto, cero, nota, aviso }`, de la más nueva a la más vieja, con `tipo_texto` 'Feriado', 'Sábado', 'Domingo' o '', `horario` «Salida 16:20» en un día hábil —y «Entrada 08:02» en `entrada_texto`— o «De 09:21 a 12:10» en uno que no lo es, y `cero` en las que dan 0), `totales_por_mes` con lo que suman sus salidas y `a_favor_detalle` en cada mes;
  en planta, `dias_por_mes` y `totales_por_mes` salen de sus horarios sueltos (`diasDeLasHorasExtras`), sin `a_favor_detalle`.
  Con «Sumar al mes anterior» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 4, 5, 8 y 9), la planilla trae `sumar_a` después de `siguiente` (el nombre del mes anterior, en minúscula y sin año, el del tilde: 'enero'; en todos los meses, también en el primero del rango) y `entran` después de `fines_de_semana` (los días tildados del mes siguiente que suman a este, por fecha, con la forma de los días de la planilla y los nombres de los feriados de su año; [] si el mes siguiente todavía no llegó);
  cada día trae `al_mes_anterior` después de `nota` (false sin salida); y `suma` es `{ horas, cifra, texto, detalle }`, con `horas` las de `repartoDelMes` (las propias más las que entran: las que dan las horas a favor), la frase de `textoDeLaSumaDelMes` en `texto` y en `detalle` la segunda línea (`textoDeLoQueSeMueve`, o '').
  El `PUT` recibe en cada día `al_mes_anterior`, opcional (`true` o `false`; sin él, se conserva lo guardado y un día nuevo queda en 0; un borrado lo deja en 0; otro valor, el 400 de `validarSalida`, con su fecha, y no se guarda ningún día).
  En `GET /mi-espacio/horas-extras` de contrato, cada fila de la tabla trae `horas_detalle` después de `horas_texto`, de dónde salen sus horas cuando algo se mueve entre meses («5,5 h + 1,5 h de febrero», «1,5 h de febrero» sin horas propias, «1,5 h suman a enero» o «1 h suma a enero», las dos partes con « · »; si nada se mueve, ''), y un mes con salidas tiene siempre su fila (`mesesConSalidasSinHoras`; respuesta del usuario:
  «Sí, con salidas hay fila»), aunque sume 0 o todas sus horas pasen al anterior:
  «0 h», el mes de uso sin detalle, «—» y «El mes sigue sumando» mientras el mes no terminó y, después, sin horas ni usos, `estado` 'sin_horas', «Sin horas a favor» (con usos de más, `estado` 'usadas', «Todas usadas»), así sus días se ven y se editan desde la pestaña (las horas a favor, el Resumen, «Vence pronto» y el email siguen sin un mes en 0); en el día por día (`diasDeLasSalidas`), cada día trae `suma_a` («Suma a enero» si está tildado;
  si no, '') y, al final de su mes de las horas y por fecha, van los días tildados del mes siguiente, con `tipo_texto` «De febrero», `suma_a` '' y `de_otro_mes: true` (solo ellos llevan la clave);
  `totales_por_mes` es lo de `horasPorMesDeSalidas` (el mismo número de la fila).

## La planilla en la página

- La planilla en la página (spec 2026-10-27-mi-espacio-horas, secciones 4 y 5; la maqueta que aprobó el usuario; el código, en «La página» de este documento): en contrato, «Cargar horas extras» (el del encabezado, `#btn-cargar-horas`, y el de la tarjeta, `data-cargar="horas"`) abre `#modal-planilla` en lugar de `#modal-horas`, que sigue para planta («Planta queda como está»: decisión del usuario);
  como siempre, sin modalidad o sin el saldo inicial los botones no se ven (sin el saldo inicial, si se llega igual, abre antes «Mis vacaciones y saldos»).
  Es un modal de administración más ancho (900 px) y alto, que un clic en el velo no cierra, con su propia región viva, `#mp-anuncio` (con `aria-modal`, la de la página puede no leerse), y arriba, fijos, el mes con sus flechas (no va a un mes que no llegó ni antes de enero de hace dos años) y la banda celeste con el total del mes en grande y la frase de `suma.texto`, que cambia mientras se escribe.
  En el cuerpo, que se desplaza:
  «Cómo se cuentan las horas» (un `<details>` cerrado, con las dos reglas y «Las horas de octubre son horas a favor en noviembre.»), las columnas (Día, Entrada *(opcional)*, Salida y Horas extras), los días por semana («5 al 9 de octubre», con lo que suma) y «¿Trabajaste un sábado o un domingo?» (los sábados y domingos del mes hasta hoy que no están, y «Sumar el día»: un sábado o un domingo se carga como un feriado y se puede quitar; decisión del usuario).
  Cada fila: la fecha con sus marcas (el feriado en ámbar con su nombre, «Sábado», «2 h a favor»), la entrada (en gris mientras está vacía en un día hábil), la salida, las horas en una pastilla y «Nota» (abre un campo debajo; con nota, en cursiva y «Cambiar nota»), y «Quitar» en un sábado o domingo; lo cambiado, con una raya a la izquierda.
  Un día de licencia de día entero va en verde con su insignia y «Es un día de licencia: no se cargan horas.» (con una salida guardada de antes, la salida como texto, sus horas, el aviso y «Quitar»); uno con horas a favor o un uso autorizado de menos de 7 horas, con su etiqueta, se carga normal (la salida cuenta desde las 15:00; decisión del usuario); uno que no llegó, en gris, «Todavía no llegó.»; hoy, con «Hoy».
  El pie:
  «Todo guardado.» o «**3 días** con cambios sin guardar» (con los meses si son más de uno), «Cancelar» y «Guardar».
  Cambiar de mes no pierde lo cargado: todos los meses se guardan juntos con un solo «Guardar» (todo o nada, hasta 100 días: decisión de la spec).
  «Guardar» sin cambios cierra; si no, controla con las copias y marca cada error en su fila (debajo, con `aria-invalid` y el foco en el primero por fecha, pasando a su mes si es otro: la regla de la spec, sobre la de la maqueta), con «Revisá el día marcado.» o «Revisá los 2 días marcados.» arriba del cuerpo; si todo está bien, manda los días cambiados y al responder cierra, avisa «Horas extras guardadas: 3 días.» (aviso y `#me-anuncio`) y vuelve a pedir el Resumen y la pestaña;
  un error del servidor con días va a esos días y, sin días, arriba del cuerpo (`#mp-error`, `role="alert"`).
  Mientras guarda, «Guardar» queda deshabilitado y el modal no se cierra (un doble clic manda un solo pedido).
  Cerrar con cambios (la ×, «Cancelar», Escape) pregunta en la confirmación de la página:
  «¿Salir sin guardar?», «Los cambios de 3 días se pierden.», «Seguir cargando» (con el foco) y «Salir sin guardar».
  Teclado: al abrir, el foco en la salida de hoy (la fila, centrada) o en la primera del mes;
  Enter en una salida o una nota lleva a la salida del día siguiente que se carga (en la última, a «Guardar»); al cerrar, el foco vuelve a donde estaba.
  En 720 px o menos, el modal casi a pantalla completa y cada día una tarjeta (la fecha y las horas arriba; la entrada y la salida lado a lado, con su rótulo y de 44 px; la nota abajo).
  Los textos, con 4,5:1 o más, y el borde de los campos, con 3:1 o más sobre el fondo de cada fila.
  En la pestaña, el día por día de contrato muestra cada salida del mes elegido («Lun 05/10 · Salida 16:20 · Entrada 08:02 · 1,5 h», «Lun 12/10 *Feriado* · De 09:21 a 12:10 · 2,5 h», con la nota en cursiva; las que dan 0, también, en gris y con «No llega a media hora»; una con aviso, con su aviso en ámbar), y «Editar» (`aria-label` «Editar el lunes 05/10») abre la planilla en ese mes con el foco en la salida de ese día (o en su «Quitar»); después de guardar, el foco vuelve a su «Editar» nuevo.
  Con «Sumar al mes anterior» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 4 y 5; la maqueta que aprobó el usuario, en `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-mockups/`): cada día con salida tiene, entre sus horas y «Nota», el tilde «Sumar a enero» (el mes anterior, en minúscula; en la planilla de enero, «Sumar a diciembre»), que sin salida no se ve pero conserva su lugar; tildar o destildar es un cambio sin guardar más (la raya y el pie lo cuentan).
  Un día tildado lleva su pastilla blanca y punteada, con «→ enero» al lado.
  La banda suma lo del mes sin los días tildados más los tildados del mes siguiente (el total de cada semana no cuenta sus tildados) y, debajo de la frase, en un renglón que tiene siempre el alto de dos (tildar no corre la planilla), «Incluye 1,5 h de febrero.» y «1,5 h del martes 02/02 suman a enero.».
  La planilla de un mes cuyo siguiente ya llegó termina con el bloque «De febrero»: su total y cada día tildado de febrero, de solo lectura, con «Ver en febrero», que abre febrero con el foco en el tilde de ese día.
  Los dos meses se miran con lo que no se guardó (tildar el 02/02 y, sin guardar, ir a enero: la banda y el bloque de enero ya lo muestran) y «Guardar» manda todo junto, como siempre.
  «Cómo se cuentan las horas» incluye, antes del renglón del mes (`#mp-como-mes`), «Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a enero»: cuentan como horas extras de enero.» (`#mp-como-anterior`).
  En 720 px o menos, el tilde va en la tarjeta, debajo de la entrada y la salida, al lado de «Nota», con 44 px de alto.
  En la pestaña, la tabla dice debajo de las horas de dónde salen («5,5 h + 1,5 h de febrero», «1,5 h suman a enero»), un mes con salidas tiene siempre su fila («Sin horas a favor», en gris, si terminó sin horas ni usos) y, en el día por día, un día tildado lleva su pastilla punteada y «Suma a enero», y los tildados del mes siguiente van al final de su mes de las horas, con «De febrero» debajo de la fecha; su «Editar» abre la planilla de su mes (febrero) con el foco en ese día.
  Planta no tiene el tilde.

## La página

La planilla de horas extras de contrato, lo puro, con su modelo en el comentario de su sección: la planilla de un mes es la de `GET /mi-espacio/salidas?mes=` y encima van `cambios` (un Map de cada fecha tocada a su estado completo `{ entrada, salida, nota }` —todo vacío es un borrado— o a `{ quitar: true }`), `agregados` (un Set de los sábados y domingos sumados:
«Quitar» saca el día de ahí, y volver a sumar uno guardado que se quitó lo trae con lo guardado), `errores` (un Map de cada fecha a `{ campo, mensaje }`) y `notasAbiertas`; los Map y los Set se reconocen por lo que saben hacer, no por su clase (los tests los arman fuera del `vm`).
Las funciones:
`htmlDeLaPlanilla(planilla, { cambios, agregados, errores, notasAbiertas })` (las semanas de lunes a domingo con su renglón, `textoDeLaSemana` —«5 al 9 de octubre»— y su total en `.mp-semana-total`, y las filas de `htmlDeLaFilaDeLaPlanilla`, todo en `<div>`, sin semántica de lista; cada día que se carga es un `role="group"` con `aria-labelledby` a su fecha y cada campo lleva su `aria-label`, «Salida del lunes 05/10», «Entrada (opcional) del lunes 05/10»;
un error va debajo de su fila, con `aria-invalid` y `aria-describedby` en su campo —en la salida si no trae campo; en una fila sin campos, la fila, con `role="group"`, `tabindex="-1"` y el error en su `aria-describedby`, recibe el foco, y en un día de licencia con una salida de antes, su «Quitar»—; el aviso del servidor, solo mientras el día no cambió;
«Hoy», un `<span class="mp-hoy">` dentro del `<b>` de la fecha, para que sea parte del nombre del grupo; nada es región viva), `htmlDeLasHorasDeLaFila` (la pastilla mientras se escribe:
«1,5 h», «0» con «No llega a media hora», «—», «Poné la entrada», «La salida va después» o «Falta la salida»), `htmlDeLaBandaDeLaPlanilla` (el total en grande y la frase con lo que se suma en negrita), `htmlDelPieDeLaPlanilla` y `textoDelPieDeLaPlanilla` (`partesDelPie`), `htmlDelSumarDeLaPlanilla`, `fechasCambiadas` (las que difieren de lo guardado, comparadas normalizadas:
un día que volvió a como estaba no cuenta, ni un sábado sumado sin nada), `erroresDeLaPlanilla`, `cuerpoDeLaPlanilla` (`{ dias: [{ fecha, entrada, salida, nota }] }`, las horas cortadas a `HH:MM` —un `<input type="time">` puede dar `'16:46:00'`— y lo vacío como ''), `diasPorFechaDe`, `diasVisiblesDeLaPlanilla`, `finesDeSemanaParaSumar`, `horasDeLosDias` y los textos planos `textoDeSalirSinGuardar`, `textoDeLosErroresDeLaPlanilla` y `textoDeComoSeCuentan`;
en la pestaña, `htmlDeDiaPorDiaDeSalidas` (el día por día de contrato:
«Editar» con `data-editar-salida` y la fecha, y el `aria-label` «Editar el lunes 05/10», con `diaLargoDe`) y el `<small>` con `a_favor_detalle` de `htmlDeTablaDeHorasAFavor`.
`textoDeLaSuma` (el modal de planta) no tiene rama de contrato (Ruling 8 del plan): fuera de planta da solo las horas.
Lo que toca el DOM, en su propia sección:
`abrirCargaDeHoras` (los dos «Cargar horas extras»: en contrato, la planilla; si no, `abrirHorasExtras`), `abrirPlanilla({ mes, fecha, volverA })` (sin el saldo inicial, «Mis vacaciones y saldos»), `cargarMesDeLaPlanilla` (cada mes, una vez por apertura; el primero, sin `mes` si no se pidió uno —el servidor da el en curso: con el reloj del teléfono adelantado, el del teléfono daría 400— y el mes es el que llega; una respuesta vieja, por `pedido` o de otra apertura, se descarta;
mientras llega, `aria-busy` y las flechas quietas; si falla, `MENSAJE_SIN_LA_PLANILLA` en `#mp-error`, y con un 401, al login), `alEscribirEnLaPlanilla` (cambia la fila sin volver a dibujarla —ni el foco ni una hora a medio escribir se pierden—, y la semana, la banda y el pie), `alApretarEnLaPlanilla` (Enter), `alTocarLaPlanilla`, `alternarLaNota`, `quitarElDia`, `sumarElDia`, `irAlMesDeLaPlanilla` (anuncia el mes en `#mp-anuncio`;
si la flecha que se usó se apaga, el foco pasa a la otra), `guardarPlanilla` (`marcarLosDias` con los errores de las copias, sin pedir nada; si no, un solo `PUT`), `pedirGuardarLaPlanilla` (un `fetch` PUT propio con `Auth.getAuthHeaders()`, como `pedirWordDe`, porque `API.pedirJson` no da los `errores` de un 400)
y `pedirSalirDeLaPlanilla` (la ×, «Cancelar» y Escape pasan por `pedirCerrarModal`).
Su estado, `pagina.planilla` (`{ mes, meses, cambios, agregados, errores, notasAbiertas, guardando, pedido, cargando, aviso, avisoDeLosDias, foco }`, o null con el modal cerrado): no se cruza con el de los otros formularios.
Mientras guarda, `estaOcupado('modal-planilla')` no deja cerrarla y la planilla no acepta cambios (`pintarElGuardadoDeLaPlanilla`:
`#mp-cuerpo` inerte y las flechas y «Guardar» apagados, y cada función que cambia algo no hace nada con `guardando`: lo escrito mientras tanto no iría en el `PUT`); al responder, todo vuelve antes de mostrar el error.
Un «Guardar» que vuelve a fallar con el mismo aviso lo vuelve a anunciar (`avisoQueSeAnuncia`, con un espacio al final, como `anunciar`), y `marcarLosDias` descarta el mes que se estaba pidiendo (`soltarElMesPedido`).
`pedirConfirmacion` recibe `textoSi` y `textoNo` (los dos botones; de entrada, «Borrar» y «Cancelar», repuestos en cada llamada) y `alConfirmar` (en lugar de `borrar`: cierra la confirmación y corre, sin pedir nada).
`IDENTIDADES_DEL_FOCO` incluye `data-editar-salida`.
Copias mínimas, atadas por tests de paridad:
`SALIDA_DE_LA_JORNADA`, `TOLERANCIA_DIA_HABIL`, `TOLERANCIA_DIA_INHABIL` y `MAXIMO_DIAS_POR_GUARDADO`; las claves de la planilla en `MENSAJES_FORMULARIOS` (`horaSalida`, `salidaQueCuenta`, `salidaFalta`, `entradaFeriado`, `entradaFinde`, `salidaAntes` y `muchosDias`, con el nombre del servidor, más `nota`);
`minutosDeLaSalida` (copia de `horaSalidaValida`);
`horasDelDiaDeLaPlanilla` (`horasDeLaSalida`, con el `tipo` del día que manda el servidor en lugar de la fecha y los feriados: los 19 renglones del CSV del usuario y 15:14, los 14 ejemplos del feriado, el sábado y el domingo, y los bordes);
`enDiasDeFranco`;
`textoDeLaSumaDelMes` (sobre `fraseDeLaSumaDelMes`, que da la misma frase con lo que se suma en negrita para la banda; el texto de la banda también se compara con el del servidor); y `erroresDeLaPlanilla` (los pasos 3 a 7 de `validarSalida` sobre `cuerpoDeLaPlanilla`, en cuatro tipos de día por 30 casos: el mismo campo y el mismo mensaje; la fecha, el rango y la licencia los controla solo el servidor).
Solo del navegador, con tests de comportamiento:
`TIPOS_DE_DIA`, las semanas y sus totales (de presentación, como `diasDeLaGrilla`), el pie, «Sumar el día» y los textos de salir y de los errores.
Los estilos, con el prefijo `.mp-` de la maqueta (y `.me-dia-horas` y `.me-fila-aviso` del día por día), en el `<style>` de `mi-espacio.html`, solo con los tokens `--sg-*` de ese `<style>` y `--f-titulo` y `--f-texto` de main.css.

## La página: sumar al mes anterior

Con «Sumar al mes anterior» (spec 2026-10-30-mi-espacio-horas-mes-anterior), cada día con salida de la planilla de contrato tiene el tilde «Sumar a {mes anterior}».
Lo puro:
`valoresDeLaSalida` y `valorDelDia` traen `al_mes_anterior` (solo el `true` literal y, en `valoresDeLaSalida`, solo con una salida; un «Quitar», false), así `fechasCambiadas` cuenta un cambio solo del tilde y `cuerpoDeLaPlanilla` lo manda siempre, como booleano;
`salidaDelDia` y `horasDelDiaConCambios`;
`horasDeLosDias` (la banda y el total de cada semana) no suma los días tildados;
`diasQueSumanAlAnterior(dias, cambios)` (los tildados de una lista, `[{ dia, fecha, horas }]`, también los de 0 h) y `diasQueEntran(planilla, estado)` (los tildados del mes siguiente que suman a este, por fecha: los de ese mes con `cambios` si ya se pidió;
si no, los de `planilla.entran` con `cambios`), con los que la página arma, también con lo que no se guardó de los dos meses, la cifra de la banda (los días sin tildar del mes más los que entran) y su segunda línea (`textoDeLoQueSeMueve(mes, entran, van)`);
`htmlDelTilde(dia, valor, sumarA)` (un `<label class="mp-tilde" id="mp-t-AAAA-MM-DD">` con su casilla, `data-campo="al_mes_anterior"` y el `aria-label` «Sumar a enero el martes 02/02», que empieza con el texto visible; sin salida, con la clase `vacio` —`visibility: hidden`: conserva su lugar— y `tabindex="-1"`; sin `sumar_a`, solo el lugar;
la clase no es `mp-anterior`, el id de la flecha del mes, ni `mp-sumar`, la de «¿Trabajaste un sábado o un domingo?»), que `htmlDeLaFilaDeLaPlanilla` pone entre las horas y «Nota» con el `sumar_a` del servidor (`sumarA`);
`htmlDeLasHorasDeLaFila(dia, valor, sumarA)` (tildado y con horas, la pastilla `otro-mes`, punteada, y «→ enero» en `.mp-va-a`, que el lector de pantalla lee «van a enero»);
`htmlDeLaBandaDeLaPlanilla(mes, horas, hoy, detalle)` (la frase y, debajo, `<p class="mp-suma-aparte">`, siempre, vacía sin nada que decir, los dos en `.mp-suma-textos`);
`htmlDelBloqueDelMesSiguiente(planilla, estado)` y `htmlDelDiaDeOtroMes` (al final de `htmlDeLaPlanilla`:
«De febrero» con su total, como el renglón de una semana pero sin `data-fechas`, y cada día tildado de febrero, de solo lectura, en `mp-dia de-otro-mes` con los ids `mp-otro-` y `mp-of-`, con su salida, sus horas y «Ver en febrero», `data-ver-en` con su fecha y el `aria-label` «Ver en febrero el martes 02/02»); y `textoDeSumarAlAnterior(mes, sumarA)` (el renglón de «Cómo se cuentan las horas», texto plano).
En la pestaña, `htmlDeTablaDeHorasAFavor` pone `horas_detalle` en un `<small>` debajo de las horas, y `htmlDeDiaPorDiaDeSalidas` le da a un día con `suma_a` la pastilla `me-dia-horas otro-mes` y «Suma a enero» (`me-fila-otro-mes`) y a uno con `de_otro_mes` en el `true` literal la clase `de-otro-mes` (su «De febrero» llega en `tipo_texto`);
`CLASE_DE_LA_SITUACION` y `SITUACIONES_EN_GRIS` incluyen `sin_horas` («Sin horas a favor», en gris).
Lo que toca el DOM:
`alEscribirEnLaPlanilla` atiende también la casilla (`campo.checked === true`; la fila no se redibuja, el foco queda en ella y no se anuncia nada);
`actualizarLaFilaDeLaPlanilla` cambia la pastilla y el `vacio` y el `tabindex` del tilde (borrar la salida lo oculta y escribirla de nuevo lo trae tildado como estaba);
`pintarLaSumaDeLaPlanilla` arma la cifra y la segunda línea y reescribe solo los totales de `.mp-semana[data-fechas]` (no el de «De febrero»);
`pintarElRenglonDelTilde` escribe `#mp-como-anterior` con `textContent` (vacío y oculto mientras llega el mes o sin texto); y «Ver en febrero» (`[data-ver-en]`, en `alTocarLaPlanilla`) llama a `irAlMesDeLaPlanilla('siguiente', { fecha })`, que, después de mostrar ese mes (sin pedirlo si ya está) y anunciarlo en `#mp-anuncio`, lleva el foco al tilde de ese día, con su fila centrada.
Copias atadas por tests de paridad:
`mesMas` y `textoDeLoQueSeMueve` (de `services/miEspacioReglas.js`; esta lee solo `fecha` y `horas` y nombra solo los días con horas) y el verbo de `textoDeLaSumaDelMes` (en `fraseDeLaSumaDelMes`).
Solo del navegador, con tests de comportamiento:
`textoDeSumarAlAnterior` y el «De febrero» del bloque (`nombreDelMes` del mes siguiente).
Los estilos, en el `<style>` de `mi-espacio.html`, solo con los tokens `--sg-*`: la fila con seis columnas (la del tilde;
las acciones, siempre en la última, también en una fila sin tilde), `.mp-tilde`, la pastilla punteada (`.mp-horas b.otro-mes` y `.me-dia-horas.otro-mes`, con su borde también en alto contraste), la segunda línea con el alto fijo de dos renglones (`.mp-suma-aparte`, `height: 2.7em` con `line-clamp` 2: tildar no cambia el alto de la banda, que está fuera de `#mp-cuerpo`, y lo que no entra se corta con «…»;
la frase reserva dos renglones de 900 px para abajo y tres de 384 px para abajo), el bloque, el corte de 721 a 860 px y, en 720 px, el tilde de 44 px en la tarjeta, al lado de «Nota».

## Reglas de los tests

Los tests de la planilla usan personas y datos inventados, nunca nombres reales; `tests/mi-espacio-salidas-api.test.js` usa la base `rpad_test_mi_espacio_salidas`.
Los de «Sumar al mes anterior» usan los datos inventados de la maqueta: enero de 2027 con 5,5 h, el martes 02/02/2027 con salida a las 16:20 (1,5 h) tildado y el miércoles 03/02 a las 15:50 (1 h) sin tildar.

## Archivos de tests

`mi-espacio-reglas.test.js`, `mi-espacio-resumen.test.js`, `mi-espacio-salidas-api.test.js`, `mi-espacio-api.test.js`, `mi-espacio-frontend.test.js`, `schema.test.js`, `permisos.test.js`, `paginas.test.js`
