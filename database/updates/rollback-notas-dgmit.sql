-- =====================================================
-- RPAD - Deshace migracion-notas-dgmit.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden TODAS las notas DGMIT cargadas (las tres tablas se borran con lo que tengan): sin ellas, el Seguimiento
-- vuelve a mostrar el tramo de la nota formal como antes. Si hace falta conservarlas, exportar las tablas antes.
-- Los colaboradores pasan a lector (la versión anterior no conoce el rol colaborador): ven lo mismo que un lector y dejan
-- de poder cargar notas. El rol del resto no cambia.
-- Si también hay que deshacer la entrega del editor (rollback-editor-sin-responsabilidad.sql y rollback-editor-auditoria.sql),
-- este va primero: esa vuelta atrás no conoce el rol colaborador y, según el modo del servidor, falla o deja a un
-- colaborador con el rol vacío.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

UPDATE `usuarios` SET `rol` = 'lector' WHERE `rol` = 'colaborador';

ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('superadmin','admin','editor','lector') NOT NULL DEFAULT 'lector';

DROP TABLE IF EXISTS `notas_dgmit_historial`;
DROP TABLE IF EXISTS `notas_dgmit_datasets`;
DROP TABLE IF EXISTS `notas_dgmit`;
