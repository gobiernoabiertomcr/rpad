-- =====================================================
-- RPAD - Mi espacio: los días de vacaciones que restituye un asueto
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-design.md (secciones 6 y 14)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce el tipo
-- nuevo ni las dos tablas, no las lee y nunca guarda 'restituidos').
-- Tipo nuevo de mi_espacio_licencias, al final de la lista:
--   'restituidos' («Días restituidos»): la carga aparte de los días que un asueto cargado después de unas vacaciones les
--   restituye, cuando su licencia vence antes del plazo para tomarlos (caso A). Lo valida la API, sin CHECK.
-- Tablas nuevas (primero los pedidos: la foto los apunta):
--   mi_espacio_restituciones: los pedidos, uno por grupo de días que se pidió: las vacaciones de las que salen (licencia_id;
--   en la recursión, una carga de días restituidos), la licencia de origen (anio), el caso ('tomar': se cargan como «Días
--   restituidos», con la carga en carga_id; 'restituir': vuelven a la licencia de origen), los días, el primer asueto (del
--   que sale el plazo), la tanda y el día del pedido (fecha: la de la nota y desde cuándo vuelven los días). Baja lógica con
--   activo.
--   mi_espacio_restituibles: la foto, que se saca en la transacción del feriado: cada día de unas vacaciones (o de una carga
--   de días restituidos) que un feriado cargado después dejó de hacer hábil, una sola vez por carga y día
--   (uq_mi_espacio_restituibles_dia), con el feriado, la tanda (NULL mientras ningún pedido la selló) y el pedido (NULL
--   mientras no se pidió). Los grupos, el plazo y el caso no se guardan: los calculan las reglas.
-- Borrar a una persona o una carga borra sus pedidos y su foto; borrar un feriado, su foto; borrar la carga de días
-- restituidos deja su pedido sin ella, y borrar un pedido deja su foto sin pedir (los usuarios no se borran: se desactivan;
-- las licencias y los feriados se dan de baja).
-- No carga datos: los feriados ya cargados no generan fotos (solo los que se carguen o corrijan después).
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-horas-mes-anterior.sql (phpMyAdmin > base
-- del RPAD > pestaña SQL, pegar y Continuar). Es obligatoria: el código nuevo lee las dos tablas cada vez que lee lo
-- cargado de una persona (estadosDe), así que sin ellas da «Table doesn't exist»: todo lo de Mi espacio que lee el estado de
-- una persona (el Resumen, las licencias, las horas extras, la nota de licencia) da error para todos, y, como el feriado
-- saca la foto en su misma transacción, Configuración → Feriados no puede cargar ni corregir un feriado (ni cargar el día de
-- «Se pasó al»); el paso de Mi espacio de la corrida de las 8:15 anota el error en Correos → Estado.
-- Se puede volver a correr si se cortó a mitad: el MODIFY del tipo deja lo mismo, y lo que ya existe se saltea.
-- Para deshacer: rollback-mi-espacio-restituciones.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_licencias` MODIFY `tipo` enum('vacaciones','franquicia','estudios','medica','medica_extraordinaria','familiar','franco','horas_a_favor','uso_autorizado','restituidos') NOT NULL;

CREATE TABLE IF NOT EXISTS `mi_espacio_restituciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `licencia_id` int(11) NOT NULL,
  `anio` smallint(6) NOT NULL,
  `caso` enum('tomar','restituir') NOT NULL,
  `dias` smallint(6) NOT NULL,
  `primer_asueto` date NOT NULL,
  `tanda` smallint(6) NOT NULL,
  `fecha` date NOT NULL,
  `carga_id` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mi_espacio_restituciones_usuario` (`usuario_id`,`activo`),
  KEY `fk_mi_espacio_restituciones_licencia` (`licencia_id`),
  KEY `fk_mi_espacio_restituciones_carga` (`carga_id`),
  CONSTRAINT `fk_mi_espacio_restituciones_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_restituciones_licencia` FOREIGN KEY (`licencia_id`) REFERENCES `mi_espacio_licencias` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_restituciones_carga` FOREIGN KEY (`carga_id`) REFERENCES `mi_espacio_licencias` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_restituibles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `licencia_id` int(11) NOT NULL,
  `feriado_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `tanda` smallint(6) DEFAULT NULL,
  `restitucion_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mi_espacio_restituibles_dia` (`licencia_id`,`fecha`),
  KEY `fk_mi_espacio_restituibles_feriado` (`feriado_id`),
  KEY `fk_mi_espacio_restituibles_restitucion` (`restitucion_id`),
  CONSTRAINT `fk_mi_espacio_restituibles_licencia` FOREIGN KEY (`licencia_id`) REFERENCES `mi_espacio_licencias` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_restituibles_feriado` FOREIGN KEY (`feriado_id`) REFERENCES `feriados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_restituibles_restitucion` FOREIGN KEY (`restitucion_id`) REFERENCES `mi_espacio_restituciones` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para verificar, en la misma pestaña SQL: tiene que dar 2 filas (mi_espacio_restituciones y mi_espacio_restituibles)
--   SHOW TABLES LIKE 'mi_espacio_restitu%';
-- y el tipo de mi_espacio_licencias tiene que terminar en 'restituidos'
--   SHOW COLUMNS FROM mi_espacio_licencias LIKE 'tipo';
