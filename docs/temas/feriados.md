# Feriados

La cuarta pestaña de Configuración: los días no hábiles que no son los 9 fijos, sus reglas, su API y la foto de los días por restituir. El calendario que arman está en `docs/temas/calendario-y-corridas.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-design.md`
- `docs/superpowers/specs/2026-10-26-feriados-design.md`
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`

## Archivos

feriadosController: leer, cargar, corregir, «no rige» y dar de baja los feriados, y cuántas licencias de Mi espacio incluye uno —también cuántas vacaciones deja con días para restituir y su plazo, y la foto de esos días, en la transacción del feriado—;
feriadosReglas (`calendarioCon`, el calendario con los 9 fijos y los feriados de la tabla, `exigirLaTabla` —el calendario, si se leyó de la tabla; si no, tira—, `feriadosDelCalendario` —los días que la tabla sacó de los hábiles, los que guarda la foto del 31/12— y `calendarioDeFechas` —el calendario que se vuelve a armar con esos días—;
contar días hábiles con los feriados en Mi espacio —también el próximo, el n-ésimo anterior y el último del mes—, la validación de un feriado, de «no rige» y de la baja desde un año, la lista de un año y sus avisos, y las fechas en que uno cambia un día hábil —con ellas, la foto de los días por restituir que saca uno, `fotosDelFeriado`—, puro) y feriadosDatos (las consultas de los feriados, solo lectura, y `leerCalendario`, el calendario de cada corrida o pedido, que nunca tira:
si la tabla no se puede leer, el de los 9 fijos con su error).

## Feriados (spec 2026-10-26-feriados)

- Qué es: la cuarta pestaña de Configuración (`#feriados`), con los días no hábiles que no son los 9 fijos: los nacionales que cambian de fecha (Carnaval, Viernes Santo, los trasladables y los extraordinarios, como el 9/11/2026), los de Chubut, los de Comodoro y los no laborables (el Jueves Santo, los días con fines turísticos y los asuetos puntuales).
  Siempre el día entero.
  Mi espacio los usa para contar en días hábiles las licencias y los francos y para su email de vencimiento (ver `docs/temas/mi-espacio.md` y, para el email, `docs/temas/mi-espacio-paso-y-avisos.md`).
  Hay un solo calendario (spec 2026-10-27-feriados-en-notas): los 9 fijos y la tabla son los días no hábiles de las corridas de la mañana y de las 14:00 y de todo lo que las anuncia (Correos → Estado, la vista previa y la prueba, Configuración → Licencias y Mi espacio: ver `docs/temas/calendario-y-corridas.md`), y también de Métricas, el Ciclo de vida del dato, la foto del 31/12 y la Agenda de pedidos: son los días no hábiles de todo el sistema.
  `esDiaHabil` y `FERIADOS_FIJOS` son solo los 9 fijos, sin la tabla (`tests/feriados-reglas.test.js` los compara con los 9 escritos a mano), y son la base del calendario.
  Antiobjetivos: que algo que hoy anda cambie sin que nadie lo decida, que un feriado mal cargado pase sin que se note (la pestaña muestra el día de la semana y avisa) y que corregir un año cambie los anteriores.
- Uno que se repite (`se_repite`): el mismo día y mes desde el año de su `fecha` (no hacia atrás) hasta `hasta_anio`, salvo los años de `feriados_no_rige`; es para los de fecha fija que no son de los 9 (el aniversario de la ciudad), y los móviles se cargan año por año.
  Un año que se corre se marca «no rige» y se carga «Se pasó al» (un feriado más, con `trasladado_de`).
  Corregir su fecha o su nombre corrige todos los años (es para errores de carga).
  Un 29/02 no se repite.
  Su baja vale desde un año (`hasta_anio` = ese año − 1: los anteriores no cambian); desde su primer año o uno anterior, es entera (`activo = 0`).
