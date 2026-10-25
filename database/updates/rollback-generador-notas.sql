-- =====================================================
-- RPAD - Deshace migracion-generador-notas.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierde el ámbito de cada área (municipal o fuera del municipio), también lo que se haya cambiado en Áreas. Si
-- después se vuelve a correr migracion-generador-notas.sql, las 13 del Anexo A quedan otra vez como externas y el resto,
-- municipales. Los nombres, las dependencias y el resto de los datos de las áreas no se tocan.
-- Se puede volver a correr: si la columna ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `areas`
  DROP COLUMN IF EXISTS `ambito`;
