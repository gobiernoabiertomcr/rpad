---
paths:
  - "services/datoQuincena*.js"
  - "controllers/datoQuincenaController.js"
  - "controllers/datoQuincenaCorreoController.js"
  - "public/js/dato-quincena.js"
  - "public/dato-quincena.html"
  - "tests/dato-quincena-*"
  - "database/updates/*dato-quincena.sql"
  - "database/updates/*dato-quincena-correo.sql"
---
# El dato de la quincena

Antes de cambiarlo, leé `docs/temas/dato-quincena.md` (el archivo: el POST de Datito, la clave, la huella, las lecturas y la lista).
Si tocás el correo (cuándo sale, la lista de personas, Reenviar, la prueba, el mail, la pestaña Correo, la corrida), leé también `docs/temas/dato-quincena-correo.md`.

- Una edición guardada no cambia: nadie la edita ni la borra desde el RPAD, y la misma clave con otro contenido es 409.
  El estado de su envío vive en otras tablas (`dato_quincena_correos`, `dato_quincena_envios`).
- El token del bot nunca va al repo, a un log ni al chat: en el servidor está solo su huella (`DATO_QUINCENA_TOKEN_SHA256`).
- El servidor arma todos los textos: la página los imprime tal cual.
- El nombre del bot es `NOMBRE_DEL_BOT` (servidor y página): no se escribe a mano en un texto ni en la plantilla del mail.
- Que un mail no salga dos veces lo garantiza la reserva de cada persona en la base, no el candado; sin direcciones ni textos de nodemailer en una respuesta.
- La corrida del correo toma el candado `rpad_dato_quincena_correo`: `tests/notificaciones.test.js` y `tests/permisos.test.js` también.
