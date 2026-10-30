-- =====================================================
-- RPAD - Mi espacio: el evento Personal (Público) de la agenda
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-design.md (secciones 6.1 y 8)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce las tres
-- columnas ni la tabla nueva y no las lee; lo que guarda queda con publico en 0, como un evento de siempre).
-- Columnas nuevas de mi_espacio_eventos, después de para_todos:
--   publico: 1 en un Personal (Público), un evento personal que otras personas ven solo como «<nombre>: <texto>». Se guarda
--   con compartido y para_todos en 0: para todo lo de antes (quién lo ve, los emails, los recordatorios) es un evento
--   personal de quien lo creó, y a nadie más le llega nada.
--   publico_todos: 1 si se les muestra a todas las personas activas (es una marca, no una lista: quien se da de alta
--   después también lo ve).
--   texto_publico: lo que ven los demás en lugar del título (de 1 a 60 caracteres en un Público; NULL en el resto). Lo
--   valida la API, sin CHECK.
-- Tabla nueva:
--   mi_espacio_evento_vistas: a quién se le muestra un Público con personas elegidas, una fila por persona. No tiene
--   sin_recordatorio: el recordatorio de un Público le llega solo a quien lo creó.
-- Si se borrara un evento por SQL, se borra a quién se mostraba; si se borrara a una persona, sus filas (los usuarios no se
-- borran: se desactivan).
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-horas.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: el código nuevo lee las tres columnas en toda consulta de los eventos
-- (e.publico) y la tabla al ver a quién se le muestra un Público, así que sin ellas da «Unknown column»: la pestaña
-- Agenda no carga (GET /mi-espacio/eventos da 500), no se puede crear, cambiar ni borrar ningún evento, la corrida de los
-- recordatorios de un día hábil termina con errores (Correos → Estado lo marca en rojo) y «Hoy y mañana» del Resumen sale
-- sin los eventos (va aislado). Lo demás de Mi espacio sigue andando.
-- Después del código va el SQL privado del kit (database/privado/mi-espacio-evento-publico-datos.sql), si lo trae.
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-mi-espacio-evento-publico.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_eventos` ADD COLUMN IF NOT EXISTS `publico` tinyint(1) NOT NULL DEFAULT 0 AFTER `para_todos`;
ALTER TABLE `mi_espacio_eventos` ADD COLUMN IF NOT EXISTS `publico_todos` tinyint(1) NOT NULL DEFAULT 0 AFTER `publico`;
ALTER TABLE `mi_espacio_eventos` ADD COLUMN IF NOT EXISTS `texto_publico` varchar(60) DEFAULT NULL AFTER `publico_todos`;

CREATE TABLE IF NOT EXISTS `mi_espacio_evento_vistas` (
  `evento_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  PRIMARY KEY (`evento_id`,`usuario_id`),
  KEY `fk_mi_espacio_evento_vistas_usuario` (`usuario_id`),
  CONSTRAINT `fk_mi_espacio_evento_vistas_evento` FOREIGN KEY (`evento_id`) REFERENCES `mi_espacio_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_evento_vistas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