- Reglas (`services/feriadosReglas.js`, puro: sin pool ni `Date` local, fechas `'AAAA-MM-DD'`, hoy por parámetro; ninguna tira, salvo las derivadas del calendario que arma `calendarioCon`, que tiran como las de `CALENDARIO_FIJO`, y `exigirLaTabla`, que tira a propósito).
  Para el calendario único (spec 2026-10-27-feriados-en-notas, 1):
  `calendarioCon(filas, { origen, error })` y los mensajes de la caída a los 9 fijos, `MENSAJE_CORRIDA_SIN_FERIADOS` y `MENSAJE_ESTADO_SIN_FERIADOS` (ver `docs/temas/calendario-y-corridas.md`).
  El calendario que arma `calendarioCon` está congelado (`Object.freeze`): las filas que cambian después no lo cambian, y sin filas da lo mismo que `CALENDARIO_FIJO`.
  Los tests lo arman con `tests/fixtures/feriados-precarga.js` (`FILAS_PRECARGA`: la precarga como la devuelve `filasDeFeriados`, congelada; `tests/feriados-en-notas.test.js` la ata a `migracion-feriados-datos.sql`): con ella, 2026 tiene 237 días hábiles.
  Para Métricas y la foto, que no caen a los 9 fijos (spec 2026-10-27-feriados-en-notas, 2 y 5):
  `MENSAJE_METRICAS_SIN_FERIADOS` ('no se pudieron leer los feriados de Configuración → Feriados', en minúscula: la corrida lo anota detrás de «No se pudo sacar la foto del año: »; en la API no se ve, el 500 lleva el mensaje fijo de cada reporte), `exigirLaTabla(calendario)` (el mismo calendario si se leyó de la tabla;
  si cayó a los 9 fijos, `error !== null` y nunca por `origen`, tira con ese mensaje), `feriadosDelCalendario(calendario, desde, hasta)` (los días de `desde` a `hasta`, en orden, hábiles con los 9 fijos y no con el calendario: los que la tabla sacó, los que guarda la foto; [] con una fecha que no sirve o `desde` > `hasta`) y `calendarioDeFechas(fechas)` (el calendario de esa lista, una fila suelta por fecha: en ese rango da lo mismo que el calendario original; lo que no es una lista, los 9 fijos).
  Para contar días hábiles (Mi espacio):
  `feriadosDelRango(filas, desde, hasta)` (el `Set` de los 9 fijos de cada año del rango y las filas que rigen, `fechaEnElAnio`; recorre una copia de `FERIADOS_FIJOS`, un array que se puede modificar), `esDiaHabilCon(fecha, feriados)` (`esFechaIso && esDiaHabil && !feriados.has(fecha)`: los feriados solo sacan días, con un `Set` vacío es `esDiaHabil` y un texto que no es una fecha da false), `diasHabilesDe` y `diasHabilesEntre` (los dos días incluidos:
  `diasHabilesTranscurridos` no cuenta el primero) y `proximoDiaHabilCon(fecha, feriados)` (la fecha, si es hábil, o el primero que la sigue: la vuelta de «Hoy no están» y el primer día hábil de diciembre del email), `restarDiasHabilesCon(fecha, n, feriados)` (el n-ésimo día hábil anterior, sin contar la fecha; con n = 0, la fecha) y `ultimoDiaHabilDelMesCon('AAAA-MM', feriados)` (nunca un día de otro mes);
  las dos primeras, con el tope de 366 vueltas (`TOPE_DE_VUELTAS`, el del calendario), y las tres dan null si no hay o si la entrada no sirve (las del calendario, en cambio, tiran); quien cuenta pide el `Set` con margen («el último día hábil del mes» y «5 días hábiles antes» caminan fuera del mes).
  Para las licencias de Mi espacio que incluye un feriado:
  `fechasDelFeriado(fila, desdeAnio, hastaAnio)` (las fechas en que rige en ese rango de años, `fechaEnElAnio` de cada uno, sin filtrar nada más; uno que se repite, todos los años en que rige) y `fechasQueCambianDiasHabiles(fila, desdeAnio, hastaAnio, otrasFilas)` (de esas, las que sin él serían hábiles: no caen sábado ni domingo, no son de los 9 fijos y ningún otro feriado activo rige ese día, `feriadosDelRango(otrasFilas, …)`;
  `otrasFilas` va sin la fila misma; uno que se repite, año por año: el 13/12 es domingo en 2026 y lunes en 2027).
  Para la API y la pestaña:
  `TIPOS_FERIADO`, `NOMBRES_TIPO_FERIADO` (Nacional, De Chubut, De Comodoro y No laborable), `NOMBRES_DE_LOS_FIJOS` (los 9, por 'MM-DD'; un test ata sus claves a `FERIADOS_FIJOS`), `MENSAJES_FERIADO` (13), `FECHA_MINIMA_FERIADO` ('2025-01-01'), `LARGO_NOMBRE_FERIADO` (150), `diaDeLaSemana`, `validarFeriado(entrada, hoy)` → `{ datos, error }` (en este orden: la fecha, del 01/01/2025 al 31/12 del año siguiente a hoy;
  el nombre recortado, obligatorio y de hasta 150 caracteres contados con `Array.from`; el tipo;
  `trasladado_de`, otra fecha del mismo año; el 29/02 que se repite), `errorDeLaCorreccion(datos, fila)` (uno que se repite, dado de baja desde un año, no pasa a una fecha de ese año o de después: quedaría activo sin regir ningún año), `validarRige(entrada, fila, hoy)` (`noSeRepite`; el año, desde el de la fila hasta su `hasta_anio` y dentro del rango;
  `rige`, el `true` o el `false` literal;
  `pasa_al`, solo con `rige: false`, opcional, otro día del mismo año), `bajaDesde(fila, desde)` (`{ activo: 0 }` o `{ hasta_anio }`; nunca la hace regir más años), `feriadosDelAnio(filas, anio)`, `avisosDeLaFecha(fecha, filas, excluirId)` y `aniosDelSelector(filas, hoy)`.
  Un error es `{ campo, mensaje }`, con el campo del pedido:
  `nombreLargo` va en `nombre`, `trasladado` en `trasladado_de`, `repite29` en `se_repite`, `despuesDeLaBaja` en `fecha`, `pasaAl` en `pasa_al` y `noSeRepite`, sin campo.
