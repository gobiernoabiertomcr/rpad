# Mi espacio: la nota de licencia en Word

La nota con que se pide cada licencia, armada en el momento y nunca guardada, y la de los días restituidos y las horas acumuladas.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-27-mi-espacio-licencia-word-design.md`
- `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-design.md`
- `docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-design.md`
- `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-design.md`

## Mi espacio: la nota de licencia en Word (spec 2026-10-27-mi-espacio-licencia-word)

- Qué es: cada licencia se pide con una nota en papel al cargo de Director General de Modernización e Investigación Territorial, que cada persona escribía a mano en Word con los datos que ya cargó en Mi espacio.
  Ahora la arma el RPAD: al guardar una licencia, «Cargar licencia» (y «Corregir la licencia») no se cierra y pasa a un segundo paso con la nota a la vista y «Descargar Word» (la versión C de las maquetas, «La nota a la vista», elegida por el usuario;
  `docs/superpowers/specs/2026-10-27-mi-espacio-licencia-word-mockups/`), y cada licencia de la lista tiene «Word» al lado de «Editar» (decisión del usuario).
  Se arma en el momento, con lo que hay en la base al pedirla, y **nunca se guarda**: ni el archivo, ni el texto, ni cuándo se bajó o quién la bajó (decisión del usuario: guardada, una licencia corregida saldría con datos viejos).
  El RPAD no sigue la nota (si se presentó, se firmó o se autorizó):
  Mi espacio sigue sin aprobaciones, firmas ni expedientes; el Word es un papel que la persona imprime y firma.
  Sin membrete, sin PDF y sin firma digital (decisión del usuario: hoja blanca).
  No cambió nada más: la carga, las reglas, Configuración → Licencias, las Notas Digitales, el Resumen, el Word del Generador de Notas y el de las Notas Digitales.
  Antiobjetivos: que la vista del segundo paso diga una cosa y el Word otra (salen de la misma estructura), que la nota salga con datos viejos, que un nombre real o un dato de producción llegue al repositorio, que el modal diga «Licencia cargada» sin un 2xx del guardado y que un carácter raro deje el Word dañado.
- Quién y qué licencias (sección 1): cualquier persona con sesión, cualquiera sea su rol, y solo las suyas: las activas de los ocho tipos con nota (desde los días restituidos, nueve:
  `TIPOS_CON_NOTA`, todos los de `TIPOS_LICENCIA` menos el uso autorizado), también las que ya pasaron y las que no cuentan («Antes del saldo inicial», fuera de la modalidad), con el texto de su tipo.
  El uso autorizado y las horas extras no tienen nota (decisión del usuario, «por ahora»).
  Una persona sin modalidad arma la nota igual: la lista no muestra sus licencias, pero el texto no depende de la modalidad (sin vínculo, la firma va como la de planta).
- La nota (`services/miEspacioNota.js`, puro: sin pool ni `Date` local, fechas `'AAAA-MM-DD'`, ninguna función tira):
  `notaDeLicencia(licencia, { fecha, persona, feriados, salidas })` (`salidas`, desde «Sumar al mes anterior», las de la planilla, opcional: sin ellas, []; solo las usan las horas a favor) → `{ nota }` o `{ error }` con una clave de `MENSAJES_NOTA` (`sinNota`, `sinDiasHabiles` o `error`: una licencia, una fecha o una persona que no sirven);
  `nota` = `{ fecha, destinatario, sd, saludo, cuerpo, cierre, firma: [{ texto, chico }], nombre }`, armada una sola vez, y de ahí salen la vista (`htmlDeLaNota`, escapada ahí mismo, con las clases `me-hoja`, `me-hoja-texto`, `derecha`, `sangria`, `justificado`, `sd`, `firma` y `chico`) y el Word.
  Lo fijo, sin nombres de personas:
  «Comodoro Rivadavia, <fecha larga>», «Al Señor Director General de» / «Modernización e Investigación Territorial» (dirigida al cargo, nunca a una persona: decisión del usuario, el repositorio es público;
  si hace falta, el nombre se agrega a mano en el Word, y si cambia la autoridad, se cambia el código), «S / D» (15 espacios a cada lado de la barra), «De mi mayor consideración:», «Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar …» (la fórmula del usuario) y «Sin otro particular, saludo a Ud. atentamente.».
  La nota opcional de la licencia no va (decisión del usuario: es un apunte personal).
- El cuerpo de cada tipo (spec, sección 2, al pie de la letra): vacaciones, «el usufructo de cinco (5) días hábiles correspondientes a mi licencia anual ordinaria, a partir del día martes 3 de noviembre de 2026.» (solo cuántos días y desde cuándo, sin el hasta ni de qué año salen: pedido del usuario); franquicia, «el usufructo de tres (3) horas de franquicia para trámites personales el día …»;
  estudios, «licencia por examen por dos (2) días hábiles, a partir del día …» (sin «Oportunamente presentaré la constancia del examen»), y con la misma forma «licencia por atención médica», «licencia por atención del grupo familiar» y «licencia médica extraordinaria»; franco, «el usufructo del franco compensatorio correspondiente a las horas extras realizadas en octubre de 2026, el día …»;
  horas a favor, desde «Sumar al mes anterior» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 7:
  el usuario eligió la redacción y pidió el día primero en todas), «el usufructo de dos horas y media (2,5) a favor el día jueves 15 de octubre de 2026, correspondientes a las horas extras realizadas en septiembre de 2026.» y, con días del mes de la licencia tildados «Sumar a {mes anterior}» que dan horas, antes del punto, «… realizadas en enero de 2027 (incluidas las del martes 2 de febrero de 2027, sumadas a enero).» (con dos, «las del martes 2 y el miércoles 3 de febrero de 2027»;
  con tres o más, «las del lunes 1, el martes 2 y el miércoles 3 de febrero de 2027»; antes decía «… a favor, correspondientes a las horas extras realizadas en septiembre de 2026, el día …»).
- Las reglas del texto: los días son los días hábiles de la licencia con los feriados (`diasHabilesDe` con el `Set` de `contextoDe`: la misma cuenta que la lista), en letras y en números (`enLetras`, de 1 a 999, con «un», «veintiún» y «una»:
  «nueve (9) días hábiles»).
  **«A partir del día» es el primer día hábil**, no `desde` (una licencia del sábado 31/10 al viernes 6/11 dice «a partir del día lunes 2 de noviembre»;
  `validarLicencia` deja empezar en un día que no es hábil), en los cinco tipos que cuentan días; con un solo día hábil, aunque `desde` y `hasta` sean distintos, «por un (1) día hábil, el día …» con ese día (en vacaciones, «un (1) día hábil correspondiente»).
  Los de un día (franquicia, franco y horas a favor) dicen su `desde` y no cuentan días (un franco en un día que pasó a feriado sigue teniendo nota).
  Las horas (`textoDeHoras`):
  «una (1) hora», «tres (3) horas», «media hora (0,5)», «una hora y media (1,5)» y «dos horas y media (2,5)»;
  «correspondiente» concuerda con la palabra que dicen: singular con 0,5, 1 y 1,5 («hora») y plural desde 2.
  El mes de las horas extras (`mesMas` y `mesEnFrase` de `miEspacioReglas.js`), cruzando el año: en un franco, dos meses antes del día del franco (el de diciembre sale de las de octubre; uno de enero de 2027, de noviembre de 2026);
  en las horas a favor, el mes anterior, y los días que se nombran entre paréntesis (`diasSumadosDe` y `textoDeLosDiasSumados`) son los tildados del mes siguiente a ese (el de la licencia), con el `true` literal y horas de `horasDeLaSalida` (uno de 0 h no se nombra), en orden de fecha y como están al armar la nota (`leerLaNota` le pasa `contexto.estado.salidas`); el franco y los demás tipos no las miran.
  Las fechas, con el día de la semana (`diaDeLaSemana` de `feriadosReglas.js` y `formatoLargo`):
  «martes 3 de noviembre de 2026».
  Una licencia de días sin ningún día hábil (un feriado cargado después en Configuración → Feriados cayó sobre ella) no tiene nota (`sinDiasHabiles`); en el segundo paso no puede pasar: el guardado no deja una licencia sin días hábiles.
- La fecha de la nota es el día argentino de la última vez que se guardó la licencia (decisión del usuario: la de la carga o la de la última corrección):
  `mi_espacio_licencias.updated_at`, que la base mueve solo cuando un guardado cambia algo (una corrección sin cambios no la mueve), leído con `UNIX_TIMESTAMP` y pasado con `hoyArgentina(new Date(…))`, como `subido_el` de Proyectos (un guardado a las 22:30 sale con ese día, no con el siguiente).
  La firma, leída al armar la nota: el nombre (`nombre_completo`); en un contratado (`vinculo = 'contrato'`), el renglón chico «Personal contratado, cumpliendo funciones de» (`RENGLON_FIRMA_CONTRATADO` de `notasDigitalesContenido.js`, como en las Notas Digitales); y el cargo.
  Sin cargo, solo el nombre, también en un contratado («cumpliendo funciones de» necesita un cargo).
  El archivo:
  «Nota de licencia - <tipo> - <desde>.docx» (decisión del usuario;
  `NOMBRES_DEL_ARCHIVO`:
  Licencia anual ordinaria, Franquicia, Estudios, Atención médica, Atención del grupo familiar, Médica extraordinaria, Franco compensatorio, Horas a favor y, desde los días restituidos, Días restituidos; con el `desde`, no con el primer día hábil).
  `aclaracionDeLaNota(fecha)`:
  «Lleva la fecha del 27/10/2026, la última vez que guardaste un cambio en la licencia.
  Se baja en Word, para imprimir y firmar.».
- El Word (`services/miEspacioNotaWord.js`, `renderNotaDocx(nota)` → `Buffer`, con `docx`, desde la misma nota): un armado propio y chico, aparte de `renderDocx` de `notasWord.js`, así el Word del Generador y el de las Notas Digitales no cambian.
  A4 con la hoja como literales (`HOJA_DE_LA_NOTA`: 11906 × 16838 twips;
  `convertMillimetersToTwip` redondea para abajo y daría 11905 × 16837), 2,5 cm arriba y abajo y 3 cm a los costados (1417 y 1701), sin encabezado, pie, membrete ni marca de agua;
  Arial 11 (`size: 22`) e interlineado 1,15 (`line: 276`, `lineRule: auto`), sin espacio entre párrafos, en el estilo por defecto del documento y no en cada párrafo (los renglones vacíos miden lo mismo que los escritos).
  El orden, el de `htmlDeLaNota`: la fecha a la derecha y dos renglones vacíos; el destinatario, el «S / D» y uno vacío; el saludo y uno; el cuerpo, justificado y con sangría de 1,25 cm en el primer renglón (709), y uno; el cierre, con la misma sangría, y cuatro; y la firma, centrada en la mitad derecha (sangría izquierda de 8 cm, 4535):
  `LINEA_DE_LA_FIRMA` (30 guiones bajos, exportada para que la vista y el Word tengan la misma), el nombre, el renglón del contratado en 9 pt y el cargo.
  Todo texto pasa por `textoParaWord` (`services/notasWord.js`, a la que solo se le agregó `export`).
  `TIPO_WORD`, el MIME de Word.
- La API (`controllers/miEspacioController.js`, solo lectura; con `authMiddleware`, sobre `req.user.userId`, en `RUTAS_MI_ESPACIO` de `tests/permisos.test.js`: sin sesión, 401):
  `GET /api/mi-espacio/licencias/:id/nota` (`verNotaDeLicencia`) → `{ success, data: { fila, html, fecha, aclaracion, lista } }`, con `fila` la de la lista (`filaDeUnaLicencia` de `miEspacioResumen.js`: el mismo `filaDeLicencia` con el mismo contexto, `contextoDeLasFilas`, y los `vinculosDe`;
  así el segundo paso no depende del año que muestra la lista ni de la modalidad), `html` la hoja ya escapada, `fecha` la de la nota y, desde la licencia anulada en Configuración, `lista`, en qué lista de Licencias quedó (`textoDeLaListaDe(licencia.desde, hoy)`:
  «Está en la lista de 2027.» si no es la del año de hoy; si no, null); y `GET /api/mi-espacio/licencias/:id/word` (`bajarWordDeLicencia`) → el .docx, con `Content-Type` `TIPO_WORD` y `Content-Disposition` de `disposicionDeAdjunto(nota.nombre)`.
  Las dos pasan por `leerLaNota`:
  `idPositivo` → `datosDeLaNota` (`services/miEspacioDatos.js`:
  `{ guardada, nombre, cargo, vinculo }` en una consulta con `usuarios`, o null;
  `personaDe` no lee el cargo) → la licencia del `estado` de `contextoDe` (con sus horas como número y sus feriados) → `notaDeLicencia`.
  Los errores, en JSON en las dos, por la clave (`RECHAZOS_DE_LA_NOTA`): 404 «Licencia no encontrada» (un id que no pasa `idPositivo`, de otra persona, que no existe, dada de baja o borrada entre las dos lecturas: no se revela que existe), 404 «Esta licencia no tiene nota.» (`sinNota`: el uso autorizado), 409 «Entre esas fechas ya no hay ningún día hábil:
  corregí la licencia para bajar la nota.» (`sinDiasHabiles`) y cualquier otra clave o falla (por ejemplo, una persona sin nombre), 500 con el mensaje fijo «Error al armar la nota» y el detalle solo en `console.error`.
  La lista no cambió: el nombre del archivo llega en el `Content-Disposition`.
- El segundo paso (sección 6; ver la convención de `mi-espacio.js`): aparece solo con un 2xx del `POST` o del `PUT` de «Cargar licencia» («Registrar un uso autorizado», que también pasa por `guardarLicencia`, se sigue cerrando con su aviso).
  El título pasa a «Licencia cargada» o «Licencia corregida»; el cuerpo y el pie del formulario (`#ml-cuerpo`, `#ml-pie-del-formulario`) se ocultan y se muestran los del segundo paso (`#ml-paso-dos`, `#ml-paso-dos-pie`; los cuatro, hijos directos del `.modal`: el que se desplaza es el cuerpo, y la hoja no tiene su propia barra);
  la página vuelve a pedir todo de fondo (la lista de atrás ya la muestra: desde la licencia anulada en Configuración, en el año de su `desde`) y el cuerpo dice «Armando la nota…» hasta que llega `GET …/nota`.
  Después: los avisos de la respuesta (solo los trae la corrección, por ejemplo `TEXTO_NO_SE_COPIA`) en un recuadro ámbar arriba, en lugar del aviso flotante (en el segundo paso no sale: lo dice el título); la licencia guardada (la tilde verde, la insignia, las fechas y lo que suma y, en gris, de qué licencias salen, lo de Configuración y lo que ven los compañeros: los textos de `fila`);
  si no es del año en curso, en qué lista quedó («Está en la lista de 2027.», el `lista` de la respuesta, alineado con la licencia);
  «Así sale la nota», con la `aclaracion`; y la hoja sobre la mesa gris, a escala del ancho del modal.
  `#me-anuncio` dice «Licencia cargada.
  Podés descargar la nota en Word.» (o «corregida»), con los avisos.
  El pie:
  «Listo» (borde, `data-cerrar`) y «Descargar Word» (tinta), que recibe el foco;
  Escape, la × y «Listo» cierran, y al volver a abrirlo está otra vez el formulario.
  Al cerrar, el foco va adonde va después de cualquier guardado (el respaldo del botón que abrió el modal, tomado antes de la recarga y aplicado cuando termina: una alta abierta desde la lista, el «Cargar licencia» nuevo; una corrección, el «Editar» de su fila).
  Si `GET …/nota` falla:
  «La licencia quedó guardada, pero no se pudo armar la vista de la nota.
  Probá «Descargar Word» o bajala después con «Word» en la lista.» (también anunciado), y «Descargar Word» sigue andando; con un 401, al login.
  Una respuesta que llega con el modal cerrado, o de otro guardado, se descarta.
