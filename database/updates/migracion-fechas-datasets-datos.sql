-- =====================================================
-- RPAD - Fechas de los datasets: carga inicial de "Datos al" y tipo de pedido de los 80 datasets
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-17-fechas-datasets-design.md (sección 12.1)
-- Sale de la planilla de "Datos al" que revisó el usuario el 17/10/2026: "Datos al" es la fecha corregida si la planilla
-- la trae y si no la estimada, y el tipo de pedido es el corregido si lo trae y si no el propuesto.
-- "Datos al" es siempre fin de mes, con febrero en 28; en los de tipo "ejercicio" es el 31/12 del ejercicio publicado.
-- Próxima edición: el Censo 2022 (50, 63, 77 y 78) lleva el 31/05/2022, la fecha de referencia de la edición. El 44
-- (Resultados de Elecciones Generales) queda sin "Datos al": la fecha de la elección se carga después desde el formulario.
-- Requiere migracion-fechas-datasets.sql (las columnas datos_al y tipo_pedido).
-- ORDEN: correr DESPUÉS de migracion-fechas-datasets.sql y ANTES de subir el código nuevo, para que los datos estén
-- completos desde el primer momento (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar).
-- SE CORRE UNA SOLA VEZ. Después, "Datos al" y el tipo de pedido cambian desde la aplicación, con doble verificación:
-- volver a correr este archivo pisaría esos cambios.
-- =====================================================

SET NAMES utf8mb4;

