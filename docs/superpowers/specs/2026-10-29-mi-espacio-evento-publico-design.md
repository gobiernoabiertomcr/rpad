# Mi espacio: el evento Personal (Público) (diseño)

Fecha: 29/10/2026. Parte de la Agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, en producción desde el 27/10, y spec
2026-10-28-mi-espacio-agenda-onda, en producción desde el 28/10). Suma un tercer tipo de evento y cambia el nombre de los dos que
hay; lo demás de la agenda no cambia.

La maqueta que aprobó el usuario está en `docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-mockups/` (datos inventados; se
ve con `python -m http.server` en esa carpeta). Lo que eligió el usuario es lo que la maqueta muestra de entrada (el rosado, los nombres
A y la lista con «Capacitación o curso»); las otras opciones de su barra quedan como registro. Cuando la maqueta y este documento no
coinciden, manda el documento.

## 1. Qué es y por qué

Una persona de la administración cargó un turno médico como evento compartido con «Todos», para que todo el mundo supiera que ese día,
a esa hora, no iba a estar. Pasaron tres cosas que no quería:

- lo vieron 3 de las 9 personas del RPAD: «Todos» quiere decir hoy toda la administración (superadmin, admin y editor), y los lectores
  y el colaborador no ven nada compartido, no pueden compartir y no aparecen en la lista para elegir;
- los que lo vieron leyeron el título completo, con el lugar del turno (el detalle también se ve);
- a las otras dos personas de la administración les llegó «Te sumaron a un evento».

El formulario no avisaba nada de eso: el botón dice solo «Todos», y lo único que dice a quién incluye es la confirmación del borrado
(«A toda la administración le llega un email…»).

El usuario quiere poder avisar algo personal a quien elija, de cualquier rol, sin dar detalles y sin mandarle emails a nadie.

**Qué es un éxito:** que esa persona cargue su turno, elija «Todos» y «Turno médico», y que las otras 8 personas vean en su agenda
«10:00 Tomás: Turno médico» (Tomás es un nombre inventado), sin que a nadie le llegue un email y sin que nadie más que quien lo
cargó vea el título ni el detalle.

## 2. Lo que decidió el usuario (29/10/2026)

1. **Tres tipos de evento** en lugar de dos (la idea es del usuario):
   - **Personal (Privado)**: el «Solo yo» de hoy. No cambia nada.
   - **Personal (Público)**: el nuevo.
   - **Laboral**: el «Compartido» de hoy. No cambia nada, salvo textos (punto 7).
2. **Quién ve un Público**: las personas que elija quien lo carga, **«Todos»** o una por una, de la lista completa: todos los usuarios
   activos, de cualquier rol. «Todos» son todos los usuarios activos (hoy, las 9 personas).
3. **Quién lo crea**: cualquier rol, también el lector y el colaborador (que hoy solo tienen eventos personales).
4. **Qué ven los demás**: el nombre corto de quien lo cargó y un texto corto, «Tomás: Turno médico». Quien lo carga ve su título
   completo. El texto se elige de una lista o se escribe a mano, y es **obligatorio**. La lista: **Trámite personal, Turno médico, Asunto
   familiar, Fuera de la oficina** (las del usuario) y **Capacitación o curso** (de las cuatro que propuso Claude, la única que eligió),
   y al final **Otro**, para escribirlo.
5. **Puede ser cualquier cosa**, no solo una ausencia: la hora de fin sigue siendo opcional.
6. **Emails**: los dos tipos personales (Privado y Público) mandan **solo el recordatorio, y solo a quien creó el evento** (palabras del
   usuario: «deben ser enviados UNICAMENTE a la persona que crea el evento»). A los que ven un Público no les llega nada: ni la
   invitación, ni el cambio, ni la cancelación, ni el recordatorio. Lo ven en su agenda y en «Hoy y mañana» del Resumen.
7. **El «Todos» del Laboral pasa a decir «Toda la administración»** (para que no se confunda con el del Público). Solo cambian textos:
   quién lo ve y sus emails siguen como hoy.
