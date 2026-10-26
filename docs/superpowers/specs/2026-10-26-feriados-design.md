# Feriados: una pestaña en Configuración para los feriados móviles, provinciales y municipales

Fecha: 26/10/2026. **Estado: aprobado por el usuario el 26/10/2026.** Salió de la charla del 26/10/2026 sobre el panel personal. Es la primera de tres entregas:
1. Feriados (este documento).
2. Mi espacio: licencias y horas extras (`2026-10-26-mi-espacio-licencias-y-horas-design.md`).
3. Mi espacio: la agenda (`2026-10-26-mi-espacio-agenda-design.md`).

**Maqueta:** `2026-10-26-mi-espacio-mockups/3-feriados.html`. Se mira con un servidor estático; el preview `maquetas-mi-espacio`, puerto 8765, sirve la carpeta. Usa el `main.css` real y datos inventados. **Las fechas de la maqueta son de ejemplo:** las que se precarguen se verifican antes contra las fuentes oficiales (sección 5). Donde la maqueta y este documento no coincidan, manda el documento.

**Revisión del 26/10/2026 (segunda sesión).** Cuatro agentes leyeron el código y el usuario contestó otra ronda de preguntas. Lo que cambió:
- **Un feriado que se repite puede saltear un año.** Si un año se corre, ese año no rige y se carga el día al que se pasó (sección 1 y 3).
- **Dar de baja uno que se repite vale desde el año que se elija:** los anteriores no cambian.
- **Los trasladables guardan de qué fecha vienen** (`trasladado_de`), y la tabla lo muestra.
- **El Jueves Santo es «No laborable»,** como dice la ley, no un feriado nacional.
- **El tipo «Nacional móvil» pasa a ser «Nacional»** (`nacional`): cubre también los feriados extraordinarios, como el del 9/11/2026.
- **La precarga, con las respuestas a las dudas de las fuentes** (sección 5): el 13/12 es de Chubut y va año por año; rigen también el 30/4 y el 3/11 de Chubut; se suma el 2/1/2026.
- **La pestaña se ve como Áreas:** sus estilos, no los de la maqueta.
- Lo que corrigió el análisis del código: `validarFeriado` recibe hoy, los 9 fijos necesitan sus nombres, el aviso de «ya hay uno ese día» mira también los fijos y los que se repiten, un 29/02 no se repite, la reiteración de las Notas Digitales es a los 20 días corridos (sección 8) y los tests que también cambian (sección 7).

## Por qué

El RPAD tiene una sola regla de día hábil: `esDiaHabil` (`services/notasDigitalesCalendario.js`). Considera hábiles los días de lunes a viernes, salvo los 9 feriados nacionales de fecha fija (`FERIADOS_FIJOS`). No conoce el Carnaval, Semana Santa, los feriados trasladables, los de Chubut, los de Comodoro ni los puentes. Quedó así a propósito, porque los avisos y las métricas no lo necesitaban.

Mi espacio sí lo necesita. Las vacaciones, los días de estudio y los de atención médica y familiar se cuentan en días hábiles (decisión del usuario). Una licencia de lunes a viernes con un Carnaval en el medio son 4 días, no 5.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Una tabla `feriados`** para los días no hábiles que no son los 9 fijos: los nacionales que cambian de fecha cada año (Carnaval, Viernes Santo, los trasladables y los extraordinarios), los de Chubut, los de Comodoro y los días no laborables, como los puentes, el Jueves Santo y los asuetos puntuales.
- **Una pestaña Feriados en Configuración,** la cuarta, después de Usuarios, Licencias y Áreas. Lista los feriados del año, con los 9 fijos a la vista y sin editar, y permite cargar, corregir y dar de baja los demás.
- **Arranca precargada con 2026 y 2027,** con las fechas verificadas contra las fuentes oficiales (decisión del usuario).
- **Reglas puras para contar días hábiles con estos feriados,** que usa Mi espacio.

