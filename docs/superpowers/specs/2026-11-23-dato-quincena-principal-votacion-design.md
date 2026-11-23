# El dato de la quincena: la principal del equipo se vota

Fecha: 23/11/2026. Base: main 3b6f10a (en producción).
Lo pidió el usuario: que la principal del equipo no la decida una sola persona.
Lo eligió mirando maquetas fuera del repo (`~/rpad-notas/dq-principal-votacion/`), con la edición real del 23/11 y votantes inventados.

## Por qué

- Hoy una sola persona de administración designa la principal del equipo de cada edición («Validar la de Datito», «Elegir otra», «Cambiar»; `docs/temas/dato-quincena-principal-equipo.md`).
- El usuario quiere tres cosas: que la decida más de una persona, que pueda participar más gente que administración y que el sistema diga solo cómo se resuelve, sin que alguien tenga que arbitrar.
- Votan siempre las dos personas de la Dirección; puede votar alguien más.
  Con dos votantes fijos, la mayoría es unanimidad y el empate es lo común: el desempate es parte del diseño desde el arranque.

## Objetivos, no objetivos y anti-objetivos

- Objetivo: en cada edición nueva, las personas de una lista que arma administración ordenan las propuestas; gana la que suma más puntos, con un desempate fijo.
- Objetivo: la votación cierra sola a las 12:00 del día del mail, se ve quién votó mientras está abierta y, al cerrar, la ganadora, cómo ganó y el orden de cada persona.
- Objetivo: avisos en la edición, en la tarjeta de la lista y en Mi espacio para quien no votó, y un mail a administración a las 14:00 del día del cierre con la ganadora.
- Objetivo: la pestaña «Correo» pasa a llamarse «Envío y votación», con una sola tabla de personas con «Recibe el mail» y «Vota».
- No objetivo: el contrato con Datito, su POST, su schema y su recibo (`docs/temas/dato-quincena-contrato.md`).
- No objetivo: el mail de cada edición (el de las 8:05). No lee la principal del equipo y sigue igual byte por byte (lo controla `tests/dato-quincena-resguardo.test.js`).
- No objetivo: elegir el método por edición o un interruptor entre votar y designar. Hay un solo método.
- No objetivo: corregir a mano el resultado después del cierre.
- Anti-objetivo: tocar lo archivado. La edición, sus propuestas y `dato_quincena_propuestas.principal` (la de Datito) no cambian nunca; las ediciones de antes conservan lo que se eligió a mano.
- Anti-objetivo: que alguien pueda acomodar su voto al de otra persona. Mientras la votación está abierta no se ve el orden de nadie ni cómo va.
- Anti-objetivo: que una votación cerrada vuelva a abrirse, o que su resultado cambie después.
- Anti-objetivo: que la página filtre una licencia. Quien no votó figura como «todavía no votó», esté o no de licencia.

## Enfoques

- Elegido (decisión del usuario): **todo se calcula al leer**.
  Los votos van en una tabla nueva, una fila por cada vez que alguien guarda su orden (vale la última de cada persona); la ganadora se calcula al mirar, con los votos anteriores al cierre.
  No hace falta un paso que cierre a las 12:00: pasado el cierre, el servidor rechaza votos.
  Es el criterio del correo, que calcula «Sale el …» al leer (`proximaSalida`).
- Descartado: que la votación escriba la ganadora en `dato_quincena_principal_equipo` al cerrar.
  Pedía un paso de cierre a las 12:00, una columna para distinguir votada de elegida a mano, y la página igual tenía que calcularla si esa corrida fallaba.
- Descartado: guardar el resultado en la edición o en sus propuestas (lo archivado no cambia).
- Elegido (decisión del usuario): la lista de quienes votan cada edición se fija cuando llega, como la del mail en su primera corrida.
  Quien se suma a la lista después vota desde la edición siguiente.
  Descartado: contar a quienes están en la lista al cierre, porque «Votaron 2 de 3» cambiaría si la lista cambia después.
- Elegido: un sellado en la corrida de las 14:00 (abajo, sección 6), que deja guardada la hora del cierre y manda el mail a administración.
  Motivo: el cierre se calcula con el calendario; sin el sellado, un feriado cargado después para un día que ya pasó podría reabrir una votación cerrada.
  Mi decisión, no del usuario: es la pieza mínima para cumplir el anti-objetivo de no reabrir.

