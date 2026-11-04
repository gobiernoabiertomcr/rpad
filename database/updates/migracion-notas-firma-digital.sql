-- =====================================================
-- RPAD - La firma digital de las Notas Digitales
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-03-notas-firma-digital-design.md (secciones 4 y 8)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce las columnas y no
-- las lee; lo que guarda queda con espera_firma en 0).
-- Columnas nuevas de notas_digitales, después de presentada_por_id:
--   espera_firma: 1 mientras la nota espera que la suban firmada (a las 14:00 sale lo que quede).
--   pdf_firmado: el PDF firmado que se subió, tal cual. El pdf original no se toca: la nota sale con pdf_firmado si está.
--   firmado_por y firmado_at: el nombre del certificado y el momento que declara la firma, en hora argentina.
--   firma_subida_por: quién la subió (FK a usuarios ON DELETE SET NULL).
-- Columna nueva de notas_digitales_config, al final:
--   firma_digital_activa: el interruptor de Correos → Estado. Queda en 0 (apagado): con él apagado, todo sigue igual.
-- Lo ya enviado no cambia: lo cargado queda con espera_firma en 0 y lo demás en NULL. Lo valida la API, sin CHECK.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio-horas-acumuladas.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: el código nuevo lee las columnas al enviar cualquier nota y al mostrar el Libro,
-- así que sin ellas da «Unknown column»: ninguna nota sale y Correos no carga.
-- Se puede volver a correr: lo que ya existe se saltea.
-- Para deshacer: rollback-notas-firma-digital.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `notas_digitales`
  ADD COLUMN IF NOT EXISTS `espera_firma` tinyint(1) NOT NULL DEFAULT 0 AFTER `presentada_por_id`,
  ADD COLUMN IF NOT EXISTS `pdf_firmado` mediumblob DEFAULT NULL AFTER `espera_firma`,
  ADD COLUMN IF NOT EXISTS `firmado_por` varchar(255) DEFAULT NULL AFTER `pdf_firmado`,
  ADD COLUMN IF NOT EXISTS `firmado_at` datetime DEFAULT NULL AFTER `firmado_por`,
  ADD COLUMN IF NOT EXISTS `firma_subida_por` int(11) DEFAULT NULL AFTER `firmado_at`,
  ADD KEY IF NOT EXISTS `fk_notas_firma_subida_por` (`firma_subida_por`),
  ADD CONSTRAINT `fk_notas_firma_subida_por` FOREIGN KEY IF NOT EXISTS (`firma_subida_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

ALTER TABLE `notas_digitales_config`
  ADD COLUMN IF NOT EXISTS `firma_digital_activa` tinyint(1) NOT NULL DEFAULT 0 AFTER `updated_by`;

-- Para verificar, en la misma pestaña SQL: la primera tiene que dar 5 filas y la segunda, 1, con 0
--   SHOW COLUMNS FROM notas_digitales WHERE Field IN ('espera_firma', 'pdf_firmado', 'firmado_por', 'firmado_at', 'firma_subida_por');
--   SELECT firma_digital_activa FROM notas_digitales_config;