**No objetivos**
- **El resto del sistema no cambia en esta etapa** (decisión del usuario): las Notas Digitales, la auditoría, los recordatorios, las licencias de Configuración, Métricas, el Ciclo de vida del dato y la Agenda de pedidos siguen con `esDiaHabil` y los 9 fijos. Sumarlos a cada módulo es trabajo posterior, de a uno y con sus tests (sección 8).
- No hay asuetos de medio día: un feriado es siempre el día entero (decisión del usuario).
- No hay un calendario oficial descargado de internet ni una actualización automática. Los feriados los carga administración.

**Antiobjetivos**
- **Que algo que hoy anda cambie sin que nadie lo decida.** Por ejemplo, que una reiteración salga otro día, que una cifra de Métricas se mueva o que la foto del 31/12 de un año cerrado deje de coincidir con lo que dice. `esDiaHabil` y `FERIADOS_FIJOS` no se tocan.
- Que un feriado mal cargado quede sin que se note: la pestaña muestra el día de la semana de cada fecha y avisa si cae en fin de semana o si ese día ya es feriado.
- **Que corregir un año cambie los anteriores sin querer.** Un feriado que se corre un año o que deja de regir no toca los años que ya pasaron (decisión del usuario).

## 1. Qué se guarda

**La tabla `feriados`:**

| Columna | Tipo |
|---|---|
| `id` | |
| `fecha` | DATE. En uno que se repite, la de su primer año. |
| `nombre` | varchar(150) |
| `tipo` | enum('nacional','provincial','municipal','no_laborable') |
| `trasladado_de` | DATE NULL: la fecha original de un trasladable |
| `se_repite` | tinyint(1), por defecto 0 |
| `hasta_anio` | smallint NULL: en uno que se repite, el último año en que rige (NULL: sigue) |
| `activo` | tinyint(1), por defecto 1 |
| `creado_por` | FK a `usuarios`, ON DELETE SET NULL |
| `created_at` y `updated_at` | |

**La tabla `feriados_no_rige`:** los años en que uno que se repite no rige. `feriado_id` (FK a `feriados`, ON DELETE CASCADE) y `anio` (smallint), con PK compuesta.

- **Los tipos se muestran como:** Nacional, De Chubut, De Comodoro y No laborable.
- **`se_repite`:** el feriado cae el mismo día y mes todos los años, desde el año de su `fecha` en adelante; no hacia atrás. Es para los de fecha fija que no están entre los 9 del sistema, como el aniversario de la ciudad. Los móviles se cargan año por año (decisión del usuario).
  - **Rige** un año si ese año es igual o posterior al de su `fecha`, no pasa de `hasta_anio` y no está en `feriados_no_rige`.
  - **Si un año se corre** (por ejemplo, el municipio pasa el Día del Empleado Municipal a un lunes), ese año se marca «no rige» y se carga el día al que se pasó, como un feriado más, con `trasladado_de` (decisión del usuario).
  - **Corregir la fecha o el nombre** de uno que se repite corrige todos los años: es para los errores de carga.
  - **Un 29/02 no puede repetirse.**
- **`trasladado_de`:** opcional. Es una fecha válida, distinta de `fecha` y del mismo año. La tabla la muestra debajo del nombre: «Trasladado del miércoles 17/06» (decisión del usuario).
- **Baja lógica con `activo`,** como en el resto del sistema. Un feriado dado de baja deja de contar. **En uno que se repite, la baja vale desde el año que se elija** (decisión del usuario): se guarda como `hasta_anio` = ese año − 1, y los años anteriores no cambian. Si el año elegido es el primero, o uno anterior, la baja es entera (`activo = 0`).
- **Sin índice único:** el mismo día puede tener dos feriados. Por ejemplo, el Jueves Santo de 2026 cae el 2/4, el mismo día que Malvinas. La API avisa si ese día ya es feriado, pero no lo impide.
- **Los 9 fijos no se guardan en la tabla:** salen de `FERIADOS_FIJOS`. La pestaña los muestra con la insignia «Fijo del sistema» y sin «Editar».