## Las decisiones del usuario

- Quién vota: una lista que arma administración; las dos de la Dirección están siempre (en el sistema, son dos personas más de la lista: no hay marca de «la Dirección»).
  Puede entrar cualquier usuario activo, de cualquier rol.
- Cómo: orden de preferencia. Cada persona ordena **todas** las propuestas; con N propuestas, el 1.º puesto da N puntos y el último, 1. Gana la que suma más.
- Desempate: si la de Datito está entre las empatadas, gana; si no, la de número más bajo entre las empatadas.
- Cierre: a las 12:00 del día hábil en que sale el mail; si el mail sale a las 14:00 (la edición llegó esa mañana, después de las 8:05), a las 12:00 del día hábil siguiente.
  Hasta el cierre, cada persona cambia su orden cuando quiera.
- Lo que se ve: abierta, quién votó y quién falta, sin el orden de nadie ni cómo va; cerrada, la ganadora, cómo ganó, el orden de cada persona y los puntos.
- La designación directa desaparece. Las ediciones que llegaron antes quedan con lo que se eligió a mano (o sin elegir), sin botones.
- Avisos: la franja y la tarjeta de la lista; Mi espacio, el día del cierre, para quien está en la lista y no votó; un mail a administración a las 14:00 del día del cierre con la ganadora.
- Los pilotos se votan igual, con el mismo cierre, pero no mandan el mail del resultado.
- La forma de ordenar es la B de la maqueta, «Tocar en orden».
- Una sola tabla de personas, «Recibe el mail» y «Vota», y la pestaña «Correo» pasa a llamarse «Envío y votación».

## 1. La base

Una migración `database/updates/migracion-dato-quincena-votacion.sql` (aditiva y repetible, con la cabecera de siempre) y su `rollback-dato-quincena-votacion.sql`, también en `database/schema.sql`.
Va después de `migracion-dato-quincena-principal-equipo.sql` (fila 40 de `docs/temas/despliegue.md`); su vuelta atrás, antes de la de la principal del equipo.
Cuatro tablas, con `utf8mb4_unicode_ci`, FK con el nombre del índice igual al de la constraint, y las horas en `DATETIME` escritas con `ahoraArgentina()`:

- `dato_quincena_votantes`: la lista de hoy, como `dato_quincena_destinatarios`.
  `usuario_id` (PK, FK a `usuarios` con `ON DELETE CASCADE`), `agregado_por` (FK a `usuarios`, `ON DELETE SET NULL`) y `agregado_at`.
- `dato_quincena_votaciones`: una fila por edición que se vota, creada al llegar la edición.
  `edicion_id` (PK, FK a `dato_quincena_ediciones`, `ON DELETE CASCADE`), `creada_at`, `cierre_at` (null hasta el sellado), `sellada_at` (null hasta el sellado) y lo que haga falta para registrar el mail del resultado (sección 6).
  **Que la fila exista es lo que dice que la edición se vota**: las ediciones de antes no la tienen.
- `dato_quincena_votacion_personas`: quiénes votan esa edición, la foto de la lista al llegar.
  `id` (PK), `edicion_id` (FK a `dato_quincena_votaciones`, `ON DELETE CASCADE`), `usuario_id` (FK a `usuarios`, `ON DELETE SET NULL`) y un `UNIQUE (edicion_id, usuario_id)`.
- `dato_quincena_votos`: una fila por cada vez que alguien guarda su orden; nunca un UPDATE ni un DELETE desde el RPAD.
  `id` (PK), `persona_id` (FK a `dato_quincena_votacion_personas.id`, `ON DELETE CASCADE`), `orden` (el orden de las propuestas, de la primera a la última, como texto ASCII «2,1,4,3»; lo valida la API) y `votado_at`.
  El vigente de cada persona es su fila de mayor `id` con `votado_at` anterior al cierre.
  Mi decisión: el voto se ata a la fila de la foto, no al usuario.
  Motivo: si alguien borrara una cuenta con un SQL a mano (el RPAD no borra usuarios), la fila de la foto queda con `usuario_id` en null pero sigue juntando sus votos, y el resultado de una votación cerrada no cambia; su nombre se muestra como «Una persona que ya no está».

La migración es obligatoria y va antes que el código: sin las tablas, la lista, el detalle y el POST de Datito darían error.
`tests/schema.test.js` y `tests/permisos.test.js` leen la base del `.env`: hay que migrarla antes de la suite.