8. **No aparece en «Hoy no están»** del Resumen: un Público puede ser cualquier cosa; «Hoy no están» sigue siendo solo de licencias.
9. **Cambiar de tipo**: pasar un Laboral a Público **no le manda nada a nadie** (es la regla de hoy para los que salen de un evento).
10. **Si se desactiva a quien cargó un Público, los demás dejan de verlo.**
11. **El color** de los Públicos de otras personas: **rosado** (de tres: violeta, rosado y gris).
12. **Los nombres**: los del usuario, «Personal (Privado)», «Personal (Público)» y «Laboral» (de dos juegos; el otro era «Solo yo»,
    «Personal, a la vista» y «Laboral»).
13. **El evento real que motivó el pedido** se convierte al tipo nuevo, en el lugar (sin borrarlo: conserva su número y el registro de
    las dos invitaciones que ya salieron), como Público con «Todos» y «Turno médico». Ese SQL nombra el turno médico de una persona
    real: va en `database/privado/`, fuera del repo, y viaja solo en el kit (sección 8).

## 3. Los tres tipos, de un vistazo

| | Personal (Privado) | Personal (Público) | Laboral |
|---|---|---|---|
| Quién lo crea | cualquier rol | cualquier rol | administración |
| Quién lo ve | quien lo creó | quien lo creó y «Todos» (todos los activos) o las personas elegidas (de todos los activos) | quien lo creó y «Toda la administración» o las personas elegidas (de la administración), como hoy |
| Qué ven los demás | nada | «Tomás: Turno médico», la fecha y las horas | todo, como hoy |
| Emails | el recordatorio, a quien lo creó | el recordatorio, a quien lo creó | como hoy: la invitación, el cambio, la cancelación y el recordatorio |
| «Mi recordatorio» de los demás | no hay | no hay | como hoy |
| Si se desactiva quien lo creó | nadie lo ve | los demás dejan de verlo | sigue para los invitados, como hoy |

Al cambiar de tipo un evento ya guardado, los emails siguen la regla de hoy: le llegan solo a los que entran a un Laboral (la invitación)
y a los que siguen en un Laboral (el cambio, si cambió el título, la fecha o una hora). Así, pasar un Laboral a Público o a Privado no
le manda nada a nadie, y pasar un Privado o un Público a Laboral le manda la invitación a la administración que entra.

## 4. El formulario («Nuevo evento» y «Editar evento»)

El de hoy (`#modal-evento`), con estos cambios (maqueta, «Abrir Nuevo evento» y «Abrir el turno de Tomás»):

- **«¿Quién lo ve?» pasa a «Tipo de evento»** y se ve para todos los roles (hoy está oculto para el lector y el colaborador), con
  opciones grandes (`.me-opcion`, `aria-pressed`):
  - Personal (Privado): «Nadie más lo ve».
  - Personal (Público): «Lo ven quienes elijas, con un texto corto».
  - Laboral: «Con la administración que elijas». Solo para administración (`Auth.isAdmin()`): el lector y el colaborador ven dos
    opciones.
  - De entrada, Personal (Privado), como hoy «Solo yo».
- **Con Personal (Público):**
  - **«Qué ven los demás»**: un grupo de pastillas, una sola elegida (`aria-pressed`), con la lista del punto 2.4 y «Otro», que muestra
    un campo de texto con su contador («0 de 60»). Al editar un Público cuyo texto no es de la lista, viene elegido «Otro» con su texto.
  - **«Así lo ven los demás:»**: la pastilla del evento tal como se va a ver en su agenda («10:00 Tomás: Turno médico», en rosado, con el
    ícono del ojo), que cambia mientras se escribe la hora o se elige el texto, con «En su agenda y en «Hoy y mañana» del Resumen. No
    ven el título ni el detalle.». Es lo único con protagonismo del formulario.
  - **«Con quién»**: el botón «Todos» y las personas de la lista completa (todos los usuarios activos, de cualquier rol, sin quien
    carga), con la ayuda «No les llega ningún email: lo ven en su agenda y en el Resumen.».
  - **El recordatorio**, con la ayuda «Te llega solo a vos.» (en lugar de «Les llega a todas las personas del evento.»).
