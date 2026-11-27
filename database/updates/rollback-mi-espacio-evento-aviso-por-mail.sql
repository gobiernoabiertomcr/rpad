-- =====================================================
-- RPAD - Deshace migracion-mi-espacio-evento-aviso-por-mail.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Si también se deshace el aviso diario, esto va antes que rollback-mi-espacio-eventos-diario.sql: las vueltas atrás van de la más
-- nueva a la más vieja.
-- Borra la columna aviso_por_mail de mi_espacio_eventos. Los eventos con el tilde apagado vuelven a mandar el mail a la cadena:
-- con el código anterior, todo Público se avisa a quienes están más arriba de quien lo cargó.
-- Para listarlos antes (y avisarles a quienes los cargaron), en la misma pestaña SQL:
--   SELECT id, creado_por, fecha FROM mi_espacio_eventos WHERE aviso_por_mail = 0 AND activo = 1;
-- Los eventos no se tocan. Si la migración se vuelve a correr, todos quedan en 1: el tilde apagado se pierde.
-- Se puede volver a correr: si la columna ya no existe, se saltea.
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_eventos`
  DROP COLUMN IF EXISTS `aviso_por_mail`;
