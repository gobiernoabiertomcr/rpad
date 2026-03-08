-- Migración: Hitos independientes de proyectos ("Logros del Área")
-- Permite crear hitos con proyecto_id = NULL para registrar reuniones, capacitaciones, eventos

-- Eliminar FK existente
ALTER TABLE proyecto_hitos DROP FOREIGN KEY fk_ph_proyecto;

-- Hacer proyecto_id nullable
ALTER TABLE proyecto_hitos MODIFY COLUMN proyecto_id int(11) DEFAULT NULL;

-- Recrear FK con CASCADE (solo aplica a valores no nulos)
ALTER TABLE proyecto_hitos ADD CONSTRAINT fk_ph_proyecto
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE;

-- Índice para consultas de logros
CREATE INDEX idx_ph_logros ON proyecto_hitos(proyecto_id, fecha);