- La lista de un año (`feriadosDelAnio`): los 9 fijos (`id` null, `tipo` 'fijo', «Fijo del sistema») y las filas que van ese año (las que se repiten, proyectadas, también las que ese año no rigen:
  `rige: false` y solo «Este año no rige»), por fecha (el mismo día, el fijo primero y después por nombre), cada una `{ id, fecha, dia_semana, nombre, tipo, tipo_nombre, fijo, se_repite, rige, trasladado_de, aclaraciones, fecha_guardada, trasladado_de_guardado, hasta_anio }` (`fecha` y `trasladado_de`, las del año; los tres últimos, lo guardado en la fila, null en los fijos).
  Las aclaraciones, en este orden:
  «Trasladado del miércoles 17/06», «Cae domingo: no cambia ningún día hábil» y «Cae el mismo día que un feriado fijo: no cambia nada» o «Cae el mismo día que «<nombre>»».
  Los avisos al guardar (`avisosDeLaFecha`), contra la proyección completa del año y sin la fila que se corrige, nunca con un `WHERE fecha = ?`:
  «Cae domingo: no cambia ningún día hábil.» y «Ese día ya es feriado: <nombre> (fijo del sistema).» o «Ese día ya es feriado: <nombre>.».
  Los años del selector: los anteriores al en curso, desde 2025, con algún feriado de la tabla que rige, más el en curso y el siguiente.
