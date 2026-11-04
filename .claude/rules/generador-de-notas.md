---
paths:
  - "services/notasGenerador*.js"
  - "services/notasWord.js"
  - "controllers/notasController.js"
  - "public/js/notas.js"
  - "tests/notas-{generador-api,generador-contenido,generador-reglas,word,word-membrete,frontend}.test.js"
  - "tests/areas-ambito-api.test.js"
---
# Generador de Notas

Antes de cambiarlo, leé `docs/temas/generador-de-notas.md`.

- No registra nada: ni el número, ni la nota, ni quién la generó.
- Los «Datos solicitados» salen del mismo cálculo que las Notas Digitales (`conPedido`): nunca otro período ni otra frecuencia.
- La vista previa y el Word salen de los mismos bloques (`construirNotaDgmit`): no pueden decir cosas distintas.
- Todo texto variable del Word pasa por `textoParaWord`: un carácter de control deja el archivo dañado.
