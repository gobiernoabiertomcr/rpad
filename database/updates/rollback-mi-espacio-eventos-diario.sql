-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-eventos-diario.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL). Si también
-- se deshacen rollback-mi-espacio-evento-publico.sql o rollback-mi-espacio-agenda.sql, esto va antes que ellos.
-- Se pierden lo cargado en «Depende de», la casilla «Recibir mi agenda por mail», cuándo se publicó cada Público, a quién ya se le informó
-- y los envíos del mail diario.
-- Los Laborales: los «para todos» de antes no vuelven (quedan con las mismas personas, elegidas una por una). Un Laboral «Todos» creado con
-- el código nuevo pasa a ser solo para la administración, que es lo que entiende el código anterior. Uno con personas elegidas que no son de
-- la administración sigue, y esas personas lo siguen viendo.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `mi_espacio_diario_envios`;

DROP TABLE IF EXISTS `mi_espacio_evento_informados`;

ALTER TABLE `mi_espacio_eventos`
  DROP COLUMN IF EXISTS `publicado_at`;

ALTER TABLE `usuarios`
  DROP FOREIGN KEY IF EXISTS `fk_usuarios_depende_de`,
  DROP KEY IF EXISTS `fk_usuarios_depende_de`,
  DROP COLUMN IF EXISTS `eventos_por_mail`,
  DROP COLUMN IF EXISTS `depende_de`;
