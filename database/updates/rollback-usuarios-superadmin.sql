-- =====================================================
-- RPAD - Deshace migracion-usuarios-superadmin.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden el historial de usuarios, los links de acceso, los cargos y los vínculos.
-- Los usuarios con invitación pendiente quedan desactivados (no tienen contraseña).
-- =====================================================

SET NAMES utf8mb4;

UPDATE usuarios SET rol = 'admin' WHERE rol = 'superadmin';
UPDATE usuarios SET password_hash = '!sin-contrasena', activo = 0 WHERE password_hash IS NULL;

DROP TABLE IF EXISTS `usuarios_tokens`;
DROP TABLE IF EXISTS `usuarios_auditoria`;

ALTER TABLE `usuarios`
  DROP COLUMN `sesion_version`,
  DROP COLUMN `ultimo_ingreso`,
  DROP COLUMN `vinculo`,
  DROP COLUMN `cargo`,
  MODIFY COLUMN `rol` enum('admin','lector') NOT NULL DEFAULT 'lector',
  MODIFY COLUMN `password_hash` varchar(255) NOT NULL;
