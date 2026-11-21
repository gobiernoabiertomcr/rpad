-- =====================================================
-- RPAD - El dato de la quincena: la principal del equipo
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-21-dato-quincena-principal-equipo-design.md (sección 1)
-- Solo agrega: no borra columnas ni datos. El código anterior no la lee: sigue funcionando con esta estructura.
-- Tabla nueva, sin CHECK (valida la API):
--   dato_quincena_principal_equipo: la propuesta que administración elige como principal del equipo en cada edición, una fila por
--   elección (nunca un UPDATE ni un DELETE desde el RPAD): la vigente es la de mayor id de la edición. Apunta a la propuesta por la
--   edición y su orden (FK compuesta al UNIQUE uq_dato_quincena_orden, ON DELETE CASCADE) y a quien eligió (FK a usuarios ON DELETE
--   SET NULL), con la hora argentina de la elección. Lo archivado no cambia: la edición, sus propuestas y
--   dato_quincena_propuestas.principal (la principal de Datito) quedan como llegaron.
-- Borrar a una persona deja sus elecciones sin autor; borrar una edición (solo con SQL a mano: el RPAD no las borra) borra sus
-- propuestas y, en cascada, sus elecciones.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-dato-quincena-correo.sql (phpMyAdmin > base del RPAD > pestaña
-- SQL, pegar y Continuar). Es obligatoria: sin la tabla, la lista y el detalle de las ediciones dan 500.
-- Se puede volver a correr: si la tabla ya existe, se saltea y no se pierde ninguna elección.
-- Para deshacer: rollback-dato-quincena-principal-equipo.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `dato_quincena_principal_equipo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `orden` tinyint(3) unsigned NOT NULL,
  `elegida_por` int(11) DEFAULT NULL,
  `elegida_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_dato_quincena_principal_equipo_propuesta` (`edicion_id`, `orden`),
  KEY `fk_dato_quincena_principal_equipo_usuario` (`elegida_por`),
  CONSTRAINT `fk_dato_quincena_principal_equipo_propuesta` FOREIGN KEY (`edicion_id`, `orden`)
    REFERENCES `dato_quincena_propuestas` (`edicion_id`, `orden`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_principal_equipo_usuario` FOREIGN KEY (`elegida_por`)
    REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para verificar, en la misma pestaña SQL: tiene que dar 8 filas (las tres del archivo, las cuatro del correo y esta)
--   SHOW TABLES LIKE 'dato_quincena%';
