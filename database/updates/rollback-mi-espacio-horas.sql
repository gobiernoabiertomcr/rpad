-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-horas.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierde lo cargado en la planilla de horas extras de contrato: la tabla mi_espacio_salidas se borra con lo que tenga. Si
-- hace falta conservarlo, exportar la tabla antes. Con el código anterior, las horas extras de las personas de contrato
-- vuelven a salir de mi_espacio_horas_extras, que no se toca (tampoco los usuarios ni lo demás de Mi espacio).
-- Si también se deshace la agenda de Mi espacio (rollback-mi-espacio-agenda.sql), esto va antes, en el orden inverso al de
-- las migraciones (la base no lo exige: la tabla solo apunta a usuarios).
-- Se puede volver a correr: si la tabla ya no existe, se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `mi_espacio_salidas`;
