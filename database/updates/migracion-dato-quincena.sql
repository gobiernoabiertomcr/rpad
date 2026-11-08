-- =====================================================
-- RPAD - El dato de la quincena: el archivo de las ediciones que manda Grok Bot
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-07-dato-quincena-design.md (secciones 8 y 17)
-- Solo agrega: no borra columnas ni datos. El código anterior no las lee: sigue funcionando con esta estructura.
-- Tablas nuevas, sin CHECK (valida la API):
--   dato_quincena_ediciones: una por clave (uq_dato_quincena_clave), con metadata tal como llegó (utf8mb4_bin), la huella del paquete
--   y la llegada. La clave y la huella, en ascii_bin: se comparan byte a byte.
--   dato_quincena_propuestas: las propuestas de cada edición, una por orden (uq_dato_quincena_orden), con el dataset si existe (FK a
--   datasets ON DELETE SET NULL: borrar el dataset deja la propuesta con su nombre).
--   dato_quincena_adjuntos: los archivos de cada edición, uno por campo (uq_dato_quincena_adjunto), con sus bytes en MEDIUMBLOB.
-- Borrar una edición (solo con SQL a mano: el RPAD no las borra) borra sus propuestas y sus adjuntos (ON DELETE CASCADE).
-- ANTES de correrla, en la pestaña SQL, esta consulta tiene que dar 16777216 o más (16 MB, lo que trae MariaDB): una infografía de
-- hasta 5 MB necesita unos 6 MB en el INSERT y unos 11 MB al restaurar un respaldo de phpMyAdmin.
--   SELECT @@max_allowed_packet;
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-eventos-diario.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: sin las tablas, las rutas nuevas del dato de la quincena dan 500.
-- Se puede volver a correr: si una tabla ya existe, se saltea.
-- Para deshacer: rollback-dato-quincena.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `dato_quincena_ediciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `clave` varchar(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `tipo` enum('regular','piloto') NOT NULL,
  `fecha_edicion` date NOT NULL,
  `referencia_piloto` varchar(20) DEFAULT NULL,
  `titulo` varchar(200) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `huella` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `recibida_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_clave` (`clave`),
  KEY `idx_dato_quincena_fecha` (`fecha_edicion`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_propuestas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `orden` tinyint(3) unsigned NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `cifra_clave` varchar(1000) NOT NULL,
  `principal` tinyint(1) NOT NULL DEFAULT 0,
  `dataset_id` int(11) DEFAULT NULL,
  `dataset_nombre` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_orden` (`edicion_id`, `orden`),
  KEY `idx_dato_quincena_dataset` (`dataset_id`),
  CONSTRAINT `fk_dato_quincena_propuesta_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_propuesta_dataset` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_adjuntos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `campo` enum('infografia_png','correo_texto','calculos') NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `mime` varchar(30) NOT NULL,
  `bytes` int(10) unsigned NOT NULL,
  `sha256` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `contenido` mediumblob NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_adjunto` (`edicion_id`, `campo`),
  CONSTRAINT `fk_dato_quincena_adjunto_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para verificar, en la misma pestaña SQL: tiene que dar 3 filas (dato_quincena_adjuntos, dato_quincena_ediciones y dato_quincena_propuestas)
--   SHOW TABLES LIKE 'dato_quincena%';
