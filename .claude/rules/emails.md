---
paths:
  - "services/email*.js"
---
# Emails

Cada plantilla está en el documento de su tema: mirá «El mapa» de `CLAUDE.md`.

- Un solo remitente (`remitente()`) y un solo marco (`marcoEmail`), sin emojis; las Notas Digitales tienen su propio armado.
- Sin destinatario, `sendEmail` va a las casillas por defecto de la DGMIT: nunca se llama con una lista vacía.
- Ningún email dice el tipo de una licencia médica.
- Ningún envío real en una prueba: en local todo va a Mailpit.
