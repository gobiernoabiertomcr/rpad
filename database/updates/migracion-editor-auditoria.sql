-- =====================================================
-- RPAD - Rol editor y auditoría de cambios pendientes
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (sección 11.2)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Después de subir el código y reiniciar, el superadmin pasa a editor a quien corresponda desde el panel de usuarios
-- (no hace falta SQL privado) y revisa en Correos los destinatarios de las notas de auditoría.
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-editor-auditoria.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('superadmin','admin','editor','lector') NOT NULL DEFAULT 'lector';

ALTER TABLE `cambios_pendientes`
  ADD COLUMN IF NOT EXISTS `primer_recordatorio_at` datetime DEFAULT NULL AFTER `revisado_at`,
  ADD COLUMN IF NOT EXISTS `revisado_como_respaldo` tinyint(1) NOT NULL DEFAULT 0 AFTER `primer_recordatorio_at`,
  ADD COLUMN IF NOT EXISTS `aviso_sin_auditores_at` datetime DEFAULT NULL AFTER `revisado_como_respaldo`;

ALTER TABLE `notas_digitales`
  MODIFY COLUMN `tipo` enum('aviso','reiteracion','autorizacion','auditoria') NOT NULL;

CREATE TABLE IF NOT EXISTS `notas_digitales_cambios` (
  `nota_id` int(11) NOT NULL,
  `cambio_id` int(11) NOT NULL,
  `seccion` enum('nuevo','reiterado') NOT NULL,
  PRIMARY KEY (`nota_id`,`cambio_id`),
  KEY `idx_ndc_cambio` (`cambio_id`),
  CONSTRAINT `fk_ndc_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas_digitales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ndc_cambio` FOREIGN KEY (`cambio_id`) REFERENCES `cambios_pendientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `notas_digitales_config`
  ADD COLUMN IF NOT EXISTS `para_auditoria` varchar(500) NOT NULL DEFAULT 'mit@comodoro.gov.ar' AFTER `casillas_prueba`,
  ADD COLUMN IF NOT EXISTS `cc_auditoria` varchar(500) DEFAULT NULL AFTER `para_auditoria`;
