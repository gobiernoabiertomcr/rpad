-- =====================================================
-- RPAD - Fechas de los datasets: "Datos al", tipo de pedido, frecuencia en meses y registro de actualizaciones
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-17-fechas-datasets-design.md (sección 6)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura.
-- Todas las columnas nuevas quedan en NULL; la carga de datos va aparte (migracion-fechas-datasets-datos.sql).
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea y los meses se vuelven a escribir igual.
-- =====================================================

SET NAMES utf8mb4;

-- Frecuencia en meses: la aritmética de fechas nueva usa meses. `dias` queda como está (lo usan filtros y frontend).
-- Eventual queda en NULL (no tiene período).
ALTER TABLE `frecuencias`
  ADD COLUMN IF NOT EXISTS `meses` smallint(6) DEFAULT NULL COMMENT 'Meses entre actualizaciones. NULL para Eventual' AFTER `dias`;

UPDATE `frecuencias` SET `meses` = CASE `nombre`
  WHEN 'Mensualmente' THEN 1
  WHEN 'Bimestralmente' THEN 2
  WHEN 'Trimestralmente' THEN 3
  WHEN 'Cuatrimestralmente' THEN 4
  WHEN 'Cada medio año' THEN 6
  WHEN 'Anualmente' THEN 12
  WHEN 'Cada dos años' THEN 24
  WHEN 'Cada tres años' THEN 36
  WHEN 'Cada cuatro años' THEN 48
  WHEN 'Cada diez años' THEN 120
END
WHERE `nombre` IN ('Mensualmente', 'Bimestralmente', 'Trimestralmente', 'Cuatrimestralmente', 'Cada medio año',
                   'Anualmente', 'Cada dos años', 'Cada tres años', 'Cada cuatro años', 'Cada diez años');

-- Hasta qué fecha llegan los datos publicados (siempre fin de mes; NULL = sin dato) y qué tipo de pedido se le hace al área
ALTER TABLE `datasets`
  ADD COLUMN IF NOT EXISTS `datos_al` date DEFAULT NULL AFTER `ultima_actualizacion`,
  ADD COLUMN IF NOT EXISTS `tipo_pedido` enum('acumulado','foto','anio_anterior','ejercicio','edicion','relevamiento','eventual') DEFAULT NULL AFTER `que_se_solicita`;

-- Registro de cada actualización: qué ciclo cumplió, hasta qué fecha llegaron los datos, cuándo los recibió el área
-- y la próxima que quedó. `fecha_actualizacion` sigue siendo la fecha de carga en el portal.
ALTER TABLE `historial_actualizaciones`
  ADD COLUMN IF NOT EXISTS `cambio_id` int(11) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `vencimiento` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `datos_al` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `recibido_el` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `proxima_nueva` date DEFAULT NULL,
  ADD KEY IF NOT EXISTS `idx_historial_cambio` (`cambio_id`),
  ADD CONSTRAINT `fk_historial_cambio` FOREIGN KEY IF NOT EXISTS (`cambio_id`) REFERENCES `cambios_pendientes` (`id`) ON DELETE SET NULL;

-- El pedido de cada nota, tal como salió (congelado). Las notas anteriores quedan en NULL: no dijeron ningún período.
ALTER TABLE `notas_digitales_datasets`
  ADD COLUMN IF NOT EXISTS `datos_desde` date DEFAULT NULL AFTER `cuenta_desde`,
  ADD COLUMN IF NOT EXISTS `datos_hasta` date DEFAULT NULL AFTER `datos_desde`,
  ADD COLUMN IF NOT EXISTS `datos_solicitados` varchar(255) DEFAULT NULL AFTER `datos_hasta`;
