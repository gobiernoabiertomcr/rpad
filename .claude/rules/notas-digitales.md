---
paths:
  - "services/notasDigitales*.js"
  - "services/notasFirmaDigital.js"
  - "services/firmasService.js"
  - "controllers/{notasDigitales,firmas}Controller.js"
  - "public/js/correos.js"
  - "tests/notas-{anexo,api,auditoria,contenido,datos,licencias,motor,pdf,seguimiento-anexo,digitales-word,firma-digital,firma-digital-api,firma-digital-motor}.test.js"
  - "tests/correos-frontend.test.js"
---
# Notas Digitales

Antes de cambiar una nota, sus tablas, sus anexos, su firma o Correos, leé `docs/temas/notas-digitales.md`.
Si toca la firma digital, también `docs/temas/firma-digital.md`.
Si toca cuándo sale, también `docs/temas/calendario-y-corridas.md`.

- Lo ya enviado no cambia: `pdf`, `html` y `anexo_pdf` quedan en bytes y no se regeneran.
- `notas_digitales_datasets.vencimiento` es la clave del ciclo para el Seguimiento y Métricas.
- El Word reconoce la nota por lo que escribe `renderHtml` (`notasDigitalesWord.js`): si lo cambiás, corré `tests/notas-digitales-word.test.js`.
- `DocumentoNota` no tiene tamaño: la nota sale en oficio y los anexos en A4, cada uno con el suyo.
- Una simulación de las notas va con una copia de producción y sin envíos reales.