- «Word» y «Descargar Word» bajan por el mismo camino (`bajarWordDeLicencia`), con un `fetch` propio y no con `API.pedirArchivo`, que no da el estado ni el `Content-Disposition` (`api.js` no cambió), y el nombre del `filename*` (sin el encabezado, «Nota de licencia.docx»): así la página no copia los nombres de los tipos y el nombre llega también si falló `GET …/nota`.
  Mientras baja, el botón queda deshabilitado (`.sg-link:disabled`, con el gris de `--sg-suave`, 5,8:1 sobre blanco, el subrayado punteado y el cursor de espera); el foco vuelve a él solo si se perdió.
  Si falla, el mensaje del servidor (el 409) o «No se pudo descargar la nota.
  Probá de nuevo en unos minutos.»; con un 401, al login.
  «Word» va antes de «Editar», en un grupo a la derecha de la fila (`.me-fila-acciones`; en el teléfono, arriba a la derecha), con el `aria-label` «Descargar en Word la nota de la licencia del 16/11 al 27/11/2026», y no aparece en el uso autorizado.
  `VERSION_MI_ESPACIO` pasó a `'20261212'`.
- Los días restituidos (spec 2026-10-31-mi-espacio-dias-restituidos, 12; los textos los aprobó el usuario en la ronda 4; la regla, en «Mi espacio: licencias y horas extras»): con el mismo encabezado, saludo, cierre y firma, en la misma hoja A4 y sin membrete.
  Unas vacaciones (y una carga de días restituidos) suman a sus días hábiles sus días restituibles (`restituibles`, opcional, los de `restituiblesDe`, que pasa `leerLaNota`; los que caen dentro de sus fechas), así la nota sigue diciendo los días que se presentaron («diecinueve (19)» aunque después un asueto caiga en ellas: la nota no cambia).
  La nota A, la de una carga de días restituidos (su fecha, la de la carga, `updated_at`, como siempre), necesita `restitucion` = `{ anio, fechas, durante }` (la licencia de origen, los asuetos y el tipo de la carga en la que cayeron, del pedido guardado —`durante`, el `licencia.tipo` del pedido: 'restituidos' en la recursión y si no 'vacaciones'— y de las filas de la foto que sostiene:
  `restitucionDeLaCarga` del controlador; sin ella, o con un año o unas fechas que no sirven, `{ error: 'error' }`; sin `durante`, o con otro valor, «vacaciones»):
  «Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de dos (2) días hábiles de mi licencia anual ordinaria 2024, restituidos por los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones, a partir del día lunes 12 de abril de 2027.» (de un día, «… el usufructo de un (1)
  día hábil de mi licencia anual ordinaria 2024, restituido por el asueto del día jueves 24 de diciembre de 2026, declarado durante mis vacaciones, el día lunes 12 de abril de 2027.»).
  En la recursión (el asueto cayó en una carga de días restituidos y sus días se toman en otra), «declarado durante mis días restituidos» («declarados», con varios asuetos), como el aviso y el email («cayeron en tus días restituidos»; revisión final de los días restituidos, 3).
  La nota B, la de un pedido de restitución, es `notaDeRestitucion(pedido, { fecha, persona })` (`pedido` = `{ anio, dias, fechas }`, con los días guardados en el pedido; su fecha, el día del pedido; la misma estructura que `notaDeLicencia`, así `htmlDeLaNota` y `renderNotaDocx` no cambian; nunca tira):
  «Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar la restitución a mi licencia anual ordinaria 2025 de dos (2) días hábiles, correspondientes a los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones.» (de un día, «… de un (1) día hábil, correspondiente al asueto del día jueves 24 de diciembre de 2026, declarado durante mis vacaciones.»).
  Los asuetos van con `textoDeLosAsuetos(fechas)`, por fecha y sin repetir:
  «de los días jueves 24 y jueves 31 de diciembre de 2026»; con varios meses o años, «de los días miércoles 24, viernes 26 y miércoles 31 de diciembre de 2025 y viernes 2 de enero de 2026»; uno, «del día jueves 24 de diciembre de 2026».
  Los archivos (17.9):
  «Nota de licencia - Días restituidos - 2027-04-12.docx» (con el «Desde») y «Nota de restitución - Licencia 2025 - 2027-04-01.docx» (con el día del pedido), y la aclaración de la B, `aclaracionDeLaRestitucion(fecha)`:
  «Lleva la fecha del 01/04/2027, el día en que pediste la restitución.
  Se baja en Word, para imprimir y firmar.».
  La nota A sale por las rutas de siempre (`GET …/licencias/:id/nota` y `…/word`); la B, por `GET /mi-espacio/restituciones/:id/nota` y `…/word`, con la firma de `firmaDe` (`services/miEspacioDatos.js`: la de la persona, que no depende de la carga, que puede estar dada de baja).
  Tests: en `mi-espacio-nota.test.js`, los dos cuerpos al pie de la letra y con la hoja de la maqueta, el singular, `textoDeLosAsuetos` (un mes, dos meses, dos años, un día y lo que no es una fecha), la nota A sin su `restitucion`, los demás tipos que no la miran, las vacaciones con sus restituibles que siguen con «diecinueve (19)», la recursión (sus restituibles y «durante mis días restituidos», en singular y en plural;
  `GET …/nota` de la carga de la recursión, en `mi-espacio-api.test.js`), los nombres de los archivos, los nueve tipos de `TIPOS_CON_NOTA` y `aclaracionDeLaRestitucion`; y en `mi-espacio-nota-word.test.js`, el Word de A y de B igual a la vista y a los Word de la maqueta, renglón por renglón.