Las dos tablas van en una migración aditiva y repetible, `migracion-feriados.sql` (`CREATE TABLE IF NOT EXISTS`), **antes del código**, con su `rollback-feriados.sql`, y también en `database/schema.sql`: los tests crean sus bases solo con `schema.sql`, y `tests/schema.test.js` compara `schema.sql` con la base local, así que la migración se corre también en el Docker local. Hay que seguir las cabeceras y las reglas que controla `tests/schema.test.js`. La precarga va en otro archivo, `migracion-feriados-datos.sql` (sección 5).

## 2. Las reglas

Un archivo puro nuevo, `services/feriadosReglas.js`: sin pool ni `Date` local, con fechas `'AAAA-MM-DD'`, y ninguna función tira error. Reutiliza las funciones puras de `services/notasDigitalesCalendario.js` (`esFechaIso`, `sumarDias`, `esDiaHabil`) sin cambiarlas.

- **`feriadosDelRango(filas, desde, hasta)`:** devuelve el `Set` de fechas no hábiles del rango. Suma los 9 fijos, las filas activas sin `se_repite` y las que se repiten, proyectadas a cada año del rango en que rigen (sección 1). Nunca modifica `FERIADOS_FIJOS`: trabaja con una copia.
- **`esDiaHabilCon(fecha, feriados)`:** `esFechaIso(fecha) && esDiaHabil(fecha) && !feriados.has(fecha)`. Envuelve a `esDiaHabil`: los feriados solo pueden sacar días, nunca agregarlos, y con un `Set` vacío da exactamente lo mismo que `esDiaHabil`. El control de la fecha evita el `true` que hoy da `esDiaHabil` con un texto que no es una fecha.
- **`diasHabilesDe(desde, hasta, feriados)`:** la lista de los días hábiles entre dos fechas, ambas incluidas (`[]` si `hasta` es anterior a `desde` o alguna no es una fecha). Mi espacio la usa para repartir los días de una licencia entre años y licencias.
- **`diasHabilesEntre(desde, hasta, feriados)`:** cuántos son (`diasHabilesDe(...).length`). No se reutiliza `diasHabilesTranscurridos`, que no cuenta el primer día.
- **`feriadosDelAnio(filas, anio)`:** la lista de la pestaña y de `GET /api/feriados`: los de la tabla (los que se repiten, proyectados al año, también los que ese año no rigen, marcados) y los 9 fijos con su nombre, cada uno con el día de la semana y sus aclaraciones (cae en fin de semana, coincide con otro), ordenados por fecha.
- **`NOMBRES_DE_LOS_FIJOS`:** el nombre de cada uno de los 9 fijos, por su 'MM-DD'. Un test comprueba que sus claves son exactamente las de `FERIADOS_FIJOS`.
- **`diaDeLaSemana(fecha)`:** «lunes», «martes», … Hoy no existe en el servidor.
- **`validarFeriado(entrada, hoy)`:** devuelve `{ datos, error }`. Valida la fecha (del 01/01/2025 al 31/12 del año siguiente al de hoy), el nombre (obligatorio, hasta 150 caracteres contados con `Array.from`), el tipo, `trasladado_de` y que un 29/02 no se repita. Los mensajes van en `MENSAJES_FERIADO`.

**El `Set` se pide con margen.** Las cuentas de Mi espacio («vuelve el…», el último día hábil del mes, «5 días hábiles antes») pueden salir del rango que miran: quien pide los feriados pide un margen. La entrega 2 suma a este archivo las funciones con feriados que necesite (el próximo día hábil, el último hábil del mes).

