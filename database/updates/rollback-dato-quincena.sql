-- =====================================================
-- RPAD - Deshace migracion-dato-quincena.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se borran las tres tablas, primero las que apuntan a las ediciones (adjuntos y propuestas) y al final las ediciones.
-- Con ellas se pierden las ediciones del dato de la quincena recibidas, con sus propuestas y sus archivos.
-- Si ya hay ediciones, exportar las tres tablas antes (phpMyAdmin > Exportar). Los datasets y lo demás no se tocan.
-- Se puede volver a correr: si una tabla ya no existe, se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `dato_quincena_adjuntos`;
DROP TABLE IF EXISTS `dato_quincena_propuestas`;
DROP TABLE IF EXISTS `dato_quincena_ediciones`;
