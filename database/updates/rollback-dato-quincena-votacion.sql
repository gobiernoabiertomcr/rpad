-- =====================================================
-- RPAD - Deshace migracion-dato-quincena-votacion.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Borra las cuatro tablas de la votación: se pierden los votantes, las votaciones de cada edición, sus personas y los votos.
-- Si hace falta conservarlos, exportar las cuatro tablas antes (phpMyAdmin > Exportar). Las ediciones, sus propuestas, la principal
-- del equipo, el correo y los usuarios no se tocan.
-- Va antes que rollback-dato-quincena-principal-equipo.sql, si también se deshace: por el orden de las entregas, la base no lo exige.
-- Se borra de los votos a los votantes, porque cada tabla apunta a la anterior.
-- Se puede volver a correr: si las tablas ya no existen, se saltean.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `dato_quincena_votos`;
DROP TABLE IF EXISTS `dato_quincena_votacion_personas`;
DROP TABLE IF EXISTS `dato_quincena_votaciones`;
DROP TABLE IF EXISTS `dato_quincena_votantes`;
