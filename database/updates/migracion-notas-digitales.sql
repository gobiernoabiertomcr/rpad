-- =====================================================
-- RPAD - Notas Digitales
-- =====================================================
-- Libro de notas, datasets incluidos en cada nota y configuración.
-- Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 7)
-- Ejecutar: mysql -u USUARIO -p NOMBRE_BASE < migracion-notas-digitales.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE `notas_digitales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` int(11) DEFAULT NULL,
  `anio` smallint(6) DEFAULT NULL,
  `tipo` enum('aviso','reiteracion') NOT NULL,
  `gestion` enum('interna','externa') NOT NULL,
  `periodo` char(7) DEFAULT NULL,
  `fecha` date NOT NULL,
  `es_prueba` tinyint(1) NOT NULL DEFAULT 0,
  `asunto` varchar(300) NOT NULL,
  `para` varchar(500) NOT NULL,
  `cc` varchar(500) DEFAULT NULL,
  `cco` varchar(500) DEFAULT NULL,
  `html` mediumtext NOT NULL,
  `texto` mediumtext NOT NULL,
  `pdf` mediumblob NOT NULL,
  `estado` enum('pendiente','enviada','fallida') NOT NULL DEFAULT 'pendiente',
  `intentos` int(11) NOT NULL DEFAULT 0,
  `ultimo_error` text DEFAULT NULL,
  `message_id` varchar(255) DEFAULT NULL,
  `respuesta_smtp` varchar(500) DEFAULT NULL,
  `enviada_at` datetime DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notas_numero` (`anio`,`numero`),
  KEY `idx_notas_tipo_periodo` (`tipo`,`gestion`,`periodo`),
  KEY `idx_notas_estado` (`estado`),
  KEY `fk_notas_creado_por` (`creado_por`),
  CONSTRAINT `fk_notas_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notas_digitales_datasets` (
  `nota_id` int(11) NOT NULL,
  `dataset_id` int(11) NOT NULL,
  `seccion` enum('proximo','vencido') NOT NULL,
  `vencimiento` date NOT NULL,
  PRIMARY KEY (`nota_id`,`dataset_id`),
  KEY `idx_ndd_dataset_vencimiento` (`dataset_id`,`vencimiento`),
  CONSTRAINT `fk_ndd_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas_digitales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ndd_dataset` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notas_digitales_config` (
  `id` tinyint(4) NOT NULL,
  `envio_activo` tinyint(1) NOT NULL DEFAULT 0,
  `para_interna` varchar(500) NOT NULL DEFAULT '',
  `cc_interna` varchar(500) NOT NULL DEFAULT '',
  `para_externa` varchar(500) NOT NULL DEFAULT '',
  `cc_externa` varchar(500) NOT NULL DEFAULT '',
  `cco` varchar(500) NOT NULL DEFAULT '',
  `linea_cc_interna` varchar(200) NOT NULL DEFAULT '',
  `linea_cc_externa` varchar(200) NOT NULL DEFAULT '',
  `firma_nombre` varchar(150) NOT NULL DEFAULT '',
  `firma_cargo` varchar(200) NOT NULL DEFAULT '',
  `firma_imagen` mediumblob DEFAULT NULL,
  `firma_mime` varchar(50) DEFAULT NULL,
  `casillas_prueba` varchar(500) NOT NULL DEFAULT '',
  `reiteracion_evaluada_interna` char(7) DEFAULT NULL,
  `reiteracion_evaluada_externa` char(7) DEFAULT NULL,
  `ultima_corrida_fecha` date DEFAULT NULL,
  `ultima_corrida_inicio` datetime DEFAULT NULL,
  `ultima_corrida_fin` datetime DEFAULT NULL,
  `ultima_corrida_resultado` varchar(1000) DEFAULT NULL,
  `ultima_corrida_con_errores` tinyint(1) NOT NULL DEFAULT 0,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `notas_digitales_config`
  (`id`, `para_interna`, `cc_interna`, `para_externa`, `cc_externa`, `cco`, `linea_cc_interna`, `linea_cc_externa`)
VALUES
  (1, 'mit@comodoro.gov.ar', 'geoestadisticas@comodoro.gov.ar', 'mit@comodoro.gov.ar',
   'investigacionterritorial@comodoro.gov.ar', 'datospublicos@comodoro.gov.ar',
   'CC. Dir. de Investigación Territorial', 'CC. Dir. Administrativa');
