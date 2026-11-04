# Configuración: usuarios, licencias y áreas

La página de Administración con sus pestañas, salvo Feriados, que tiene su documento.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-24-configuracion-design.md`
- `docs/superpowers/specs/2026-10-28-mi-espacio-licencia-anulada-design.md`
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`

## Archivos

areasReglas (la validación de un área y sus mensajes, los datos de contacto que solo ve administración y por qué no se puede borrar, puro);
licenciasOficialesService (el alta, la edición y la anulación de una licencia de Configuración → Licencias con sus reglas, dentro de una transacción ajena: las comparten Configuración y Mi espacio);
configuracion.html # Configuración: pestañas Usuarios, Licencias, Áreas y Feriados (usuarios.js, areas.js y feriados.js); reemplaza a usuarios.html y areas.html

## Configuración: Usuarios, Licencias, Áreas y Feriados (spec 2026-10-24-configuracion)

- Qué es:
  Administración → Configuración (`configuracion.html`, que sale de `usuarios.html` con su marcado, sus ids, sus textos y sus modales tal cual, + `usuarios.js` + `areas.js` + `feriados.js`), con cuatro pestañas:
  Usuarios (la inicial), Licencias, Áreas y Feriados (`#pagina-pestanas`, `data-vista`; la de Feriados, ver «Feriados»).
  Solo administración (`Auth.isAdmin()`); sin sesión, al login, y el lector y el colaborador, a la portada.
  La pestaña viaja en la dirección (`#usuarios`, `#licencias`, `#areas`, `#feriados`):
  `usuarios.js` la lee al abrir (`vistaDeLaDireccion`; un fragmento desconocido abre Usuarios) y la escribe al cambiar con `history.replaceState` (no suma pasos al botón Atrás; sin `hashchange`; en el `vm` de los tests no hay `history`).
  `VISTAS` y `mostrarVista` conocen las cuatro vistas y los tres botones del encabezado ("Nuevo usuario" en Usuarios, "Nueva área" en Áreas, "Nuevo feriado" en Feriados;
  Licencias no tiene, "Nueva licencia" sigue en su tarjeta), y al mostrar Áreas o Feriados llaman a `cargarAreas` de `areas.js` o a `cargarFeriados` de `feriados.js`.
  Usuarios y Licencias no cambiaron (decisión del usuario: la pestaña Áreas se ve distinta de las otras dos); la ayuda del editor sigue diciendo "en Usuarios".
  Desde Mi espacio, la pestaña Licencias hace lo mismo que antes (los tests de `licencias-api` y `licencias-reglas` no cambiaron sus aserciones, salvo las de la persona autorizada que se queda sin días en `licencias-api`, por la decisión del usuario del 27/10/2026:
  ver «Firma de las Notas Digitales y licencia del firmante», y, desde la licencia anulada en Configuración, el mensaje y la insignia después de anular una «Cargada desde Mi espacio»), pero el alta, la edición y la anulación con sus reglas (`cargarLicencia`, `cambiarLicencia`, `anularLicenciaDe`, `rechazoDeLaBase`, `bloquearUsuarios`, `firmanteTitular`, `autorizables`, `conSusLicencias`, `COLUMNAS_LICENCIA`) están en `services/licenciasOficialesService.js`, que comparte con Mi espacio:
  reciben la conexión de una transacción abierta y al actor (nunca `req`), no la abren ni la cierran y, si algo no se puede, devuelven `{ rechazo: { status, error, campo, motivo } }` sin escribir (`licenciasController.js` responde el status, el mensaje y el campo de siempre; el `motivo` es para Mi espacio).
  Cada fila de la lista lleva `desde_mi_espacio` (la creó Mi espacio: ver «Mi espacio») y `filaLicencia` de `usuarios.js` le pone la insignia «Cargada desde Mi espacio» (`.etiqueta-mi-espacio`, en el celeste de `--cielo`); administración la edita como cualquier otra y, desde la spec 2026-10-28-mi-espacio-licencia-anulada, anularla la borra también de Mi espacio (ver abajo).
  Antiobjetivos: perder algo de Usuarios, que un link viejo deje de andar y que los datos de contacto de una persona se vean sin sesión.