La lectura va en `services/feriadosDatos.js` (solo lectura, consultas parametrizadas): `feriadosEntre(desde, hasta)` devuelve el `Set` de `feriadosDelRango`. Como el pool no tiene `dateStrings`, las fechas se leen con `DATE_FORMAT(…, '%Y-%m-%d')` y las marcas con `Number()`.

`services/notasDigitalesCalendario.js` no cambia. Un test comprueba que `esDiaHabil` da lo mismo que hoy.

## 3. La API

`controllers/feriadosController.js`, con respuestas `{ success, data?, error?, message? }`:

| Ruta | Permiso | Qué hace |
|---|---|---|
| `GET /api/feriados?anio=AAAA` | `authMiddleware`, cualquier rol con sesión | Los feriados del año (`feriadosDelAnio`) y los años que ofrece el selector. Mi espacio y su agenda la usan. |
| `POST /api/feriados` | `authMiddleware` + `adminOnly` | Carga uno. |
| `PUT /api/feriados/:id` | `authMiddleware` + `adminOnly` | Lo corrige. |
| `PUT /api/feriados/:id/rige` | `authMiddleware` + `adminOnly` | En uno que se repite, `{ anio, rige, pasa_al }`: marca o desmarca que ese año no rige. Si llega `pasa_al`, en la misma transacción carga el día al que se pasó: el mismo nombre y tipo, sin «se repite» y con `trasladado_de`. |
| `DELETE /api/feriados/:id` | `authMiddleware` + `adminOnly` | Lo da de baja. En uno que se repite recibe `?desde=AAAA`, el año desde el que deja de regir (sección 1). |

- **Al cargar o corregir,** la respuesta trae `avisos`, que no frenan nada: «Ese día ya es feriado: Día del Veterano y de los Caídos en Malvinas (fijo del sistema).» o «Cae domingo: no cambia ningún día hábil.». Se calculan contra la proyección completa del año (los fijos, las filas activas y las que se repiten), no con un `WHERE fecha = ?`.
- **Un error de validación** responde 400 con `{ success: false, error, campo }`. Un id que no es un entero positivo, que no existe o que está dado de baja responde 404. `rige` sobre uno que no se repite responde 400.
- **Lo suma la entrega 2, no esta:** al cargar o corregir, la respuesta va a sumar `licencias_afectadas`, cuántas licencias de Mi espacio (de cualquier persona, ya cargadas y activas) incluyen esa fecha. Es solo un número, sin nombres ni tipos. El formulario lo va a mostrar antes de guardar («2 licencias cargadas lo incluyen: sus días hábiles se recalculan»), así que también va a hacer falta pedirlo sin guardar, con `GET /api/feriados/afectadas?fecha=`. Va en la entrega 2 porque cuenta filas de `mi_espacio_licencias`, una tabla que crea esa entrega.
- **Todas las rutas nuevas** van en las listas de `tests/permisos.test.js`: el `GET` en las del lector y el colaborador (corre contra la base local, que tiene que tener la tabla) y las escrituras en `RUTAS_SOLO_ADMIN`.

## 4. La pestaña Feriados

Va en `configuracion.html`, como cuarta pestaña (`#feriados`). Con la convención de `areas.js`, sale de un archivo propio: `public/js/feriados.js`, que va después de `areas.js`. **Se ve como Áreas:** usa sus estilos (`.ar-*` y los tokens del `<style>` de `configuracion.html`), no los de la maqueta, que esa página no tiene.

**El archivo `feriados.js`:**
- Al cargarse solo declara.
- Sus nombres de nivel superior no se repiten con los de los otros scripts de la página (`config.js`, `auth.js`, `main.js`, `api.js`, `usuarios.js` y `areas.js`): llevan `Feriado` o `Feriados`.
- Escucha sus clics solo dentro de `#vista-feriados` y de sus modales, y en `#btn-nuevo-feriado`, que está en el encabezado, fuera de la vista. Usa sus propios atributos (`data-filtro-feriado`, `data-editar-feriado`, …), nunca `data-ver`, `data-licencia` ni `data-vista`, que escucha `usuarios.js`, ni los de `areas.js`. Su Escape cierra solo sus modales.
- Lo que arma HTML es puro y va primero; lo que toca el DOM o la API, al final. Pide con `API.pedirJson`. Todo texto pasa por `Utils.escapeHtml`.

