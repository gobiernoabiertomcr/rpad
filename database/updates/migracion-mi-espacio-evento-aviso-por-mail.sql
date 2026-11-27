-- =====================================================
-- RPAD - «Yo y quienes elija» con el aviso por mail optativo
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-27-evento-mail-optativo-design.md (secciones 9 y 13)
-- Solo agrega: no borra columnas ni datos.
-- Columna nueva de mi_espacio_eventos, después de publicado_at:
--   aviso_por_mail: 1 si el evento se avisa por mail a la cadena de quien lo cargó (el aviso diario de la agenda); 0 en un Público
--   con el tilde apagado. Todos los eventos que ya existen quedan en 1.
-- El código anterior sigue funcionando con la columna: no la lee, y lo que guarda queda en 1.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-dato-quincena-votacion.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: sin la columna, el código nuevo da «Unknown column» en toda la agenda.
-- Se puede volver a correr: si la columna ya existe, se saltea y no cambia ningún tilde.
-- Para deshacer: rollback-mi-espacio-evento-aviso-por-mail.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_eventos`
  ADD COLUMN IF NOT EXISTS `aviso_por_mail` tinyint(1) NOT NULL DEFAULT 1 AFTER `publicado_at`;

-- Para verificar, en la misma pestaña SQL: la primera tiene que dar 1 fila y la segunda, 0
--   SHOW COLUMNS FROM mi_espacio_eventos WHERE Field = 'aviso_por_mail';
--   SELECT COUNT(*) FROM mi_espacio_eventos WHERE aviso_por_mail <> 1;