## 2. Las reglas (puras, en `services/`)

- **El cierre** (`cierreDeLaVotacion`, pura, con el calendario por parámetro): las 12:00 del primer día hábil en que la edición ya estaba en el RPAD a las 8:05, y nunca antes de su `fecha_edicion`.
  Con la llegada en hora argentina (`recibida_at` por `UNIX_TIMESTAMP`, como el resto del dato de la quincena):
  sea D el mayor entre `fecha_edicion` y el día de la llegada; si la edición llegó ese mismo día D a las 8:05 o después, D pasa al día siguiente; el cierre es el primer día hábil desde D, a las 12:00.
  Coincide con lo que pidió el usuario en todos los casos:
  - llega el lunes 23/11 (feriado) a las 9:45 → mail el martes 24/11 a las 8:05 → cierra el martes 24/11 a las 12:00;
  - llega un lunes hábil a las 10:00 → mail ese lunes a las 14:00 → cierra el martes a las 12:00;
  - llega un viernes con `fecha_edicion` del lunes siguiente → mail el lunes a las 8:05 → cierra el lunes a las 12:00;
  - lunes 07/12 (no hábil) y martes 08/12 (feriado) → mail el miércoles 09/12 a las 8:05 → cierra el miércoles 09/12 a las 12:00.
  Se calcula con el calendario de la lectura (una sola lectura por pedido) hasta que la votación se sella; después, vale `cierre_at`.
  Es independiente del envío real: un envío apagado, un mail que falló o un piloto cierran igual.
- **Abierta o cerrada**: cerrada si está sellada o si `ahoraArgentina()` es igual o posterior al cierre.
- **Sin calendario** (mi decisión): si la tabla de feriados no se pudo leer (`calendario.error !== null`) y la votación no está sellada, el cierre no se puede saber con certeza.
  Las tres lecturas (el detalle, la lista y Mi espacio) la toman como abierta y sin resultado, nunca con el orden de nadie ni la ganadora: con los 9 fijos podría dar cerrada un día que la tabla extiende, y al volver la tabla se reabriría.
  `cierre` dice «No se pudo leer el calendario: el cierre se confirma en unos minutos.», `puede_votar` es false (el PUT tampoco guarda) y Mi espacio no muestra el ítem.
- **Los puntos** (`resultadoDeLaVotacion`, pura): cada voto vigente de una persona de la foto suma, a cada propuesta, N menos su puesto más 1 (N, la cantidad de propuestas de la edición).
  Gana la de más puntos; si empatan, la de Datito (la marcada `principal` o, si ninguna, la primera) si está entre las empatadas y, si no, la de `orden` más bajo.
  Sin votos, queda la de Datito, y el texto dice «nadie votó» (no «por desempate»).
  Devuelve siempre la misma forma, como `permisoParaAuditar`: la ganadora, cómo ganó (`puntos`, `desempate` o `nadie`), los puntos de cada propuesta y los puestos de cada persona.
- Un voto cuyo `orden` no es una permutación de los `orden` de las propuestas de la edición no se guarda (lo frena la API); si igual llegara uno a la base (un SQL a mano), no cuenta.
- Todos los textos los arma el servidor, con `NOMBRE_DEL_BOT` para el nombre de Datito (Ruling 19: la página imprime).

## 3. La API

### Al llegar la edición

- En la transacción del POST de Datito, donde hoy se crea la fila del correo (`guardarEdicion`, `services/datoQuincenaDatos.js`), se crea la fila de `dato_quincena_votaciones` y la foto de `dato_quincena_votantes` en `dato_quincena_votacion_personas` (solo las personas activas).
  Regular o piloto, igual. Con la lista vacía, la votación existe igual, sin votantes, y termina como «nadie votó».
- El 200 (lo mismo otra vez) y el 409 no crean nada. El recibo no cambia.

### Votar: `PUT /api/dato-quincena/ediciones/:id/voto`

- `authMiddleware`, cualquier rol: el permiso es estar en la foto de esa edición, no el rol.
- Cuerpo: `{ orden: [2, 1, 4, 3] }`, el `orden` de cada propuesta, de la más querida a la menos.
- El orden de los controles, cada uno antes del siguiente:
  1. un id que no pasa `idPositivo` o una edición que no existe: 404 «No existe esa edición.»;
  2. una edición sin votación (una de antes): 409 «Esta edición no se vota.»;
  3. quien pide no está en la foto: 403 «No estás en la lista de quienes votan esta edición.»;
  4. la votación ya cerró: 409 «La votación ya cerró.»;
  5. un `orden` que no es una lista con cada propuesta de la edición una sola vez: 400 «Ordená todas las propuestas de la edición.».
