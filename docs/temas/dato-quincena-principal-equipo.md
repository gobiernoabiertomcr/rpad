# El dato de la quincena: la principal del equipo

Datito marca una sola propuesta de cada edición como `Principal`; el equipo puede validarla o elegir otra, y las dos conviven en el RPAD.
Administración elige la principal del equipo de cualquier edición, la cambia cuando quiere, y queda quién y cuándo.
Se ve en General, en Propuestas y en la lista, y el mail de las 8:05 aclara que su principal es la de Datito.
El contrato con Datito y el archivo son los de `docs/temas/dato-quincena-contrato.md` y `docs/temas/dato-quincena.md`.
La frase y el recuadro de la principal están en el correo (abajo, «El mail»); el resto del correo, en `docs/temas/dato-quincena-correo.md`.

Historia y motivos, en la spec:
- `docs/superpowers/specs/2026-11-21-dato-quincena-principal-equipo-design.md`

## Archivos

datoQuincenaDatos (`leerPrincipalDelEquipo`, `guardarPrincipalDelEquipo` y `listarEdiciones`, que lee la vigente de cada edición);
datoQuincenaReglas (puro: `detalleDeLaEdicion`, con la elección por parámetro, `itemDeLaLista` y los textos de la elección);
datoQuincenaController y `routes/index.js` (la ruta `PUT /api/dato-quincena/ediciones/:id/principal-equipo`);
datoQuincenaCorreoReglas (`modeloDelMail`) y emailTemplates (`datoQuincenaTemplate`): la frase y el recuadro del mail;
dato-quincena.html y dato-quincena.js (la franja, las marcas, el diálogo y la tarjeta);
`database/updates/migracion-dato-quincena-principal-equipo.sql` y `rollback-dato-quincena-principal-equipo.sql` (la tabla, en `docs/temas/base-de-datos.md`).

## La regla

- En el RPAD conviven dos principales: la de Datito, la del JSON, y la del equipo.
  Son dos cosas distintas y no se mezclan: lo archivado de Datito no cambia nunca, y lo del equipo vive en su propia tabla.
- Decisión: la elección del equipo no va en `dato_quincena_ediciones` ni en `dato_quincena_propuestas.principal`.
  La edición es inmutable, y la columna `principal` es la marca de Datito: la leen la lista y el mail, y reusarla las confundiría.
- Quién elige: administración (superadmin, admin y editor), en cualquier edición, regular o piloto, también las viejas.
  Los demás roles ven la franja y las marcas sin las acciones de elegir («Validar la de Datito», «Elegir otra», «Cambiar» y «Elegir como principal del equipo»); «Ver la propuesta», sí.
- No manda ningún mail al elegir.
- «Copiar la propuesta» sigue copiando las etiquetas tal como las mandó Datito («[Principal, …]»): la copia es de lo archivado.

## La base

- `dato_quincena_principal_equipo`, una fila por elección: `id`, `edicion_id`, `orden`, `elegida_por` y `elegida_at`.
  La vigente es la de mayor `id` de la edición: el RPAD nunca hace un UPDATE ni un DELETE, y por eso queda todo el historial.
- La FK compuesta `(edicion_id, orden)` apunta a `dato_quincena_propuestas`, cuyo `UNIQUE` sirve de destino, con `ON DELETE CASCADE`: una elección nunca nombra una propuesta que la edición no tiene.
  `elegida_por` apunta a `usuarios` con `ON DELETE SET NULL`: borrar una cuenta no borra lo que eligió.
- `elegida_at` es hora argentina (`ahoraArgentina()`), no `NOW()`.
- Decisión: la página muestra solo la vigente.
  El historial está en la base por si hace falta, pero no tiene pantalla.
- La migración es aditiva y repetible, y va antes que el código: sin la tabla, la lista y el detalle dan error.
  Su vuelta atrás va antes que las del correo y la del archivo.
  El orden, en `docs/temas/despliegue.md`.

## Elegir

- `PUT /api/dato-quincena/ediciones/:id/principal-equipo`, con `authMiddleware` y `adminOnly`.
  El cuerpo es `{ orden: N }`, el `orden` de la propuesta del detalle (la página identifica cada propuesta por su `orden`, no por su id).
- El orden de los controles:
  1. un id que no es un entero positivo (`idPositivo`) o una edición que no existe da 404 «No existe esa edición.»;
  2. un `orden` que no es un número entero positivo, o que no es el de una propuesta de la edición, da 400 «Elegí una de las propuestas de la edición.».
