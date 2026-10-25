-- =====================================================
-- RPAD - Métricas y Reportes: la foto anual de las métricas y los «Recibido el» importados
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md (secciones 3 y 4)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce las dos
-- tablas nuevas y no las lee).
-- Tablas nuevas:
--   metricas_fotos: la foto de las métricas de cada año, al 31/12 (anio es el año y al, siempre AAAA-12-31). La saca
--   sola, una sola vez, la primera corrida de las 8:15 desde el 10/01 del año siguiente, y no se modifica nunca. datos es
--   un JSON con version, casos, vistas, cintas, contexto, trabajo, areas y generada, con los números ya calculados (lo
--   valida el código).
--   actualizaciones_recibido: el «Recibido el» y el origen de los datos ('area' o 'fuente_publica') de las actualizaciones
--   aprobadas que no lo traen, por cambio_id. Se importan aparte: cambios_pendientes.datos_nuevos no se reescribe.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-metricas.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `metricas_fotos` (
  `anio` smallint(6) NOT NULL,
  `al` date NOT NULL,
  `datos` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`anio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `actualizaciones_recibido` (
  `cambio_id` int(11) NOT NULL,
  `recibido_el` date DEFAULT NULL,
  `origen_datos` enum('area','fuente_publica') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`cambio_id`),
  CONSTRAINT `fk_actualizaciones_recibido_cambio` FOREIGN KEY (`cambio_id`) REFERENCES `cambios_pendientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