- Lectura (`services/feriadosDatos.js`, solo lectura, parametrizada, sin N+1; fechas con `DATE_FORMAT`, marcas con `Number()`):
  `filasDeFeriados(conexion)` (las activas con su `no_rige`, en dos consultas), `filaDeFeriado(id, conexion)` (una activa o null; con la conexión de una transacción, con `FOR UPDATE`, y tiene que ser su primera lectura) y `feriadosEntre(desde, hasta)` (el `Set`;
  Mi espacio no la usa: lee `filasDeFeriados` una vez y arma el `Set` con `feriadosDelRango`, en `feriadosPara` de `miEspacioDatos.js`, y con las mismas filas da el próximo feriado del Resumen y su calendario, `calendarioCon`).
  `leerCalendario(conexion = pool)`:
  `calendarioCon` de `filasDeFeriados(conexion)`, que nunca tira (ver `docs/temas/calendario-y-corridas.md`).
- API (`controllers/feriadosController.js`; hoy es `hoyArgentina()`):
  `GET /api/feriados?anio=AAAA` (`authMiddleware`: cualquier rol con sesión, también el lector y el colaborador, que no ven la pestaña; sin sesión, 401) → `{ success, data: { anio, anios, feriados } }` (sin `anio`, el en curso; lo que no es un texto de cuatro cifras de 2000 a 2100, 400 en `anio`).
  Las cuatro escrituras, con `authMiddleware` + `adminOnly` (lector y colaborador, 403;
  `RUTAS_SOLO_ADMIN`):
  `POST /api/feriados` (201 `{ success, data: { id }, message: 'Feriado cargado.', avisos }`, con `creado_por`), `PUT /api/feriados/:id` (el formulario entero; 200 `{ success, message: 'Feriado corregido.', avisos }`; sacarle «se repite» no borra su `hasta_anio` ni sus años que no rigen), `PUT /api/feriados/:id/rige` (va antes de `PUT /feriados/:id`;
  `{ anio, rige, pasa_al }`:
  `INSERT IGNORE` o `DELETE` de ese año en `feriados_no_rige` y, con `pasa_al`, en la misma transacción, el día al que se pasó —el mismo nombre y tipo, sin «se repite» y trasladado del día que no rige— o el que ya hay activo con esa fecha y ese nombre: repetirlo no duplica nada; 200 con `data: { nuevo_id }`, «En 2027 no rige: se pasó al 09/11/2027.» y `avisos`, los de ese día, como en el alta —contra la proyección completa y sin contarlo a él; sin `pasa_al`, `[]`—;
  volver a regir no toca el día al que se había pasado, y si sigue activo el mensaje lo dice:
  «En 2027 vuelve a regir.
  El día al que se había pasado (09/11/2027) sigue cargado: si ya no corresponde, dalo de baja.») y `DELETE /api/feriados/:id?desde=AAAA` (`bajaDesde`; en uno que se repite, sin `desde`, 400 en `desde`).
  Orden: un id que no pasa `idPositivo`, que no existe o dado de baja → 404 «Feriado no encontrado»; después, la validación → 400 `{ success: false, error, campo }` (`rige` sobre uno que no se repite, con `campo` null).
  Corregir, «no rige» y la baja son una transacción que lee la fila con `filaDeFeriado` (un 2xx confirma; otro status o un error deshace): dos escrituras del mismo feriado se esperan.
  El alta es una transacción con su foto (ver abajo), con los avisos calculados antes; `enTransaccion` repite una vez, desde el principio, una transacción que MariaDB corta por un bloqueo mutuo (`ER_LOCK_DEADLOCK`; dos intentos en total, como las de Mi espacio: el feriado escribe también la foto, que escriben los pedidos de Mi espacio).
  Los avisos nunca frenan nada (la pestaña los muestra en un toast de advertencia); un 500 dice un mensaje fijo por operación (el error, solo en la consola).
  Cuántas licencias de Mi espacio activas, de cualquier persona, incluye un feriado (`licenciasQueIncluyen(fila, { excluir, antes })` de `services/miEspacioDatos.js`: solo el número, ni personas ni tipos, y cada licencia una vez):
  `GET /api/feriados/afectadas?fecha=&se_repite=&id=` (`authMiddleware` + `adminOnly`, en `RUTAS_SOLO_ADMIN`; la fecha y «se repite» —'1'; cualquier otro valor es '0'— son los del modal y, con el id de uno guardado, sus años que no rigen y su baja desde un año, sin contarlo como otro feriado ese día;
  una fecha que no es una fecha, 400 en `fecha`) → `{ data: { licencias_afectadas } }`, y el alta y la corrección traen `data.licencias_afectadas` con lo ya guardado (después del commit y aislado: si la cuenta falla, null, y el resto de la respuesta no cambia).
  Uno que se repite cuenta en todos los años en que rige, del primer año de las licencias activas al último (decisión del usuario, 26/10/2026), y solo por las fechas en que cambia de verdad un día hábil (`fechasQueCambianDiasHabiles`, decisión del usuario, 27/10/2026: no un sábado, un domingo, uno de los 9 fijos ni un día en que ya rige otro feriado activo); sin ninguna, 0.
  `GET /feriados/afectadas`, el alta y la corrección traen (spec 2026-10-31-mi-espacio-dias-restituidos, 8 y 9) `vacaciones_para_restituir` (cuántas cargas de vacaciones, o de días restituidos, quedarían con ese día para restituir: las que tendrían foto) y `plazo_de_restitucion` (el plazo contado desde la primera de esas fechas, con los feriados de la tabla y el del modal, o null), sin decir de quién (`vacacionesParaRestituir` de `services/miEspacioDatos.js`; sin ninguna, 0 y null;
  aisladas, como la otra cuenta: si fallan, las dos en null y el error en la consola, y si falla la de las licencias, en el `GET`, el 500 «Error al contar las licencias que incluyen el feriado»); con el id de uno guardado (en el `GET`, la fila guardada;
  en la corrección, `antes`, la de antes de corregirlo), solo por sus fechas nuevas, y `licenciasQueIncluyen` no cuenta como recalculada, en una fecha que ya tenía, una licencia que ya tiene la foto de ese feriado en esa fecha (ese día es restituible y la carga conserva sus días).