- Las horas acumuladas (spec 2026-11-03-mi-espacio-horas-acumuladas, 9; la regla, en «Mi espacio: licencias y horas extras»): solo cambia la nota de unas horas a favor que usa horas acumuladas (`notaDeLicencia` le pasa a `CUERPOS.horas_a_favor` la parte acumulada, `horasAcumuladasDe(licencia)`;
  `leerLaNota` ya pasa la licencia entera).
  Las demás, también la de unas horas a favor sin acumuladas, quedan como estaban, y el nombre del archivo, la fecha y la firma no cambian.
  Del mes y acumuladas, primero el total y el día y después de dónde sale cada parte:
  «Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de siete (7) horas a favor el día viernes 6 de noviembre de 2026: seis horas y media (6,5) correspondientes a las horas extras realizadas en octubre de 2026 y media hora (0,5) de horas extras no usufructuadas de meses anteriores.»; solo acumuladas, sin el mes ni el paréntesis:
  «… el usufructo de una hora y media (1,5) de horas extras no usufructuadas de meses anteriores el día lunes 9 de noviembre de 2026.».
  Las horas, con `textoDeHoras`, y «correspondiente» o «correspondientes» con la parte del mes (`correspondientesALasHoras`).
  Con días tildados «Sumar a {mes anterior}», el paréntesis va después del mes de las horas:
  «… realizadas en octubre de 2026 (incluidas las del lunes 2 de noviembre de 2026, sumadas a octubre) y media hora (0,5) de horas extras no usufructuadas de meses anteriores.» (solo nombra días del mes de la licencia, como antes).
  Una parte que no se puede escribir da `{ error: 'error' }`, como antes.
  El Word sale de la misma estructura (`miEspacioNotaWord.js` no cambió).
