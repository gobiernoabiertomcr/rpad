-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-horas-mes-anterior.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se borra la columna al_mes_anterior de mi_espacio_salidas: las salidas quedan, con sus horas, pero se pierde qué días
-- estaban tildados con «Sumar a {mes anterior}», y las horas tildadas vuelven a su mes (el de su fecha). Un uso de horas a
-- favor que se apoyaba en ellas puede quedar con el aviso ámbar de lo que falta (no frena nada). Si hace falta conservar las
-- marcas, exportar la tabla antes. Los usuarios y lo demás de Mi espacio no se tocan.
-- Si también se deshace la planilla de horas extras de contrato (rollback-mi-espacio-horas.sql), esto va antes, en el orden
-- inverso al de las migraciones (la base no lo exige: esa borra la tabla entera).
-- Se puede volver a correr: si la columna ya no existe, se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_salidas` DROP COLUMN IF EXISTS `al_mes_anterior`;
