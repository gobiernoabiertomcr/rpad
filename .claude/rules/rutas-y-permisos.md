---
paths:
  - "routes/index.js"
  - "middleware/**"
  - "tests/permisos.test.js"
---
# Rutas y permisos

Cada documento de `docs/temas/` describe sus rutas: mirá «El mapa» de `CLAUDE.md`.

- Una ruta nueva va en la lista que corresponde de `tests/permisos.test.js`.
- Una ruta con sesión lleva `authMiddleware`; una de administración, además, `adminOnly`.
- `sesionOpcional` nunca responde 401 ni 403: sigue como un visitante.
- Comparar roles siempre con `esAdmin`, `esAuditor` o `puedeCargarNotasDgmit`.