- En una transacción, con la fila de la votación bloqueada (`FOR UPDATE`), como `guardarPrincipalDelEquipo`: si el orden es el vigente de esa persona, no escribe; si no, inserta una fila.
  El cierre se mira adentro de la transacción, con la hora de ese momento.
- Responde 200 `{ success: true, data: { cambio }, message }`, con «Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00.» (o «Tu orden ya era ese.» si no cambió).
- Si el calendario no se pudo leer (`calendario.error !== null`) y la votación no está sellada, no se puede saber el cierre con certeza: el voto no se guarda (500 «No se pudo guardar tu orden. Probá de nuevo en unos minutos.»).
- Un 500 dice un mensaje fijo; en la consola, solo el código y el mensaje del error.
- Sumarla a `tests/permisos.test.js` con el 404 del id 999999 antes de escribir.

### La principal elegida a mano: `PUT /api/dato-quincena/ediciones/:id/principal-equipo`

- Desaparece la designación directa: la ruta queda, para una pestaña abierta con la página anterior, y contesta siempre, después del 404 de una edición que no existe, 409 «La principal del equipo ahora se vota: volvé a cargar la página.».
  No escribe nada. La tabla `dato_quincena_principal_equipo` queda como está y se sigue leyendo para las ediciones de antes.

### El detalle: `GET /api/dato-quincena/ediciones/:id`

- `principal_datito` no cambia.
- `principal_equipo` mantiene su forma (`orden`, `coincide`, `rotulo`, `pastilla`, `marca`, `resumen`, `cifra_clave`, `quien`):
  - en una edición de antes, como hoy (la elección a mano vigente, o sin elegir);
  - abierta: `orden` null, `resumen` «se vota hasta el martes 24/11 a las 12:00.», sin `cifra_clave` ni `quien`;
  - cerrada: la ganadora, con `resumen` «la misma de Datito (propuesta N).» o «Propuesta N · <título>», la `cifra_clave` si no es la de Datito y `quien` null.
- Una clave nueva al final, `votacion`: null en una edición de antes y, si no:
  - `estado`: `abierta` o `cerrada`;
  - `cierre`: «Se vota hasta el martes 24/11/2026 a las 12:00.» o «La votación cerró el martes 24/11/2026 a las 12:00.»;
  - `participacion`, lo mismo para todos: «Ya votó 1 de 3: <nombre>. Faltan los votos de <nombre> y <nombre>.», «Ya votaron 3 de 3.», «Todavía no votó nadie de 3.»; cerrada, «Votaron 2 de 3: no votó <nombre>.» o «No votó nadie de 3.»; sin votantes, «No había nadie en la lista para votar.»;
  - para quien mira (`req.user.userId`): `puede_votar` (está en la foto y está abierta), `falta_tu_voto` y `tu_orden` (su orden vigente, `[{ puesto: '1.º', orden, texto: 'Propuesta 2 · <título>' }]`, o null);
  - cerrada: `resultado`, con `orden` (la ganadora), `como`, `texto` («Ganó por puntos: 10, contra 7 de la que siguió.», «Ganó por desempate: empató con la 2, con 7 puntos, y es la de Datito.», «Ganó por desempate: empató con la 3, con 7 puntos, y tiene el número más bajo.», «Nadie votó: quedó la de Datito.»), la `regla` («Cada puesto da puntos: con 4 propuestas, el 1.º da 4 y el último, 1. Si empatan, gana la de Datito; si no está entre las empatadas, la de número más bajo.») y `tabla` (null sin votos; si no, `votantes`, los nombres de quienes votaron, y `filas`, una por propuesta de más a menos puntos, cada una `{ orden, texto, de_datito, puestos, puntos, gana }`).
- El nombre de cada persona es su `nombre_completo`; el de una cuenta borrada, «Una persona que ya no está».
  Ver quién votó qué, después del cierre, es para todos los roles: el Seguimiento ya muestra a todos quién propuso y quién aprobó cada cambio.
