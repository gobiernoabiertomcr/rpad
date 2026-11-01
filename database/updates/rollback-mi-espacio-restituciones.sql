-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-restituciones.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Las cargas de días restituidos (tipo 'restituidos') pasan a vacaciones, con sus fechas y sin cambiar la fecha de su nota:
-- siguen en Mi espacio y, las que pasaron, en Configuración → Licencias, pero en Mi espacio pasan a descontar de las
-- licencias, como unas vacaciones más, y puede aparecer un aviso ámbar de lo que falta (no frena nada).
-- Se pierden los pedidos de restitución y la foto de los días por restituir: las dos tablas se borran con lo que tengan,
-- primero la foto (apunta a los pedidos). Los días que habían vuelto a una licencia con un pedido dejan de sumar, y las
-- vacaciones vuelven a contar sus días con los feriados de hoy, como antes. Si hace falta conservarlos, exportar las tablas
-- antes. Los avisos ya enviados (las claves restitucion-… de mi_espacio_avisos) quedan: el código anterior no los lee.
-- Al final, el tipo de las licencias de Mi espacio vuelve a sus nueve valores. Los usuarios, los feriados y lo demás de Mi
-- espacio no se tocan.
-- Si también se deshace «Sumar al mes anterior» (rollback-mi-espacio-horas-mes-anterior.sql), esto va antes, en el orden
-- inverso al de las migraciones. Y si se deshicieran también las licencias de Mi espacio (rollback-mi-espacio.sql) o los
-- feriados (rollback-feriados.sql), esto va antes que ellas: la base lo exige (las dos tablas apuntan a
-- mi_espacio_licencias y a feriados).
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

UPDATE `mi_espacio_licencias` SET `tipo` = 'vacaciones', `updated_at` = `updated_at` WHERE `tipo` = 'restituidos';
DROP TABLE IF EXISTS `mi_espacio_restituibles`;
DROP TABLE IF EXISTS `mi_espacio_restituciones`;
ALTER TABLE `mi_espacio_licencias` MODIFY `tipo` enum('vacaciones','franquicia','estudios','medica','medica_extraordinaria','familiar','franco','horas_a_favor','uso_autorizado') NOT NULL;
