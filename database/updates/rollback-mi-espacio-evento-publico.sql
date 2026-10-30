-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-evento-publico.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Si se convirtió un evento con el SQL privado (database/privado/mi-espacio-evento-publico-datos.sql), su vuelta atrás,
-- database/privado/rollback-mi-espacio-evento-publico-datos.sql, va antes que esto.
-- Los Públicos quedan como eventos personales de quien los creó (ya se guardan con compartido y para_todos en 0): siguen en
-- su agenda, con su título, y nadie más los ve ni recibe nada. Se pierden el texto que veían los demás y
-- a quién se le mostraba cada uno: la tabla mi_espacio_evento_vistas se borra con lo que tenga, y las tres columnas también.
-- Si hace falta conservarlos, exportar la tabla y las columnas antes. Los usuarios y el resto de los datos (también lo demás
-- de la agenda: los eventos, con quién se compartió cada uno y los emails) no se tocan.
-- Si también se deshace la agenda de Mi espacio (rollback-mi-espacio-agenda.sql), esto va antes, en el orden inverso al de
-- las migraciones: la base lo exige (mi_espacio_evento_vistas apunta a mi_espacio_eventos).
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `mi_espacio_evento_vistas`;
ALTER TABLE `mi_espacio_eventos` DROP COLUMN IF EXISTS `texto_publico`;
ALTER TABLE `mi_espacio_eventos` DROP COLUMN IF EXISTS `publico_todos`;
ALTER TABLE `mi_espacio_eventos` DROP COLUMN IF EXISTS `publico`;
