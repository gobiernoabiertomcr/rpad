# El dato de la quincena: la principal del equipo

Fecha: 21/11/2026. Base: main 235a840 (en producción).
Lo pidió el director de la Dirección: que la propuesta principal la defina el equipo y no Datito.
El usuario eligió cómo, mirando maquetas con el piloto 25 real (fuera del repo, `~/rpad-notas/dato-quincena-principal-equipo/maqueta/`).

## Por qué

- Datito marca una sola propuesta como `Principal` y el mail de las 8:05 la destaca, con su infografía.
- El director quiere que la principal la decida el equipo.
  El equipo puede validar la de Datito o elegir otra de las propuestas.
- El usuario quiere lograrlo sin tocar el contrato con Datito: en el RPAD conviven dos principales, la de Datito (la del JSON, como siempre) y la del equipo.
- La quiere en producción hoy, 21/11, para elegir la de la regular del lunes 23/11.
  El 23/11 es feriado: el mail de esa edición sale el martes 24/11 a las 8:05.

## Objetivos, no objetivos y anti-objetivos

- Objetivo: administración (superadmin, admin y editor) elige la principal del equipo de cualquier edición, la cambia cuando quiere y queda quién y cuándo.
- Objetivo: la principal del equipo se ve en General (una franja), en Propuestas (marcas, pastillas y la que se abre) y en la tarjeta de la lista.
- Objetivo: el mail de las 8:05 dice que su principal es la de Datito, y suma arriba un recuadro con el botón al RPAD.
- Objetivo: la agenda de la página ocupa tantas columnas como grupos trae: con todos los eventos futuros, «Lo que pasó» no deja una columna vacía.
- No objetivo: el contrato v1.4, el schema y el POST de Datito. No cambian (los controlan sus tests).
- No objetivo: el chip de Mi espacio (no nombra ninguna propuesta), un aviso por mail al elegir, subir una infografía del equipo.
- No objetivo: el historial a la vista. La base guarda cada elección, pero la página muestra solo la vigente.
- No objetivo: «Copiar la propuesta». Sigue copiando las etiquetas tal como las mandó Datito («[Principal, …]»).
- Anti-objetivo: tocar lo archivado. La edición, sus propuestas y `dato_quincena_propuestas.principal` (la marca de Datito) no cambian nunca.
- Anti-objetivo: un mail que dependa de cuándo se manda. La frase es fija: dice lo mismo antes y después de que el equipo elija, así un reintento o un reenvío salen iguales.
- Anti-objetivo: que el mail cambie en algo más que la frase y el recuadro (lo controla el resguardo).

## Enfoques

- Elegido: una tabla nueva, `dato_quincena_principal_equipo`, con una fila por elección; la vigente es la última.
  Lo archivado no cambia y queda el historial, que pidió el usuario.
- Descartado: una columna en `dato_quincena_ediciones` o reusar `dato_quincena_propuestas.principal`.
  La edición guardada no cambia, y la columna `principal` es la marca de Datito, que leen la lista y el mail.
- Descartado: elegir por el `id` de la propuesta. El detalle no lo expone y la página identifica cada propuesta por su `orden`; el UNIQUE `(edicion_id, orden)` sirve de destino a una FK compuesta.
- Elegido en General: la dirección B «Franja del equipo» (decisión del usuario).
  La portada queda como hoy, rotulada «La principal de Datito», con su infografía, y arriba va una franja con la del equipo.
- Descartado: la dirección A «Portada del equipo».
  La infografía (la de Datito) quedaba al lado de una propuesta que no era la suya.
- Elegido en el mail: una frase fija que viene del modelo (la plantilla no puede nombrar al bot).
- Descartado: que la frase lea la elección al armar el mail (dos personas podrían recibir la misma edición distinta) o congelarla en el primer envío (otra columna, para nada).

## 1. La base

