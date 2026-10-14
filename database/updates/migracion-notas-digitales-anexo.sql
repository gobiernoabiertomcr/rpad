-- =====================================================
-- RPAD - Notas Digitales: anexo de los avisos (una hoja por dataset)
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 6.7 y 7.1)
-- Requiere migracion-notas-digitales.sql. Ejecutar ANTES de subir el código:
--   mysql -u USUARIO -p NOMBRE_BASE < migracion-notas-digitales-anexo.sql
-- =====================================================

ALTER TABLE `notas_digitales` ADD COLUMN `anexo_pdf` MEDIUMBLOB NULL AFTER `pdf`;
