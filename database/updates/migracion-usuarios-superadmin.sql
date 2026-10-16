-- =====================================================
-- RPAD - Usuarios: rol superadmin, cargo, vínculo, links de acceso y auditoría
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-15-usuarios-superadmin-design.md (sección 6)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Después de subir el código y reiniciar, correr UNA SOLA VEZ la carga no versionada
-- database/privado/usuarios-superadmin-datos.sql (rol superadmin, cargos y vínculos).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-usuarios-superadmin.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `usuarios`
  MODIFY COLUMN `password_hash` varchar(255) DEFAULT NULL,
  MODIFY COLUMN `rol` enum('superadmin','admin','lector') NOT NULL DEFAULT 'lector',
  ADD COLUMN IF NOT EXISTS `cargo` varchar(200) DEFAULT NULL AFTER `rol`,
  ADD COLUMN IF NOT EXISTS `vinculo` enum('planta_permanente','planta_politica','contrato') DEFAULT NULL AFTER `cargo`,
  ADD COLUMN IF NOT EXISTS `ultimo_ingreso` timestamp NULL DEFAULT NULL AFTER `activo`,
  ADD COLUMN IF NOT EXISTS `sesion_version` int(11) NOT NULL DEFAULT 0 AFTER `ultimo_ingreso`;

CREATE TABLE IF NOT EXISTS `usuarios_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `tipo` enum('invitacion','recuperacion') NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expira_at` datetime NOT NULL,
  `usado_at` datetime DEFAULT NULL,
  `anulado_at` datetime DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuarios_tokens_hash` (`token_hash`),
  KEY `idx_usuarios_tokens_usuario` (`usuario_id`,`tipo`),
  KEY `fk_usuarios_tokens_creado_por` (`creado_por`),
  CONSTRAINT `fk_usuarios_tokens_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_usuarios_tokens_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios_auditoria` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `actor_id` int(11) DEFAULT NULL,
  `accion` enum('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado') NOT NULL,
  `detalle` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`detalle`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_usuarios_auditoria_usuario` (`usuario_id`,`created_at`),
  KEY `fk_usuarios_auditoria_actor` (`actor_id`),
  CONSTRAINT `fk_usuarios_auditoria_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_usuarios_auditoria_actor` FOREIGN KEY (`actor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