**En `usuarios.js`:** `VISTAS` y `mostrarVista` suman la cuarta vista y el botón «Nuevo feriado» del encabezado (`vistaDeLaDireccion` sale de `VISTAS` y no cambia). Al abrir la pestaña se llama a `cargarFeriados`.

**Qué muestra la pestaña:**
- **Arriba, un aviso azul.** En esta entrega dice: «Por ahora, estos feriados no cambian los días hábiles del sistema: las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.» La entrega 2 lo cambia por: «Por ahora, estos feriados cuentan solo para Mi espacio: los días hábiles de las licencias y los francos. Las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.»
- **La tarjeta «Feriados y días no laborables de AAAA»,** con dos controles:
  - el selector de año: el en curso y el siguiente, y los anteriores si tienen feriados cargados;
  - los filtros como botones, cada uno con su cantidad: Todos, Nacionales, De Chubut, De Comodoro, No laborables y Fijos del sistema.
- **La tabla,** con Fecha (con el día de la semana), Nombre, Tipo, Se repite y «Editar»:
  - los fijos se ven en gris y sin «Editar»;
  - debajo del nombre, sus aclaraciones: «Trasladado del miércoles 17/06», «Cae domingo: no cambia ningún día hábil» o «Cae el mismo día que un feriado fijo: no cambia nada»;
  - uno que se repite y ese año no rige se ve tachado y en gris, con «Este año no rige».
- **El modal «Nuevo feriado» o «Editar feriado»:**
  - campos: fecha (con su día de la semana al lado), nombre, tipo (cuatro opciones grandes), «Trasladado del» (opcional) y la casilla «Se repite todos los años, el mismo día»;
  - en uno que se repite, para el año que se está mirando: «En AAAA no rige» y, si se marca, «Se pasó al» (opcional), que carga el día nuevo al guardar (`PUT /api/feriados/:id/rige`);
  - desde la entrega 2, antes de guardar, cuántas licencias cargadas afecta;
  - el pie dice «Siempre el día entero»;
  - en una edición, «Dar de baja» pide confirmación; en uno que se repite, pregunta desde qué año deja de regir (de entrada, el que se está mirando) y aclara que los anteriores no cambian.
  - después de guardar, los `avisos` del servidor se muestran sin cerrar el aviso de éxito.
- **Accesibilidad como los modales de Configuración:** el foco va al primer campo y vuelve al botón que abrió el modal, Escape cierra, cada campo con error lleva `aria-invalid` y su mensaje debajo, y un clic en el velo no cierra.

**Copias mínimas, atadas por tests de paridad:** `MENSAJES_FERIADO` (para avisar en el momento; el servidor valida igual) y `diaDeLaSemana` (el día de la semana al lado de la fecha del modal).

**Versiones y tests:**
- `feriados.js` lleva su `?v=` (`VERSION_FERIADOS`) y `usuarios.js` sube `VERSION_PANTALLAS`, los dos controlados por `tests/paginas.test.js`. Los números, uno más que el más alto de hoy.
- `tests/feriados-frontend.test.js` carga la página en un `vm`, como `areas-frontend.test.js`.

## 5. La precarga de 2026 y 2027

**Qué se precarga.** `migracion-feriados-datos.sql` deja cargados los feriados de 2026 y 2027 que no son de los 9 fijos:
- los nacionales: Carnaval, Viernes Santo, el 17/6, el 17/8, el 12/10 y el 20/11 con su fecha de cada año (con `trasladado_de` si se corrieron), y el extraordinario del 9/11/2026;
- los días no laborables: el Jueves Santo y los días con fines turísticos ya decretados;
- los de Chubut y los de Comodoro, con «se repite» cuando son de fecha fija.

