-- =====================================================
-- RPAD - El aviso diario de la agenda y de quién depende cada usuario
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-04-agenda-aviso-y-dependencia-design.md (secciones 3, 5 y 9)
-- Columnas nuevas de usuarios, después de vinculo:
--   depende_de: de quién depende (FK a usuarios ON DELETE SET NULL). NULL: de nadie.
--   eventos_por_mail: la casilla «Recibir mi agenda por mail», prendida de entrada.
-- Columna nueva de mi_espacio_eventos, después de texto_publico:
--   publicado_at: cuándo quedó Público con esa fecha, en hora argentina. NULL (los de antes) cuenta como anterior a hoy.
-- Tablas nuevas:
--   mi_espacio_evento_informados: a quién ya se le informó cada Público, y para qué fecha.
--   mi_espacio_diario_envios: el mail de cada persona, cada día y cada momento (14:00 o 8:05): nunca sale dos veces.
-- Datos: los Laborales «para todos» querían decir «la administración», y con el código nuevo «para todos» quiere decir todos los
-- usuarios activos. Se convierten sin cambiar quién los ve: la administración activa pasa a tener su fila y quedan con para_todos en 0.
-- Antes se borran las filas de quien hoy no es administración activa: son de un recordatorio apagado por alguien que dejó de serlo o se
-- desactivó, hoy no le dan acceso y convertidas le mostrarían el título y el detalle. Las de quien apagó su recordatorio y sigue, se conservan.
-- El código anterior sigue funcionando con todo esto: no conoce lo nuevo y a esos Laborales los lee como elegidas.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-notas-firma-leyenda.sql (phpMyAdmin > base del RPAD > pestaña
-- SQL, pegar y Continuar). Es obligatoria: el código nuevo lee las columnas en cada pedido de la agenda y del panel de usuarios.
-- Se puede volver a correr SOLO ANTES del Restart del código nuevo: lo que ya existe se saltea, pero después achicaría a la administración
-- los Laborales «Todos» que se creen con el código nuevo. Y conviene: correrla otra vez justo antes del Restart convierte también un
-- Laboral «para todos» que alguien haya creado con el código anterior mientras se subían los archivos.
-- La conversión es una foto: una persona de la administración que hoy está desactivada no queda en esos eventos, aunque se la reactive.
-- Para deshacer: rollback-mi-espacio-eventos-diario.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `depende_de` int(11) DEFAULT NULL AFTER `vinculo`,
  ADD COLUMN IF NOT EXISTS `eventos_por_mail` tinyint(1) NOT NULL DEFAULT 1 AFTER `depende_de`,
  ADD KEY IF NOT EXISTS `fk_usuarios_depende_de` (`depende_de`),
  ADD CONSTRAINT `fk_usuarios_depende_de` FOREIGN KEY IF NOT EXISTS (`depende_de`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

ALTER TABLE `mi_espacio_eventos`
  ADD COLUMN IF NOT EXISTS `publicado_at` datetime DEFAULT NULL AFTER `texto_publico`;

CREATE TABLE IF NOT EXISTS `mi_espacio_evento_informados` (
  `evento_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `informado_at` datetime NOT NULL,
  PRIMARY KEY (`evento_id`,`usuario_id`,`fecha`),
  KEY `fk_mi_espacio_evento_informados_usuario` (`usuario_id`),
  CONSTRAINT `fk_mi_espacio_evento_informados_evento` FOREIGN KEY (`evento_id`) REFERENCES `mi_espacio_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_evento_informados_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_diario_envios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `dia` date NOT NULL,
  `momento` enum('tarde','manana') NOT NULL,
  `enviado_at` datetime DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mi_espacio_diario_envios` (`usuario_id`,`dia`,`momento`),
  CONSTRAINT `fk_mi_espacio_diario_envios_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE p FROM `mi_espacio_evento_personas` p
  JOIN `mi_espacio_eventos` e ON e.id = p.evento_id AND e.compartido = 1 AND e.para_todos = 1
  JOIN `usuarios` u ON u.id = p.usuario_id AND (u.activo = 0 OR u.rol NOT IN ('superadmin', 'admin', 'editor'));

INSERT IGNORE INTO `mi_espacio_evento_personas` (`evento_id`, `usuario_id`)
  SELECT e.id, u.id FROM `mi_espacio_eventos` e
  JOIN `usuarios` u ON u.activo = 1 AND u.rol IN ('superadmin', 'admin', 'editor') AND (e.creado_por IS NULL OR u.id <> e.creado_por)
  WHERE e.compartido = 1 AND e.para_todos = 1;

UPDATE `mi_espacio_eventos` SET `para_todos` = 0 WHERE `compartido` = 1 AND `para_todos` = 1;

-- Para verificar, en la misma pestaña SQL: la primera tiene que dar 2 filas, la segunda 1, la tercera 2 y la cuarta, 0
--   SHOW COLUMNS FROM usuarios WHERE Field IN ('depende_de', 'eventos_por_mail');
--   SHOW COLUMNS FROM mi_espacio_eventos WHERE Field = 'publicado_at';
--   SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('mi_espacio_evento_informados', 'mi_espacio_diario_envios');
--   SELECT COUNT(*) FROM mi_espacio_eventos WHERE compartido = 1 AND para_todos = 1;