- Todo va en una transacción, con la fila de la edición bloqueada (`FOR UPDATE`): dos elecciones a la vez no se cruzan, gana la última y la misma elección no se repite.
- Si el `orden` ya es el de la vigente, no escribe nada; si no, inserta una fila con quien elige y la hora.
- Responde 200 con `{ cambio: true | false }` y el texto ya armado:
  «Quedó la de Datito como principal del equipo.» o «Quedó la propuesta N como principal del equipo.»;
  y, si no cambió, «La de Datito ya era la principal del equipo.» o «La propuesta N ya era la principal del equipo.».
- Un 500 dice «Error al guardar la principal del equipo»; en la consola, solo el código y el mensaje.

## Lo que manda el servidor

- `detalleDeLaEdicion` recibe la elección vigente (`{ orden, nombre, elegida_at }` o null) y suma dos claves al final del detalle, después de `archivos`: `principal_datito` y `principal_equipo`.
  Solo el controlador de `ver` la lee y la pasa: el mail no la pasa ni la usa.
- `principal_datito` trae el `orden` de la marcada como Principal (o, si ninguna, la primera), el `rotulo` «La principal de Datito», la `pastilla` y la `marca` de las propuestas, y el pie y el texto alternativo de la infografía.
  Es null sin propuestas (solo con un SQL a mano).
- `principal_equipo` trae el `orden` elegido, `coincide` (true si es el de Datito), `rotulo`, `pastilla`, `marca`, `resumen`, `cifra_clave` y `quien`.
- Los tres estados:
  - sin elegir: `orden` null, `resumen` «todavía no la eligió.», sin cifra ni `quien`;
  - coincide: `resumen` «la misma de Datito (propuesta N).», y `quien`;
  - otra: «Propuesta N · <título>», con la `cifra_clave` de esa propuesta, y `quien`.
- `quien` dice «La eligió <nombre> el 23/11/2026 a las 10:12.», con el nombre completo de quien eligió; si la cuenta se borró, «La eligió el equipo el …».
  El Seguimiento ya muestra a todos los roles quién propuso y quién aprobó cada cambio: acá es lo mismo.
- Una elección cuyo orden ya no está en la edición no llega (la FK lo impide) y se toma como sin elegir.
- `propuestas` no cambia: cada una sigue con su `principal`, el de Datito, y sus etiquetas.
- El detalle sigue siendo el mismo para todos los roles: lo que cambia por rol son los botones de la página.
- La lista: cada edición muestra la principal que cuenta, la del equipo si eligió y, si no, la de Datito.
  Su `principal` trae `{ titulo, cifra_clave, rotulo }`, con `rotulo` «Principal del equipo» o «Principal de Datito».
  `resto` sigue siendo las demás propuestas, sin la que se muestra.
  `listarEdiciones` lee la vigente de todas las ediciones con una sola consulta más.

## La página

Es la dirección B «Franja del equipo» de la maqueta que eligió el usuario.
Los textos los trae el servidor y la página los imprime, todos por `Utils.escapeHtml`.

- General: arriba de la portada, a lo ancho, una franja con el `rotulo` en negrita y el `resumen`; debajo, la `cifra_clave` en chico y `quien`, si hay.
  - Sin elegir, solo para administración: «Validar la de Datito», que guarda directo, y «Elegir otra».
  - Con elección: «Ver la propuesta», que lleva a la del equipo en Propuestas, y, solo para administración, «Cambiar».
  - Un lector ve la franja sin «Validar la de Datito», «Elegir otra» ni «Cambiar»; con una elección, «Ver la propuesta», sí.
- Decisión: la portada es la de la propuesta de Datito, con su infografía, y se rotula «La principal de Datito».
  Motivo: la infografía es la de la propuesta de Datito, y con la portada del equipo (la dirección que se descartó) quedaba al lado de una propuesta que no era la suya.
- «Ver las N propuestas» lleva a la del equipo si hay y, si no, a la de Datito.
- Propuestas:
  - en el índice, dos marcas de principal, `Datito` y `Equipo`, las dos en la misma propuesta si coinciden, cada una con su ícono y un texto oculto «Principal de …»: el color no es lo único que las distingue;
  - en la propuesta que se ve, la etiqueta `Principal` se muestra con la `pastilla` de Datito, y la del equipo suma la suya;
  - para administración, cada propuesta que no es la del equipo trae «Elegir como principal del equipo», que guarda directo, y la del equipo, el texto «Es la principal del equipo»;
  - sin `&propuesta=`, se abre la del equipo si hay y, si no, la de Datito.