**Cómo se carga.**
- Cada `INSERT` va con `WHERE NOT EXISTS (… misma fecha y mismo nombre …)`, así el archivo se puede volver a correr.
- Va después de `migracion-feriados.sql`, con `SET NAMES utf8mb4` (por las tildes).
- El comentario con la fuente de cada fila va en su propio renglón, no al final del `INSERT`: `tests/schema.test.js` lee como código todo lo que está en el mismo renglón.

**Las fuentes.** Las fechas se verifican antes de escribir el SQL, y cada fila lleva un comentario con su fuente. La lista verificada queda en `2026-10-26-feriados-fuentes.md`:
- la ley de feriados nacionales y el decreto anual de los días no laborables, en el Boletín Oficial;
- la ley o el decreto provincial de Chubut;
- la ordenanza o el decreto municipal de Comodoro Rivadavia.

**Lo que no está decretado.** Si a la fecha de la entrega todavía no se publicaron los puentes de 2027, no se inventan: se cargan cuando salgan, desde la pestaña.

**Lo que rige para el personal municipal** (respuestas del usuario, 26/10/2026, después de la investigación de las fuentes):
- **De Chubut, con «se repite»:** la gesta galesa, el 28/7, que la Ley I N° 857 deja inamovible.
- **De Chubut, año por año:** el Día del Petróleo Nacional (13/12), el Plebiscito de 1902 (30/4) y la Jura de fidelidad a la Bandera de los pueblos tehuelches y mapuches (3/11). Los fija la Ley I N° 85 y, desde el 22/10/2026, la Ley I N° 857 los hace trasladables: casi todos los años cambian de día.
- **De Comodoro, con «se repite»:** el aniversario de la ciudad (23/2) y el Día del Empleado Municipal (8/11). Son asuetos que el intendente declara cada año por resolución. El año que se corre uno, se marca «no rige» y se carga «se pasó al».
- **Nacional, extraordinario:** el 9/11/2026, por la visita del Papa (DNU 1103/2026).
- **No laborables:** los días nacionales con fines turísticos (el municipio adhiere siempre, así que se precargan todos los decretados) y los asuetos municipales puntuales, como el 2/1/2026 (Res. 2809/25).
- **El 12/10** se llama como en la ley: «Día del Respeto a la Diversidad Cultural».
- **2027:** se precarga lo que la ley fija sin decreto (Carnaval, Semana Santa, los trasladables que caen de lunes a viernes, el 3/11 de Chubut y el 13/12). Lo que depende de un decreto, se carga desde la pestaña cuando salga: los días turísticos, el 20/11/2027 (cae sábado), el 30/4/2027 de Chubut, si se mueve el 13/12/2026 (cae domingo) y los asuetos municipales de fin de año.

**La lista final, con la fuente de cada fecha,** está en `2026-10-26-feriados-fuentes.md` (sección «Respuestas del usuario y lista para la precarga»): 19 filas de 2026 y 9 de 2027.

## 6. Qué pasa cuando cambia un feriado

Mi espacio no guarda días hábiles: los calcula cada vez, con los feriados de ese momento. Si se carga un feriado que cae dentro de una licencia ya cargada, esa licencia pasa a contar un día menos y el saldo de su dueño sube.
- **Es el comportamiento buscado,** y desde la entrega 2 el modal lo dice antes de guardar con `licencias_afectadas`.
- **Dar de baja un feriado** hace lo contrario: la licencia pasa a contar un día más, y puede quedar sin días suficientes. Mi espacio lo muestra como un faltante, sin frenar la baja (entrega 2, sección 3.10).
- **«No rige» y la baja de uno que se repite** cambian solo los años que tocan: los anteriores quedan como estaban.
- **No cambia ninguna licencia de Configuración:** esas guardan desde y hasta en días corridos.

