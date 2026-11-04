-- =====================================================
-- RPAD - Deshace migracion-notas-firma-digital.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se borran las columnas: se pierden las copias firmadas guardadas y quién firmó cada nota (exportarlas antes, si hace falta). Los emails
-- ya salieron, con lo que tenían, y el pdf original de cada nota queda como estaba. Una nota que todavía esperaba la firma queda como una
-- pendiente común y sale en la corrida siguiente, con la imagen de la firma. Lo demás no se toca.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `notas_digitales`
  DROP FOREIGN KEY IF EXISTS `fk_notas_firma_subida_por`,
  DROP KEY IF EXISTS `fk_notas_firma_subida_por`,
  DROP COLUMN IF EXISTS `firma_subida_por`,
  DROP COLUMN IF EXISTS `firmado_at`,
  DROP COLUMN IF EXISTS `firmado_por`,
  DROP COLUMN IF EXISTS `pdf_firmado`,
  DROP COLUMN IF EXISTS `espera_firma`;

ALTER TABLE `notas_digitales_config`
  DROP COLUMN IF EXISTS `firma_digital_activa`;
