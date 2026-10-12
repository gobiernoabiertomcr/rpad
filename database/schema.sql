-- =====================================================
-- RPAD - Registro Permanente de Actualización de Datasets
-- Estructura de la base de datos (MariaDB 10.6+)
-- =====================================================
-- Generado desde la estructura de producción (MariaDB 10.11) el 2026-10-12.
-- Incluye las 16 tablas, índices y claves foráneas, y los catálogos
-- (temas, frecuencias, formatos). NO incluye usuarios, áreas, datasets ni
-- ningún otro dato real: este archivo es público en el repositorio.
--
-- Instalación en una base vacía:
--   1. Importar este archivo (phpMyAdmin > Importar, o mysql < schema.sql)
--   2. Crear el primer administrador: npm run setup-admin
--
-- No tiene DROP TABLE: si se importa por error sobre una base existente,
-- falla en lugar de borrar datos.
--
-- Si cambiás la estructura (migraciones en database/updates/), actualizá
-- también este archivo: tests/schema.test.js compara ambos.
-- =====================================================

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `articulo` enum('el','la') NOT NULL DEFAULT 'la',
  `area_superior` varchar(300) DEFAULT NULL,
  `articulo_superior` enum('el','la') DEFAULT 'la',
  `email_principal` varchar(150) DEFAULT NULL,
  `email_secundario` varchar(150) DEFAULT NULL,
  `telefono_area` varchar(50) DEFAULT NULL,
  `celular_area` varchar(50) DEFAULT NULL,
  `nombre_contacto` varchar(150) DEFAULT NULL,
  `telefono_contacto` varchar(50) DEFAULT NULL,
  `email_contacto` varchar(150) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre_unique` (`nombre`),
  KEY `idx_areas_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cambios_pendientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_cambio` enum('crear','editar','eliminar') NOT NULL,
  `dataset_id` int(11) DEFAULT NULL,
  `datos_nuevos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`datos_nuevos`)),
  `datos_anteriores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_anteriores`)),
  `usuario_id` int(11) NOT NULL,
  `estado` enum('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
  `revisor_id` int(11) DEFAULT NULL,
  `comentario_rechazo` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `revisado_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `revisor_id` (`revisor_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_usuario` (`usuario_id`),
  KEY `idx_dataset` (`dataset_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `cambios_pendientes_ibfk_1` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cambios_pendientes_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cambios_pendientes_ibfk_3` FOREIGN KEY (`revisor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `dataset_formatos` (
  `dataset_id` int(11) NOT NULL,
  `formato_id` int(11) NOT NULL,
  PRIMARY KEY (`dataset_id`,`formato_id`),
  KEY `formato_id` (`formato_id`),
  CONSTRAINT `dataset_formatos_ibfk_1` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dataset_formatos_ibfk_2` FOREIGN KEY (`formato_id`) REFERENCES `formatos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `datasets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `area_id` int(11) NOT NULL,
  `frecuencia_id` int(11) NOT NULL,
  `ultima_actualizacion` date DEFAULT NULL,
  `proxima_actualizacion` date DEFAULT NULL,
  `tema_principal_id` int(11) NOT NULL,
  `tema_secundario_id` int(11) DEFAULT NULL,
  `url_dataset` varchar(500) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `tipo_gestion` enum('interna','externa') NOT NULL DEFAULT 'externa',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_datasets_tema_principal` (`tema_principal_id`),
  KEY `idx_datasets_tema_secundario` (`tema_secundario_id`),
  KEY `idx_datasets_frecuencia` (`frecuencia_id`),
  KEY `idx_datasets_proxima_actualizacion` (`proxima_actualizacion`),
  KEY `idx_datasets_activo` (`activo`),
  KEY `idx_datasets_area_id` (`area_id`),
  CONSTRAINT `datasets_ibfk_1` FOREIGN KEY (`frecuencia_id`) REFERENCES `frecuencias` (`id`),
  CONSTRAINT `datasets_ibfk_2` FOREIGN KEY (`tema_principal_id`) REFERENCES `temas` (`id`),
  CONSTRAINT `datasets_ibfk_3` FOREIGN KEY (`tema_secundario_id`) REFERENCES `temas` (`id`),
  CONSTRAINT `fk_datasets_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `formatos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `habitual` tinyint(1) DEFAULT 0,
  `extension` varchar(20) DEFAULT NULL,
  `tipo_mime` varchar(100) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `frecuencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `dias` int(11) DEFAULT NULL COMMENT 'Días entre actualizaciones. NULL para Eventual',
  `orden` int(11) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_actualizaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dataset_id` int(11) NOT NULL,
  `fecha_actualizacion` date NOT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `idx_historial_dataset` (`dataset_id`),
  CONSTRAINT `historial_actualizaciones_ibfk_1` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historial_actualizaciones_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `hito_archivos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `hito_id` int(11) NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `nombre_almacenado` varchar(300) NOT NULL,
  `tamano` int(11) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ha_hito` (`hito_id`),
  CONSTRAINT `fk_ha_hito` FOREIGN KEY (`hito_id`) REFERENCES `proyecto_hitos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `metricas_manuales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` enum('notas_enviadas','reuniones_capacitaciones','consultas_atendidas') NOT NULL,
  `anio` int(4) NOT NULL,
  `mes` int(2) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tipo_periodo` (`tipo`,`anio`,`mes`),
  KEY `idx_metricas_periodo` (`anio`,`mes`),
  KEY `idx_metricas_tipo` (`tipo`),
  KEY `fk_metricas_usuario` (`created_by`),
  CONSTRAINT `fk_metricas_usuario` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificaciones_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` enum('interno-60','interno-30','interno-vencido','externo-60','externo-40','externo-5','externo-vencido','area-aviso-40') NOT NULL,
  `area_id` int(11) DEFAULT NULL COMMENT 'NULL para notificaciones internas a DGMIT',
  `destinatarios` varchar(500) NOT NULL,
  `datasets_ids` varchar(500) NOT NULL COMMENT 'IDs separados por coma',
  `cantidad_datasets` int(11) NOT NULL DEFAULT 1,
  `enviado_at` timestamp NULL DEFAULT current_timestamp(),
  `success` tinyint(1) DEFAULT 1,
  `error_message` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notificaciones_tipo` (`tipo`),
  KEY `idx_notificaciones_area` (`area_id`),
  KEY `idx_notificaciones_fecha` (`enviado_at`),
  CONSTRAINT `notificaciones_log_ibfk_1` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proyecto_areas` (
  `proyecto_id` int(11) NOT NULL,
  `area_id` int(11) NOT NULL,
  PRIMARY KEY (`proyecto_id`,`area_id`),
  KEY `idx_proyecto_areas_area` (`area_id`),
  CONSTRAINT `fk_pa_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pa_proyecto` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proyecto_documentos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proyecto_id` int(11) NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `nombre_almacenado` varchar(300) NOT NULL,
  `tamano` int(11) NOT NULL DEFAULT 0,
  `mime_type` varchar(100) NOT NULL DEFAULT 'application/octet-stream',
  `ruta_archivo` varchar(500) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pd_proyecto` (`proyecto_id`),
  CONSTRAINT `fk_pd_proyecto` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proyecto_hitos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proyecto_id` int(11) DEFAULT NULL,
  `titulo` varchar(200) NOT NULL,
  `fecha` date NOT NULL,
  `descripcion` text DEFAULT NULL,
  `evidencia_tipo` enum('archivo','url','ninguno') DEFAULT 'ninguno',
  `evidencia_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ph_proyecto` (`proyecto_id`),
  KEY `idx_ph_fecha` (`fecha`),
  KEY `idx_ph_logros` (`proyecto_id`,`fecha`),
  CONSTRAINT `fk_ph_proyecto` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proyectos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `estado` enum('en_curso','completado','suspendido','idea') NOT NULL DEFAULT 'idea',
  `fecha_inicio` date DEFAULT NULL,
  `icono` varchar(50) DEFAULT NULL,
  `color` varchar(7) DEFAULT '#3b82f6',
  `responsable` varchar(150) DEFAULT NULL,
  `enlace_externo` varchar(500) DEFAULT NULL,
  `prioridad` enum('alta','media','baja') NOT NULL DEFAULT 'media',
  `categoria` enum('tecnologia','normativa','difusion') NOT NULL DEFAULT 'tecnologia',
  `activo` tinyint(1) DEFAULT 1,
  `orden` int(11) DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_proyectos_estado` (`estado`),
  KEY `idx_proyectos_categoria` (`categoria`),
  KEY `idx_proyectos_prioridad` (`prioridad`),
  KEY `idx_proyectos_activo` (`activo`),
  KEY `fk_proyectos_usuario` (`created_by`),
  CONSTRAINT `fk_proyectos_usuario` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `temas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `icono` varchar(50) DEFAULT NULL,
  `orden` int(11) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre_completo` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `rol` enum('admin','lector') NOT NULL DEFAULT 'lector',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


-- =====================================================
-- Catálogos
-- =====================================================

/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `temas` WRITE;
/*!40000 ALTER TABLE `temas` DISABLE KEYS */;
INSERT INTO `temas` (`id`, `nombre`, `icono`, `orden`, `activo`) VALUES (1,'Economía y Finanzas','coins',1,1),
(2,'Educación y Cultura','graduation-cap',2,1),
(3,'Geografía y Territorio','map',3,1),
(4,'Gobierno y Gestión Pública','landmark',4,1),
(5,'Infraestructura y Equipamiento Urbano','building',5,1),
(6,'Marco Legal, Elecciones y Seguridad','scale',6,1),
(7,'Medio Ambiente','leaf',7,1),
(8,'Población y Sociedad','users',8,1),
(9,'Salud, Género y Desarrollo Social','heart-pulse',9,1),
(10,'Servicios Públicos','wrench',10,1),
(11,'Transporte y Movilidad','bus',11,1),
(12,'Turismo y Deportes','plane',12,1);
/*!40000 ALTER TABLE `temas` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `frecuencias` WRITE;
/*!40000 ALTER TABLE `frecuencias` DISABLE KEYS */;
INSERT INTO `frecuencias` (`id`, `nombre`, `dias`, `orden`, `activo`) VALUES (1,'Mensualmente',30,1,1),
(2,'Bimestralmente',60,2,1),
(3,'Trimestralmente',90,3,1),
(4,'Cuatrimestralmente',120,4,1),
(5,'Cada medio año',180,5,1),
(6,'Anualmente',365,6,1),
(7,'Cada dos años',730,7,1),
(8,'Cada tres años',1095,8,1),
(9,'Cada cuatro años',1460,9,1),
(10,'Cada diez años',3650,10,1),
(11,'Eventual',NULL,11,1);
/*!40000 ALTER TABLE `frecuencias` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `formatos` WRITE;
/*!40000 ALTER TABLE `formatos` DISABLE KEYS */;
INSERT INTO `formatos` (`id`, `nombre`, `habitual`, `extension`, `tipo_mime`, `activo`, `created_at`) VALUES (1,'CSV',1,'.csv','text/csv',1,'2025-12-09 23:42:31'),
(2,'XLSX',1,'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',1,'2025-12-09 23:42:31'),
(3,'XLS',1,'.xls','application/vnd.ms-excel',1,'2025-12-09 23:42:31'),
(4,'PDF',1,'.pdf','application/pdf',1,'2025-12-09 23:42:31'),
(5,'KML',1,'.kml','application/vnd.google-earth.kml+xml',1,'2025-12-09 23:42:31'),
(6,'KMZ',1,'.kmz','application/vnd.google-earth.kmz',1,'2025-12-09 23:42:31'),
(7,'SHP',1,'.shp','application/x-shapefile',1,'2025-12-09 23:42:31'),
(8,'JSON',1,'.json','application/json',1,'2025-12-09 23:42:31'),
(9,'XML',1,'.xml','application/xml',1,'2025-12-09 23:42:31'),
(10,'DOC',1,'.doc','application/msword',1,'2025-12-09 23:42:31'),
(11,'DOCX',0,'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',1,'2025-12-09 23:42:31'),
(12,'GeoJSON',0,'.geojson','application/geo+json',1,'2025-12-09 23:42:31'),
(13,'GeoTIFF',0,'.tif','image/tiff',1,'2025-12-09 23:42:31'),
(14,'GPX',0,'.gpx','application/gpx+xml',1,'2025-12-09 23:42:31'),
(15,'DWG',0,'.dwg','application/acad',1,'2025-12-09 23:42:31'),
(16,'DXF',0,'.dxf','application/dxf',1,'2025-12-09 23:42:31'),
(17,'GDB',0,'.gdb','application/x-filegdb',1,'2025-12-09 23:42:31'),
(18,'GPKG',0,'.gpkg','application/geopackage+sqlite3',1,'2025-12-09 23:42:31'),
(19,'WKT',0,'.wkt','text/plain',1,'2025-12-09 23:42:31'),
(20,'Markdown',0,'.md','text/markdown',1,'2025-12-09 23:42:31'),
(21,'Texto plano',0,'.txt','text/plain',1,'2025-12-09 23:42:31'),
(22,'HTML',0,'.html','text/html',1,'2025-12-09 23:42:31'),
(23,'ODS',0,'.ods','application/vnd.oasis.opendocument.spreadsheet',1,'2025-12-09 23:42:31'),
(24,'ODT',0,'.odt','application/vnd.oasis.opendocument.text',1,'2025-12-09 23:42:31'),
(25,'ZIP',0,'.zip','application/zip',1,'2025-12-09 23:42:31'),
(26,'RAR',0,'.rar','application/vnd.rar',1,'2025-12-09 23:42:31'),
(27,'7Z',0,'.7z','application/x-7z-compressed',1,'2025-12-09 23:42:31');
/*!40000 ALTER TABLE `formatos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- =====================================================
-- Notas Digitales (database/updates/migracion-notas-digitales.sql)
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