- **Con Laboral:** como el «Compartido» de hoy, con el botón «Toda la administración» en lugar de «Todos» y la ayuda de hoy («Les llega
  un email cuando los sumás, y otro si cambiás o borrás el evento. Solo vos lo podés cambiar.»).
- **Con Personal (Privado):** como «Solo yo» hoy.
- **Los errores**, debajo de su campo, como los de hoy: «Elegí qué ven los demás.» (sin texto elegido), «Escribí qué ven los demás.»
  («Otro» vacío), «Lo que ven los demás puede tener hasta 60 caracteres.», «Elegí con quién lo compartís, o «Todos».» (Público) y
  «Elegí con quién lo compartís, o «Toda la administración».» (Laboral). Los dos de las personas tienen el mismo campo (`personas`).
- **Un evento Laboral que creó alguien que ya no es de administración** (borde abierto del cierre de la agenda: hoy, al corregirlo, se
  guarda como «Solo yo» sin avisar): el formulario muestra las tres opciones con Laboral elegida y deshabilitada, y la ayuda «Ya no
  podés compartir eventos laborales. Elegí otro tipo para guardarlo.»; «Guardar» sin otro tipo da ese error. (Decisión mía: sección 10.)

## 5. Cómo se ve

### 5.1 La grilla, «Próximos» y el día elegido del teléfono

- **Un Público tuyo**: en tinta, como lo «Solo vos», con el ícono `eye` de Lucide (decorativo, `aria-hidden`: el ojo quiere decir
  siempre «lo ven otros») y su título completo. En «Próximos» y en el día elegido, debajo: «Lo ven todos como «Turno médico»», «Lo ve
  Julián como «…»», «Lo ven Julián y Lucía como «…»» o «Lo ven 4 personas como «…»» (con los nombres cortos).
- **Un Público de otra persona**: en rosado, con el ojo, y «Tomás: Turno médico» como título (la hora en negrita delante, como los
  demás eventos). En «Próximos», sin insignia de quién lo ve.
- **Un Laboral**: en violeta con las dos personas, como hoy, con «Con toda la administración», «Con Carla» o «Con 2 personas» (el
  tuyo) y «De Julián» (el de otra persona).
- **Un Privado**: como hoy lo «Solo vos».
- **El teléfono**: el Público de otra persona es un **anillo** rosado (no un punto), así no se distingue solo por el color.
- **El rosado** (tokens nuevos del `<style>` de `mi-espacio.html`): `--sg-rosado: #8A3B5C` (texto: 6,00:1 sobre `--sg-rosado-fondo` y
  7,34:1 sobre blanco), `--sg-rosado-fondo: #F7E3EC` y `--sg-rosado-borde: #B5577F` (3,70:1 contra su fondo, y el anillo del teléfono
  3,80:1 o más contra la celda). El constructor vuelve a medir todo contraste nuevo: texto ≥ 4,5:1 y bordes, puntos y anillos ≥ 3:1.

### 5.2 La leyenda

«Solo vos», «Tuyos, a la vista» (tinta con el ojo), «Personales de otros» (rosado con el ojo), «Laborales» (era «Compartidos»), «Tus
licencias y francos», «Feriados» y «Compañeros que no están». «Laborales» y «Compañeros que no están», solo para administración (el
lector y el colaborador no pueden ver ni uno ni otro).

### 5.3 El detalle de un evento de otra persona (`#modal-evento-ajeno`)

- **Un Público**: el título «Tomás: Turno médico», «Jueves 05/11/2026 a las 10:00», la insignia rosada con el ojo «Personal (Público)»
  y «Es un evento personal de Tomás: se ve solo lo que eligió mostrar.»; **sin «Mi recordatorio»** y con «Cerrar».
- **Un Laboral**: como hoy, con la insignia «Laboral» (era «Compartido») y «Lo creó Julián. Es para toda la administración.» o «Lo creó
  Julián. Están: vos y Carla.».

### 5.4 «Hoy y mañana» del Resumen

- Un Público de otra persona: «10:00 Tomás: Turno médico», sin nada debajo.
- Un Público tuyo: «10:00 <tu título>» y debajo «lo ven todos como «Turno médico»» (o lo que corresponda, en minúscula, como hoy «con
  todos»).
