---
paths:
  - "services/{fechasDatasetReglas,registroReglas,requiereNotaReglas}.js"
  - "controllers/{dataset,cambiosPendientes,catalog}Controller.js"
  - "public/js/{admin,admin-fechas,perfil}.js"
  - "tests/{fechas-api,fechas-datos,fechas-escritura,fechas-reglas,registro-reglas,requiere-nota-api,requiere-nota-reglas,estados-api,admin-frontend,perfil-frontend,doble-verificacion}.test.js"
---
# Datasets

Antes de cambiar fechas, estados, «Registrar actualización» o «Requiere nota DGMIT», leé `docs/temas/datasets.md`.
Si tocás quién audita o Mi Perfil, también `docs/temas/auditoria.md`.

- `proxima_actualizacion` y `datos_al` son siempre el último día de un mes, con febrero en 28 también en los años bisiestos.
- `ultima_actualizacion` es «Cargado en el portal», el día de la carga; la fecha de los datos es `datos_al`.
- Todo cambio a un dataset pasa por la doble verificación; solo `aprobarCambio` lo aplica.
- El navegador no recalcula: las reglas están en `services/fechasDatasetReglas.js`, y sus copias, atadas por tests de paridad.
