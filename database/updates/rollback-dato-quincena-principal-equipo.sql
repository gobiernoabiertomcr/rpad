-- =====================================================
-- RPAD - Deshace migracion-dato-quincena-principal-equipo.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Borra la tabla de la principal del equipo: se pierden las elecciones (cuál eligió el equipo en cada edición, quién y cuándo).
-- Si hace falta conservarlas, exportar dato_quincena_principal_equipo antes (phpMyAdmin > Exportar). Las ediciones, sus
-- propuestas (con la principal de Datito), el correo y los usuarios no se tocan.
-- Si también se deshace la votación, esa va primero. Si también se deshacen el correo o el archivo de las ediciones, esto va primero.
-- Antes que rollback-dato-quincena.sql, porque la base lo exige: las elecciones apuntan a las propuestas.
-- Antes que rollback-dato-quincena-correo.sql, por el orden de las entregas: la base no lo exige.
-- Si antes se corrió rollback-dato-quincena.sql y falló en las propuestas (ya borró los adjuntos), esto borra igual la tabla:
-- después, volver a correr rollback-dato-quincena.sql, que termina de borrar las propuestas y las ediciones.
-- Se puede volver a correr: si la tabla ya no existe, se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `dato_quincena_principal_equipo`;