- Un Laboral tuyo: «con toda la administración» (era «con todos»).
- Lo demás de «Hoy y mañana», y del Resumen, no cambia.

### 5.5 La frase del mes

Sigue contando los eventos que ve quien mira: ahora también los Públicos de otras personas.

## 6. El servidor

### 6.1 Cómo se guarda (decisión mía, con el análisis de todos los caminos: sección 10)

Un Público se guarda con **`compartido` 0 y `para_todos` 0** y columnas propias, y su audiencia en una tabla propia. Así, todos los
caminos que hoy deciden emails y visibilidad (`ELEGIDA`, `VISIBLES`, `VISIBLES_CON_TODOS`, `audienciaDe`, `emailsDelGuardado`,
`eventosParaLaCorrida` y sus destinatarios) lo tratan como un evento personal de quien lo creó: **ningún camino viejo le puede mandar un
email a otra persona ni mostrarle el título**. Se suma solo lo nuevo:

- `mi_espacio_eventos`: `publico` tinyint(1) NOT NULL DEFAULT 0, `publico_todos` tinyint(1) NOT NULL DEFAULT 0 y `texto_publico`
  varchar(60) NULL, después de `para_todos`.
- `mi_espacio_evento_vistas` (nueva): `evento_id` y `usuario_id`, PK compuesta, las dos FK ON DELETE CASCADE. A quién se le muestra un
  Público con personas elegidas. No tiene `sin_recordatorio`: a nadie más le llega un recordatorio.
- La regla, validada por la API (sin `CHECK`): un Público lleva siempre `compartido` 0 y `para_todos` 0, `texto_publico` con 1 a 60
  caracteres, y `publico_todos` 1 o al menos una fila en la tabla nueva; un Privado o un Laboral, `publico` 0, `publico_todos` 0,
  `texto_publico` NULL y ninguna fila en la tabla nueva.
- `para_todos` sigue queriendo decir solo «toda la administración».
- Defensa: `audienciaDe` y los destinatarios de la corrida dan [] o solo a quien lo creó cuando `publico` es 1, aunque los datos
  vinieran mal (con su test).
- Pasan a ser 43 tablas.

### 6.2 Quién ve un Público

Además de lo de hoy, cualquier persona activa, de cualquier rol, ve un Público activo si quien lo creó está activo y, o es
`publico_todos`, o tiene una fila suya en `mi_espacio_evento_vistas`. «Todos» es una marca: quien se da de alta después también lo
ve. La administración no ve los Públicos de otros por ser administración: solo si la eligieron o si es para todos.

### 6.3 Qué devuelve la API a quien no lo creó

**El título, el detalle, el recordatorio y con quién más está no salen del servidor** hacia otra persona: no basta con no dibujarlos
(antiobjetivo). La consulta de los eventos de otros recorta el Público antes de armar el ítem, y el ítem (`itemDeEvento`) tiene una rama
propia: `{ id, fecha, desde, hasta, es_mio: false, compartido: false, publico: true, titulo: «Tomás: Turno médico», creador: «Tomás»,
texto_publico }`, sin `detalle`, `personas`, `recordatorio`, `mi_recordatorio`, `aviso`, `quien_texto` ni `quien_largo` (o con ellos
vacíos: el constructor elige, mientras no lleven nada del evento). El de quien lo creó suma `publico`, `publico_todos`, `texto_publico`,
`personas_ids` (los de la tabla nueva) y `quien_texto` («Lo ven todos como «Turno médico»», sección 5.1).

El nombre corto de quien cargó un Público se arma contra **todos los usuarios activos** (no solo la administración, como el de los
compañeros): lo puede crear un lector, y dos personas de cualquier rol pueden compartir el primer nombre (decisión mía).

### 6.4 La lista para elegir personas

`GET /mi-espacio/personas` queda igual (la administración, para el Laboral; 403 al lector y al colaborador). Una ruta nueva,
`GET /mi-espacio/personas/publico`, para todos los roles con sesión, devuelve todos los usuarios activos sin quien pide, `{ id, nombre,
iniciales }`, ni el email ni el rol. Es la primera vez que el lector y el colaborador ven la lista de los usuarios del RPAD (solo los
nombres).

