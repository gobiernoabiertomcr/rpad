# Feriados: una pestaña en Configuración para los feriados móviles, provinciales y municipales

Fecha: 26/10/2026. **Estado: pre-plan, borrador para revisar.** Salió de la charla del 26/10/2026 sobre el panel personal. Es la primera de tres entregas:
1. Feriados (este documento).
2. Mi espacio: licencias y horas extras (`2026-10-26-mi-espacio-licencias-y-horas-design.md`).
3. Mi espacio: la agenda (`2026-10-26-mi-espacio-agenda-design.md`).

**Maqueta:** `2026-10-26-mi-espacio-mockups/3-feriados.html`. Se mira con un servidor estático; el preview `maquetas-mi-espacio`, puerto 8765, sirve la carpeta. Usa el `main.css` real y datos inventados. **Las fechas de la maqueta son de ejemplo:** las que se precarguen se verifican antes contra las fuentes oficiales (sección 5). Donde la maqueta y este documento no coincidan, manda el documento.

## Por qué

El RPAD tiene una sola regla de día hábil: `esDiaHabil` (`services/notasDigitalesCalendario.js`). Considera hábiles los días de lunes a viernes, salvo los 9 feriados nacionales de fecha fija (`FERIADOS_FIJOS`). No conoce el Carnaval, Semana Santa, los feriados trasladables, los de Chubut, los de Comodoro ni los puentes. Quedó así a propósito, porque los avisos y las métricas no lo necesitaban.

Mi espacio sí lo necesita. Las vacaciones, los días de estudio y los de atención médica y familiar se cuentan en días hábiles (decisión del usuario). Una licencia de lunes a viernes con un Carnaval en el medio son 4 días, no 5.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Una tabla `feriados`** para los días no hábiles que no son los 9 fijos: los nacionales móviles y trasladables, los de Chubut, los de Comodoro y los días no laborables, como los puentes y los asuetos puntuales.
- **Una pestaña Feriados en Configuración,** la cuarta, después de Usuarios, Licencias y Áreas. Lista los feriados del año, con los 9 fijos a la vista y sin editar, y permite cargar, corregir y borrar los demás.
- **Arranca precargada con 2026 y 2027,** con las fechas verificadas contra las fuentes oficiales (decisión del usuario).
- **Reglas puras para contar días hábiles con estos feriados,** que usa Mi espacio.

**No objetivos**
- **El resto del sistema no cambia en esta etapa** (decisión del usuario): las Notas Digitales, la auditoría, los recordatorios, Métricas, el Ciclo de vida del dato y la Agenda de pedidos siguen con `esDiaHabil` y los 9 fijos. Sumarlos a cada módulo es trabajo posterior, de a uno y con sus tests (sección 8).
- No hay asuetos de medio día: un feriado es siempre el día entero (decisión del usuario).
- No hay un calendario oficial descargado de internet ni una actualización automática. Los feriados los carga administración.

**Antiobjetivos**
- **Que algo que hoy anda cambie sin que nadie lo decida.** Por ejemplo, que una reiteración salga otro día, que una cifra de Métricas se mueva o que la foto del 31/12 de un año cerrado deje de coincidir con lo que dice. `esDiaHabil` no se toca.
- Que un feriado mal cargado quede sin que se note: la pestaña muestra el día de la semana de cada fecha y avisa si cae en fin de semana.

## 1. Qué se guarda

**La tabla `feriados`:**

| Columna | Tipo |
|---|---|
| `id` | |
| `fecha` | DATE |
| `nombre` | varchar(150) |
| `tipo` | enum('nacional_movil','provincial','municipal','no_laborable') |
| `se_repite` | tinyint(1), por defecto 0 |
| `activo` | tinyint(1), por defecto 1 |
| `creado_por` | FK a `usuarios`, ON DELETE SET NULL |
| `created_at` y `updated_at` | |