- La pestaña: el aviso azul («Estos feriados, junto con los 9 fijos, son los días no hábiles de todo el sistema: esos días no sale ninguna nota ni ningún email automático, y no cuentan como días hábiles en las licencias, Mi espacio ni Métricas.», spec 2026-10-27-feriados-en-notas, 6), la tarjeta «Feriados y días no laborables de AAAA» (el `h2` de `configuracion.html` va sin el año:
  lo pone `tituloDeFeriados`, y sin un año queda sin él), con el selector del año y los filtros como botones (`aria-pressed`; los filtros con su cantidad:
  Todos, Nacionales, De Chubut, De Comodoro, No laborables y Fijos del sistema), y la tabla (Fecha con el día, «Lun 16/02»;
  Nombre con sus aclaraciones;
  Tipo;
  Se repite, «Todos los años» o «—»; y «Editar»; los fijos en gris y sin «Editar»; uno que ese año no rige, tachado).
  Se ve como Áreas: sus `.ar-*` y los `.fe-*` del `<style>` de `configuracion.html`.
  El modal (`#modal-feriado`, sin `<form>` entre el `.modal` y su cuerpo): la fecha con su día de la semana al lado (al corregir uno que se repite, con la ayuda `#fe-fecha-ayuda` en su `aria-describedby`:
  «Es la fecha de su primer año (2026): corregirla cambia todos los años.» y, con «no rige» a la vista, «Si solo en 2027 se corrió, marcá «En 2027 no rige».»; debajo, «N licencias cargadas lo incluyen: sus días hábiles se recalculan.» en `#fe-fecha-afectadas`), el nombre, el tipo (cuatro opciones grandes), «Trasladado del» (opcional), «Se repite todos los años, el mismo día» y, al corregir uno que se repite, «En AAAA no rige» (el año que se mira) con «Se pasó al» (opcional);
  en el pie, «Siempre el día entero» y, al corregir, «Dar de baja», que pide confirmación en `#modal-baja-feriado` (`aria-describedby` con la pregunta; en uno que se repite, «Deja de regir desde», de entrada el año que se mira, y «Los años anteriores no cambian.»).