### 6.5 El guardado

- El cuerpo suma el tipo y el texto público (el constructor elige la forma). Un cuerpo de antes, sin el tipo (una pestaña que quedó
  abierta con la página anterior), se lee como hoy: con `compartido`, Laboral; sin él, Privado.
- `validarEvento` valida también el tipo y el texto público (recortado, de 1 a 60 caracteres contados con `Array.from`, con los mensajes
  de la sección 4) y deja el primer error en el orden del formulario: título, fecha, desde, hasta, detalle, tipo, texto público, personas
  y recordatorio.
- Un Laboral de quien no es administración sigue dando 400 `sinPermiso` en `compartido`.
- Las personas de un Público se validan contra la lista de la sección 6.4 más las que ya estaban en el evento (como hoy en el Laboral);
  el id propio se saca sin error.
- Los emails del guardado siguen la regla de la sección 3, sin cambiar `emailsDelGuardado`: un Público no tiene audiencia.
- Al pasar a otro tipo, se borran las filas que ya no van: las de `mi_espacio_evento_personas` al dejar de ser Laboral (ya pasa hoy) y
  las de la tabla nueva al dejar de ser Público, y `texto_publico` queda NULL.

### 6.6 «Mi recordatorio»

`PUT /mi-espacio/eventos/:id/mi-recordatorio` sobre un Público de otra persona da 400 con `campo` null («Este evento no tiene
recordatorio para vos.») antes de escribir nada (hoy podría insertar una fila en `mi_espacio_evento_personas`).

### 6.7 La corrida de los recordatorios

No cambia: el recordatorio de un Público, como el de un Privado, le llega solo a quien lo creó, si está activo. Test: un Público con
«Todos» y recordatorio deja un solo envío, el de quien lo creó.

### 6.8 Los textos del Laboral

«Con todos» pasa a «Con toda la administración», «Es para todos.» a «Es para toda la administración.» y «con todos» de «Hoy y mañana»
a «con toda la administración», en el servidor (`services/miEspacioEventosReglas.js`) y en sus copias de la página. `MENSAJES_EVENTO`
suma los mensajes del Público y el de las personas del Laboral cambia (sección 4), con sus copias atadas por tests de paridad.

## 7. Accesibilidad

Como el resto de la agenda: los grupos de opciones con `aria-pressed` y su rótulo, los errores en el `aria-describedby` de su campo, el
contador de «Otro» fuera de la región viva (`#me-anuncio` sigue siendo la única), los íconos decorativos con `aria-hidden` y el color
nunca como lo único que distingue (el ojo, el anillo del teléfono y el texto «Tomás: …»). El nombre accesible de un Público de otra
persona en la grilla es «10:00 Tomás: Turno médico». Teclado y foco, como hoy.

## 8. La migración y el despliegue

- **La estructura** (`database/updates/migracion-mi-espacio-evento-publico.sql`, aditiva y repetible: tres `ADD COLUMN IF NOT EXISTS` y
  un `CREATE TABLE IF NOT EXISTS`) va **antes** del código, y también en `schema.sql`. Su vuelta atrás
  (`rollback-mi-espacio-evento-publico.sql`) va después de volver a los archivos anteriores: borra la tabla nueva y las tres columnas;
  los Públicos quedan como Privados de quien los creó (sin emails ni nada a la vista de otros; se pierden el texto y a quién se
  mostraba).
- **El evento real** (`database/privado/`, no versionado): un `UPDATE` de ese evento, controlado por su id, su título, su fecha, quién lo
  creó y que siga activo, compartido y para la administración, que lo deja como Público con «Todos» y «Turno médico» (`compartido` 0,
  `para_todos` 0); con una consulta de verificación al final. Se corre después del código. Su vuelta atrás, también en
  `database/privado/`, lo devuelve a compartido con la administración y va **antes** del rollback de la estructura.
  - Los datos salen del dump de producción del 29/10/2026: no hace falta pedirle nada a nadie.
  - El `UPDATE` controla que el evento siga como estaba en ese dump: si hasta el despliegue alguien lo cambió o lo borró, la
    condición no se cumple y no hace nada; la consulta de verificación lo muestra (0 filas convertidas), y PASOS lo dice.
  - Cuando se despliegue, el turno ya habrá pasado: no hace falta ninguna medida antes.
