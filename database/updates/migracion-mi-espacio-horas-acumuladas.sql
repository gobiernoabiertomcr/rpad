-- =====================================================
-- RPAD - Mi espacio: las horas acumuladas de contrato
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-design.md (secciones 6 y 15)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce la columna
-- nueva y no la lee; una carga nueva queda con horas_acumuladas en NULL, todo del mes). Ojo: si el código anterior corrige una
-- carga que ya tenía horas acumuladas (por ejemplo, entre volver a los archivos anteriores y correr el rollback), su UPDATE no
-- toca la columna y queda el valor viejo; el código nuevo nunca toma más que horas (horasAcumuladasDe) y el rollback la borra.
-- Columna nueva de mi_espacio_licencias, después de horas:
--   horas_acumuladas: la parte de horas que sale de las horas acumuladas, en una carga de «Horas a favor» de una persona de
--   contrato (de 0 a horas, de a media hora). horas sigue siendo el total del día; la parte del mes es horas - horas_acumuladas.
--   Solo en horas_a_favor; en cualquier otro tipo, NULL. NULL y 0 son lo mismo. Lo ya cargado queda en NULL: todo cuenta contra
--   su mes, como hasta ahora. Lo valida la API, sin CHECK.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-restituciones.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: el código nuevo lee la columna cada vez que lee lo cargado de una persona
-- (estadosDe), así que sin ella da «Unknown column»: el Resumen, las licencias, las horas extras, la planilla, la nota de
-- licencia y todo lo de Mi espacio que lee el estado de una persona dan error para todos.
-- Se puede volver a correr: si la columna ya existe, se saltea.
-- Para deshacer: rollback-mi-espacio-horas-acumuladas.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_licencias` ADD COLUMN IF NOT EXISTS `horas_acumuladas` decimal(3,1) DEFAULT NULL AFTER `horas`;

-- Para verificar, en la misma pestaña SQL: tiene que dar 1 fila (horas_acumuladas, decimal(3,1), YES, NULL)
--   SHOW COLUMNS FROM mi_espacio_licencias LIKE 'horas_acumuladas';
