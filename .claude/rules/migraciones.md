---
paths:
  - "database/**"
  - "tests/schema.test.js"
---
# Migraciones y base de datos

Antes de escribir una migración o tocar el esquema, leé `docs/temas/base-de-datos.md`.
El orden general y las vueltas atrás están en `docs/temas/despliegue.md`.

- Una migración es aditiva y repetible, va antes que el código y lo nuevo va también en `database/schema.sql`.
- Cada una lleva su `rollback-*.sql`, que corre después de volver a los archivos anteriores.
- `rollback-mi-espacio.sql` y `rollback-feriados.sql` no se pueden correr solos mientras esté la de los días restituidos; `rollback-mi-espacio-agenda.sql`, mientras esté la del evento Personal (Público).
- Después de `migracion-notas-dgmit.sql` no se vuelven a correr `migracion-editor-auditoria.sql` ni `migracion-usuarios-superadmin.sql`: fijan el rol sin `colaborador`.
- `database/privado/` no se versiona: ahí van las cargas de datos de personas.