- Decisión: el detalle deja de ser igual para todos los roles: `ver` mira `req.user` para lo de quien mira. Lo demás sigue igual para todos.
- `tests/fixtures/dato-quincena-respuestas.json` suma detalles con la votación abierta (con y sin voto de quien mira) y cerrada (por puntos, por desempate y sin votos).

### La lista: `GET /api/dato-quincena/ediciones`

- `principal` muestra la que cuenta: abierta, la de Datito con «Principal de Datito»; cerrada, la ganadora con «Principal del equipo»; en una de antes, como hoy.
- Una clave nueva en cada edición, `votacion`: null salvo abierta, `{ texto: 'Se vota hasta el mar 24/11 a las 12:00', falta_tu_voto }`.
- `listarEdiciones` suma las consultas de las votaciones, sus fotos y sus votos vigentes de todas las ediciones de la página, sin una consulta por edición.

### La pestaña «Envío y votación»: `GET /api/dato-quincena/correo` y `PUT /api/dato-quincena/correo/destinatarios`

- Siguen siendo solo de administración, con sus rutas y su dirección (`#correo`).
- El GET suma a cada persona `vota` (true si está en `dato_quincena_votantes`) y `votan_texto` («Vota 1 persona.», «Votan 3 personas.», «No vota nadie.»).
- El PUT acepta `{ usuarios: [ids], votantes: [ids] }` y reemplaza las dos listas en una sola transacción.
  Sin `votantes` (una pestaña con la página anterior), la lista de quienes votan no cambia.
  Las mismas validaciones de `usuarios` valen para `votantes` (todas activas, sin repetir).
  Su `message`: «Guardamos la lista: lo reciben 4 personas y votan 3.» (con los plurales del servidor).
- Cambiar la lista no cambia las votaciones abiertas: cada edición vota con su foto.

## 4. La página (`dato-quincena.html` y `dato-quincena.js`)

La referencia visual es la maqueta `~/rpad-notas/dq-principal-votacion/web/` con «Cómo se ordena: B · Tocar en orden».
Los textos los trae el servidor y la página los imprime, todos por `Utils.escapeHtml`.

### La franja de General

- Una edición de antes: la franja de hoy, sin botones para nadie.
- Abierta: «Principal del equipo:» y el `resumen`; debajo, `participacion` y, si hay, «Tu orden» con `tu_orden` en una lista corta.
  A la derecha, con `falta_tu_voto`, la pastilla «Falta tu voto» (sol, con el triángulo) y, con `puede_votar`, el botón «Votar» o, con voto, «Cambiar mi orden».
  Quien no está en la foto ve «Votan las personas de la lista que arma administración.», sin botón.
- Cerrada: «Principal del equipo:» y el `resumen`, la `cifra_clave` si hay, el `resultado.texto` en negrita y `participacion` con el `cierre`;
  debajo, plegado, «Ver los votos» con la `regla` y una tabla (Propuesta, una columna por quien votó, Puntos), la ganadora marcada con fondo y «Ganó» con un tilde (no solo el color), y la de Datito con su marca;
  a la derecha, «Ver la propuesta».

### Votar: el diálogo «Tu orden»

- HTML estático en `dato-quincena.html`, como el de «Reenviar»: velo, Escape, foco, Tab y Mayúscula+Tab no salen.
- Lo abren «Votar» y «Cambiar mi orden», de la franja y de cada propuesta.
- Texto: «Tocá las propuestas en orden, de la que más querés trabajar como principal a la que menos. Lo podés cambiar hasta el martes 24/11 a las 12:00.» (la fecha, del servidor).
- Una fila por propuesta, en el orden de la edición: un botón con `aria-pressed`, su puesto («1.º» o un punto si no tiene), «Propuesta N» y el título, y la marca de Datito en la suya.
  Tocar una sin puesto le da el siguiente; tocar una con puesto se lo saca y las de atrás suben.
  «Empezar de nuevo» saca todos.
  Debajo, en una región viva: «Tocá primero la que más querés trabajar.», «Te faltan 2.» o «Listo: ya están las 4.».
- Sin voto, arranca sin ningún puesto, así no empuja a dejar el orden de Datito; con voto, con el suyo.
- «Guardar mi orden», deshabilitado hasta que todas tienen puesto y hasta la respuesta; un error muestra el mensaje del servidor y no cierra.
- Después de guardar, el `message` en el toast, se vuelve a pedir el detalle y se redibuja en la misma pestaña y propuesta, con el foco en el botón que lo abrió (o su reemplazo).
- Una por vez, como la elección de hoy: mientras se guarda, el diálogo no se abre ni abre «Reenviar…».

