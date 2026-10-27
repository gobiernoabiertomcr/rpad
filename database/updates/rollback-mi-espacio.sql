-- =====================================================
-- RPAD - Deshace migracion-mi-espacio.sql
-- =====================================================
-- Usar solo si hay que volver a la versión anterior del código.
-- ORDEN: primero volver a subir los archivos anteriores y hacer Restart; después correr esto en phpMyAdmin (pestaña SQL).
-- Se pierden los años, los saldos iniciales, las licencias, las horas extras y los avisos de vencimiento enviados que se
-- cargaron en Mi espacio: las seis tablas se borran con lo que tengan. Si hace falta conservarlos, exportar las tablas antes.
-- Las licencias que pasaron a Configuración → Licencias quedan allí, como cualquier otra (sin la marca «Cargada desde Mi
-- espacio»): si alguna no tiene que seguir, se anula desde Configuración. Los usuarios y el resto de los datos no se tocan.
-- Si también se deshacen las licencias y las firmas (rollback-licencias-firmas.sql), esto va antes: mi_espacio_licencias
-- apunta a usuarios_licencias y, sin borrarla primero, aquel rollback no puede borrar esa tabla.
-- Borra las seis en el orden inverso al de la migración.
-- Se puede volver a correr: lo que ya no existe se saltea.
-- =====================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `mi_espacio_avisos`;
DROP TABLE IF EXISTS `mi_espacio_horas_extras`;
DROP TABLE IF EXISTS `mi_espacio_licencias`;
DROP TABLE IF EXISTS `mi_espacio_saldos`;
DROP TABLE IF EXISTS `mi_espacio_arranque`;
DROP TABLE IF EXISTS `mi_espacio_anios`;
