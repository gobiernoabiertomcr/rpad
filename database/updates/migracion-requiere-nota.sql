-- =====================================================
-- RPAD - «Requiere nota DGMIT»: si un dataset de gestión externa necesita que la DGMIT le mande una nota formal al área
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md (secciones 1.1 y 1.2)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- datasets.requiere_nota: 1 = Sí (la DGMIT le manda una nota formal al área), 0 = No (los datos se obtienen sin nota),
-- NULL = sin dato. En gestión interna es siempre NULL. La columna nueva queda en NULL para todos los datasets: la carga
-- inicial va aparte (migracion-requiere-nota-datos.sql).
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: si la columna ya existe se saltea y los datos no se tocan.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `datasets`
  ADD COLUMN IF NOT EXISTS `requiere_nota` tinyint(1) NULL DEFAULT NULL AFTER `tipo_gestion`;
