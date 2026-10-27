-- =====================================================
-- RPAD - Mi espacio: la agenda (los eventos, con quién se comparte cada uno, los emails y los recordatorios)
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-26-mi-espacio-agenda-design.md (sección 3)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce las cuatro
-- tablas nuevas y no las lee).
-- Tablas nuevas:
--   mi_espacio_eventos: los eventos de la agenda, personales (solo los ve quien los creó) o compartidos (compartido), con
--   las personas elegidas o con toda la administración (para_todos: es una marca, no una lista). La fecha y las horas son
--   hora argentina, sin pasar a UTC; hasta es opcional. recordatorio: 'ninguno', '1h', '2h' (de entrada) o 'dia_anterior'.
--   Lo cambia y lo borra solo quien lo creó; baja lógica con activo.
--   mi_espacio_evento_personas: con quién se compartió cada evento y si esa persona apagó su recordatorio
--   (sin_recordatorio). En un evento para todos, solo tienen fila las personas que apagaron el suyo.
--   mi_espacio_evento_envios: qué email salió a quién (tipo: 'recordatorio', 'invitacion', 'cambio' o 'cancelacion'), para
--   qué momento del evento (para), cuándo (enviado_at, NULL mientras el recordatorio está reservado) y si salió (success).
--   Un recordatorio no se repite: la clave única uq_mi_espacio_evento_envios_recordatorio (evento, persona, para y
--   recordatorio_unico) vale solo para los recordatorios, porque recordatorio_unico es una columna generada que da 1 en los
--   recordatorios y NULL en el resto. Las invitaciones, los cambios y las cancelaciones se pueden repetir.
--   mi_espacio_eventos_corridas: una sola fila (id = 1), con la última corrida de los recordatorios, para Correos → Estado.
-- Si se borrara un evento por SQL, se borran sus personas y sus envíos; si se borrara a una persona, su lugar en los eventos
-- y sus envíos, y los eventos que creó quedan sin autor (creado_por NULL). Los usuarios no se borran: se desactivan.
-- ORDEN: correr ANTES de subir el código nuevo, después de migracion-mi-espacio.sql (phpMyAdmin > base del RPAD > pestaña
-- SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-mi-espacio-agenda.sql
-- =====================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `mi_espacio_eventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `creado_por` int(11) DEFAULT NULL,
  `titulo` varchar(150) NOT NULL,
  `detalle` text DEFAULT NULL,
  `fecha` date NOT NULL,
  `desde` time NOT NULL,
  `hasta` time DEFAULT NULL,
  `compartido` tinyint(1) NOT NULL DEFAULT 0,
  `para_todos` tinyint(1) NOT NULL DEFAULT 0,
  `recordatorio` enum('ninguno','1h','2h','dia_anterior') NOT NULL DEFAULT '2h',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mi_espacio_eventos_fecha` (`fecha`,`activo`),
  KEY `fk_mi_espacio_eventos_creado_por` (`creado_por`),
  CONSTRAINT `fk_mi_espacio_eventos_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_evento_personas` (
  `evento_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `sin_recordatorio` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`evento_id`,`usuario_id`),
  KEY `fk_mi_espacio_evento_personas_usuario` (`usuario_id`),
  CONSTRAINT `fk_mi_espacio_evento_personas_evento` FOREIGN KEY (`evento_id`) REFERENCES `mi_espacio_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_evento_personas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_evento_envios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `evento_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `tipo` enum('recordatorio','invitacion','cambio','cancelacion') NOT NULL,
  `para` datetime NOT NULL,
  `enviado_at` datetime DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `recordatorio_unico` tinyint(1) GENERATED ALWAYS AS (case when `tipo` = 'recordatorio' then 1 end) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mi_espacio_evento_envios_recordatorio` (`evento_id`,`usuario_id`,`para`,`recordatorio_unico`),
  KEY `fk_mi_espacio_evento_envios_usuario` (`usuario_id`),
  CONSTRAINT `fk_mi_espacio_evento_envios_evento` FOREIGN KEY (`evento_id`) REFERENCES `mi_espacio_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mi_espacio_evento_envios_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mi_espacio_eventos_corridas` (
  `id` tinyint(4) NOT NULL,
  `inicio_at` datetime DEFAULT NULL,
  `fin_at` datetime DEFAULT NULL,
  `resultado` varchar(1000) DEFAULT NULL,
  `con_errores` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
