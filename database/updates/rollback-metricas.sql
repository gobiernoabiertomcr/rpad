-- =====================================================
-- RPAD - Deshace migracion-metricas.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden la foto de cada año (metricas_fotos) y los «Recibido el» importados (actualizaciones_recibido): las dos
-- tablas se borran con lo que tengan. Si hace falta conservarlos, exportar las tablas antes. Los cambios pendientes, el
-- historial y el resto de los datos no se tocan.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `actualizaciones_recibido`;
DROP TABLE IF EXISTS `metricas_fotos`;
