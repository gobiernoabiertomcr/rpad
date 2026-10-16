-- =====================================================
-- RPAD - Deshace migracion-licencias-firmas.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden las licencias, las firmas cargadas en Mi Perfil, el firmante titular, quién firmó cada nota, el historial
-- de licencias (borra de usuarios_auditoria las filas licencia_cargada, licencia_editada y licencia_anulada) y los
-- avisos al superadmin retenidos. Las notas vuelven a salir con la firma cargada en Correos (que la migración no tocó).
-- notas_digitales.tipo (con 'autorizacion') y notas_digitales.gestion (que admite NULL) quedan ampliados a propósito:
-- las notas de autorización son notas numeradas del libro y no se borran. El código anterior no falla con ellas, pero
-- su libro las muestra con el tipo y la gestión vacíos ("undefined"): no conoce el tipo 'autorizacion'.
-- =====================================================

SET NAMES utf8mb4;

DELETE FROM `usuarios_auditoria` WHERE `accion` IN ('licencia_cargada','licencia_editada','licencia_anulada');

ALTER TABLE `usuarios_auditoria`
  DROP COLUMN IF EXISTS `aviso_retenido`,
  MODIFY COLUMN `accion` enum('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado') NOT NULL;

ALTER TABLE `notas_digitales_datasets` DROP COLUMN IF EXISTS `cuenta_desde`;

ALTER TABLE `notas_digitales`
  DROP COLUMN IF EXISTS `presentada_por_id`,
  DROP COLUMN IF EXISTS `firmante_id`;

ALTER TABLE `notas_digitales_config` DROP COLUMN IF EXISTS `firmante_usuario_id`;

DROP TABLE IF EXISTS `usuarios_firmas`;
DROP TABLE IF EXISTS `usuarios_licencias`;
