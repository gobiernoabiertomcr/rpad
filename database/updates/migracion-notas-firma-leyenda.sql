-- =====================================================
-- RPAD - La leyenda de la firma digital en las Notas Digitales
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-04-firma-digital-leyenda-design.md (secciones 2.3 y 6)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce la columna y no la lee).
-- Columna nueva de notas_digitales, después de firma_subida_por:
--   pdf_para_firmar: la copia con la leyenda al pie, la que se firma, solo mientras la nota espera la firma. La nota que sale sin firmar sale
--   con su pdf, que no se toca. Lo ya enviado no cambia: lo cargado queda en NULL.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-notas-firma-digital.sql (phpMyAdmin > base del RPAD > pestaña SQL,
-- pegar y Continuar). Es obligatoria: el código nuevo escribe la columna al enviar cualquier nota, así que sin ella el email sale, la nota no
-- queda como enviada y se vuelve a mandar.
-- Se puede volver a correr: lo que ya existe se saltea.
-- Para deshacer: rollback-notas-firma-leyenda.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `notas_digitales`
  ADD COLUMN IF NOT EXISTS `pdf_para_firmar` mediumblob DEFAULT NULL AFTER `firma_subida_por`;

-- Para verificar, en la misma pestaña SQL: tiene que dar 1 fila
--   SHOW COLUMNS FROM notas_digitales WHERE Field = 'pdf_para_firmar';