- La pestaña Licencias con el calendario (spec 2026-10-27-feriados-en-notas, 4): cada pedido de `controllers/licenciasController.js` lee el calendario una sola vez (`leerCalendario`):
  `listarLicencias`, para la lista y las personas autorizables;
  `crearLicencia` y `editarLicencia`, dentro de la transacción y después de `bloquearUsuarios`, con su conexión (es una lectura común, sin bloqueos), y lo pasan a `cargarLicencia` y `cambiarLicencia` (para el 409 de la persona autorizada sin días:
  `rechazoDeLaBase` y `disponibilidadDelAutorizado`) y a la respuesta;
  `anularLicencia`, después del commit, solo para la respuesta.
  Con él salen la víspera, «Vuelve el…» y las ausencias unidas de la persona autorizada (`conSusLicencias` y `unirAusencias`;
  `GET /mi-espacio/firmante` usa el mismo arreglo) y los días sin auditor (`periodosSinAuditor`).
  Cada licencia del firmante titular trae `vispera`, `sin_anticipo` y `sin_dias_habiles` (`aRespuesta`, con `visperaDeLaLicencia` y las demás licencias del titular sin anular, `licenciasDelTitular`: ver «Firma de las Notas Digitales y licencia del firmante»); las demás, `null`, `false` y `false` (`SIN_VISPERA`, una sola, la de `services/licenciasReglas.js`).
  `efectoEnNotas` de `usuarios.js` las lee (solo el `true` literal; su copia está en `mi-espacio.js`):
  «No tiene días hábiles: las notas no cambian.» y, sin anticipo, «Empieza a continuación de otra licencia: los avisos no se adelantan.
  Lo que toque avisar sale el primer día hábil después de la licencia.
  La reiteración que toque, ese día si es un mes de reiteración; si no, en el próximo.» o, con persona autorizada, «… Desde el primer día, {nombre} presenta las notas con las dos firmas, después de la nota que comunica la autorización.».
  El modal (`actualizarEfecto`) usa la víspera y `sin_anticipo` de la licencia guardada mientras no cambia el inicio, y `sin_dias_habiles` mientras no cambian el inicio ni el fin (por eso `#l-hasta` también lo escucha); con otras fechas dice «el último día hábil anterior» sin preguntarle al servidor (la fila guardada dice lo real: es uno de los límites sabidos, ver «Firma de las Notas Digitales y licencia del firmante»).
  Si la tabla de feriados no se puede leer, la pestaña (y `GET /mi-espacio/firmante`) sigue con los 9 fijos, lo que haría la corrida ese día, y lo anota en la consola.