- El diálogo «La principal del equipo» lo abren «Elegir otra» y «Cambiar».
  Es HTML estático de `dato-quincena.html`, como el de «Reenviar»: velo, Escape, foco y las opciones en `.dq-opciones`.
  Tab y Mayúscula+Tab no salen de ninguno de los dos.
  Lleva una opción por propuesta, «Propuesta N · <título>» y, en la de Datito, « (la de Datito)», con la vigente marcada.
  «Guardar» está deshabilitado mientras no haya una opción marcada y hasta la respuesta.
  Un error muestra el mensaje del servidor y no cierra el diálogo.
- Decisión: una elección por vez; mientras una espera su respuesta, el diálogo no se abre y los otros botones de elegir no hacen nada.
  Motivo: abierto antes de la respuesta, tendría las opciones de antes y quedaría abierto sobre la edición ya redibujada, con «Guardar» sin actualizar.
  Tampoco abre «Reenviar…»: el redibujo correría con su diálogo abierto y el foco iría a «Cambiar», detrás del velo.
- Después de guardar sale el `message` del servidor, y se vuelve a pedir el detalle y se redibuja en la misma pestaña y propuesta.
  El foco va a «Cambiar» si se eligió en General (con «Validar la de Datito» o con el diálogo), y al título de la propuesta si se eligió en Propuestas («Elegir como principal del equipo»).
- La tarjeta de la lista suma, arriba del título, el `rotulo` de la principal con un ícono.
- Decisión: la agenda ocupa tantas columnas como grupos trae (con todos los eventos futuros, «Lo que pasó» no deja una columna vacía), arriba de 820 px; debajo, una sola.

## El mail

- `modeloDelMail` suma dos claves: `aclaracion`, «La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.», y `recuadro: true`.
  La frase se arma con `NOMBRE_DEL_BOT`: la plantilla no escribe el nombre del bot.
- Decisión: la frase es fija, y dice lo mismo antes y después de que el equipo elija.
  El mail sale a las 8:05 y la elección puede no estar todavía, y un reintento, un reenvío o la prueba tienen que salir iguales al primero.
  Por eso no lee la elección al armarse (dos personas podrían recibir la misma edición distinta) ni se congela en el primer envío (otra columna, para nada).
- Decisión: la frase no dice que la del equipo sea otra, porque tiene que ser cierta en todos los envíos, también si el equipo validó la de Datito antes del mail (un lunes feriado, el mail sale el martes).
- La plantilla dibuja cada una solo si viene: un modelo armado a mano sin ellas sale como siempre.
- La frase va justo después de la bajada, en un párrafo como el de la bajada, y en el texto plano un renglón debajo de la bajada, en el mismo bloque.
- Decisión: su color es `COLORES.subtitulo` (#5A7391, 4,89:1 sobre blanco) y no el gris de la bajada, que no llega a 4,5:1.
- El recuadro va después del saludo y antes de la infografía, en celeste (`COLORES.encabezado` con su borde), con «Esta edición se lee mejor en el RPAD», la frase de qué hay en el RPAD y el mismo botón «Ver la edición en el RPAD», con la misma dirección.
  En el texto plano, un bloque «Esta edición se lee mejor en el RPAD: <dirección>» después del bloque del título.
  El botón del final queda.
- Sale igual en la corrida, los reintentos, los reenvíos y la prueba.
- Lo controla `tests/dato-quincena-resguardo.test.js`: su fixture no se regenera y compara contra el mail de antes con exactamente esas dos inserciones, en anclas que aparecen una sola vez.
  Si el mail cambia en algo más que la frase y el recuadro, ese test falla a propósito.

## Lo que no cambia

- El POST de Datito, el contrato v1.4, su validación de una sola `Principal`, la clave, la huella, el recibo y el 409.
- `dato_quincena_propuestas.principal` y la `metadata` guardada.
- El chip de Mi espacio, que no nombra ninguna propuesta, y el aviso diario.
- La caja Correo y sus rutas.
- El mail, salvo la frase y el recuadro; la infografía del mail y su pie.

## Archivos de tests

`schema.test.js`, `dato-quincena-reglas.test.js`, `dato-quincena-api.test.js`, `permisos.test.js`, `dato-quincena-frontend.test.js`, `dato-quincena-correo-reglas.test.js`, `dato-quincena-correo.test.js`, `dato-quincena-resguardo.test.js`, `email-diseno.test.js`, `paginas.test.js`
