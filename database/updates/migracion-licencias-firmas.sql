-- =====================================================
-- RPAD - Licencias, firma de cada usuario y firmante titular de las Notas Digitales
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (sección 11.1)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Después de subir el código y reiniciar, correr UNA SOLA VEZ la carga no versionada
-- database/privado/licencias-firmas-datos.sql (firmante titular y su firma).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-licencias-firmas.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `usuarios_licencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `desde` date NOT NULL,
  `hasta` date NOT NULL,
  `autorizado_id` int(11) DEFAULT NULL,
  `autorizado_at` datetime DEFAULT NULL,
  `nota_autorizacion_id` int(11) DEFAULT NULL,
  `anulada` tinyint(1) NOT NULL DEFAULT 0,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_licencias_usuario_fechas` (`usuario_id`,`desde`,`hasta`),
  KEY `fk_licencias_autorizado` (`autorizado_id`),
  KEY `fk_licencias_creado_por` (`creado_por`),
  CONSTRAINT `fk_licencias_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_licencias_autorizado` FOREIGN KEY (`autorizado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_licencias_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios_firmas` (
  `usuario_id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `cargo` varchar(200) NOT NULL,
  `imagen` mediumblob DEFAULT NULL,
  `mime` varchar(20) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`usuario_id`),
  CONSTRAINT `fk_firmas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `notas_digitales_config`
  ADD COLUMN IF NOT EXISTS `firmante_usuario_id` int(11) DEFAULT NULL AFTER `firma_mime`;

ALTER TABLE `notas_digitales`
  MODIFY COLUMN `tipo` enum('aviso','reiteracion','autorizacion') NOT NULL,
  MODIFY COLUMN `gestion` enum('interna','externa') DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `firmante_id` int(11) DEFAULT NULL AFTER `creado_por`,
  ADD COLUMN IF NOT EXISTS `presentada_por_id` int(11) DEFAULT NULL AFTER `firmante_id`;

ALTER TABLE `notas_digitales_datasets`
  ADD COLUMN IF NOT EXISTS `cuenta_desde` date DEFAULT NULL AFTER `vencimiento`;

ALTER TABLE `usuarios_auditoria`
  MODIFY COLUMN `accion` enum('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado','licencia_cargada','licencia_editada','licencia_anulada') NOT NULL,
  ADD COLUMN IF NOT EXISTS `aviso_retenido` varchar(300) DEFAULT NULL AFTER `detalle`;
