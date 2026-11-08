---
paths:
  - "services/datoQuincena*.js"
  - "controllers/datoQuincenaController.js"
  - "public/js/dato-quincena.js"
  - "public/dato-quincena.html"
  - "tests/dato-quincena-*"
  - "database/updates/*dato-quincena.sql"
---
# El dato de la quincena

Antes de cambiarlo, leé `docs/temas/dato-quincena.md`.

- Una edición guardada no cambia: nadie la edita ni la borra desde el RPAD, y la misma clave con otro contenido es 409.
- El token del bot nunca va al repo, a un log ni al chat: en el servidor está solo su huella (`DATO_QUINCENA_TOKEN_SHA256`).
- El servidor arma todos los textos: la página los imprime tal cual.
