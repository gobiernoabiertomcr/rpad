-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-agenda.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden los eventos de la agenda, con quién se compartió cada uno, los recordatorios apagados, el registro de los
-- emails enviados y la última corrida de los recordatorios: las cuatro tablas se borran con lo que tengan. Si hace falta
-- conservarlos, exportar las tablas antes. Los usuarios y el resto de los datos (también lo demás de Mi espacio: las
-- licencias, las horas extras y el saldo inicial) no se tocan.
-- La Tarea Cron de /api/cron/eventos se borra en cPanel (Tareas Cron): el código anterior no tiene esa ruta.
-- Si también se deshace la entrega anterior de Mi espacio (rollback-mi-espacio.sql), esto va antes, en el orden inverso al
-- de las migraciones (la base no lo exige: las tablas de la agenda solo apuntan a usuarios).
-- Borra las cuatro en el orden inverso al de la migración: corridas, envíos, personas y eventos.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `mi_espacio_eventos_corridas`;
DROP TABLE IF EXISTS `mi_espacio_evento_envios`;
DROP TABLE IF EXISTS `mi_espacio_evento_personas`;
DROP TABLE IF EXISTS `mi_espacio_eventos`;