- **Los tipos se muestran como:** Nacional móvil, De Chubut, De Comodoro y No laborable.
- **`se_repite`:** el feriado cae el mismo día y mes todos los años, desde el año de su `fecha` en adelante; no hacia atrás. Es para los de fecha fija que no están entre los 9 del sistema, como el aniversario de la ciudad. Los móviles se cargan año por año (decisión del usuario).
- **Baja lógica con `activo`,** como en el resto del sistema. Un feriado borrado deja de contar.
- **Sin índice único:** el mismo día puede tener dos feriados. Por ejemplo, el Jueves Santo de 2026 cae el 2/4, el mismo día que Malvinas. La API avisa si ya hay uno ese día, pero no lo impide.
- **Los 9 fijos no se guardan en la tabla:** salen de `FERIADOS_FIJOS`. La pestaña los muestra con la insignia «Fijo del sistema» y sin «Editar».

Va en una migración aditiva y repetible, `migracion-feriados.sql` (`CREATE TABLE IF NOT EXISTS`), **antes del código**, con su `rollback-feriados.sql`. Hay que seguir las cabeceras y las reglas que controla `tests/schema.test.js`. La precarga va en otro archivo, `migracion-feriados-datos.sql` (sección 5).

## 2. Las reglas

Un archivo puro nuevo, `services/feriadosReglas.js`: sin pool ni `Date` local, con fechas `'AAAA-MM-DD'`, y ninguna función tira error.

- **`feriadosDelRango(filas, desde, hasta)`:** devuelve el `Set` de fechas no hábiles del rango. Suma los 9 fijos, las filas activas sin `se_repite` y las que se repiten, proyectadas a cada año del rango desde su primer año.
- **`esDiaHabilCon(fecha, feriados)`:** lunes a viernes y fuera del `Set`.
- **`diasHabilesEntre(desde, hasta, feriados)`:** cuenta los días hábiles entre dos fechas, ambas incluidas.
- **`diasHabilesDe(desde, hasta, feriados)`:** la lista de esos días. Mi espacio la usa para repartir los días de una licencia entre años y licencias.
- **`validarFeriado(entrada)`:** devuelve `{ datos, error }`. Valida la fecha (del 01/01/2025 al 31/12 del año siguiente al de hoy), el nombre (obligatorio, hasta 150 caracteres contados con `Array.from`) y el tipo. Los mensajes van en `MENSAJES_FERIADO`.

La lectura va en `services/feriadosDatos.js` (solo lectura, consultas parametrizadas): `feriadosEntre(desde, hasta)` devuelve el `Set` de `feriadosDelRango`.

`services/notasDigitalesCalendario.js` no cambia. Si conviene, `esDiaHabilCon` puede reutilizar su lógica de fin de semana y de los fijos, siempre que `esDiaHabil` dé exactamente lo mismo que hoy. Lo comprueba un test.

## 3. La API

`controllers/feriadosController.js`, con respuestas `{ success, data?, error?, message? }`:

| Ruta | Permiso | Qué hace |
|---|---|---|
| `GET /api/feriados?anio=AAAA` | `authMiddleware`, cualquier rol con sesión | Los feriados del año: los de la tabla y los 9 fijos (con `fijo: true`), con el día de la semana y ordenados por fecha. Mi espacio y su agenda la usan. |
| `POST /api/feriados` | `authMiddleware` + `adminOnly` | Carga uno. |
| `PUT /api/feriados/:id` | `authMiddleware` + `adminOnly` | Lo corrige. |
| `DELETE /api/feriados/:id` | `authMiddleware` + `adminOnly` | Lo da de baja (`activo = 0`). |

- **Un error de validación** responde 400 con `{ success: false, error, campo }`. Un id que no es un entero positivo, o que no existe, responde 404.
- **Lo suma la entrega 2, no esta:** al cargar o corregir, la respuesta va a sumar `licencias_afectadas`, cuántas licencias de Mi espacio (de cualquier persona, ya cargadas y activas) incluyen esa fecha. Es solo un número, sin nombres ni tipos. El formulario lo va a mostrar antes de guardar («2 licencias cargadas lo incluyen: sus días hábiles se recalculan»), así que también va a hacer falta pedirlo sin guardar, con `GET /api/feriados/afectadas?fecha=`. Va en la entrega 2 porque cuenta filas de `mi_espacio_licencias`, una tabla que crea esa entrega.
- **Todas las rutas nuevas** van en las listas de `tests/permisos.test.js`.

## 4. La pestaña Feriados

Va en `configuracion.html`, como cuarta pestaña (`#feriados`). Con la convención de `areas.js`, sale de un archivo propio: `public/js/feriados.js`, que va después de `areas.js`.

