---
paths:
  - "public/configuracion.html"
  - "public/js/{usuarios,areas,feriados}.js"
  - "controllers/{usuarios,licencias,areas,feriados}Controller.js"
  - "services/{licenciasReglas,licenciasOficialesService,areasReglas,usuariosReglas}.js"
  - "tests/{usuarios-frontend,usuarios-panel,usuarios-reglas,editor-panel,licencias-api,licencias-reglas,areas-reglas,areas-api,areas-frontend,feriados-api,feriados-frontend,feriados-reglas}.test.js"
---
# Configuración

Antes de cambiar usuarios, licencias o áreas, leé `docs/temas/configuracion.md`.
Si tocás la pestaña Feriados, leé `docs/temas/feriados.md`.

- `services/licenciasOficialesService.js` lo comparten Configuración y Mi espacio: recibe la conexión de una transacción abierta, no la abre ni la cierra.
- Los datos de contacto de un área solo los recibe una sesión de administración.
- Comparar roles siempre con `esAdmin`, `esAuditor` o `puedeCargarNotasDgmit`, nunca con `'admin'` a mano.
- Cada pestaña tiene sus propios atributos y sus propios nombres: `configuracion.html` carga siete scripts juntos.