-- 1. Presupuesto Municipal
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'ejercicio' WHERE id = 1;
-- 2. Gasto Público
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 2;
-- 3. Funcionarios Públicos
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'foto' WHERE id = 3;
-- 4. Castraciones de Animales
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 4;
-- 5. Obra Pública
UPDATE datasets SET datos_al = '2025-06-30', tipo_pedido = 'acumulado' WHERE id = 5;
-- 6. Manejo de residuos sólidos urbanos en Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 6;
-- 7. Infracciones de Tránsito
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 7;
-- 8. Ejecución presupuestaria
UPDATE datasets SET datos_al = '2024-12-31', tipo_pedido = 'acumulado' WHERE id = 8;
-- 9. Pedidos de Acceso a la Información Pública
UPDATE datasets SET datos_al = '2026-08-31', tipo_pedido = 'acumulado' WHERE id = 9;
-- 10. Pauta Publicitaria
UPDATE datasets SET datos_al = '2026-07-31', tipo_pedido = 'acumulado' WHERE id = 10;
-- 11. Parque Automotor (Patentamiento)
UPDATE datasets SET datos_al = '2022-12-31', tipo_pedido = 'acumulado' WHERE id = 11;
-- 12. Seguridad Pública
UPDATE datasets SET datos_al = '2025-11-30', tipo_pedido = 'relevamiento' WHERE id = 12;
-- 13. Siniestros viales por categoría
UPDATE datasets SET datos_al = '2023-12-31', tipo_pedido = 'acumulado' WHERE id = 13;
-- 14. Guía Práctica: Licencia CC BY-SA 4.0
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'eventual' WHERE id = 14;
-- 15. Guía Práctica Estructuración de Datos Abiertos 2025
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'eventual' WHERE id = 15;
-- 16. Guía Práctica de Apertura de Datos
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'eventual' WHERE id = 16;
-- 17. Paradas de transporte público
UPDATE datasets SET datos_al = '2023-09-30', tipo_pedido = 'relevamiento' WHERE id = 17;
-- 18. Sucursales Bancarias y Financieras de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 18;
-- 19. Comedores Comunitarios
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 19;
-- 20. Jardines Maternales Comunitarios
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 20;
-- 21. Infraestructura de Salud Privada
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 21;
-- 22. Espacios Culturales
UPDATE datasets SET datos_al = '2025-02-28', tipo_pedido = 'foto' WHERE id = 22;
-- 23. Ocupación hotelera y cantidad de turistas
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 23;
-- 24. Distancias desde Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 24;
-- 25. Hotelería en Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'foto' WHERE id = 25;
-- 26. Infraestructura deportiva al aire libre en Comodoro Rivadavia
UPDATE datasets SET datos_al = '2023-03-31', tipo_pedido = 'relevamiento' WHERE id = 26;
-- 27. Playones deportivos en espacios públicos de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-02-28', tipo_pedido = 'foto' WHERE id = 27;
-- 28. Proyectos de Inteligencia Artificial en la administración pública municipal
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 28;
-- 29. Centros de jubilados
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 29;
-- 30. Puntos Fijos de la Red de Nivelación Argentina
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'eventual' WHERE id = 30;
-- 31. Espacios reservados para vehículos de personas con movilidad reducida
UPDATE datasets SET datos_al = '2026-03-31', tipo_pedido = 'relevamiento' WHERE id = 31;
-- 32. Medios Periodísticos
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'foto' WHERE id = 32;
-- 33. Listado de Proveedores
UPDATE datasets SET datos_al = '2025-06-30', tipo_pedido = 'foto' WHERE id = 33;
-- 34. Superficie de Espacio Verde por habitantes
UPDATE datasets SET datos_al = '2026-06-30', tipo_pedido = 'relevamiento' WHERE id = 34;
-- 35. Movimientos aéreos del Aeropuerto Internacional General Mosconi
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 35;
-- 36. Tráfico de pasajeros aéreos en Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 36;
-- 37. Fuerzas Armadas y Fuerzas de Seguridad
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 37;
-- 38. Escala salarial municipal (planta permanente)
UPDATE datasets SET datos_al = '2025-05-31', tipo_pedido = 'relevamiento' WHERE id = 38;
-- 39. Centros de Promoción Barrial
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'relevamiento' WHERE id = 39;
-- 40. Centrales de generación eléctrica
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'relevamiento' WHERE id = 40;
-- 41. Proyecto de Ordenanza Marco para el uso ético de la IA
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 41;
-- 42. Establecimientos Educativos de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2026-03-31', tipo_pedido = 'foto' WHERE id = 42;
-- 43. Espacios Verdes de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2026-06-30', tipo_pedido = 'relevamiento' WHERE id = 43;
-- 44. Resultados de Elecciones Generales
UPDATE datasets SET datos_al = NULL, tipo_pedido = 'edicion' WHERE id = 44;
-- 45. Dependencias Municipales de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'relevamiento' WHERE id = 45;
-- 46. Consumo de agua potable en Comodoro Rivadavia (mensual)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 46;
-- 47. Ordenanza de Gobierno Abierto
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 47;
-- 48. Consumo de agua potable en Comodoro Rivadavia (anual)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 48;
-- 49. Consulados y Viceconsulados
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'relevamiento' WHERE id = 49;
-- 50. Evolución demográfica de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2022-05-31', tipo_pedido = 'edicion' WHERE id = 50;
-- 51. Museos de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'relevamiento' WHERE id = 51;
-- 52. Directores Generales de Planta Permanente
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'foto' WHERE id = 52;
-- 53. Patrimonio Escultórico
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 53;
-- 54. Gimnasios Municipales
UPDATE datasets SET datos_al = '2023-12-31', tipo_pedido = 'eventual' WHERE id = 54;
-- 55. Centros de Salud Públicos
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 55;
-- 56. Guía Telefónica de áreas específicas de género
UPDATE datasets SET datos_al = '2026-04-30', tipo_pedido = 'foto' WHERE id = 56;
-- 57. Presupuesto con perspectiva de género
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'ejercicio' WHERE id = 57;
-- 58. Áreas específicas de género
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'foto' WHERE id = 58;
-- 59. Entidades Religiosas
UPDATE datasets SET datos_al = '2025-02-28', tipo_pedido = 'foto' WHERE id = 59;
-- 60. Sucursales de Correo Postal
UPDATE datasets SET datos_al = '2026-05-31', tipo_pedido = 'relevamiento' WHERE id = 60;
-- 61. Comercios habilitados por rubro
UPDATE datasets SET datos_al = '2025-06-30', tipo_pedido = 'acumulado' WHERE id = 61;
-- 62. Líneas de transporte público
UPDATE datasets SET datos_al = '2021-12-31', tipo_pedido = 'relevamiento' WHERE id = 62;
-- 63. Radios Censales Indec 2022
UPDATE datasets SET datos_al = '2022-05-31', tipo_pedido = 'edicion' WHERE id = 63;
-- 64. Límites administrativos (Departamento y Ejido)
UPDATE datasets SET datos_al = '2025-09-30', tipo_pedido = 'eventual' WHERE id = 64;
-- 65. Estaciones de Servicio
UPDATE datasets SET datos_al = '2025-10-31', tipo_pedido = 'relevamiento' WHERE id = 65;
-- 66. Barrios de Comodoro Rivadavia
UPDATE datasets SET datos_al = '2026-06-30', tipo_pedido = 'eventual' WHERE id = 66;
-- 67. Cuarteles y destacamentos de Bomberos Voluntarios
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'relevamiento' WHERE id = 67;
-- 68. Sedes de Asociaciones Vecinales
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'relevamiento' WHERE id = 68;
-- 69. Cantidad de usuarios del servicio de saneamiento (serie histórica)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 69;
-- 70. Cantidad de usuarios de energía eléctrica (serie histórica - por categoría)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 70;
-- 71. Cantidad de usuarios de energía eléctrica (serie histórica - total)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 71;
-- 72. Cantidad de usuarios del servicio de agua potable (serie histórica)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 72;
-- 73. Cantidad de usuarios del servicio de agua potable (anual)
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'acumulado' WHERE id = 73;
-- 74. Tránsito Medio Diario Anual (TMDA) en Comodoro Rivadavia
UPDATE datasets SET datos_al = '2025-12-31', tipo_pedido = 'anio_anterior' WHERE id = 74;
-- 75. Puntos de Venta del Sistema de Estacionamiento Medido
UPDATE datasets SET datos_al = '2026-02-28', tipo_pedido = 'foto' WHERE id = 75;
-- 76. Estimación de Población y Viviendas 2021
UPDATE datasets SET datos_al = '2021-11-30', tipo_pedido = 'eventual' WHERE id = 76;
-- 77. Población y Viviendas por Barrio Censo 2022
UPDATE datasets SET datos_al = '2022-05-31', tipo_pedido = 'edicion' WHERE id = 77;
-- 78. Población por Radio Censal Censo 2022
UPDATE datasets SET datos_al = '2022-05-31', tipo_pedido = 'edicion' WHERE id = 78;
-- 79. Relevamiento de espacios reservados para estacionamiento de motos
UPDATE datasets SET datos_al = '2026-03-31', tipo_pedido = 'relevamiento' WHERE id = 79;
-- 80. Rampas para personas con movilidad reducida
UPDATE datasets SET datos_al = '2026-04-30', tipo_pedido = 'relevamiento' WHERE id = 80;
