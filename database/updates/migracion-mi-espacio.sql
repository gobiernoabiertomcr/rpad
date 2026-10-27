-- =====================================================
-- RPAD - Mi espacio: las licencias y las horas extras de cada persona
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md (sección 5)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce las seis
-- tablas nuevas y no las lee). usuarios_licencias (Configuración → Licencias) no cambia: mi_espacio_licencias solo la
-- apunta.
-- Tablas nuevas (los saldos no se guardan: los calculan las reglas con lo cargado, el saldo inicial y los feriados):
--   mi_espacio_anios: por persona y por año, los días de vacaciones (10 a 30) y los estudios ('universitario',
--   'secundario' o NULL: no estudia).
--   mi_espacio_arranque: el día en que la persona cargó su saldo inicial (uno por persona; no cambia al corregirlo).
--   mi_espacio_saldos: el saldo inicial, una fila por concepto y año (en vacaciones, el año de la licencia; en el resto, el
--   del arranque), en días o en horas.
--   mi_espacio_licencias: las licencias y los usos de horas (desde y hasta iguales en lo de un día; horas, solo en la
--   franquicia, las horas a favor y el uso autorizado), con «Mostrar a mis compañeros» y una nota. licencia_oficial_id es
--   la licencia de Configuración → Licencias que creó ('creada') o a la que se unió ('unida'); sin_pasar, el motivo por el
--   que no pasó. Las de Configuración no se borran (se anulan); si una se borrara por SQL, el vínculo queda NULL. Baja
--   lógica con activo.
--   mi_espacio_horas_extras: las horas extras, por día, de qué hora a qué hora. Baja lógica con activo.
--   mi_espacio_avisos: los emails de vencimiento ya enviados (clave, por ejemplo 'horas-2026-10' o 'licencia-2024'), para
--   no repetirlos.
-- Borrar a una persona borra lo suyo de las seis tablas (los usuarios no se borran: se desactivan).
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-feriados.sql (phpMyAdmin > base del RPAD > pestaña
-- SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-mi-espacio.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `mi_espacio_anios` (
  `usuario_id` int(11) NOT NULL,
  `anio` smallint(6) NOT NULL,
  `dias_vacaciones` tinyint(4) NOT NULL,
  `estudios` enum('universitario','secundario') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`usuario_id`,`anio`),
  CONSTRAINT `fk_mi_espacio_anios_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_arranque` (
  `usuario_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`usuario_id`),
  CONSTRAINT `fk_mi_espacio_arranque_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_saldos` (
  `usuario_id` int(11) NOT NULL,
  `concepto` enum('vacaciones','franquicias','estudios','medica','familiar','horas_no_utilizadas') NOT NULL,
  `anio` smallint(6) NOT NULL,
  `cantidad` decimal(5,1) NOT NULL DEFAULT 0.0,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`usuario_id`,`concepto`,`anio`),
  CONSTRAINT `fk_mi_espacio_saldos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_licencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `tipo` enum('vacaciones','franquicia','estudios','medica','medica_extraordinaria','familiar','franco','horas_a_favor','uso_autorizado') NOT NULL,
  `desde` date NOT NULL,
  `hasta` date NOT NULL,
  `horas` decimal(3,1) DEFAULT NULL,
  `mostrar` tinyint(1) NOT NULL DEFAULT 1,
  `nota` varchar(200) DEFAULT NULL,
  `licencia_oficial_id` int(11) DEFAULT NULL,
  `oficial` enum('creada','unida') DEFAULT NULL,
  `sin_pasar` varchar(200) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mi_espacio_licencias_usuario` (`usuario_id`,`desde`,`hasta`),
  KEY `fk_mi_espacio_licencias_oficial` (`licencia_oficial_id`),
  CONSTRAINT `fk_mi_espacio_licencias_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_licencias_oficial` FOREIGN KEY (`licencia_oficial_id`) REFERENCES `usuarios_licencias` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_horas_extras` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `desde` time NOT NULL,
  `hasta` time NOT NULL,
  `nota` varchar(200) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mi_espacio_horas_usuario` (`usuario_id`,`fecha`),
  CONSTRAINT `fk_mi_espacio_horas_extras_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_avisos` (
  `usuario_id` int(11) NOT NULL,
  `clave` varchar(40) NOT NULL,
  `enviado_at` datetime NOT NULL,
  PRIMARY KEY (`usuario_id`,`clave`),
  CONSTRAINT `fk_mi_espacio_avisos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
