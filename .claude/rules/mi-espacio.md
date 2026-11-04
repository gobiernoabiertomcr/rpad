---
paths:
  - "services/miEspacio*.js"
  - "controllers/miEspacio*.js"
  - "public/js/mi-espacio.js"
  - "public/mi-espacio.html"
  - "tests/mi-espacio*.test.js"
  - "tests/fixtures/mi-espacio-casos.js"
---
# Mi espacio

Estos archivos tienen todos los subtemas adentro: elegí por lo que vas a cambiar y leé ese documento de `docs/temas/` antes de tocar nada.

| Si cambiás | Leé |
|---|---|
| Modalidad, vacaciones, topes, horas extras, saldo inicial, Resumen, su API | `mi-espacio.md` |
| El paso a Configuración, «Hoy no están», el email de vencimiento | `mi-espacio-paso-y-avisos.md` |
| La planilla de contrato, «Sumar al mes anterior» | `mi-espacio-planilla.md` |
| Las horas acumuladas | `mi-espacio-acumuladas.md` |
| Los días restituidos | `mi-espacio-restituidos.md` |
| Eventos, quién ve qué, recordatorios | `mi-espacio-agenda.md` |
| El mes de la agenda, el nombre corto | `mi-espacio-agenda-mes.md` |
| El evento Personal (Público) | `mi-espacio-evento-publico.md` |
| La nota de licencia en Word | `mi-espacio-nota-word.md` |

- `estadosDe` lee todas las tablas: una columna sin migrar da 500 en todo Mi espacio.
- Lo que entra en `faltantesDe` frena cargas; `avisosDeSalidas`, las restituciones y `para_revisar` van aparte y nunca frenan.
- Un tipo de licencia nuevo va en `TIPOS_LICENCIA` y su enum, `TIPOS_POR_MODALIDAD`, `TIPOS_DE_DIA_ENTERO`, `CUERPOS`, `NOMBRES_DEL_ARCHIVO` y `FRASE_DE_LA_LICENCIA`.
- `services/emailTemplates.js` importa de las reglas de eventos, y estas de `miEspacioResumen.js`: tocar un export puede romper emails.
- `#me-anuncio` es la única región viva de la página (la planilla suma `#mp-anuncio`).
- El `<style>` usa solo los tokens `--sg-*`, `--f-titulo` y `--f-texto`, y un `style` en línea solo escribe `--n`, `--p`, `--demora` y `--duracion`.
