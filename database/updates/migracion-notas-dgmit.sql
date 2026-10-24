-- =====================================================
-- RPAD - Notas DGMIT en el Seguimiento: el rol Colaborador y las tres tablas de las notas
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-24-notas-dgmit-design.md (secciones 1, 4 y 11)
-- Solo agrega: no borra columnas ni datos, y el código anterior sigue funcionando con esta estructura (no conoce el rol
-- colaborador, pero ninguna cuenta lo tiene hasta que el superadmin o un editor se lo asigne desde el panel de usuarios).
-- usuarios.rol suma 'colaborador' después de 'editor'; los roles que ya hay no cambian.
-- Tablas nuevas: notas_dgmit (cada nota que la DGMIT le mandó al área), notas_dgmit_datasets (qué datasets pide cada
-- nota) y notas_dgmit_historial (las correcciones y la anulación de cada nota). No se reusan las de Notas Digitales.
-- ORDEN: correr ANTES de subir el código nuevo (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- Se puede volver a correr si se cortó a mitad: lo que ya existe se saltea.
-- Para deshacer: rollback-notas-dgmit.sql
-- =====================================================

SET NAMES utf8mb4;

ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('superadmin','admin','editor','colaborador','lector') NOT NULL DEFAULT 'lector';

CREATE TABLE IF NOT EXISTS `notas_dgmit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(40) NOT NULL,
  `tipo` enum('solicitud','reiteracion') NOT NULL,
  `recibida` date NOT NULL,
  `anulada` tinyint(1) NOT NULL DEFAULT 0,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notas_dgmit_recibida` (`recibida`),
  KEY `fk_notas_dgmit_creado_por` (`creado_por`),
  CONSTRAINT `fk_notas_dgmit_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notas_dgmit_datasets` (
  `nota_id` int(11) NOT NULL,
  `dataset_id` int(11) NOT NULL,
  PRIMARY KEY (`nota_id`,`dataset_id`),
  KEY `idx_notas_dgmit_datasets_dataset` (`dataset_id`),
  CONSTRAINT `fk_notas_dgmit_datasets_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas_dgmit` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notas_dgmit_datasets_dataset` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notas_dgmit_historial` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nota_id` int(11) NOT NULL,
  `accion` enum('correccion','anulacion') NOT NULL,
  `motivo` varchar(500) NOT NULL,
  `anteriores` longtext DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notas_dgmit_historial_nota` (`nota_id`),
  KEY `fk_notas_dgmit_historial_usuario` (`usuario_id`),
  CONSTRAINT `fk_notas_dgmit_historial_nota` FOREIGN KEY (`nota_id`) REFERENCES `notas_dgmit` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notas_dgmit_historial_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
