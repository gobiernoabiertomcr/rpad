---
paths:
  - "public/**"
  - "tests/paginas.test.js"
  - "tests/*-frontend.test.js"
---
# Frontend

Antes de tocar la carga de una página, una versión, el CSS, la carcasa o el sitio público, leé `docs/temas/frontend.md`.
La parte de cada página está en el documento de su tema: mirá «El mapa» de `CLAUDE.md`.

- Al cambiar un script, subí su constante en `tests/paginas.test.js` y su `?v=` en el HTML.
- `VERSION_FERIADOS` tiene que ser mayor que `VERSION_REPORTES`.
- `configuracion.html` carga siete scripts juntos: un nombre de nivel superior repetido rompe el segundo script entero.
- Los comunes se quedan como están salvo que haga falta: tocar `auth.js`, `main.js` o `api.js` sube `VERSION` en todas las páginas.