- Anular una licencia «Cargada desde Mi espacio» (spec 2026-10-28-mi-espacio-licencia-anulada, 2.1 y 3b; decisión del usuario del 28/10/2026, que cambió la de la spec de Mi espacio, sección 6:
  «si la anula, la de Mi espacio queda como registro personal»): la fila de Mi espacio que la creó (`mi_espacio_licencias.oficial = 'creada'`, activa) se da de baja también (`activo = 0`), la anule quien la anule (la misma persona u otra de administración):
  queda una sola licencia en todo el sistema y, después, nadie la ve (ni Mi espacio —los saldos, el Resumen, la lista, la agenda propia, lo que ven los compañeros, el email de vencimiento y la cuenta de las licencias que incluye un feriado—, ni las Notas Digitales, la auditoría o Correos → Estado).
  `anularLicencia` (`controllers/licenciasController.js`), después de un `anularLicenciaDe` sin rechazo y antes del `commit`, en la misma transacción y con su conexión (que ya pasó por `bloquearUsuarios`: las escrituras de Mi espacio bloquean primero la fila de la persona o a todos los usuarios, así que no hay bloqueo mutuo), llama a `bajaPorLaAnulacion(conexion, { licenciaOficialId, hoy })` (`services/miEspacioPaso.js`:
  un `UPDATE` de las creadas activas que la apuntan con `desde` hoy o después y, después, un `COUNT(*)` de las creadas activas que siguen apuntándola; devuelve `{ borradas, quedan }`).
  No va dentro de `anularLicenciaDe`: la usan también las correcciones y los borrados de Mi espacio (`aplicarCorreccion` y `aplicarBaja`), y en una corrección que anula la de Configuración (una franquicia de 7 horas que pasa a 3, una creada corregida a fechas que ya terminaron) la fila tiene que quedar activa.
  Un rechazo (el 404, o el 409 de una que ya empezó) hace rollback antes de tocar Mi espacio, y una falla antes del `commit` deshace todo.
  Las unidas no se tocan (siguen, con «Ya no está cubierta…»), y tampoco una creada que en Mi espacio ya empezó antes de hoy (3b: puede pasar si en Configuración se corrió el inicio para más adelante, y Mi espacio nunca borra sola una licencia que empezó): queda, sigue contando y avisa para revisar (ver «Mi espacio: licencias y horas extras»).
  El mensaje lo arma `mensajeDeLaAnulacion({ borradas, quedan })` (`services/licenciasReglas.js`, pura, nunca tira; solo cuentan los enteros positivos):
  «Licencia anulada» (sin fila de Mi espacio), «Licencia anulada.
  También se borró de Mi espacio.» o, si alguna quedó, «Licencia anulada.
  En Mi espacio ya había empezado: queda allá para que la persona la revise.».
  Si se dio de baja alguna, la respuesta vuelve a leer la licencia (`buscarLicenciaOficial`) y llega con `desde_mi_espacio` en false: la insignia se apaga sola (su `EXISTS` pide `activo = 1`).
  La confirmación de «Anular» la arma `textoDeLaAnulacion(l)` de `usuarios.js` (pura, texto plano para `confirm`: nada se escapa):
  «¿Anular la licencia de <nombre> (del 04/01/2027 al 15/01/2027)?» y, solo con `desde_mi_espacio` en `true` o `1`, «Se cargó desde Mi espacio: también se borra de ahí.» (`TEXTO_SE_BORRA_DE_MI_ESPACIO`, copia de la de `services/licenciasReglas.js`, atada por un test de paridad); nunca dice el tipo y no distingue el caso de 3b (lo dice el mensaje).
  Sin emails nuevos: a la persona no le llega nada, lo ve en Mi espacio (si otra persona anula una del superadmin, le sigue llegando el aviso de siempre, `avisarSiEsDelSuperadmin`).
  Lo demás de la pestaña no cambió (la edición sigue igual, sin avisos nuevos, y anular sigue pidiendo `puedeAnularse`).
  `VERSION_PANTALLAS` pasó a `'20261211'`.
  Tests:
  `licencias-reglas.test.js` (`mensajeDeLaAnulacion` con cada caso y con lo que no son cantidades, y el texto), `usuarios-frontend.test.js` (`textoDeLaAnulacion` con `desde_mi_espacio` en true, 1, false, 0, `'true'` y sin la clave, un nombre con HTML, la paridad y que `anularLicencia` pregunta con ese texto y no anula sin confirmar), `licencias-api.test.js` (la insignia que se apaga, con su mensaje, también en `?incluir_pasadas=1`, y la fila con `activo` 0;
  sin fila de Mi espacio, «Licencia anulada»), `mi-espacio-api.test.js` (ver «Mi espacio: licencias y horas extras») y `paginas.test.js` (`VERSION_PANTALLAS`).
- Las direcciones viejas (`app.js`, antes de `express.static`):
  `GET /usuarios.html` → 302 a `/configuracion.html`, sin fragmento (el navegador conserva el del link:
  `usuarios.html#licencias` llega a `configuracion.html#licencias`), y `GET /areas.html` → 302 a `/configuracion.html#areas`.
  Temporales (302), así una vuelta atrás no queda recordada en los navegadores; como van antes del estático, un `usuarios.html` o un `areas.html` que haya quedado en el servidor nunca se sirve (sin ellas, el comodín del final daría la portada sin avisar).
  `public/usuarios.html` y `public/areas.html` se borraron.
  Los dos emails al superadmin (`avisoSuperadminTemplate` y `resumenAvisosRetenidosTemplate`) abren `${RPAD_URL}/configuracion.html`, en el botón y en el texto (el botón sigue diciendo "Ver el panel de usuarios"); los ya enviados llegan por la redirección.
  El alta rápida de un área de `admin.html` dice "Los datos de contacto se completan después, en Configuración → Áreas." (`admin.js` no cambió).
