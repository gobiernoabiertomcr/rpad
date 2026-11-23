-- =====================================================
-- RPAD - El dato de la quincena: la votación de la principal del equipo
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md (sección 1)
-- Solo agrega: no borra columnas ni datos. El código anterior no la lee: sigue funcionando con esta estructura.
-- Cuatro tablas nuevas, sin CHECK (valida la API):
--   dato_quincena_votantes: quiénes pueden votar (una fila por persona; borrar a la persona la saca; quien la agregó queda en NULL si se borra).
--   dato_quincena_votaciones: una fila por edición que se vota (la clave es la edición); la existencia de la fila es lo que dice que la
--   edición se vota. Guarda cuándo se creó, el cierre, cuándo se selló y cómo salió el aviso (enviado, parcial, fallido, apagado o no corresponde).
--   dato_quincena_votacion_personas: quiénes votaban en esa edición, congelado al crearla (borrar a la persona deja la fila con usuario en NULL).
--   dato_quincena_votos: los votos de cada persona, el orden de la propuesta y cuándo (nunca un UPDATE ni un DELETE desde el RPAD).
-- Lo archivado no cambia: la edición, sus propuestas y la principal de Datito quedan como llegaron.
-- Borrar una edición (solo con SQL a mano: el RPAD no las borra) borra su votación, sus personas y, en cascada, sus votos.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-dato-quincena-principal-equipo.sql (phpMyAdmin > base del RPAD >
-- pestaña SQL, pegar y Continuar). Es obligatoria: sin las tablas, la lista y el detalle de las ediciones dan 500.
-- Se puede volver a correr: si las tablas ya existen, se saltean y no se pierde ningún voto.
-- Para deshacer: rollback-dato-quincena-votacion.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `dato_quincena_votantes` (
  `usuario_id` int(11) NOT NULL,
  `agregado_por` int(11) DEFAULT NULL,
  `agregado_at` datetime NOT NULL,
  PRIMARY KEY (`usuario_id`),
  KEY `fk_dato_quincena_votantes_agregado_por` (`agregado_por`),
  CONSTRAINT `fk_dato_quincena_votantes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_votantes_agregado_por` FOREIGN KEY (`agregado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_votaciones` (
  `edicion_id` int(11) NOT NULL,
  `creada_at` datetime NOT NULL,
  `cierre_at` datetime DEFAULT NULL,
  `sellada_at` datetime DEFAULT NULL,
  `aviso` enum('enviado','parcial','fallido','apagado','no_corresponde') DEFAULT NULL,
  `aviso_at` datetime DEFAULT NULL,
  PRIMARY KEY (`edicion_id`),
  CONSTRAINT `fk_dato_quincena_votaciones_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_votacion_personas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_votacion_persona` (`edicion_id`, `usuario_id`),
  KEY `fk_dato_quincena_votacion_personas_usuario` (`usuario_id`),
  CONSTRAINT `fk_dato_quincena_votacion_personas_votacion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_votaciones` (`edicion_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_votacion_personas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_votos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `persona_id` int(11) NOT NULL,
  `orden` varchar(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `votado_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_dato_quincena_votos_persona` (`persona_id`),
  CONSTRAINT `fk_dato_quincena_votos_persona` FOREIGN KEY (`persona_id`) REFERENCES `dato_quincena_votacion_personas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para verificar, en la misma pestaña SQL: tiene que dar 12 filas (las tres del archivo, las cuatro del correo, la de la principal del equipo y estas cuatro)
--   SHOW TABLES LIKE 'dato_quincena%';
