-- Migración: Upload de archivos para Proyectos e Hitos
-- Fecha: 2026-03-08

-- Nueva tabla: archivos de hitos
CREATE TABLE IF NOT EXISTS `hito_archivos` (
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

-- Agregar campos metadata a proyecto_documentos (tabla ya existente pero sin usar)
ALTER TABLE `proyecto_documentos`
  ADD COLUMN `nombre_almacenado` varchar(300) NOT NULL AFTER `nombre_archivo`,
  ADD COLUMN `tamano` int(11) NOT NULL DEFAULT 0 AFTER `nombre_almacenado`,
  ADD COLUMN `mime_type` varchar(100) NOT NULL DEFAULT 'application/octet-stream' AFTER `tamano`;