### Propuestas

- Con la votación abierta y `puede_votar`, cada propuesta suma en su cabecera «Tu N.º» (si votó) y el botón «Votar» o «Cambiar mi orden».
  Desaparecen «Elegir como principal del equipo» y «Es la principal del equipo».
- El índice suma la marca «Tu N.º» a cada propuesta, con el estilo de las otras marcas.
- La marca y la pastilla del equipo van en la ganadora cuando cierra, como hoy en la elegida.

### La tarjeta de la lista

- Abierta: el rótulo y el título de la de Datito, y en el pie, además de la pastilla del envío, «Se vota hasta el mar 24/11 a las 12:00» (cielo, con el reloj) y, con `falta_tu_voto`, «Falta tu voto».
- Cerrada: la ganadora con «Principal del equipo».

### La pestaña «Envío y votación»

- La pestaña «Correo» se llama «Envío y votación», y el título de la página con ella, «Envío y votación - El dato de la quincena - RPAD». La dirección sigue siendo `#correo`.
- «Envío por correo» queda como está.
- Una sección nueva, «La votación de la principal del equipo», con la regla en dos párrafos (el cierre; los puntos y el desempate; lo que se ve; el mail de las 14:00 y los pilotos).
- «Quién lo recibe» pasa a ser «Las personas»: arriba, «Recibe el mail: …» y «Vota: …» en dos renglones; la tabla, Persona, Rol, Correo, «Recibe el mail» y «Vota», con una casilla en cada una; el pie, `reciben_texto` y `votan_texto` (la página los recuenta al tildar, con las copias de las reglas atadas por un test de paridad), y un solo «Guardar».

