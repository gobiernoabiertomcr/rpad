-- =====================================================
-- RPAD - El dato de la quincena: el correo que manda el RPAD y la infografía editable (SVG)
-- =====================================================
-- Spec: docs/superpowers/specs/2026-11-12-dato-quincena-correo-design.md (sección 7)
-- Solo agrega: no borra columnas ni datos. El código anterior no las lee y nunca guarda 'infografia_svg': sigue funcionando con
-- esta estructura.
-- Valor nuevo, al final de la lista (los de antes no cambian):
--   dato_quincena_adjuntos.campo: 'infografia_svg', la infografía editable que puede mandar Datito con cada edición.
-- Tablas nuevas, sin CHECK (valida la API):
--   dato_quincena_correo_config: una sola fila (id = 1, la carga esta migración), con el envío automático (envio_activo,
--   apagado al crearla), quién y cuándo lo cambió (FK a usuarios ON DELETE SET NULL) y la última corrida, para Correos → Estado.
--   dato_quincena_destinatarios: quién recibe el correo, una fila por persona (FK a usuarios ON DELETE CASCADE), con quién y
--   cuándo la sumó. Vacía al crearla: las personas se tildan en la página.
--   dato_quincena_correos: el correo de cada edición con envío, una fila por edición (FK a las ediciones ON DELETE CASCADE), con
--   su estado, el motivo si no se envió, la hora del primer envío que salió y la última corrida.
--   dato_quincena_envios: cada envío a cada persona (el automático, un reenvío o una prueba), con la dirección usada, el estado,
--   los intentos y quién pidió un reenvío o una prueba. El automático es uno solo por edición y persona: unico es una columna
--   generada (STORED, nadie la escribe) que da 1 en el automático y NULL en los reenvíos y las pruebas, y como dos NULL nunca
--   chocan en un UNIQUE, uq_dato_quincena_envio_automatico (edicion_id, usuario_id, unico) frena un segundo automático y deja
--   repetir los reenvíos y las pruebas.
-- Borrar a una persona la saca de la lista y borra sus envíos; borrar una edición (solo con SQL a mano: el RPAD no las borra)
-- borra su correo y sus envíos.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-dato-quincena.sql (phpMyAdmin > base del RPAD > pestaña
-- SQL, pegar y Continuar). Es obligatoria: sin las tablas, la página del correo y la corrida del dato de la quincena dan error, y
-- sin el valor nuevo, una edición que traiga la infografía editable no se puede guardar.
-- Se puede volver a correr: el MODIFY deja lo mismo, si una tabla ya existe se saltea y la fila 1 no se pisa (INSERT IGNORE: si
-- ya se prendió el envío, sigue prendido).
-- Para deshacer: rollback-dato-quincena-correo.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `dato_quincena_adjuntos` MODIFY `campo` enum('infografia_png','correo_texto','calculos','infografia_svg') NOT NULL;

CREATE TABLE IF NOT EXISTS `dato_quincena_correo_config` (
  `id` tinyint(4) NOT NULL,
  `envio_activo` tinyint(1) NOT NULL DEFAULT 0,
  `cambiado_por` int(11) DEFAULT NULL,
  `cambiado_at` datetime DEFAULT NULL,
  `corrida_inicio_at` datetime DEFAULT NULL,
  `corrida_fin_at` datetime DEFAULT NULL,
  `corrida_resultado` varchar(500) DEFAULT NULL,
  `corrida_con_errores` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_dato_quincena_correo_config_usuario` (`cambiado_por`),
  CONSTRAINT `fk_dato_quincena_correo_config_usuario` FOREIGN KEY (`cambiado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_destinatarios` (
  `usuario_id` int(11) NOT NULL,
  `agregado_por` int(11) DEFAULT NULL,
  `agregado_at` datetime NOT NULL,
  PRIMARY KEY (`usuario_id`),
  KEY `fk_dato_quincena_destinatario_agregado_por` (`agregado_por`),
  CONSTRAINT `fk_dato_quincena_destinatario_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_destinatario_agregado_por` FOREIGN KEY (`agregado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_correos` (
  `edicion_id` int(11) NOT NULL,
  `estado` enum('programada','enviada','parcial','fallida','no_enviada') NOT NULL,
  `motivo` enum('apagado','vieja','mas_nueva','sin_lista') DEFAULT NULL,
  `enviada_at` datetime DEFAULT NULL,
  `creada_at` datetime NOT NULL,
  `ultima_corrida_at` datetime DEFAULT NULL,
  PRIMARY KEY (`edicion_id`),
  KEY `idx_dato_quincena_correo_estado` (`estado`),
  CONSTRAINT `fk_dato_quincena_correo_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dato_quincena_envios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `edicion_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `tipo` enum('automatico','reenvio','prueba') NOT NULL,
  `unico` tinyint(1) GENERATED ALWAYS AS (if(`tipo` = 'automatico',1,NULL)) STORED,
  `estado` enum('pendiente','enviando','enviado','fallido','licencia','omitido') NOT NULL,
  `intentos` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `enviado_at` datetime DEFAULT NULL,
  `ultimo_intento_at` datetime DEFAULT NULL,
  `error` varchar(200) DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `creado_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dato_quincena_envio_automatico` (`edicion_id`, `usuario_id`, `unico`),
  KEY `fk_dato_quincena_envio_usuario` (`usuario_id`),
  KEY `fk_dato_quincena_envio_creado_por` (`creado_por`),
  CONSTRAINT `fk_dato_quincena_envio_edicion` FOREIGN KEY (`edicion_id`) REFERENCES `dato_quincena_ediciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_envio_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dato_quincena_envio_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `dato_quincena_correo_config` (`id`, `envio_activo`) VALUES (1, 0);

-- Para verificar, en la misma pestaña SQL: tiene que dar 7 filas (las tres del archivo de las ediciones y las cuatro del correo)
--   SHOW TABLES LIKE 'dato_quincena%';
-- y el campo de dato_quincena_adjuntos tiene que terminar en 'infografia_svg'
--   SHOW COLUMNS FROM dato_quincena_adjuntos LIKE 'campo';