- La pestaña Áreas (ver la convención de `areas.js`): la bajada, el aviso ámbar de las áreas a las que no les llega el aviso de los 40 días ("N áreas con datasets de gestión externa no tienen email cargado: no les llega el aviso de los 40 días.", con "Ver las áreas sin email", que elige el filtro "Sin email";
  la regla es la de `datasetsExternosPorArea`: algún dataset activo, de gestión externa, con «Requiere nota DGMIT» en Sí o sin dato y una frecuencia que vence, y ni email principal ni secundario;
  con la base del 24/10/2026, 6), la tarjeta "Áreas responsables" con el buscador (nombre, dependencia, emails o persona de contacto) y los filtros como botones con la cantidad del total (Todas, Municipales, Fuera del municipio, Sin email y, solo si hay, Sin datasets: ningún dataset, activo o dado de baja), y la tabla (Área y dependencia —"Depende de la …", "Depende del …" o "Sin dependencia cargada"—, Ámbito, Emails del área —sin ninguno, "Sin email:
  no recibe el aviso de los 40 días" en rojo si le toca el aviso, o "Sin email"—, Persona de contacto, Datasets —los activos— y "Editar", con `aria-label` "Editar <nombre>"), que se desplaza de costado dentro de su marco.
  El modal (`#modal-area`, 720 px) tiene cabecera, cuerpo y pie como hijos directos del `.modal`, sin `<form>` en el medio: el cuerpo se desplaza y los botones quedan siempre a la vista (en `areas.html`, con menos de unos 995 px de alto, el pie quedaba cortado).
  Tres grupos:
  El área (nombre y "Depende de", cada uno con su artículo delante;
  "Así se lee en las notas", que se actualiza mientras se escribe, sin `aria-live`; y el Ámbito, dos opciones grandes con "Municipal" elegida en un alta), Contacto del área y Persona de contacto.
  El pie dice "Se guarda al confirmar." en un alta, "Borrar el área" si no tiene datasets ni cambios pendientes que la usen, o por qué no ("Tiene N datasets: …", "Un cambio pendiente la usa: …").
  Los errores van adentro del modal (con campo, debajo del campo y el foco ahí; sin campo, un aviso arriba del cuerpo); un clic en el velo no lo cierra, como en Usuarios.
  Borrar pide confirmación en `#modal-borrar-area` (520 px, `aria-describedby="borrar-area-texto"` con la pregunta, el foco en "Cancelar"): es un borrado definitivo (`areas` no tiene `activo`;
  `proyecto_areas` se borra en cascada y `notificaciones_log.area_id` queda NULL, como siempre).
- La API de áreas y la de datasets (decisión del usuario):
  `GET /api/areas`, `/api/areas/:id`, `/api/datasets` y `/api/datasets/:id` siguen públicas y pasan por `sesionOpcional` (`middleware/auth.js`: con una sesión válida pone `req.user`, con el mismo `verificarSesion` que `authMiddleware`; con cualquier otra cosa —sin token, un token inválido o vencido, una cuenta desactivada o un error de la base— sigue como un visitante; nunca responde 401 ni 403).
  Sin una sesión de administración (`esAdmin`; el lector y el colaborador no la tienen) no van los datos de contacto, quitados con `sinCampos`: en el área, `CAMPOS_DE_CONTACTO_AREA` (los dos emails, el teléfono y el celular del área y el nombre, el teléfono y el email de la persona de contacto); en el dataset, `CAMPOS_DE_CONTACTO_DATASET` (los siete `area_*` de contacto de `DATASET_SELECT_QUERY`).
  El nombre, los artículos, la dependencia, el ámbito, `cantidad_datasets` (también en `getAreaById`, desde esta entrega) y las fechas van para todos, y `area_nombre` y `area_superior`, en el dataset.
  Con ella, `/areas` y `/areas/:id` suman `datasets_dados_de_baja`, `datasets_externos_con_nota` (la regla del aviso), `cambios_pendientes_que_la_usan` y `vista: 'administracion'`, al lado de `data` (la vista no se deduce porque falte un campo): sin la marca (por ejemplo, con la sesión vencida con la página abierta) no dibuja la tabla ni el aviso, dice "Tu sesión ya no permite ver las áreas.
  Volvé a ingresar." y deshabilita "Nueva área".
  El resto (el calendario, el selector de `admin.js`, el Generador, Métricas y Reportes y Proyectos) usa solo el id y el nombre.
  Lo que ve el lector con sesión en el Seguimiento (los emails del área en un "Email al área") y en el reporte "Por área" no cambió.
- Guardar y borrar (`controllers/areasController.js`, con las reglas puras de `services/areasReglas.js`):
  `validarArea(entrada, anterior)` → `{ datos, error }` (ninguna función tira): el nombre recortado, obligatorio en el alta y, en una edición, si viene, no vacío (hasta 200 caracteres, contados con `Array.from`); los artículos 'la' o 'el' (el de la dependencia, también null; en el alta, sin artículo, 'la'); los demás textos recortados, '' o solo espacios como NULL, con los largos del varchar (`LARGOS_AREA`);
  uno que llega como número finito se pasa a texto (`String(n)`, el 0 es "0") y se valida como texto (`opcionalComoTexto`: un teléfono mandado sin comillas no borra lo guardado, y en un email da el error de formato);
  NaN, Infinity y lo que no es un texto ni un número cuentan como vacío; los emails, con `PATRON_EMAIL` (que `services/usuariosReglas.js` ahora exporta), con el largo antes que el formato.
  El formato y el largo de todo lo que no es el nombre ni los artículos, incluida la dependencia (`area_superior`), se validan solo si el campo cambia (un dato viejo no frena una edición que no lo toca); el nombre y los artículos, siempre que vienen.
  Los errores, 400 `{ success: false, error, campo }` con `MENSAJES_AREA`; el del Ámbito conserva su forma del Generador, `{ success, error, campo, errores }` (`tests/areas-ambito-api.test.js` no cambió).
  Orden: en el alta, `validarArea` → ámbito → repetido; en la edición, 404 → `validarArea` → ámbito → repetido.
  El nombre repetido (la colación no distingue mayúsculas ni tildes; la propia área no cuenta), también por `ER_DUP_ENTRY` (dos guardados a la vez), es "Ya hay un área con ese nombre." en `nombre`, nunca un 500.
  La edición sigue siendo parcial y el alta rápida (`API.createArea({ nombre })`) sigue andando.
  Borrar cuenta todos los datasets del área (activos y dados de baja: antes contaba solo los activos y chocaba con la clave foránea, un 500) y los cambios `pendiente` cuyo `datos_nuevos.area_id` (guardado como número o como texto) es el área (aprobarlos chocaría con `fk_datasets_area`;
  `JSON_VALUE(cp.datos_nuevos, '$.area_id') = a.id`, una comparación numérica que no depende de colaciones:
  `datos_nuevos` es `utf8mb4_bin`):
  `textoNoSePuedeBorrar` da el 400 ("No se puede borrar el área: tiene N datasets (M dados de baja).
  Primero hay que pasarlos a otra área.", o el de los pendientes); un `ER_ROW_IS_REFERENCED_2` por una carrera, el 400 de `MENSAJES_AREA.enUso`.
  Un id que no es un entero positivo o que no existe da 404 "Área no encontrada" (en el GET, el PUT y el DELETE).
  Sin tablas, columnas ni migraciones.
- Tests:
  `tests/areas-reglas.test.js` (puro:
  `validarArea`, `sinCampos` y `textoNoSePuedeBorrar`), `areas-api.test.js` (Docker: quién ve el contacto en las dos APIs, de sin sesión a la cuenta desactivada, las tres cuentas, cada 400 con su campo, el dato viejo por SQL, el alta rápida, las altas simultáneas, borrar —con un dado de baja, con un alta pendiente con el `area_id` en texto y la carrera— y las direcciones viejas, con `redirect: 'manual'`), `areas-frontend.test.js` (`areas.js` en un `vm`:
  "Así se lee", el aviso, los filtros, la búsqueda, la tabla y el escapado, el pie, lo que se manda al guardar, la vista sin la marca, la paridad del mensaje y de los artículos y, con un DOM falso, la carga, el modal, borrar y Escape), `usuarios-frontend.test.js` (lee `configuracion.html`;
  la tercera pestaña y el fragmento), `paginas.test.js` (las páginas con carcasa, 14 desde Mi espacio, el menú de Administración con sus íconos, `VERSION_PANTALLAS` y `VERSION_AREAS`, el `role="status"` del aviso y de "Ninguna área coincide…", el foco visible de la vista Áreas fuera del modal, y que ya no están `usuarios.html` ni `areas.html`), `email-diseno.test.js` (los dos emails al superadmin) y `publico.test.js` (`GET /areas` sin sesión, sin contacto).

## La página: areas.js

- `areas.js` (la pestaña Áreas de Configuración; ver «Configuración»): al cargarse solo declara (`tests/areas-frontend.test.js` lo carga en un `vm`, con el `api.js` de verdad, y también con un DOM falso).
  En `configuracion.html` va después de `usuarios.js`, así que sus nombres de nivel superior no se repiten con los de `config.js`, `auth.js`, `main.js`, `api.js` ni `usuarios.js` (llevan `Area` o `Areas`:
  `escArea`, `abrirModalArea`, `pluralArea`, …; un `let` o un `const` repetido rompe el segundo script entero y una `function` repetida pisa la otra); escucha sus clics solo dentro de `#vista-areas` y de sus dos modales, y en `#btn-nueva-area` ("Nueva área", que está en el encabezado de la página, fuera de `#vista-areas`), con sus propios atributos (`data-filtro-area`, `data-editar-area`, `data-borrar-area`, `data-cerrar-area` y `data-cerrar-borrar`;
  nunca `data-ver`, `data-licencia` ni `data-vista`, que escucha `usuarios.js`), y su Escape cierra solo sus modales, primero el de borrar.
  Lo que arma HTML y lo que calcula es puro y va primero (`comoSeNombra` —"Así se lee en las notas"—, `textoDependenciaArea`, `sinAvisoDe40`, `FILTROS_AREA`, `areasVisibles` —la búsqueda, sin tildes ni mayúsculas—, `htmlDeTablaAreas`, `textoAvisoSinEmail`, `textoPieDelArea`, `cambiosDelArea` y `esVistaDeAdministracion`); lo que toca el DOM o la API va aparte, al final.
  Pide con `API.pedirJson` (GET, POST, PUT y DELETE;
  `api.js` no cambió).
  `cargarAreas` (la llama `mostrarVista` de `usuarios.js` al abrir la pestaña) pide la lista una sola vez, y con `forzar` después de guardar o borrar.
  Las cuentas de cada área (activos, dados de baja, los externos que reciben el email de los 40 días y los cambios pendientes que la usan) las manda el servidor: la pestaña solo las suma y filtra con ellas.
  Todo texto pasa por `Utils.escapeHtml` y un número va con `String`.
  Copia mínima:
  `MENSAJE_NOMBRE_AREA` (copia de `MENSAJES_AREA.nombre` de `services/areasReglas.js`, para controlar el nombre antes de enviar, atada por un test de paridad); los artículos de `comoSeNombra` y de "Depende de" (`articuloDelArea` y `deArticuloArea`, copias de `articuloDe` y `deArticulo` de `services/notasGeneradorContenido.js`, que las exporta para el test: 'el' da "el" y "del", y cualquier otro valor, también 'la' o null, "la" y "de la"), atados por un test de paridad.

## Archivos de tests

`areas-frontend.test.js`, `licencias-reglas.test.js`, `usuarios-frontend.test.js`, `licencias-api.test.js`, `mi-espacio-api.test.js`, `paginas.test.js`, `areas-ambito-api.test.js`, `areas-reglas.test.js`, `areas-api.test.js`, `email-diseno.test.js`, `publico.test.js`
