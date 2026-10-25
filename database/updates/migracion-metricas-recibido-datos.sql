-- =====================================================
-- RPAD - Métricas y Reportes: los «Recibido el» y los orígenes de los datos de las actualizaciones viejas
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md (sección 4)
-- Sale del Excel que completó el usuario (RPAD - Recibido el - para completar.xlsx, generado el 24/10/2026 con la base del
-- 20/10/2026): las 32 actualizaciones aprobadas sin «Recibido el», de enero a octubre de 2026. Va un INSERT por cada una que
-- trae la fecha o el origen: 27. Las otras 5 (los cambios 25, 27, 38, 39 y 41) quedaron sin completar: siguen en
-- Métricas → Para completar.
-- Solo lleva el cambio, la fecha («Recibido el» u «Obtenido el») y el origen de los datos ('area' o 'fuente_publica'; NULL en
-- gestión interna, donde no se pregunta). Las observaciones del Excel no se importan.
-- Solo agrega: escribe en actualizaciones_recibido, por cambio_id, y no toca cambios_pendientes (datos_nuevos no se reescribe).
-- Lo importado completa lo que el cambio no trae: nunca pisa lo que el cambio guardó.
-- Requiere migracion-metricas.sql (la tabla actualizaciones_recibido).
-- ORDEN: correr DESPUÉS de migracion-metricas.sql (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar). Puede ir antes o
-- después de subir el código: el anterior no lee la tabla. Tiene que entrar ANTES del 10/01/2027, el día en que se saca la foto
-- de 2026, que no se modifica nunca.
-- Se puede volver a correr: cada INSERT escribe (o vuelve a escribir) la fila de su cambio, nunca la duplica, y un cambio que no
-- existe no hace nada.
-- VERIFICACIÓN: al final de este archivo hay una consulta (comentada): las actualizaciones aprobadas que siguen sin «Recibido el».
-- Después de correrlo, pegarla sola en la pestaña SQL (sin el «-- » del principio): con la base del 24/10/2026 da 5 filas,
-- los cambios 25, 27, 38, 39 y 41. Si da más, son actualizaciones aprobadas después del 24/10/2026 sin la fecha: también se ven en
-- Métricas → Para completar.
-- Para deshacer: rollback-metricas.sql (borra la tabla con lo importado).
-- =====================================================

SET NAMES utf8mb4;

INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 4, '2026-01-30', 'fuente_publica' FROM cambios_pendientes WHERE id = 4 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 3, '2026-01-30', 'fuente_publica' FROM cambios_pendientes WHERE id = 3 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 7, '2026-02-04', 'area' FROM cambios_pendientes WHERE id = 7 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 11, '2026-02-09', 'area' FROM cambios_pendientes WHERE id = 11 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 10, '2026-02-09', 'area' FROM cambios_pendientes WHERE id = 10 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 12, '2026-02-12', NULL FROM cambios_pendientes WHERE id = 12 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 13, '2026-02-18', 'fuente_publica' FROM cambios_pendientes WHERE id = 13 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 16, '2026-03-02', 'area' FROM cambios_pendientes WHERE id = 16 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 17, '2026-03-03', 'area' FROM cambios_pendientes WHERE id = 17 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 21, '2026-03-03', NULL FROM cambios_pendientes WHERE id = 21 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 23, '2026-03-10', 'area' FROM cambios_pendientes WHERE id = 23 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 26, '2026-03-25', 'fuente_publica' FROM cambios_pendientes WHERE id = 26 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 28, '2026-03-26', 'fuente_publica' FROM cambios_pendientes WHERE id = 28 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 33, '2026-04-24', 'area' FROM cambios_pendientes WHERE id = 33 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 34, '2026-04-24', 'area' FROM cambios_pendientes WHERE id = 34 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 35, '2026-04-24', 'area' FROM cambios_pendientes WHERE id = 35 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 31, '2026-04-24', 'area' FROM cambios_pendientes WHERE id = 31 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 32, '2026-04-24', 'area' FROM cambios_pendientes WHERE id = 32 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 37, '2026-05-22', 'fuente_publica' FROM cambios_pendientes WHERE id = 37 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 36, '2026-05-22', NULL FROM cambios_pendientes WHERE id = 36 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 40, '2026-06-03', NULL FROM cambios_pendientes WHERE id = 40 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 43, '2026-06-04', 'fuente_publica' FROM cambios_pendientes WHERE id = 43 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 44, '2026-07-14', 'fuente_publica' FROM cambios_pendientes WHERE id = 44 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 45, '2026-09-25', 'fuente_publica' FROM cambios_pendientes WHERE id = 45 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 46, '2026-10-02', NULL FROM cambios_pendientes WHERE id = 46 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 47, '2026-10-09', 'area' FROM cambios_pendientes WHERE id = 47 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);
INSERT INTO actualizaciones_recibido (cambio_id, recibido_el, origen_datos) SELECT 48, '2026-10-13', 'fuente_publica' FROM cambios_pendientes WHERE id = 48 ON DUPLICATE KEY UPDATE recibido_el = VALUES(recibido_el), origen_datos = VALUES(origen_datos);

-- Verificación (con la base del 24/10/2026, 5 filas):
-- SELECT c.id AS cambio_id, c.dataset_id FROM cambios_pendientes c LEFT JOIN actualizaciones_recibido r ON r.cambio_id = c.id WHERE c.tipo_cambio = 'editar' AND c.estado = 'aprobado' AND (JSON_CONTAINS(c.datos_nuevos, 'true', '$.registro_actualizacion') OR (LEFT(JSON_VALUE(c.datos_nuevos, '$.ultima_actualizacion'), 10) <> LEFT(IFNULL(JSON_VALUE(c.datos_anteriores, '$.ultima_actualizacion'), ''), 10) AND LEFT(JSON_VALUE(c.datos_nuevos, '$.proxima_actualizacion'), 10) <> LEFT(IFNULL(JSON_VALUE(c.datos_anteriores, '$.proxima_actualizacion'), ''), 10))) AND IFNULL(JSON_VALUE(c.datos_nuevos, '$.recibido_el'), '') = '' AND r.recibido_el IS NULL ORDER BY c.id;
