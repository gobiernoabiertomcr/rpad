-- =====================================================
-- RPAD - Mi espacio: «Sumar a {mes anterior}» en la planilla de horas extras de contrato
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-design.md (secciones 8 y 11)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce la columna
-- nueva y no la lee; lo que guarda queda con al_mes_anterior en 0, sin tildar).
-- Columna nueva de mi_espacio_salidas, después de nota:
--   al_mes_anterior: 1 si las horas extras de ese día suman al mes anterior al de su fecha (el tilde «Sumar a enero» de la
--   planilla: las del martes 02/02 cuentan como horas extras de enero). Las horas del día no cambian, solo el mes en que
--   cuentan. Lo ya cargado queda en 0: nada cambia hasta que alguien tilde. Un día que se borra vuelve a 0. Lo valida la API,
--   sin CHECK.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-horas.sql (la que crea la tabla; phpMyAdmin >
-- base del RPAD > pestaña SQL, pegar y Continuar). Es obligatoria: el código nuevo lee la columna cada vez que lee lo cargado
-- de una persona, así que sin ella da «Unknown column»: la planilla, la pestaña Horas extras, el Resumen y todo lo de Mi
-- espacio que lee el estado de una persona dan error para todos.
-- Se puede volver a correr: si la columna ya existe, se saltea.
-- Para deshacer: rollback-mi-espacio-horas-mes-anterior.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `mi_espacio_salidas` ADD COLUMN IF NOT EXISTS `al_mes_anterior` tinyint(1) NOT NULL DEFAULT 0 AFTER `nota`;

-- Para verificar, en la misma pestaña SQL: tiene que dar 1 fila (al_mes_anterior, tinyint(1), NO, 0)
--   SHOW COLUMNS FROM mi_espacio_salidas LIKE 'al_mes_anterior';
