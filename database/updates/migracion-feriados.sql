-- =====================================================
-- RPAD - Feriados: los feriados que no son los 9 fijos y los años en que uno que se repite no rige
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-26-feriados-design.md (sección 1)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce las dos
-- tablas nuevas y no las lee).
-- Tablas nuevas:
--   feriados: los días no hábiles que no son los 9 feriados nacionales fijos (esos no se guardan: salen del código): los
--   nacionales, los de Chubut, los de Comodoro y los días no laborables. trasladado_de es la fecha original de un
--   trasladable. Uno que se repite (se_repite) cae el mismo día y mes todos los años desde el de su fecha, hasta
--   hasta_anio (NULL: sigue). Baja lógica con activo. Sin índice único: el mismo día puede tener dos feriados.
--   feriados_no_rige: los años en que uno que se repite no rige (por ejemplo, porque ese año se corrió a otro día).
-- La precarga de 2026 y 2027 va aparte, en migracion-feriados-datos.sql, que se corre después de esta.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-feriados.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `feriados` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `tipo` enum('nacional','provincial','municipal','no_laborable') NOT NULL,
  `trasladado_de` date DEFAULT NULL,
  `se_repite` tinyint(1) NOT NULL DEFAULT 0,
  `hasta_anio` smallint(6) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_feriados_fecha` (`fecha`),
  KEY `fk_feriados_creado_por` (`creado_por`),
  CONSTRAINT `fk_feriados_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feriados_no_rige` (
  `feriado_id` int(11) NOT NULL,
  `anio` smallint(6) NOT NULL,
  PRIMARY KEY (`feriado_id`,`anio`),
  CONSTRAINT `fk_feriados_no_rige_feriado` FOREIGN KEY (`feriado_id`) REFERENCES `feriados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