- Sin tablas, columnas, migraciones ni Tarea Cron: el despliegue es subir los archivos y Restart (el kit va después del del Resumen «Titular»).
- Tests:
  `tests/mi-espacio-nota.test.js` (puro: las constantes, `enLetras` —«un» y «una», «veintiún» y «veintiuna», las centenas y las tildes—, `textoDeHoras`, el cuerpo de cada tipo al pie de la letra, el primer día hábil, un solo día hábil entre fechas distintas, los 9 fijos, ningún día hábil, el franco en un día que pasó a feriado, el mes de las horas extras cruzando el año, la concordancia de las medias, el uso autorizado y un tipo desconocido, la firma de planta, la de un contratado,
  sin cargo y sin vínculo, el nombre del archivo con el `desde`, que nunca tira, el HTML escapado y la aclaración), `mi-espacio-nota-word.test.js` (puro, abre el .docx con JSZip, como `notas-word.test.js`:
  la hoja A4 y sus márgenes, Arial 22 e interlineado 276 en el estilo por defecto y no en cada párrafo, sin encabezado, pie ni imágenes, los bloques en orden con su diagramación, la línea de la firma, el renglón del contratado en 9 pt, los renglones vacíos, la nota opcional que no va, los mismos renglones que `htmlDeLaNota` en cada tipo y cada firma, y un carácter de control o un surrogate solo, que dan un Word sano), `mi-espacio-api.test.js` (Docker, el `describe` «la nota de una licencia»:
  las dos rutas, la fila, el Word que se abre y dice lo mismo, sin la nota opcional; la fecha —el día argentino de un guardado a las 22:30 y una corrección sin cambios, que no la mueve—; lo ajeno, 404; el uso autorizado, 404 con su mensaje; sin días hábiles —por SQL o por un feriado cargado después—, 409; los feriados en los días; una persona sin nombre por SQL, 500 con el mensaje fijo; sin modalidad; un lector; el contratado y sin cargo;
  y `datosDeLaNota`), `mi-espacio-frontend.test.js` (`nombreDelAdjunto` —con lo que arma `disposicionDeAdjunto` y un % roto—, «Word» en las filas y no en el uso autorizado, la descarga —el token en el encabezado, el botón deshabilitado, el nombre con tildes, sin `Content-Disposition`, el 401, el 409, un error sin mensaje y el foco—, el segundo paso puro y con el DOM falso —el alta, la corrección con un aviso, otro año, «Listo», la × y Escape, el formulario al reabrir, la respuesta vieja,
  la falla de `…/nota`, «Descargar Word» y el foco al cerrar—, «Registrar un uso autorizado», que se sigue cerrando, los tests que esperaban que el modal se cerrara al guardar una licencia, que ahora esperan el segundo paso, y los estilos de la hoja, de la mesa y de «Word» deshabilitado), `permisos.test.js` (las dos rutas) y `paginas.test.js` (`VERSION_MI_ESPACIO` y los ids del modal, con el cuerpo y el pie del segundo paso).
  El Word del Generador y el de las Notas Digitales no cambiaron: sus tests siguen sin tocar.
  Desde «Sumar al mes anterior», en `mi-espacio-nota.test.js`, el día primero en todas las horas a favor y el paréntesis con uno, dos y tres días (en orden de fecha), los que no se nombran (de 0 h, sin tildar, de otro mes o con la marca que no es el `true` literal), «correspondiente» con 1 h, cruzando el año y que las salidas no cambian los demás tipos; en `mi-espacio-nota-word.test.js`, el Word con el paréntesis igual a la vista;
  y en `mi-espacio-api.test.js`, `GET …/nota` y `…/word` con un día tildado y, destildado, sin paréntesis.
  Desde las horas acumuladas, en `mi-espacio-nota.test.js`, los dos textos al pie de la letra, el paréntesis con un día tildado, solo acumuladas con un día tildado (sin el mes ni el paréntesis), «correspondiente» y «correspondientes», el '0.5' en texto, acumuladas de más (todas acumuladas), sin acumuladas igual a antes (sin la clave, null, 0, '', negativas, un texto, `true` o NaN), una franquicia con la clave que no cambia, y el nombre, la fecha y la firma;
  en `mi-espacio-nota-word.test.js`, los dos casos, con el Word igual a la vista renglón por renglón; y en `mi-espacio-api.test.js`, `GET …/nota` de 7 horas con 0,5 acumuladas, con la frase entera.