`dato-quincena.js?v=` sube a 20261238, con `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.

## 5. Mi espacio

- El día del cierre, en la agenda de quien está en la foto de una votación abierta y todavía no votó, un ítem «Votá la principal del dato de la quincena» (decisión del usuario, mirando la maqueta):
  - en la casilla del día, después del chip del dato de la quincena y antes de los eventos, «**Hasta 12:00** Votá la principal del dato de la quincena», como enlace a `dato-quincena.html?id=N`;
  - en el día elegido y en «Próximos», «Hasta 12:00» en la columna de la hora, el título, el detalle «Edición del lunes 23/11.» (sin repetir la hora) y un botón-enlace «Votar»;
  - en la leyenda, su muestra.
  Desaparece apenas vota o cuando cierra.
- Va aparte del chip del dato de la quincena, que sigue igual para todos y sin enlace: el ítem nuevo es de cada persona.
  En cobre, con el ícono `vote` de Lucide (en el teléfono, un punto cuadrado): se distingue por su ícono y su texto, no solo por el color.
  Un clic en el ítem va a la edición y no abre «Nuevo evento».
- Lo arma el servidor en `GET /api/mi-espacio/eventos` (una clave nueva, para quien pide), con los textos ya armados; la referencia visual, la maqueta `~/rpad-notas/dq-principal-votacion/mi-espacio/`.
- No va al aviso diario de la agenda ni a ningún otro mail.

## 6. El sellado y el mail de las 14:00

- La corrida de las 14:00 (`/api/cron/cambios-pendientes`) y la de las 8:05 suman un paso, aislado como `correoDelDatoQuincenaAislado` (nunca rechaza), con su propio candado (`rpad_dato_quincena_votacion`):
  sella cada votación no sellada cuyo cierre ya pasó, calculado con el calendario de la corrida.
  Sellar es guardar `cierre_at` y `sellada_at`; desde ahí, la votación ya no depende del calendario.
- Cuándo sella (mis decisiones, para que el mail salga cuando lo pidió el usuario, «a las 14 hs, cuando están los resultados»):
  - solo un día hábil y con el calendario leído (`calendario.error === null`); si no, lo deja para la corrida siguiente;
  - solo desde las 14:00 del día del cierre: la corrida de las 14:00 de ese día sella; si no pudo, la de las 8:05 del siguiente día hábil.
  - Las corridas a mano de administración (`/api/notificaciones/ejecutar` y `/api/notificaciones/cambios-pendientes`) comparten el controlador y siguen la misma regla: antes de las 14:00 del día del cierre no sellan ni mandan nada.
- En una edición **regular**, al sellar se manda el mail del resultado a administración: las personas activas con `esAdmin`, con un email válido y sin licencia oficial ese día (`deLicenciaOficial`).
  Un piloto se sella sin mail.
- Mi decisión: el mail respeta el interruptor «Envío automático» de la pestaña, que hoy dice «Apagado, las ediciones se siguen guardando acá y no sale ningún mail.».
  Con el envío apagado, la votación se sella igual, sin mail, y no se manda después al prenderlo (como el correo de una edición).
- El mail sale una sola vez por edición: se reserva con un UPDATE condicionado sobre la fila de la votación, como `reservarEnvio`.
  A quien no le llega no se le reintenta; queda en Correos → Estado («El mail de la votación del dd/mm no le llegó a N personas.»).
  Mi decisión, no del usuario: es un aviso, no la edición; el resultado está siempre en la página.
- El mail, con `plantillaSimple` (el marco de siempre, el remitente de siempre, `to` siempre):
  - asunto «La principal del equipo del lunes 23/11/2026»;
  - «Hola, <nombre>:», «Cerró la votación de El dato de la quincena del lunes 23/11/2026. La principal del equipo es esta:», un recuadro celeste con «Propuesta N» (y «La misma de Datito» si lo es), su título y su cifra clave;
  - el `resultado.texto` en negrita, la participación y el cierre; la tabla de los votos (sin votos, no va) y la regla en chico;
  - el botón «Ver la edición en el RPAD» y la nota «Te llega porque sos de administración del RPAD. Votan las personas con «Vota» tildado en la pestaña Envío y votación.».
  - La referencia visual, `~/rpad-notas/dq-principal-votacion/web/mail-resultado.html`.
- `tests/email-diseno.test.js` suma su asunto y su texto; `tests/notificaciones.test.js` y `tests/permisos.test.js` toman también el candado nuevo.
- Una votación que cierra un día y se sella en la corrida de las 8:05 del siguiente (porque la de las 14:00 no pudo) manda el mail a esa hora.

## 7. Lo que no cambia

- El POST de Datito, el contrato v1.4, la clave, la huella, el recibo, el 409 y la tabla `dato_quincena_propuestas`.
- El mail de cada edición, con su frase fija («La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.»), el recuadro y el resguardo.
  La frase sigue siendo cierta: la del equipo se elige (votando) y se ve en el RPAD.
- `dato_quincena_principal_equipo` y lo que se eligió a mano en las ediciones de antes.
- El chip del dato de la quincena en Mi espacio y el aviso diario.
- «Copiar la propuesta» (copia las etiquetas tal como las mandó Datito).

## 8. La documentación

- `docs/temas/dato-quincena-principal-equipo.md` pasa a contar la principal del equipo votada (las reglas, la API, la página, el sellado y el mail), con lo de las ediciones de antes en una sección corta; si supera el tope de `tests/documentos.test.js`, se parte (por ejemplo, el mail del resultado y el sellado en `dato-quincena-votacion.md`).
- `docs/temas/dato-quincena-correo.md`: el nombre de la pestaña, la tabla «Las personas» y el PUT con `votantes`.
- `docs/temas/dato-quincena.md`: los punteros, la clave `votacion` del detalle y de la lista, y que `ver` mira a quien pide.
- `docs/temas/base-de-datos.md` (las cuatro tablas y la cuenta), `docs/temas/despliegue.md` (el orden), `docs/temas/calendario-y-corridas.md` (el paso nuevo de las corridas), `docs/temas/mi-espacio-agenda.md` (el ítem nuevo).
- La tabla «El mapa» de `CLAUDE.md`, si nace un documento, y `.claude/rules/dato-quincena.md` (la regla de la tabla de la principal y los votos).

## Lo que queda al implementador

- Los nombres de las funciones nuevas y su lugar (`*Reglas.js` puro, `*Datos.js` con las consultas, el servicio del sellado).
- Las columnas exactas para registrar el mail del resultado en `dato_quincena_votaciones`.
- La clave de Mi espacio y su forma, con los textos del servidor.
- Los íconos (SVG embebidos de Lucide, `aria-hidden`) y los estilos con los tokens `--sg-*`.
- Los textos de los 500 y de Correos → Estado, con el tono de los de al lado.
