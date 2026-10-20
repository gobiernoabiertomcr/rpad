-- =====================================================
-- RPAD - «Requiere nota DGMIT»: carga inicial de los 45 datasets de gestión externa
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md (sección 1.2)
-- Sale del Excel que completó el usuario (RPAD-requiere-nota.xlsx, spec del 20/10/2026): 35 datasets con Sí (1) y 10 con No (0).
-- No requieren nota (0): 10 (Pauta Publicitaria), 30 (Puntos Fijos de la Red de Nivelación Argentina), 35 y 36 (EANA),
-- 50, 63, 77 y 78 (INDEC), 74 (TMDA, se extraen en web Vialidad) y 81 (Cantidad de empleados municipales, se extraen del
-- Boletín Oficial). Los otros 35 externos requieren nota (1). Los 36 de gestión interna quedan en NULL: no se tocan.
-- Requiere migracion-requiere-nota.sql (la columna requiere_nota).
-- ORDEN: correr DESPUÉS de migracion-requiere-nota.sql y ANTES de subir el código nuevo, para que los datos estén
-- completos desde el primer momento (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- SE CORRE UNA SOLA VEZ. Después, "Requiere nota DGMIT" cambia desde la aplicación, con doble verificación. Cada UPDATE
-- solo escribe si el dataset sigue siendo externo y todavía no tiene dato (requiere_nota IS NULL): si se vuelve a correr,
-- no pisa un cambio aprobado después.
-- VERIFICACIÓN: al final de este archivo hay una consulta (comentada). Después de correrlo, pegarla sola en la pestaña
-- SQL: tiene que dar 0 filas (ningún dataset externo activo sin dato).
-- =====================================================

SET NAMES utf8mb4;

-- 1. Presupuesto Municipal
UPDATE datasets SET requiere_nota = 1 WHERE id = 1 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 2. Gasto Público
UPDATE datasets SET requiere_nota = 1 WHERE id = 2 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 3. Funcionarios Públicos
UPDATE datasets SET requiere_nota = 1 WHERE id = 3 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 4. Castraciones de Animales
UPDATE datasets SET requiere_nota = 1 WHERE id = 4 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 5. Obra Pública
UPDATE datasets SET requiere_nota = 1 WHERE id = 5 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 6. Manejo de residuos sólidos urbanos en Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 1 WHERE id = 6 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 7. Infracciones de Tránsito
UPDATE datasets SET requiere_nota = 1 WHERE id = 7 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 8. Ejecución presupuestaria
UPDATE datasets SET requiere_nota = 1 WHERE id = 8 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 9. Pedidos de Acceso a la Información Pública
UPDATE datasets SET requiere_nota = 1 WHERE id = 9 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 10. Pauta Publicitaria
UPDATE datasets SET requiere_nota = 0 WHERE id = 10 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 11. Parque Automotor (Patentamiento)
UPDATE datasets SET requiere_nota = 1 WHERE id = 11 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 13. Siniestros viales por categoría
UPDATE datasets SET requiere_nota = 1 WHERE id = 13 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 22. Espacios Culturales
UPDATE datasets SET requiere_nota = 1 WHERE id = 22 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 23. Ocupación hotelera y cantidad de turistas
UPDATE datasets SET requiere_nota = 1 WHERE id = 23 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 25. Hotelería en Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 1 WHERE id = 25 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 27. Playones deportivos en espacios públicos de Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 1 WHERE id = 27 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 30. Puntos Fijos de la Red de Nivelación Argentina
UPDATE datasets SET requiere_nota = 0 WHERE id = 30 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 32. Medios Periodísticos
UPDATE datasets SET requiere_nota = 1 WHERE id = 32 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 33. Listado de Proveedores
UPDATE datasets SET requiere_nota = 1 WHERE id = 33 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 35. Movimientos aéreos del Aeropuerto Internacional General Mosconi
UPDATE datasets SET requiere_nota = 0 WHERE id = 35 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 36. Tráfico de pasajeros aéreos en Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 0 WHERE id = 36 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 42. Establecimientos Educativos de Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 1 WHERE id = 42 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 44. Resultados de Elecciones Generales
UPDATE datasets SET requiere_nota = 1 WHERE id = 44 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 46. Consumo de agua potable en Comodoro Rivadavia (mensual)
UPDATE datasets SET requiere_nota = 1 WHERE id = 46 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 48. Consumo de agua potable en Comodoro Rivadavia (anual)
UPDATE datasets SET requiere_nota = 1 WHERE id = 48 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 50. Evolución demográfica de Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 0 WHERE id = 50 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 52. Directores Generales de Planta Permanente
UPDATE datasets SET requiere_nota = 1 WHERE id = 52 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 53. Patrimonio Escultórico
UPDATE datasets SET requiere_nota = 1 WHERE id = 53 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 54. Gimnasios Municipales
UPDATE datasets SET requiere_nota = 1 WHERE id = 54 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 56. Guía Telefónica de áreas específicas de género
UPDATE datasets SET requiere_nota = 1 WHERE id = 56 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 57. Presupuesto con perspectiva de género
UPDATE datasets SET requiere_nota = 1 WHERE id = 57 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 58. Áreas específicas de género
UPDATE datasets SET requiere_nota = 1 WHERE id = 58 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 59. Entidades Religiosas
UPDATE datasets SET requiere_nota = 1 WHERE id = 59 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 61. Comercios habilitados por rubro
UPDATE datasets SET requiere_nota = 1 WHERE id = 61 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 63. Radios Censales Indec 2022
UPDATE datasets SET requiere_nota = 0 WHERE id = 63 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 69. Cantidad de usuarios del servicio de saneamiento (serie histórica)
UPDATE datasets SET requiere_nota = 1 WHERE id = 69 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 70. Cantidad de usuarios de energía eléctrica (serie histórica - por categoría)
UPDATE datasets SET requiere_nota = 1 WHERE id = 70 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 71. Cantidad de usuarios de energía eléctrica (serie histórica - total)
UPDATE datasets SET requiere_nota = 1 WHERE id = 71 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 72. Cantidad de usuarios del servicio de agua potable (serie histórica)
UPDATE datasets SET requiere_nota = 1 WHERE id = 72 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 73. Cantidad de usuarios del servicio de agua potable (anual)
UPDATE datasets SET requiere_nota = 1 WHERE id = 73 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 74. Tránsito Medio Diario Anual (TMDA) en Comodoro Rivadavia
UPDATE datasets SET requiere_nota = 0 WHERE id = 74 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 75. Puntos de Venta del Sistema de Estacionamiento Medido
UPDATE datasets SET requiere_nota = 1 WHERE id = 75 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 77. Población y Viviendas por Barrio Censo 2022
UPDATE datasets SET requiere_nota = 0 WHERE id = 77 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 78. Población por Radio Censal Censo 2022
UPDATE datasets SET requiere_nota = 0 WHERE id = 78 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
-- 81. Cantidad de empleados municipales (planta permanente y transitoria)
UPDATE datasets SET requiere_nota = 0 WHERE id = 81 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;

-- Verificación (tiene que dar 0 filas):
-- SELECT id, titulo FROM datasets WHERE activo = 1 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;