- **Antes**: tiene que estar desplegado el kit `RPAD-deploy-feriados-en-metricas` (`reportes.js?v=20261208`).
- `VERSION_MI_ESPACIO` pasa a `'20261218'`. Sin cron nuevo, sin variables de entorno nuevas y sin Run NPM Install.
- La suite de la rama corre contra una base propia, `rpad_rama_evento_para_todos` (el dump del 29/10 con la migración), con `DB_NAME`
  en el entorno (`schema.test.js` y `permisos.test.js` leen la base del `.env`): `datospublicos_mcr_rpad` no se toca. Después del
  despliegue se recarga con un dump nuevo.

## 9. No objetivos y antiobjetivos

**No objetivos:** cambiar quién ve un Laboral o sus emails; cambiar «Hoy no están» o los compañeros que no están; que los que ven un
Público tengan recordatorio; que un Público mande cualquier email a otra persona; cambiar las licencias; eventos que se repiten o de todo
el día; confirmación de asistencia.

**Antiobjetivos** (lo que haría fallar esto aunque ande):
- que el título o el detalle de un Público llegue al navegador de otra persona (aunque no se dibuje);
- que a alguien que no sea quien lo creó le llegue un email por un evento Personal;
- que un Público de una persona desactivada se siga viendo;
- que el Laboral cambie de comportamiento (quién lo ve, qué emails salen);
- que el rosado o el ojo sean lo único que distingue un Público de otra persona;
- que un nombre real o el turno real queden en el repo (el SQL del evento real va en `database/privado/`).

## 10. Decisiones mías (para que el usuario las revise)

1. **Cómo se guarda** (6.1): `compartido` 0, tres columnas y una tabla nueva, en lugar de reusar `para_todos` y
   `mi_espacio_evento_personas` o de una columna `tipo`. Reusar `para_todos` le daría dos sentidos (una consulta futura podría mostrarle
   el título a la administración) y mezclaría las filas de las personas de los dos tipos (un recordatorio apagado sobreviviría al pasar
   de Público a Laboral); una columna `tipo` duplicaría lo que ya dice `compartido` y no sería aditiva.
2. **Lo que se ve en el formulario** (4): el detalle nunca se ve en público; la fecha y las horas sí; quien lo crea ve debajo lo que ven
   los demás; se puede cambiar de tipo al editar; el texto libre tiene un largo máximo de 60 caracteres.
3. **El Laboral de alguien que ya no es de administración** (4): la opción Laboral elegida y deshabilitada, con su ayuda, en lugar de
   guardarlo como Privado sin avisar. Cierra un borde abierto del cierre de la agenda.
4. **La leyenda** (5.2): «Solo vos», «Tuyos, a la vista», «Personales de otros» y «Laborales»; el ojo es siempre «lo ven otros».
5. **El teléfono** (5.1): el anillo para los Públicos de otras personas.
6. **El nombre corto** (6.3): contra todos los usuarios activos, solo en lo del Público.
7. **La lista de personas** (6.4): una ruta nueva, en lugar de un parámetro en la de hoy (que mezclaría el 403 con el 200).
8. **«Mi recordatorio» de un Público** (6.6): 400, no 404 (quien pide ve el evento).

## 11. Lo que queda para el plan

La forma exacta del cuerpo del guardado y de los ítems, los nombres de las funciones y de las constantes nuevas (en el idioma del
archivo: `evento` o `mi_espacio_`, nunca «agenda» a secas), el reparto en tareas, la lista de tests que cambian (los de «Con todos» y
«Es para todos», las claves de los ítems, el esquema, los permisos y la página), las copias de la página con sus tests de paridad, la
actualización de CLAUDE.md (43 tablas, la sección de la agenda) y el kit con sus dos SQL privados.