Migración `database/updates/migracion-dato-quincena-principal-equipo.sql` (aditiva y repetible, sin `USE` ni `CHECK`) y su `rollback-dato-quincena-principal-equipo.sql`. También en `database/schema.sql`.

```sql
CREATE TABLE IF NOT EXISTS `dato_quincena_principal_equipo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `orden` tinyint(3) unsigned NOT NULL,
  `elegida_por` int(11) DEFAULT NULL,
  `elegida_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_dato_quincena_principal_equipo_propuesta` (`edicion_id`, `orden`),
  KEY `fk_dato_quincena_principal_equipo_usuario` (`elegida_por`),
  CONSTRAINT `fk_dato_quincena_principal_equipo_propuesta` FOREIGN KEY (`edicion_id`, `orden`)
    REFERENCES `dato_quincena_propuestas` (`edicion_id`, `orden`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_principal_equipo_usuario` FOREIGN KEY (`elegida_por`)
    REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- Una fila por elección, nunca un UPDATE ni un DELETE desde el RPAD: la vigente es la de mayor `id` de la edición.
- `elegida_at` es hora argentina (`ahoraArgentina()`), como `cambiado_at` del correo.
- Borrar una edición a mano borra sus propuestas y, en cascada, sus elecciones.
- El rollback hace `DROP TABLE IF EXISTS` y va antes que los rollbacks del dato de la quincena y del correo.
- Va antes que el código: sin la tabla, la lista y el detalle darían error.

## 2. Elegir: `PUT /api/dato-quincena/ediciones/:id/principal-equipo`

- `authMiddleware` y `adminOnly`, como la caja Correo (decisión del usuario: administración).
- Cuerpo: `{ orden: N }`.
- El orden de los controles, como `reenviarEdicion`:
  1. un id que no es un entero positivo (`idPositivo`), o una edición que no existe: 404 «No existe esa edición.»;
  2. un `orden` que no es un número entero positivo (un texto, un 0, nada), o que no es el de una propuesta de la edición: 400 «Elegí una de las propuestas de la edición.».
- En una transacción, con la fila de la edición bloqueada (`FOR UPDATE`) para que dos elecciones a la vez no se crucen:
  - si `orden` ya es el de la vigente, no escribe nada;
  - si no, inserta la fila con `elegida_por = req.user.userId` y `elegida_at = ahoraArgentina()`.
- Respuesta 200: `{ success: true, data: { cambio: true | false }, message }`.
  - Eligió la de Datito: «Quedó la de Datito como principal del equipo.».
  - Eligió otra: «Quedó la propuesta N como principal del equipo.».
  - Ya era: «La de Datito ya era la principal del equipo.» o «La propuesta N ya era la principal del equipo.».
- Un 500: «Error al guardar la principal del equipo»; en la consola, solo el código y el mensaje.
- Vale para cualquier edición, regular o piloto, y para las viejas.
- No manda ningún mail.

## 3. Lo que manda el servidor

Lo arma `services/datoQuincenaReglas.js` (Ruling 19: la página imprime). El nombre del bot sale de `NOMBRE_DEL_BOT`.

### El detalle

`detalleDeLaEdicion` recibe un parámetro nuevo, `eleccion`: la vigente (`{ orden, nombre, elegida_at }`) o `null`.
Solo el controlador `ver` la lee y la pasa; el mail no la pasa ni la usa.
El detalle suma dos claves al final, después de `archivos`:

```js
principal_datito: {            // null sin propuestas (solo con un SQL a mano)
  orden: 1,                    // la marcada como Principal o, si ninguna, la primera
  rotulo: 'La principal de Datito',
  pastilla: 'Principal de Datito',
  marca: 'Datito',
  infografia_pie: 'La infografía de la principal de Datito.',
  infografia_alt: 'Infografía de la principal de Datito: <título>'
},
principal_equipo: {
  orden: null,                 // o el orden elegido
  coincide: false,             // true si el orden elegido es el de Datito
  rotulo: 'Principal del equipo',
  pastilla: 'Principal del equipo',
  marca: 'Equipo',
  resumen: 'todavía no la eligió.',
  cifra_clave: null,
  quien: null
}
```

Los tres estados de `principal_equipo`:

| Estado | `orden` | `coincide` | `resumen` | `cifra_clave` | `quien` |
|---|---|---|---|---|---|
| Sin elegir | null | false | «todavía no la eligió.» | null | null |
| Coincide | 1 | true | «la misma de Datito (propuesta 1).» | null | «La eligió <nombre> el 23/11/2026 a las 10:12.» |
| Otra | 2 | false | «Propuesta 2 · <título>» | la de la 2 | «La eligió <nombre> el 23/11/2026 a las 10:12.» |

- `<nombre>` es el `nombre_completo` de quien eligió (el Seguimiento ya muestra quién propuso y quién aprobó a todos los roles).
- Si la cuenta se borró (`elegida_por` en null), «La eligió el equipo el 23/11/2026 a las 10:12.».
- Una elección cuyo orden ya no está en la edición no llega (la FK lo impide): se toma como sin elegir.
- `propuestas` no cambia: cada una sigue con `principal` (la de Datito) y sus etiquetas.

### La lista

`itemDeLaLista` muestra la principal que cuenta: la del equipo si eligió; si no, la de Datito.
`principal` pasa a `{ titulo, cifra_clave, rotulo }`, con `rotulo` «Principal del equipo» o «Principal de Datito».
`resto` sigue siendo el resto de las propuestas, sin la que se muestra.
`listarEdiciones` lee la vigente de cada edición con una sola consulta más.

## 4. La página

La referencia visual es la dirección B de la maqueta (`dir=B`), sin «Cambios (N)».

### General

- Arriba de la portada, a lo ancho, la franja: «<rotulo>:» en negrita y el `resumen`.
  Debajo, `cifra_clave` en chico (si hay) y `quien` (si hay).
  - Botones de la franja:
    - Sin elegir (solo administración): «Validar la de Datito» (con borde) y «Elegir otra».
    - Con elección: «Ver la propuesta», que lleva a la del equipo en Propuestas, y, para administración, «Cambiar».
- La portada queda como hoy, con `principal_datito.rotulo` en `.dq-sobre`.
  El pie y el alt de la infografía son `infografia_pie` e `infografia_alt`.
- «Ver las N propuestas» lleva a la del equipo si hay; si no, a la de Datito.
- Un lector ve la franja sin botones.

### Propuestas

- En el índice, la marca «Principal» pasa a ser dos: `principal_datito.marca` en la de Datito y `principal_equipo.marca` en la del equipo, las dos en la misma si coinciden.
  Cada una lleva su ícono y un texto oculto «Principal de …»: el color no es lo único que las distingue.
- En la propuesta que se ve:
  - la etiqueta `Principal` se muestra con `principal_datito.pastilla`;
  - la del equipo suma la pastilla `principal_equipo.pastilla`.
- Para administración, en la cabecera de cada propuesta que no es la del equipo, el botón «Elegir como principal del equipo» (guarda directo, como «Validar»).
  En la del equipo, el texto «Es la principal del equipo».
- Sin `&propuesta=`, se abre la del equipo si hay; si no, la de Datito.

### El diálogo «La principal del equipo»

- Lo abren «Elegir otra» y «Cambiar».
- HTML estático en `dato-quincena.html`, como el de «Reenviar»: velo, Escape, foco y radios en `.dq-opciones`.
- Texto: «Elegí la propuesta que el equipo va a trabajar como principal. Se puede cambiar cuando quieran.».
- Una opción por propuesta: «Propuesta N · <título>», y la de Datito con « (la de Datito)».
  Viene marcada la vigente del equipo, o ninguna.
- «Guardar» está deshabilitado mientras no hay una opción marcada y hasta la respuesta. «Cancelar» cierra.
- Después de guardar:
  - el toast con el `message` del servidor;
  - se vuelve a pedir el detalle y se redibuja en la misma pestaña y propuesta;
  - el foco vuelve a «Cambiar».
- Un error muestra el mensaje del servidor y no cierra el diálogo.

### La lista y la agenda

- La tarjeta suma arriba del título su `rotulo`, con un ícono.
- `.dq-agenda-cols`: arriba de 820 px, tantas columnas como grupos (`grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr)`); debajo, una sola, como hoy.

`dato-quincena.js?v=` sube a 20261236, con `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.

