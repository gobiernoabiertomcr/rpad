-- =====================================================
-- RPAD - Deshace migracion-editor-auditoria.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Los editores pasan a admin: la versión anterior no conoce el rol editor (vuelven a aprobar cambios como cualquier admin).
-- Se pierden la fecha del primer recordatorio de cada cambio, la marca de aprobación "de respaldo", qué cambios incluyó
-- cada nota de auditoría y los destinatarios de auditoría de Correos.
-- notas_digitales.tipo (con 'auditoria') queda ampliado a propósito: las notas de auditoría son notas numeradas del libro
-- y no se borran. El código anterior no falla con ellas, pero su libro las muestra con el tipo vacío ("undefined").
-- =====================================================

SET NAMES utf8mb4;

UPDATE `usuarios` SET `rol` = 'admin' WHERE `rol` = 'editor';

ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('superadmin','admin','lector') NOT NULL DEFAULT 'lector';

DROP TABLE IF EXISTS `notas_digitales_cambios`;

ALTER TABLE `notas_digitales_config`
  DROP COLUMN IF EXISTS `cc_auditoria`,
  DROP COLUMN IF EXISTS `para_auditoria`;

ALTER TABLE `cambios_pendientes`
  DROP COLUMN IF EXISTS `revisado_como_respaldo`,
  DROP COLUMN IF EXISTS `primer_recordatorio_at`;