## 7. Tests

- **`tests/feriados-reglas.test.js` (puro):**
  - `feriadosDelRango` con los fijos, con los que se repiten (desde su año y no antes, hasta `hasta_anio` y sin los años que no rigen) y con los dados de baja;
  - `esDiaHabilCon`, `diasHabilesEntre` y `diasHabilesDe`, con fines de semana, el cambio de año, un feriado repetido en la misma fecha y fechas que no son fechas;
  - `feriadosDelAnio`: los fijos con su nombre, las aclaraciones (fin de semana, coincide con otro, trasladado, no rige) y el orden;
  - `NOMBRES_DE_LOS_FIJOS` tiene exactamente las claves de `FERIADOS_FIJOS`, y `FERIADOS_FIJOS` sigue con los mismos 9 valores, en el mismo orden, después de usar las reglas;
  - `validarFeriado` en sus bordes, el 29/02 que se repite y `trasladado_de`;
  - **`esDiaHabil` no cambia:** en los 730 días de 2026 y 2027 da lo mismo que un oráculo propio del test (el día de la semana con `Date.UTC` y la lista literal de los 9), y los totales son 253 días hábiles en 2026 y 255 en 2027. `esDiaHabilCon(f, new Set())` da lo mismo que `esDiaHabil(f)` en esos 730 días.
- **`tests/feriados-api.test.js` (Docker, con base propia):**
  - permisos: el lector y el colaborador pueden leer pero reciben 403 al escribir, y sin sesión la respuesta es 401;
  - cada 400 con su campo, el 404, la baja lógica, la baja desde un año, «no rige» con y sin «se pasó al» (una sola transacción) y los `avisos`.
- **`tests/feriados-frontend.test.js`:** la tabla, los filtros con sus cantidades, las aclaraciones, el modal (también el de uno que se repite), el escapado de los textos y las paridades.
- **`tests/schema.test.js`:** las dos tablas en `schema.sql`, la migración dos veces y la vuelta atrás, como el bloque de Métricas.
- **Los tests existentes que cambian:**
  - `tests/paginas.test.js`: la lista exacta de scripts de `configuracion.html`, la cuarta pestaña, `VERSION_PANTALLAS`, `VERSION_FERIADOS` y la descripción de la página si cambia;
  - `tests/usuarios-frontend.test.js`: tiene escritas a mano las vistas y los botones del encabezado;
  - `tests/areas-frontend.test.js`: su test de convivencia de los scripts suma `feriados.js`;
  - `tests/permisos.test.js`: las rutas nuevas.

## 8. Después: sumar los feriados al resto del sistema

Queda fuera de esta entrega, pero conviene anotar desde ya qué hay que mirar en cada módulo. Mientras tanto conviven dos calendarios: Mi espacio cuenta con los feriados de la tabla, y el resto del sistema, con los 9 fijos. Por ejemplo, Configuración → Licencias acepta una licencia de lunes y martes de Carnaval, y Mi espacio dice que no tiene días hábiles.
- **Notas Digitales y recordatorios.** Dejarían de salir en Carnaval o en un puente. Cambiaría la víspera y la vuelta de la licencia del firmante y el rango del email de los 40 días. La reiteración no cambia: sale a los 20 días corridos (`DIAS_PARA_REITERAR`).
- **Auditoría.** Cambiarían los 5 días hábiles entre notas de auditoría, los 2 recordatorios antes de la nota, los días sin auditor y el canal nota o recordatorio.
- **Licencias de Configuración.** Los días hábiles libres de la persona autorizada y «vuelve el…».
- **Métricas y el Ciclo de vida del dato.** Hoy los feriados móviles cuentan como laborables a propósito. Si se cambia, se mueven las cifras del año en curso. La foto del 31/12 de un año cerrado no se modifica nunca, así que sumarlos a un año ya fotografiado haría que la pestaña y la foto digan cosas distintas.

