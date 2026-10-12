-- =====================================================
-- RPAD - Rol por defecto de usuarios nuevos: lector
-- =====================================================
-- Opcional y sin riesgo: solo cambia el valor por defecto de la columna, no
-- modifica ningún usuario existente. El código actual siempre indica el rol al
-- crear usuarios (npm run setup-admin), así que nada depende de este valor;
-- evita que un INSERT manual sin rol cree un administrador.
--
-- Ejecutar: mysql -u USUARIO -p NOMBRE_BASE < migracion-rol-default-lector.sql
-- =====================================================

ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'lector';