## La página

Desde la nota de licencia en Word (ver «Mi espacio: la nota de licencia en Word»), lo puro:
«Word» en `htmlDeFilaDeLicencia` (`data-word-licencia`, con el `aria-label` «Descargar en Word la nota de la licencia del …»; en el uso autorizado no va, por su `tipo`), antes de «Editar», los dos en `.me-fila-acciones`;
`nombreDelAdjunto` (el nombre del archivo de un `Content-Disposition`, el que arma `disposicionDeAdjunto`: el `filename*` en UTF-8, decodificado; sin él, o con un % roto, el `filename` entre comillas; si no, null; nunca tira); y el segundo paso de «Cargar licencia»:
`tituloDelSegundoPaso` («Licencia cargada» o «Licencia corregida»), `avisosDelGuardado`, `anuncioDelSegundoPaso`, `htmlDeLosAvisosDelGuardado` (el recuadro ámbar), `htmlDelSegundoPasoEnEspera` (`TEXTO_ARMANDO_LA_NOTA`), `htmlDelSegundoPasoSinVista` (`MENSAJE_SIN_VISTA`) y `htmlDelSegundoPaso({ fila, html, aclaracion, avisos })`, que escapa todo texto del servidor salvo `html`, la hoja que arma y escapa el servidor y va tal cual, como la nota del Generador de Notas.
Lo que toca el DOM o la API:
`pedirWordDeLicencia(id)` (un `fetch` GET propio a `/mi-espacio/licencias/:id/word` con `Auth.getAuthHeaders()`, JWT en el encabezado y nunca en la URL, como `pedirWord` de `notas.js`, porque `API.pedirArchivo` no da el estado ni el `Content-Disposition`;
`api.js` no cambió: da `{ blob, nombre }` y, con un error, tira un `Error` con su `status` y el mensaje del servidor, o ''), `bajarWordDeLicencia(id, boton)` (el de «Word», delegado en `alTocarLicencias`, y el de «Descargar Word», `#ml-descargar-word`: el botón deshabilitado mientras baja —un segundo clic no pide nada—; el nombre del servidor o `NOMBRE_DEL_WORD_POR_DEFECTO`, «Nota de licencia.docx», con un `descargarBlob` local, copiado de `correos.js`; con un 401, `irAlLogin`;
con otro error, `avisarMiEspacio` con el mensaje del servidor —el 409— o `MENSAJE_SIN_DESCARGA`; al terminar, el foco vuelve al botón solo si se perdió mientras bajaba —deshabilitado, el navegador lo suelta a `<body>`—: si la persona lo llevó a otro lado, ahí queda), `pasarAlSegundoPaso` (lo llama `guardarLicencia` solo con el formulario `licencia`:
«Registrar un uso autorizado» se sigue cerrando con `avisarLaRespuesta`; toma el respaldo del foco con `respaldoDelFoco` del botón que abrió el modal antes de `volverAPedirTodo` —que lo calcularía con el foco, que queda en el modal, y cuya recarga reemplaza ese botón— y lo aplica en `sesion.alCerrar`, después de `soltarElFocoDe` y cuando termina la recarga:
una alta abierta desde la lista vuelve al «Cargar licencia» nuevo y una corrección, al «Editar» de su fila), `mostrarSegundoPaso`, `pedirLaNotaDelSegundoPaso` (con `API.pedirJson`;
`pagina.pedidos.nota` numera cada pedido y una respuesta que llega con el modal cerrado, o de otro guardado, no toca nada) y `quitarSegundoPaso` (al cerrar y, por las dudas, en `abrirLicencia`: al volver a abrir, siempre el formulario).
Su estado, `pagina.segundoPaso` (`{ id, corregida, avisos }` o null).
No copia nada del servidor: los nombres de los tipos llegan en el `Content-Disposition`.
Los estilos del segundo paso y de la hoja (A4 a escala de su ancho, en `cqw`) van en el `<style>` de `mi-espacio.html`.
Tests en `tests/mi-espacio-frontend.test.js`, con un `Blob` y un `URL.createObjectURL` falsos en el `vm` (los casos, en «Mi espacio: la nota de licencia en Word»).

## Tests

Los de la nota, en «Mi espacio: la nota de licencia en Word».

## Archivos de tests

`mi-espacio-frontend.test.js`, `permisos.test.js`, `mi-espacio-nota.test.js`, `mi-espacio-api.test.js`, `mi-espacio-nota-word.test.js`, `notas-word.test.js`, `paginas.test.js`
