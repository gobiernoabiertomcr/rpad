---
paths:
  - "services/datoQuincena*.js"
  - "controllers/datoQuincenaController.js"
  - "controllers/datoQuincenaCorreoController.js"
  - "controllers/datoQuincenaVotacionController.js"
  - "public/js/dato-quincena.js"
  - "public/dato-quincena.html"
  - "tests/dato-quincena-*"
  - "database/updates/*dato-quincena.sql"
  - "database/updates/*dato-quincena-correo.sql"
  - "database/updates/*dato-quincena-principal-equipo.sql"
  - "database/updates/*dato-quincena-votacion.sql"
---
# El dato de la quincena

Antes de cambiarlo, leé `docs/temas/dato-quincena.md` (el archivo: las lecturas, la lista y la página).
Si tocás el POST de Datito, la validación, la clave, la huella, el guardado, el recibo o el token, leé `docs/temas/dato-quincena-contrato.md`.
Si tocás la principal del equipo (su votación: los votos, el cierre, el PUT del voto, el sellado y su mail, la franja, las marcas, la frase y el recuadro del mail), leé `docs/temas/dato-quincena-principal-equipo.md`.
Si tocás el correo (cuándo sale, la lista de personas, Reenviar, la prueba, el mail, la pestaña Envío y votación, la corrida), leé también `docs/temas/dato-quincena-correo.md`.

- Una edición guardada no cambia: nadie la edita ni la borra desde el RPAD, y la misma clave con otro contenido es 409.
  El estado de su envío vive en otras tablas (`dato_quincena_correos`, `dato_quincena_envios`).
  La principal del equipo se vota: `dato_quincena_votos` solo recibe INSERT y la ganadora no se escribe en ninguna tabla, se calcula al leer.
  `dato_quincena_principal_equipo` solo se lee (ediciones de antes); nunca un UPDATE de la edición ni de `dato_quincena_propuestas.principal` (la de Datito).
- El token del bot nunca va al repo, a un log ni al chat: en el servidor está solo su huella (`DATO_QUINCENA_TOKEN_SHA256`).
- El servidor arma todos los textos: la página los imprime tal cual.
- El nombre del bot es `NOMBRE_DEL_BOT` (servidor y página): no se escribe a mano en un texto ni en la plantilla del mail.
- Que un mail no salga dos veces lo garantiza la reserva de cada persona en la base, no el candado; sin direcciones ni textos de nodemailer en una respuesta.
- La corrida del correo toma el candado `rpad_dato_quincena_correo` y el sellado de la votación, `rpad_dato_quincena_votacion`: `tests/notificaciones.test.js` y `tests/permisos.test.js` también.
