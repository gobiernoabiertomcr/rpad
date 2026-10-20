-- =====================================================
-- RPAD - Deshace migracion-editor-sin-responsabilidad.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierde qué cambios aprobó o rechazó un editor sin responsabilidad por la auditoría: quedan como aprobados o
-- rechazados por esa persona, sin la marca.
-- Si también hay que deshacer la entrega del editor (rollback-editor-auditoria.sql), este va primero.
-- Se puede volver a correr: si la columna ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `cambios_pendientes`
  DROP COLUMN IF EXISTS `revisado_sin_responsabilidad`;