Cada módulo, cuando toque, lleva su propia spec.

## 9. Documentación y despliegue

- **`CLAUDE.md`:**
  - las dos tablas nuevas (pasan a 31);
  - `feriadosReglas` y `feriadosDatos` en la Estructura;
  - la pestaña en «Configuración»;
  - la convención de `feriados.js`;
  - una línea en «Recordatorios automáticos» que aclare que `esDiaHabil` sigue sin estos feriados.
- **`README.md`:** las migraciones y su orden.
- **Despliegue:** se corre `migracion-feriados.sql` y después `migracion-feriados-datos.sql`, se suben los archivos y se reinicia la aplicación. No necesita cron.
- **Orden de las entregas:** son tres planes y tres despliegues separados. Esta entrega puede salir sola, antes de Mi espacio: no depende de ninguna tabla de las otras dos.

## Decisiones

**Del usuario (26/10/2026):**
- Los feriados se cargan en una pestaña de Configuración.
- Se cargan cuatro tipos: nacionales, de Chubut, de Comodoro y no laborables.
- Siempre el día entero.
- Los de fecha fija se marcan «se repite todos los años»; los móviles se cargan año por año.
- Arranca con 2026 y 2027 precargados.
- En esta etapa cuentan solo para Mi espacio; el resto del sistema sigue igual y se suma después, de a un módulo.
- Rigen la gesta galesa (28/7), el aniversario de Comodoro (23/2), el Día del Petróleo (13/12) y el Día del Empleado Municipal (8/11).
- El municipio adhiere siempre a los días no laborables nacionales.

**Del usuario, en la segunda sesión (26/10/2026):**
- Uno que se repite puede saltear un año: se marca «no rige» y se carga el día al que se pasó.
- Dar de baja uno que se repite vale desde el año que se elija; los anteriores no cambian.
- Los trasladables guardan de qué fecha vienen, y la tabla lo muestra.
- El tipo «Nacional móvil» pasa a ser «Nacional».
- Las dudas de las fuentes: el 13/12 es de Chubut y va año por año; rigen el 30/4 y el 3/11 de Chubut, también año por año; el aniversario y el Día del Empleado Municipal siguen con «se repite»; el 12/10 lleva el nombre de la ley; el 2/1/2026 no se trabajó (Res. 2809/25) y se precarga; y lo de 2027 que fija la ley se precarga ya.
- Aprobó las decisiones mías de la primera revisión: tabla aparte, con baja lógica y sin índice único; los 9 fijos fuera de la tabla; los cargan los que entran a Configuración (`adminOnly`) y los lee cualquiera con sesión; las fechas del 01/01/2025 al 31/12 del año siguiente al de hoy; `se_repite` desde el año de su fecha; la pestaña se ve como Áreas.

**Mías, aprobadas por el usuario en la segunda sesión (26/10/2026):**
- El modal muestra, desde la entrega 2, cuántas licencias de Mi espacio incluyen la fecha: solo el número, sin nombres.
- «No rige» se guarda en una tabla chica aparte (`feriados_no_rige`) y la baja desde un año, en `hasta_anio`.
- «Se pasó al» carga el día nuevo en la misma transacción que marca «no rige».
- Corregir la fecha o el nombre de uno que se repite corrige todos los años (es para errores de carga).
- `trasladado_de` es del mismo año que la fecha.
- Un 29/02 no puede repetirse.
- El Jueves Santo es «No laborable», como dice la ley.
- Los avisos de «ya es feriado» y «cae en fin de semana» no frenan el guardado.

## Lo que queda para quien lo construye

- Los nombres exactos de las funciones, de las rutas y de los mensajes.
- El diseño fino de la tabla en el teléfono.
- Cómo se ordenan dos feriados del mismo día.