**El archivo `feriados.js`:**
- Al cargarse solo declara.
- Sus nombres de nivel superior no se repiten con los de los otros scripts: llevan `Feriado` o `Feriados`.
- Escucha sus clics solo dentro de `#vista-feriados` y de sus modales.

**En `usuarios.js`:** `VISTAS`, `mostrarVista` y `vistaDeLaDireccion` suman la cuarta vista y el botón «Nuevo feriado» del encabezado. Al abrir la pestaña se llama a `cargarFeriados`.

**Qué muestra la pestaña:**
- **Arriba, un aviso azul.** En esta entrega dice: «Por ahora, estos feriados no cambian los días hábiles del sistema: las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.» La entrega 2 lo cambia por: «Por ahora, estos feriados cuentan solo para Mi espacio: los días hábiles de las licencias y los francos. Las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.»
- **La tarjeta «Feriados y días no laborables de AAAA»,** con dos controles:
  - el selector de año: el en curso y el siguiente, y los anteriores si tienen feriados cargados;
  - los filtros como botones, cada uno con su cantidad: Todos, Nacionales móviles, De Chubut, De Comodoro, No laborables y Fijos del sistema.
- **La tabla,** con Fecha (con el día de la semana), Nombre, Tipo, Se repite y «Editar»:
  - los fijos se ven en gris y sin «Editar»;
  - un feriado que coincide con otro o cae en fin de semana lleva una aclaración debajo del nombre («Cae domingo: no cambia ningún día hábil»).
- **El modal «Nuevo feriado» o «Editar feriado»:**
  - campos: fecha, nombre, tipo (cuatro opciones grandes) y la casilla «Se repite todos los años, el mismo día»;
  - desde la entrega 2, antes de guardar, cuántas licencias cargadas afecta;
  - el pie dice «Siempre el día entero»;
  - en una edición, «Borrar» pide confirmación.
- **Accesibilidad como los modales de Configuración:** el foco va al primer campo y vuelve al botón que abrió el modal, Escape cierra, cada campo con error lleva `aria-invalid` y su mensaje debajo, y un clic en el velo no cierra.

**Versiones y tests:**
- `feriados.js` lleva su `?v=` (`VERSION_FERIADOS`) y `usuarios.js` sube `VERSION_PANTALLAS`, los dos controlados por `tests/paginas.test.js`.
- `tests/feriados-frontend.test.js` carga la página en un `vm`, como `areas-frontend.test.js`.

## 5. La precarga de 2026 y 2027

**Qué se precarga.** `migracion-feriados-datos.sql` deja cargados los feriados de 2026 y 2027 que no son de los 9 fijos:
- los nacionales móviles y trasladables: Carnaval, Jueves y Viernes Santo, y el 17/6, el 17/8, el 12/10 y el 20/11 con su fecha de cada año;
- los días no laborables con fines turísticos ya decretados;
- los de Chubut y los de Comodoro, con «se repite» cuando son de fecha fija.

**Cómo se carga.** Cada `INSERT` va con `WHERE NOT EXISTS (… misma fecha y mismo nombre …)`, así el archivo se puede volver a correr. Va después de `migracion-feriados.sql`.

**Las fuentes.** Las fechas se verifican antes de escribir el SQL, y cada fila lleva un comentario con su fuente:
- la ley de feriados nacionales y el decreto anual de los días no laborables, en el Boletín Oficial;
- la ley o el decreto provincial de Chubut;
- la ordenanza o el decreto municipal de Comodoro Rivadavia.

**Lo que no está decretado.** Si a la fecha de la entrega todavía no se publicaron los puentes de 2027, no se inventan: se cargan cuando salgan, desde la pestaña.

**Lo que rige para el personal municipal** (respuesta del usuario, 26/10/2026):
- **De Chubut, con «se repite»:** la gesta galesa, el 28/7.
- **De Comodoro, con «se repite»:** el aniversario de la ciudad (23/2), el Día del Petróleo (13/12) y el Día del Empleado Municipal (8/11).
- **Los días no laborables nacionales con fines turísticos:** el municipio adhiere siempre, así que se precargan todos los decretados (tipo «No laborable»).

Las fechas fijas se verifican igual en sus fuentes antes de escribir el SQL.

