---
paths:
  - "controllers/proyectosController.js"
  - "services/proyectosReglas.js"
  - "config/upload.js"
  - "public/js/proyectos.js"
  - "tests/proyectos-*"
  - "tests/upload-subida.test.js"
---
# Proyectos

Antes de cambiarlo, leé `docs/temas/proyectos.md`.

- Ningún archivo huérfano: las subidas se validan antes de multer y borran lo escrito si algo falla.
- Toda ruta de un archivo pasa por `rutaSegura`.
- Nunca dice «guardado» si algo falló.
- Los hitos de cada año salen en el Informe anual: borrar uno cambia ese reporte.
