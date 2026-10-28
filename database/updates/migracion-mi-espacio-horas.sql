-- =====================================================
-- RPAD - Mi espacio: la planilla de horas extras de las personas de contrato
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-27-mi-espacio-horas-design.md (secciones 6 y 11)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce la tabla
-- nueva y no la lee). mi_espacio_horas_extras (las horas extras de planta, de qué hora a qué hora) no cambia.
-- Tabla nueva:
--   mi_espacio_salidas: una fila por persona y día (clave única uq_mi_espacio_salidas_dia), con la hora de salida y, opcional
--   en un día hábil, la de entrada (en un sábado, un domingo o un feriado es obligatoria: lo valida la API, sin CHECK). Las
--   horas no se guardan: se calculan con los feriados del momento. El guardado de la planilla es un INSERT … ON DUPLICATE
--   KEY UPDATE, que vuelve a activar una fila dada de baja; borrar un día es baja lógica con activo.
-- Borrar a una persona borra sus salidas (los usuarios no se borran: se desactivan).
-- ANTES de correrla, en la pestaña SQL, esta consulta tiene que dar 0 (ninguna persona de contrato con horas extras de
-- planta activas: dejarían de contar). Si no da 0, no seguir: hay que decidir qué hacer con esas horas.
--   SELECT COUNT(*) FROM mi_espacio_horas_extras h JOIN usuarios u ON u.id = h.usuario_id WHERE h.activo = 1 AND u.vinculo = 'contrato';
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-agenda.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: sin la tabla, Mi espacio entero da error para todos.
-- Se puede volver a correr: si la tabla ya existe, se saltea.
-- Para deshacer: rollback-mi-espacio-horas.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `mi_espacio_salidas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `entrada` time DEFAULT NULL,
  `salida` time NOT NULL,
  `nota` varchar(200) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mi_espacio_salidas_dia` (`usuario_id`,`fecha`),
  CONSTRAINT `fk_mi_espacio_salidas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
