---
paths:
  - "services/seguimiento*.js"
  - "services/notasDgmitReglas.js"
  - "controllers/{seguimiento,notasDgmit}Controller.js"
  - "public/js/seguimiento.js"
  - "tests/seguimiento-*"
  - "tests/notas-dgmit-*.test.js"
---
# Seguimiento y notas DGMIT

Antes de cambiar movimientos, ciclos, avisos, la cinta o el PDF, leé `docs/temas/seguimiento.md`.
Si toca una nota DGMIT, también `docs/temas/notas-dgmit.md`.

- `ciclosDe`, `cicloDelAviso` y `notasDgmitPorCiclo` los usan el anexo de la reiteración, Métricas, la foto y el Generador: un cambio les llega a todos.
- Lenguaje neutro: nunca «sin entregar», «sin respuesta del área» ni «atrasado»; el RPAD no le pide los datos al área.
- Una nota DGMIT no es un aviso del RPAD: no cuenta en los avisos ni cambia los ciclos.
- La hoja del PDF la usan también el anexo de la reiteración y el reporte «Por área».
