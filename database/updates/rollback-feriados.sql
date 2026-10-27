-- =====================================================
-- RPAD - Deshace migracion-feriados.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden los feriados cargados (feriados: los de la precarga y los cargados en Configuración) y los años en que uno
-- que se repite no rige (feriados_no_rige): las dos tablas se borran con lo que tengan. Si hace falta conservarlos,
-- exportar las tablas antes. Los usuarios y el resto de los datos no se tocan, y los 9 feriados fijos siguen como siempre
-- (salen del código).
-- Borra primero feriados_no_rige y después feriados: así no choca con su clave foránea.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `feriados_no_rige`;
DROP TABLE IF EXISTS `feriados`;
