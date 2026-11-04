-- =====================================================
-- RPAD - Deshace migracion-notas-firma-leyenda.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL), y antes de
-- rollback-notas-firma-digital.sql si se deshacen las dos.
-- Se borra la columna: se pierden las copias con la leyenda de las notas que esperan en ese momento. Esas notas siguen esperando y salen a
-- las 14:00; una que se firmó sobre la copia y no se subió ya no se reconoce, y sale con la imagen de la firma. Lo ya enviado no cambia.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `notas_digitales`
  DROP COLUMN IF EXISTS `pdf_para_firmar`;
