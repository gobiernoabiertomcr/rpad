-- =====================================================
-- RPAD - El editor audita sin responsabilidad por la auditoría
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-20-editor-sin-responsabilidad-design.md
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- cambios_pendientes.revisado_sin_responsabilidad: 1 si lo aprobó o rechazó un editor con auditores disponibles (un
-- cambio propuesto por un auditor), sin responsabilidad por la auditoría. 0 en todos los cambios anteriores.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar). Si el
-- código sube sin esta columna, aprobar y rechazar cambios dan error hasta que se corra.
-- Se puede volver a correr si se cortó a mitad: si la columna ya existe se saltea.
-- Para deshacer: rollback-editor-sin-responsabilidad.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `cambios_pendientes`
  ADD COLUMN IF NOT EXISTS `revisado_sin_responsabilidad` tinyint(1) NOT NULL DEFAULT 0 AFTER `aviso_sin_auditores_at`;
