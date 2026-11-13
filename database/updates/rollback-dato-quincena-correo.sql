-- =====================================================
-- RPAD - Deshace migracion-dato-quincena-correo.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Primero borra las cuatro tablas del correo, en el orden inverso al de la migración; después borra las infografías editables
-- guardadas (los adjuntos 'infografia_svg') y vuelve dato_quincena_adjuntos.campo a sus tres valores.
-- Con eso se pierden los SVG de las ediciones (las ediciones, sus propuestas, su PNG, su texto y sus cálculos quedan),
-- el registro de los envíos (a quién le llegó cada edición, los reenvíos y las pruebas), la lista de quién recibe el correo y el
-- interruptor del envío automático. Si hace falta conservarlos, exportar las cuatro tablas y los adjuntos 'infografia_svg' antes
-- (phpMyAdmin > Exportar). Los usuarios y lo demás no se tocan.
-- Si también se deshace el archivo de las ediciones, esto va antes que rollback-dato-quincena.sql: la base lo exige (los correos
-- y los envíos apuntan a las ediciones).
-- Si antes se corrió rollback-dato-quincena.sql solo y falló en las ediciones (ya borró los adjuntos y las propuestas), esto
-- borra igual las cuatro tablas y frena en el DELETE, porque dato_quincena_adjuntos ya no existe: es lo esperado. Después,
-- volver a correr rollback-dato-quincena.sql, que termina de borrar las ediciones.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `dato_quincena_envios`;
DROP TABLE IF EXISTS `dato_quincena_correos`;
DROP TABLE IF EXISTS `dato_quincena_destinatarios`;
DROP TABLE IF EXISTS `dato_quincena_correo_config`;
DELETE FROM `dato_quincena_adjuntos` WHERE `campo` = 'infografia_svg';
ALTER TABLE `dato_quincena_adjuntos` MODIFY `campo` enum('infografia_png','correo_texto','calculos') NOT NULL;
