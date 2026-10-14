-- =====================================================
-- RPAD - Campo "Qué se solicita" de los datasets
-- =====================================================
-- Qué información concreta tiene que enviar el área responsable para actualizar
-- el dataset. Se edita en el formulario del dataset (con doble verificación) y se
-- muestra en la ficha pública y en el anexo de las Notas Digitales.
-- Columna opcional (NULL): los datasets existentes quedan sin texto; la carga
-- inicial va en una migración de datos aparte, revisada antes de correrla.
-- Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 7.6)
-- Ejecutar: mysql -u USUARIO -p NOMBRE_BASE < migracion-que-se-solicita.sql
-- Ejecutarla ANTES de reiniciar la aplicación con el código nuevo.
-- =====================================================

ALTER TABLE datasets ADD COLUMN que_se_solicita TEXT NULL AFTER observaciones;
