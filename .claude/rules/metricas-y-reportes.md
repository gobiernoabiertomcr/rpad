---
paths:
  - "services/metricas*.js"
  - "services/reportes*.js"
  - "controllers/{metricas,reportes,gestion}Controller.js"
  - "public/js/reportes.js"
  - "tests/metricas-*.test.js"
  - "tests/reportes*.test.js"
---
# Métricas y Reportes

Antes de cambiar una cifra, la foto o un PDF de reportes, leé `docs/temas/metricas-y-reportes.md`.
Si toca las etapas, también `docs/temas/ciclo-de-vida.md`.

- La foto del 31/12 no se modifica nunca y guarda textos ya armados: lo que cambie esos textos tiene que estar en producción antes del 10/01.
- Cambiar la forma de la foto obliga a subir `VERSION_DE_LA_FOTO` o a leer con tolerancia.
- Un cambio a propósito en un PDF de Métricas o del Informe anual obliga a retomar `REFERENCIA_DE_LOS_PDF`.
- Métricas y la foto nunca cuentan con los 9 fijos por una falla (`exigirLaTabla`).
- Lenguaje neutro: nunca «tardanza», «demora» ni «atraso»; sin nota cargada es «pendiente de carga».
