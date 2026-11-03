-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-horas-acumuladas.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se borra la columna horas_acumuladas de mi_espacio_licencias: las licencias quedan, con sus horas, pero se pierde qué parte de
-- cada día era acumulada; esas cargas cuentan enteras contra su mes y pueden quedar con el aviso ámbar de lo que falta en las
-- horas a favor (no frena nada). Si hace falta conservar la parte acumulada, exportar la tabla antes. Los usuarios y lo demás de
-- Mi espacio no se tocan.
-- Si también se deshacen los días restituidos (rollback-mi-espacio-restituciones.sql), esto va antes, en el orden inverso al de
-- las migraciones (la base no lo exige: esa no toca esta columna).
-- Se puede volver a correr: si la columna ya no existe, se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_licencias` DROP COLUMN IF EXISTS `horas_acumuladas`;