- La foto de los días por restituir (spec 2026-10-31-mi-espacio-dias-restituidos, 6;
  la regla, en `docs/temas/mi-espacio-restituidos.md`): la saca el feriado en su misma transacción y queda en `mi_espacio_restituibles` (ver `docs/temas/base-de-datos.md`): cada día que deja de hacer hábil (`fechasQueCambianDiasHabiles`, contra los demás feriados activos: no un sábado, un domingo, uno de los 9 fijos ni un día en que ya rige otro) en una carga activa de vacaciones o de días restituidos (`TIPOS_CON_FOTO`, atada por un test a `TIPOS_CON_RESTITUIBLES`;
  en unas vacaciones, del arranque de su persona en adelante) de cualquier persona, una vez por carga y día; uno que se repite, en cada año en que rige dentro de las cargas.
  Lo calcula `fotosDelFeriado(fila, cargas, otrasFilas, { antes })` (`services/feriadosReglas.js`, pura, nunca tira) con las cargas de `cargasParaLaFoto` (`services/miEspacioDatos.js`;
  `fotosParaElFeriado` las lee solo en el rango en que puede regir el feriado, y no las lee si ya se sabe que no hay fechas nuevas), y lo escribe `sacarLaFoto` (`services/miEspacioRestituciones.js`: un `INSERT … ON DUPLICATE KEY UPDATE` que, si la carga ya tiene ese día sin pedido —una fila de un feriado dado de baja, o de este mismo en un año que no regía—, la pasa a este feriado y la vuelve a abrir, `tanda` NULL, así un asueto que llega después de un pedido arma una tanda nueva;
  con un pedido, queda como estaba).
  Con las cargas de ese rango, `fotosParaElFeriado` da lo mismo que `fotosDelFeriado` con todas las cargas.
  El alta (`crearFeriado`, que corre en una transacción) saca la foto después del `INSERT`: si la foto falla, el feriado tampoco queda.
  La corrección (`corregirFeriado`, con `antes`, la fila leída con `FOR UPDATE`) saca foto solo de sus fechas **nuevas**, las que no tenía (renombrarlo no fotografía unas vacaciones cargadas después; pasarlo a «se repite» saca la de los otros años), y `acomodarLaFotoDelFeriado` pasa las fotos sin pedido de una fecha que ya no es suya a otro feriado activo que rija ese día, si hay, y si no las borra (las de un pedido quedan: la regla ve que ese día volvió a ser hábil y el Resumen dice «Revisá…»;
  «sin pedido», con el criterio de la regla: sin `restitucion_id`, o con el de un pedido dado de baja o del caso A sin su carga).
  «Se pasó al» saca la foto del día que carga (el que ya estaba cargado, no), y volver a regir (`rige: true`) saca la de ese año, como un alta de esa fecha (decisión 4 de la spec: cuenta cualquier día que deja de ser hábil; si no, unas vacaciones cargadas mientras ese año no regía perderían el día).
  «No rige» y la baja no tocan la foto: el día vuelve a ser hábil y la regla deja de restituirlo.
  La corrección (que siempre lee la foto) y, cuando sacan foto, el alta, volver a regir y «Se pasó al» dependen de las tablas de restituciones de Mi espacio: sin `migracion-mi-espacio-restituciones.sql`, dan 500.
  El modal lo dice debajo de la fecha, sin nombres.
  `registrarPedido` y `soltarPedido` (`services/miEspacioRestituciones.js`) nunca abren ni cierran la transacción; `registrarPedido` enlaza solo las filas del grupo que siguen sin pedido y, con un grupo que no sirve, tira sin escribir nada.
  Límites sabidos: si una persona guarda o alarga unas vacaciones en el mismo instante en que se carga el asueto, esas vacaciones pueden quedar sin foto (`cargasParaLaFoto` es una lectura común, sin bloquear las cargas de todos); y el plazo del modal se cuenta desde el día que se carga (unas vacaciones que ya tenían días por restituir de un asueto anterior tienen el plazo de ese).

