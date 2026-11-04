---
paths:
  - "services/notasDigitalesCalendario.js"
  - "services/feriados{Reglas,Datos}.js"
  - "services/auditoria*.js"
  - "services/avisos*.js"
  - "controllers/notificacionesController.js"
  - "tests/{notas-calendario,calendario-unico,notificaciones,avisos-diarios,avisos-superadmin,auditoria-api,auditoria-datos,auditoria-reglas,feriados-en-notas,feriados-en-metricas}.test.js"
---
# Calendario, corridas y auditoría

Antes de cambiar el calendario o un cron, leé `docs/temas/calendario-y-corridas.md`.
Si tocás quién audita o el canal de un cambio, también `docs/temas/auditoria.md`.
Si tocás los feriados de la tabla, también `docs/temas/feriados.md`.

- El punto de entrada lee el calendario una sola vez y lo pasa: nadie más lo vuelve a leer en esa corrida o pedido.
- `leerCalendario` nunca tira; la caída se detecta por `calendario.error !== null`, nunca por `origen`.
- Dos convenciones ante el tope, a propósito: las `…Con` de `feriadosReglas.js` devuelven null y las del calendario tiran `RangeError`.
- Cada corrida tiene su candado: los recordatorios de la agenda nunca toman el de las Notas.
- Una simulación de las corridas va con una copia de producción y sin envíos reales.