## 6. Qué pasa cuando cambia un feriado

Mi espacio no guarda días hábiles: los calcula cada vez, con los feriados de ese momento. Si se carga un feriado que cae dentro de una licencia ya cargada, esa licencia pasa a contar un día menos y el saldo de su dueño sube.
- **Es el comportamiento buscado,** y desde la entrega 2 el modal lo dice antes de guardar con `licencias_afectadas`.
- **Dar de baja un feriado** hace lo contrario: la licencia pasa a contar un día más, y puede quedar sin días suficientes. Mi espacio lo muestra como un faltante, sin frenar la baja (entrega 2, sección 3.10).
- **No cambia ninguna licencia de Configuración:** esas guardan desde y hasta en días corridos.

## 7. Tests

- **`tests/feriados-reglas.test.js` (puro):**
  - `feriadosDelRango` con los fijos, con los que se repiten (desde su año y no antes) y con los dados de baja;
  - `esDiaHabilCon`, `diasHabilesEntre` y `diasHabilesDe`, con fines de semana, el cambio de año y un feriado repetido en la misma fecha;
  - `validarFeriado` en sus bordes;
  - `esDiaHabil` da lo mismo que antes en los 730 días de 2026 y 2027.
- **`tests/feriados-api.test.js` (Docker, con base propia):**
  - permisos: el lector y el colaborador pueden leer pero reciben 403 al escribir, y sin sesión la respuesta es 401;
  - cada 400 con su campo, el 404 y la baja lógica.
- **`tests/feriados-frontend.test.js`:** la tabla, los filtros con sus cantidades, el modal y el escapado de los textos.
- **`tests/schema.test.js`:** la tabla, la migración dos veces y la vuelta atrás.
- **`tests/paginas.test.js` y `tests/usuarios-frontend.test.js`:** la cuarta pestaña, el fragmento `#feriados` y las versiones.

## 8. Después: sumar los feriados al resto del sistema

Queda fuera de esta entrega, pero conviene anotar desde ya qué hay que mirar en cada módulo:
- **Notas Digitales y recordatorios.** Dejarían de salir en Carnaval o en un puente, y cambiaría el conteo de los 20 días hábiles de la reiteración y la víspera de una licencia.
- **Auditoría.** Cambiarían los días sin auditor y el canal nota o recordatorio.
- **Métricas y el Ciclo de vida del dato.** Hoy los feriados móviles cuentan como laborables a propósito. Si se cambia, se mueven las cifras del año en curso. La foto del 31/12 de un año cerrado no se modifica nunca, así que sumarlos a un año ya fotografiado haría que la pestaña y la foto digan cosas distintas.

Cada módulo, cuando toque, lleva su propia spec.

## 9. Documentación y despliegue

- **`CLAUDE.md`:**
  - la tabla nueva (pasan a 30);
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
- Se cargan cuatro tipos: nacionales móviles, de Chubut, de Comodoro y no laborables.
- Siempre el día entero.
- Los de fecha fija se marcan «se repite todos los años»; los móviles se cargan año por año.
- Arranca con 2026 y 2027 precargados.
- En esta etapa cuentan solo para Mi espacio; el resto del sistema sigue igual y se suma después, de a un módulo.
- Rigen la gesta galesa (28/7), el aniversario de Comodoro (23/2), el Día del Petróleo (13/12) y el Día del Empleado Municipal (8/11).
- El municipio adhiere siempre a los días no laborables nacionales.

**Mías (para revisar):**
- Tabla aparte, con baja lógica y sin índice único.
- `se_repite` vale desde el año de la fecha en adelante.
- Los 9 fijos no se copian a la tabla.
- Cargan y editan los feriados los mismos que entran a Configuración (`adminOnly`); los lee cualquiera con sesión.
- El modal muestra cuántas licencias de Mi espacio incluyen la fecha: solo el número, sin nombres.
- Las fechas aceptadas van del 01/01/2025 al 31/12 del año siguiente al de hoy.

## Lo que queda para quien lo construye

- Los nombres exactos de las funciones y de los mensajes.
- El diseño fino de la tabla en el teléfono.
- Si `esDiaHabilCon` reutiliza código de `notasDigitalesCalendario.js` o lo repite, siempre que `esDiaHabil` no cambie.