## La página: feriados.js

- `feriados.js` (la pestaña Feriados de Configuración): al cargarse solo declara (`tests/feriados-frontend.test.js` lo carga en un `vm`, con el `api.js` de verdad, y también con un DOM falso y un `fetch` falso debajo del `API.pedirJson` de verdad).
  En `configuracion.html` va después de `areas.js`: sus nombres de nivel superior llevan `Feriado` o `Feriados` (`escFeriado`, `cargarFeriados`, `abrirModalFeriado`, …) y no se repiten con los de los otros seis scripts de la página (`tests/areas-frontend.test.js` lo controla entre los siete).
  Escucha sus clics solo dentro de `#vista-feriados` y de sus dos modales (`#modal-feriado` y `#modal-baja-feriado`), y en `#btn-nuevo-feriado` (en el encabezado, fuera de la vista), con sus propios atributos (`data-anio-feriado`, `data-filtro-feriado`, `data-editar-feriado`, `data-cerrar-feriado` y `data-cerrar-baja-feriado`; nunca los de `usuarios.js` ni los de `areas.js`); su Escape cierra solo sus modales, primero el de la baja, y un clic en el velo no cierra.
  Lo que arma HTML y lo que calcula es puro y va primero (`feriadosVisibles`, `cantidadesDeFiltrosFeriado`, `htmlDeFiltrosFeriado`, `htmlDelSelectorDeAnioFeriado`, `htmlDeTablaFeriados` —«Editar» con `aria-label` «Editar <nombre>, <día> DD/MM»: con la precarga hay nombres repetidos—, `valoresDelFeriado`, `erroresDelFeriado` —solo los obligatorios: el rango, el largo, el trasladado y el 29/02 los controla el servidor—, `pedidosDelGuardadoFeriado` —0, 1 o 2 pedidos:
  el `POST` o el `PUT` del formulario entero y después el `PUT …/rige`—, `textoDeLaBajaFeriado` y `tituloDelModalFeriado`, texto plano para `textContent`); lo que toca el DOM o la API va aparte, al final (`iniciarFeriados`, en `DOMContentLoaded`, sale si `Auth.isAdmin()` no es el `true` literal).
  Pide y escribe con `API.pedirJson`.
  `cargarFeriados(forzar)` (la llama `mostrarVista` de `usuarios.js` al abrir la pestaña, y elegir un año también) pide cada año una sola vez; después de guardar o dar de baja, con `forzar`, descarta todos los años (uno que se repite cambia en todos) y la tabla que se ve sigue con sus filtros y su «Editar» hasta que llega la nueva, pero «Editar» espera esa lista y abre con su fila nueva (`editarDeLaListaFeriado`: con los datos de antes, el `PUT` del formulario entero desharía la corrección).
  No recalcula nada: las fechas, el día de la semana, el tipo, las aclaraciones y los años del selector los manda el servidor.
  El modal corrige con lo guardado de la fila (`fecha_guardada` y `trasladado_de_guardado`; el primer año y `hasta_anio` dan los años de «Dar de baja»), nunca con la `fecha` proyectada al año que se mira (movería el primer año de uno que se repite).
  Guardar y confirmar deshabilitan su botón hasta la respuesta, y mientras tanto el modal no se cierra ni se abre otro; un 404 cierra el modal, avisa y vuelve a pedir la lista; un 400 con campo va a su control (`aria-invalid` y el foco) y, sin campo, al aviso de arriba (`#feriado-error`); si los campos se guardan y «no rige» no, el modal queda abierto con «El feriado se guardó, pero «no rige» no: <motivo>.» y lo guardado pasa a ser el original (el próximo «Guardar» no lo repite).
  `#feriados-anuncio` es la única región viva de la vista (ahí van, después del éxito, el mensaje y los `avisos` del servidor, también en el `showToast`).
  Todo texto pasa por `Utils.escapeHtml` y un número va con `String`.
  Copias mínimas, atadas por tests de paridad:
  `MENSAJES_FERIADO` (las 13 claves de `services/feriadosReglas.js`, con el mismo nombre), `NOMBRES_TIPO_FERIADO` (los rótulos de las cuatro opciones del tipo), `diaDeLaSemanaFeriado` (copia de `diaDeLaSemana`, en 14 días seguidos con el cambio de año y con lo que no es una fecha: el día al lado de la fecha del modal), `FECHA_MINIMA_FERIADO` y `fechaMaximaFeriado` (el rango de `validarFeriado`) y `erroresDelFeriado` (el mismo campo y el mismo mensaje que `validarFeriado` en cada obligatorio).
  Las ayudas de los tipos (`AYUDAS_TIPO_FERIADO`; la de «Nacional», «Carnaval, Semana Santa, trasladables y extraordinarios», la pidió el usuario) son solo del navegador.
  Debajo de la fecha del modal (`#fe-fecha-afectadas`, en el `aria-describedby` de la fecha solo mientras se ve, después de la ayuda) dice cuántas licencias de Mi espacio la incluyen (`textoDeAfectadasFeriado`:
  «1 licencia cargada lo incluye: sus días hábiles se recalculan.», «N licencias cargadas lo incluyen: …»; con 0, nada): lo pide con `GET /feriados/afectadas` (`rutaDeAfectadasFeriado`, con la fecha, «se repite» y, al corregir, el id) 300 ms después del último cambio de la fecha o de «Se repite» hecho por quien usa el modal (abrirlo no lo pide), descarta la respuesta de un pedido viejo o de otra apertura y, si falla, no muestra nada (no frena el guardado).
  Ese mismo pedido (spec 2026-10-31-mi-espacio-dias-restituidos, 9) trae también cuántas de esas licencias son vacaciones (o días restituidos) que quedan con ese día para restituir y su plazo (`vacaciones_para_restituir` y `plazo_de_restitucion`, 'AAAA-MM-DD'), y `textoDeAfectadasFeriado(cantidad, vacaciones = 0, plazo = null)` lo dice, sin nombres:
  sin vacaciones (0, null —el servidor no las pudo contar— o lo que no es una cantidad), el texto de solo las licencias («N licencias cargadas lo incluyen: sus días hábiles se recalculan.»); todas son vacaciones (más vacaciones que licencias cuentan como todas), «1 licencia cargada lo incluye: son vacaciones, y ese día queda para restituir con nota hasta el 30/04/2027.» («3 licencias cargadas lo incluyen: son vacaciones, y …»); de los dos, «3 licencias cargadas lo incluyen.
  En 2 vacaciones, ese día queda para restituir con nota hasta el 30/04/2027; la otra se recalcula.» («En unas vacaciones, …», «las otras 2 se recalculan»); sin un plazo que sea una fecha, sin «hasta …».
  El texto lo arma el navegador con las cuentas y el plazo del servidor, sin copia ni paridad.

## Archivos de tests

`feriados-frontend.test.js`, `areas-frontend.test.js`, `feriados-reglas.test.js`, `feriados-api.test.js`, `schema.test.js`, `permisos.test.js`, `paginas.test.js`, `usuarios-frontend.test.js`
