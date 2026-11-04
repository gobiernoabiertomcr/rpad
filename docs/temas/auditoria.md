# Auditoría de cambios pendientes

Quién está disponible, por qué canal va cada cambio, la nota de auditoría y los días sin auditor. La regla general está en «Doble verificación» de `CLAUDE.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md`
- `docs/superpowers/specs/2026-10-27-feriados-en-notas-design.md`

## Archivos

auditoriaReglas (quién audita cada cambio y por qué canal, puro) y auditoriaService (quiénes están disponibles cada día, el canal de cada cambio y los cambios de la nota de auditoría).

## Auditoría de cambios pendientes

- Disponible (un día dado) = activo, con contraseña y sin licencia: la única definición es `disponibilidad` (`services/auditoriaReglas.js`), que usan `personasDeAuditoria` y `personasPorDia` (`services/auditoriaService.js`).
  El canal de cada cambio lo decide una sola función pura, `canalDelCambio` (`services/auditoriaReglas.js`), igual para el recordatorio de las 14:00 y la nota de las 8:15.
- Canal **nota** (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.1): ya tuvo sus dos recordatorios por email:
  su primer recordatorio (`cambios_pendientes.primer_recordatorio_at`) fue hace `RECORDATORIOS_ANTES_DE_LA_NOTA` (2) días hábiles o más, o sea recordatorio el día 1 y el día 2 a las 14:00 y nota el día 3 a las 8:15, el firmante titular (sin titular, el superadmin) no puede auditarlo, hay auditores disponibles y la nota puede salir (envío automático activo, configuración de Notas Digitales completa, Para de auditoría cargado y hay quién firme).
  Si no, canal **recordatorio**.
- Recordatorio: solo días hábiles, los cambios propuestos hace una hora o más.
  `created_at` es TIMESTAMP y la base puede estar en UTC: la antigüedad se mide en SQL con `TIMESTAMPDIFF(SECOND, created_at, NOW())` (reloj y zona de la base en los dos extremos), nunca comparando su texto con `ahoraArgentina()`.
- Nota de auditoría (tipo `auditoria`, sin gestión, numeración del libro): una por día, después de avisos y reiteraciones; nuevos y reiterados a los 5 días hábiles de la última nota; destinatarios `para_auditoria` y `cc_auditoria` de `notas_digitales_config`, con el `cco` general.
- Con el calendario (spec 2026-10-27-feriados-en-notas, 3):
  `canalDelCambio` (los 2 días hábiles del primer recordatorio), `seccionDeAuditoria` (los 5 días hábiles entre notas) y `agruparDiasSinAuditor` lo reciben (puras:
  `CALENDARIO_FIJO` si no);
  `contextoDeCanal(fecha, config, calendario)` lo devuelve dentro del contexto y así llega a `canalDelCambio` desde las dos corridas, que cuentan igual (un cambio con su primer recordatorio el viernes 30/10/2026 sigue por recordatorio el 03/11 y pasa a la nota el 04/11: el 02/11 es feriado);
  `personasPorDia`, `periodosSinAuditor` y `proximoDiaConQuienAudite` lo reciben o lo leen.
  La columna «días hábiles pendiente» de la nota de auditoría llega calculada con cada cambio (`dias_habiles_pendiente`, de `seleccionarParaAuditoria` con el calendario, y también en el ejemplo de la vista previa), así el contenido sigue puro (`filaDeCambio` usa los 9 fijos solo si no viene): un cambio del 30/10 en la nota del 04/11 dice 2.
- Días sin auditor (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.5): un día hábil en que ningún superadmin ni admin está disponible (los editores no cuentan: son el respaldo).
  `periodosSinAuditor` (`services/auditoriaService.js`) agrupa los días hábiles seguidos en períodos `{ desde, hasta, vuelve, respaldo }` (la regla pura es `agruparDiasSinAuditor`, en `auditoriaReglas.js`;
  `vuelve` es el primer día hábil con algún auditor, hasta 366 días, o `null`).
  La disponibilidad está en un solo lugar (`disponibilidad`, usada por `personasDeAuditoria` y `personasPorDia`).
  Se muestra en tres lugares: el formulario de licencias (`GET /api/usuarios/licencias/sin-auditor` simula la licencia sin guardarla, con `usuario_id` y `excluir`; la pestaña Licencias lo pide sin parámetros, de hoy a hoy + 60 días), el aviso a quien propone y Correos → Estado (`sin_quien_audite` y `periodos_sin_auditor`).
- Aviso a quien propone (dentro del recordatorio de las 14:00, `sinAuditorTemplate`): si un cambio que entra en el recordatorio no tiene a nadie que lo audite (`quienesAuditan` vacío), quien lo propuso recibe un solo email con todos sus cambios en esa situación, una vez por cambio (`cambios_pendientes.aviso_sin_auditores_at`, escrito con `ahoraArgentina()`).
  De licencia no se manda: queda NULL y sale a su vuelta si sigue sin auditor.
