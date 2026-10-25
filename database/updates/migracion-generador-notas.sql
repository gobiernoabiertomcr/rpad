-- =====================================================
-- RPAD - Generador de Notas: el ámbito de las áreas (municipal o fuera del municipio)
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-24-generador-de-notas-design.md (secciones 2 y 8, y el Anexo A)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce la
-- columna nueva y no la lee). Los UPDATE solo escriben la columna nueva.
-- areas.ambito: 'municipal' o 'externo' (fuera del municipio). Decide qué nota de la DGMIT le corresponde al área:
-- municipal, la interna (por la Subsecretaría); fuera del municipio, la externa (directo al organismo). Todas las áreas
-- arrancan en 'municipal' y los UPDATE marcan como externas las 13 áreas fuera del municipio del Anexo A, confirmadas
-- por el usuario el 24/10/2026. Cada UPDATE busca el área por id y por nombre: si alguien la renombró, no la encuentra
-- y el área queda municipal (se corrige a mano en Áreas). Los nombres y las dependencias de las áreas no se tocan.
-- ORDEN: correr ANTES de subir el código y después de migracion-metricas.sql (phpMyAdmin > base del RPAD > pestaña SQL,
-- pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: si la columna ya existe se saltea, y los UPDATE vuelven a dejar las
-- mismas 13 áreas como externas.
-- Si después alguien cambia en Áreas el ámbito de una de las 13, no la vuelvas a correr: la vuelve a marcar como externa.
-- VERIFICACIÓN: al final de este archivo hay una consulta (comentada). Después de correrlo, pegarla sola en la pestaña
-- SQL: tiene que dar 13.
-- Para deshacer: rollback-generador-notas.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `areas`
  ADD COLUMN IF NOT EXISTS `ambito` enum('municipal','externo') NOT NULL DEFAULT 'municipal' AFTER `articulo_superior`;

-- Las 13 áreas fuera del municipio (Anexo A), con el nombre tal como está en la base de producción

-- 2. Agencia Provincial de Seguridad Vial
UPDATE areas SET ambito = 'externo' WHERE id = 2 AND nombre = 'Agencia Provincial de Seguridad Vial';
-- 3. Asociación de Bomberos Voluntarios de Comodoro Rivadavia
UPDATE areas SET ambito = 'externo' WHERE id = 3 AND nombre = 'Asociación de Bomberos Voluntarios de Comodoro Rivadavia';
-- 4. Banco Central de la República Argentina
UPDATE areas SET ambito = 'externo' WHERE id = 4 AND nombre = 'Banco Central de la República Argentina';
-- 6. Dirección de Estadística y Evaluación Educativa
UPDATE areas SET ambito = 'externo' WHERE id = 6 AND nombre = 'Dirección de Estadística y Evaluación Educativa';
-- 24. Empresa Argentina de Navegación Aérea
UPDATE areas SET ambito = 'externo' WHERE id = 24 AND nombre = 'Empresa Argentina de Navegación Aérea';
-- 27. Honorable Concejo Deliberante de Comodoro Rivadavia
UPDATE areas SET ambito = 'externo' WHERE id = 27 AND nombre = 'Honorable Concejo Deliberante de Comodoro Rivadavia';
-- 28. Instituto Geográfico Nacional de la República Argentina
UPDATE areas SET ambito = 'externo' WHERE id = 28 AND nombre = 'Instituto Geográfico Nacional de la República Argentina';
-- 29. Instituto Nacional de Estadística y Censos de la República Argentina
UPDATE areas SET ambito = 'externo' WHERE id = 29 AND nombre = 'Instituto Nacional de Estadística y Censos de la República Argentina';
-- 30. Ministerio de Educación del Chubut
UPDATE areas SET ambito = 'externo' WHERE id = 30 AND nombre = 'Ministerio de Educación del Chubut';
-- 35. Secretaría de Energía de Nación
UPDATE areas SET ambito = 'externo' WHERE id = 35 AND nombre = 'Secretaría de Energía de Nación';
-- 41. Sociedad Cooperativa Popular Limitada
UPDATE areas SET ambito = 'externo' WHERE id = 41 AND nombre = 'Sociedad Cooperativa Popular Limitada';
-- 43. Tribunal Electoral del Chubut
UPDATE areas SET ambito = 'externo' WHERE id = 43 AND nombre = 'Tribunal Electoral del Chubut';
-- 44. Dirección Nacional de Vialidad
UPDATE areas SET ambito = 'externo' WHERE id = 44 AND nombre = 'Dirección Nacional de Vialidad';

-- Verificación (tiene que dar 13):
-- SELECT COUNT(*) AS externas FROM areas WHERE ambito = 'externo';