## 5. El mail

- `modeloDelMail` suma dos claves:
  - `aclaracion`: «La principal de este correo es la de Datito, no la del equipo: el equipo elige la suya en el RPAD.», armada con `NOMBRE_DEL_BOT`;
  - `recuadro: true`.
- La plantilla dibuja cada una solo si viene, así que un modelo armado a mano sin ellas sale como hoy.
- **La frase**, en HTML:
  - va justo después de la bajada, en un `<p>` como el de la bajada (`margin: 6px 0 0 0; font-size: 14px`);
  - su color es `COLORES.subtitulo` (#5A7391, 4,89:1 sobre blanco), porque el gris de la bajada no llega a 4,5:1.
- **La frase**, en el texto plano: un renglón más debajo de la bajada, en el mismo bloque.
- **El recuadro**, en HTML:
  - va después del saludo y antes de la infografía, en celeste (`COLORES.encabezado` con borde `COLORES.bordeEncabezado`, `border-radius: 6px`);
  - adentro, «Esta edición se lee mejor en el RPAD» en negrita (`COLORES.titulo`, 16px), «Las propuestas de a una, la agenda y los datasets nuevos, con todo listo para copiar.» (`COLORES.texto`, 14px) y el mismo botón «Ver la edición en el RPAD» con la misma dirección;
  - el botón del final queda.
- **El recuadro**, en el texto plano: un bloque «Esta edición se lee mejor en el RPAD: <url>» después del bloque del título.
- Sale igual en la corrida, los reintentos, los reenvíos y la prueba.
- El resguardo (`tests/dato-quincena-resguardo.test.js`) no regenera su fixture.
  Compara contra el fixture con exactamente esas dos inserciones (HTML y texto, del mail y de la prueba), en anclas que aparecen una sola vez.
- El primer envío real, el del martes 24/11, ya sale así.

## 6. La documentación

- `docs/temas/dato-quincena.md` (57,4 KB de 60) se parte.
  - Pasa a `docs/temas/dato-quincena-contrato.md`: «El POST de Datito», «La edición», «La clave, la huella y el guardado» y «El token y el interruptor».
  - Se quedan en `dato-quincena.md` el archivo, las lecturas y la página.
- Nace `docs/temas/dato-quincena-principal-equipo.md`, con esta feature.
- Se actualizan:
  - la tabla «El mapa» de `CLAUDE.md`;
  - `.claude/rules/dato-quincena.md` (sus globs y punteros), `.claude/rules/migraciones.md` y `docs/temas/despliegue.md` (el orden de las migraciones);
  - los punteros entre documentos.
- La regla «Ninguna sesión escribe: solo el POST de Datito» pasa a decir que la elección del equipo vive en su tabla.

## 7. Lo que no cambia

- El POST, el contrato, la validación de una sola `Principal`, la clave, la huella, el recibo y el 409.
- `dato_quincena_propuestas.principal` y la metadata guardada.
- El mail, salvo la frase y el recuadro; la infografía del mail y su pie.
- Mi espacio, el aviso diario y la caja Correo.

## Lo que queda al implementador

- Los nombres de las funciones nuevas y su lugar (datos, reglas, controlador).
- Los íconos de las marcas y de la franja (SVG embebidos, `aria-hidden`), con los tokens `--sg-*` de la página.
- Las anclas exactas del resguardo.
