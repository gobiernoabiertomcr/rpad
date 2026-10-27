-- =====================================================
-- RPAD - Feriados: la precarga de 2026 y 2027, con la fuente de cada fecha
-- =====================================================
-- Spec: docs/superpowers/specs/2026-10-26-feriados-design.md (sección 5)
-- Las fechas salen de la lista verificada de docs/superpowers/specs/2026-10-26-feriados-fuentes.md (sección «Respuestas del
-- usuario y lista para la precarga»), con las respuestas del usuario a las dudas del 26/10/2026: 28 filas, 19 de 2026 y 9 de
-- 2027. Cada INSERT lleva arriba, en su propio renglón, la norma que fija esa fecha y dónde se leyó.
-- No van los 9 feriados nacionales fijos (01/01, 24/03, 02/04, 01/05, 25/05, 20/06, 09/07, 08/12 y 25/12): salen del código.
-- Las que se repiten todos los años (el aniversario de Comodoro Rivadavia, el 23/02; la gesta galesa, el 28/07, y el Día del
-- Empleado Municipal, el 08/11) se cargan una sola vez, con la fecha de 2026: en 2027 rigen por proyección, sin fila propia.
-- Lo que todavía no está decretado no se carga acá: se carga desde Configuración → Feriados cuando salga. Son los días no
-- laborables con fines turísticos de 2027, el 20/11/2027 (cae sábado: la Jefatura de Gabinete puede pasarlo a un lunes o a un
-- viernes), el 30/04/2027 de Chubut (lo fija el decreto provincial del calendario de 2027), un posible traslado del
-- 13/12/2026 (cae domingo: lo decide un decreto provincial), los asuetos municipales de fin de año y las resoluciones que
-- corran de día el aniversario o el Día del Empleado Municipal.
-- Solo agrega: escribe en feriados, sin quién las cargó (creado_por NULL), y no toca feriados_no_rige.
-- Requiere migracion-feriados.sql (la tabla feriados).
-- ORDEN: correr DESPUÉS de migracion-feriados.sql (phpMyAdmin > base del RPAD > pestaña SQL, pegar y Continuar), antes de
-- subir el código: así la pestaña Feriados arranca con la precarga. El código anterior no lee la tabla; si se corre después de
-- subir el código, también anda.
-- Se puede volver a correr: un feriado con la misma fecha y el mismo nombre no se vuelve a cargar, aunque se haya dado de baja
-- desde la pestaña. Ojo: si desde la pestaña se corrigió la fecha o el nombre de uno de estos, volver a correrlo lo carga de
-- nuevo con la fecha y el nombre de acá.
-- VERIFICACIÓN: al final de este archivo hay una consulta (comentada). Después de correrlo, pegarla sola en la pestaña SQL (sin
-- el «-- » del principio): da una fila con 28 filas, 19 de 2026, 9 de 2027 y 3 que se repiten. Cuenta las filas sin quién las
-- cargó, las de la precarga: las que se cargan desde la pestaña llevan quién las cargó.
-- Para deshacer: rollback-feriados.sql (borra las dos tablas: se pierden también los feriados cargados desde la pestaña).
-- =====================================================

SET NAMES utf8mb4;

-- Los de 2026 (19)
-- Fuente: Res. 2809/25, confirmada por el usuario; prensa (https://www.adnsur.com.ar/sociedad/la-municipalidad-de-comodoro-decreto-asueto-administrativo-para-cuatro-dias-de-fin-de-ano_a69460dc39a0e276960f13c2c)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-01-02', 'Asueto administrativo municipal', 'no_laborable', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-01-02' AND nombre = 'Asueto administrativo municipal');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-02-16', 'Carnaval', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-02-16' AND nombre = 'Carnaval');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-02-17', 'Carnaval', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-02-17' AND nombre = 'Carnaval');
-- Fuente: Res. N° 0220-26, prensa (https://comodoro24.com.ar/el-municipio-declaro-asueto-administrativo-por-el-125-aniversario-de-comodoro/); antecedente Res. 368/23 (https://www.comodoro.gov.ar/intranet/2023/02/asueto-23-de-febrero/)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-02-23', 'Aniversario de Comodoro Rivadavia', 'municipal', NULL, 1, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-02-23' AND nombre = 'Aniversario de Comodoro Rivadavia');
-- Fuente: Resolución 164/2025 JGM (https://www.argentina.gob.ar/normativa/nacional/norma-421799/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-03-23', 'Día no laborable con fines turísticos', 'no_laborable', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-03-23' AND nombre = 'Día no laborable con fines turísticos');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-04-02', 'Jueves Santo', 'no_laborable', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-04-02' AND nombre = 'Jueves Santo');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-04-03', 'Viernes Santo', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-04-03' AND nombre = 'Viernes Santo');
-- Fuente: Ley I N° 85, art. 1, inc. c) (https://koha.chubut.edu.ar/normativas/ley/leyI_85.PDF)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-04-30', 'Plebiscito de 1902', 'provincial', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-04-30' AND nombre = 'Plebiscito de 1902');
-- Fuente: Ley 27.399, arts. 1 y 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-06-15', 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes', 'nacional', '2026-06-17', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-06-15' AND nombre = 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes');
-- Fuente: Resolución 164/2025 JGM (https://www.argentina.gob.ar/normativa/nacional/norma-421799/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-07-10', 'Día no laborable con fines turísticos', 'no_laborable', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-07-10' AND nombre = 'Día no laborable con fines turísticos');
-- Fuente: Ley I N° 85, art. 1, inc. a) (https://koha.chubut.edu.ar/normativas/ley/leyI_85.PDF); Ley I N° 857, art. 2 (https://boletin.chubut.gov.ar/mostrar/6637)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-07-28', 'Desembarco de los colonos galeses (Gesta galesa)', 'provincial', NULL, 1, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-07-28' AND nombre = 'Desembarco de los colonos galeses (Gesta galesa)');
-- Fuente: Ley 27.399, arts. 1 y 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-08-17', 'Paso a la Inmortalidad del General José de San Martín', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-08-17' AND nombre = 'Paso a la Inmortalidad del General José de San Martín');
-- Fuente: Ley 27.399, arts. 1 y 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-10-12' AND nombre = 'Día del Respeto a la Diversidad Cultural');
-- Fuente: Ley I N° 857, arts. 3 y 4 (https://boletin.chubut.gov.ar/mostrar/6637); prensa (https://www.adnsur.com.ar/sociedad/chubut-traslado-un-feriado-y-habra-un-fin-de-semana-largo-en-noviembre_a6ad8cd4a5f444e29d2172631)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-11-02', 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches', 'provincial', '2026-11-03', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-11-02' AND nombre = 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches');
-- Fuente: antecedente Res. 2476-24 (https://www.comodoro.gov.ar/intranet/2024/11/no-2476-24-asueto-08-11-2024/)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-11-08', 'Día del Empleado Municipal', 'municipal', NULL, 1, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-11-08' AND nombre = 'Día del Empleado Municipal');
-- Fuente: DNU 1103/2026, art. 2 (https://www.boletinoficial.gob.ar/detalleAviso/primera/348022/20260928)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-11-09', 'Visita de Su Santidad el Papa León XIV', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-11-09' AND nombre = 'Visita de Su Santidad el Papa León XIV');
-- Fuente: Ley 27.399, arts. 1 y 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-11-23', 'Día de la Soberanía Nacional', 'nacional', '2026-11-20', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-11-23' AND nombre = 'Día de la Soberanía Nacional');
-- Fuente: Resolución 164/2025 JGM (https://www.argentina.gob.ar/normativa/nacional/norma-421799/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-12-07', 'Día no laborable con fines turísticos', 'no_laborable', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-12-07' AND nombre = 'Día no laborable con fines turísticos');
-- Fuente: Ley I N° 85, art. 1, inc. b) (https://koha.chubut.edu.ar/normativas/ley/leyI_85.PDF)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2026-12-13', 'Día del Petróleo Nacional', 'provincial', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2026-12-13' AND nombre = 'Día del Petróleo Nacional');

-- Los de 2027 (9; el 23/02, el 28/07 y el 08/11 rigen por proyección de los de 2026)
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-02-08', 'Carnaval', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-02-08' AND nombre = 'Carnaval');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-02-09', 'Carnaval', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-02-09' AND nombre = 'Carnaval');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-03-25', 'Jueves Santo', 'no_laborable', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-03-25' AND nombre = 'Jueves Santo');
-- Fuente: Ley 27.399, art. 1 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-03-26', 'Viernes Santo', 'nacional', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-03-26' AND nombre = 'Viernes Santo');
-- Fuente: Ley 27.399, art. 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-06-21', 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes', 'nacional', '2027-06-17', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-06-21' AND nombre = 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes');
-- Fuente: Ley 27.399, art. 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-08-16', 'Paso a la Inmortalidad del General José de San Martín', 'nacional', '2027-08-17', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-08-16' AND nombre = 'Paso a la Inmortalidad del General José de San Martín');
-- Fuente: Ley 27.399, art. 6 (https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-10-11', 'Día del Respeto a la Diversidad Cultural', 'nacional', '2027-10-12', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-10-11' AND nombre = 'Día del Respeto a la Diversidad Cultural');
-- Fuente: Ley I N° 857, art. 4 (https://boletin.chubut.gov.ar/mostrar/6637)
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-11-01', 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches', 'provincial', '2027-11-03', 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-11-01' AND nombre = 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches');
-- Fuente: Ley I N° 85, art. 1, inc. b) (https://koha.chubut.edu.ar/normativas/ley/leyI_85.PDF); cae lunes: la Ley I N° 857 (https://boletin.chubut.gov.ar/mostrar/6637) no lo mueve
INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) SELECT '2027-12-13', 'Día del Petróleo Nacional', 'provincial', NULL, 0, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM feriados WHERE fecha = '2027-12-13' AND nombre = 'Día del Petróleo Nacional');

-- Verificación (una fila: 28 filas, 19 de 2026, 9 de 2027 y 3 que se repiten):
-- SELECT COUNT(*) AS filas, SUM(YEAR(fecha) = 2026) AS de_2026, SUM(YEAR(fecha) = 2027) AS de_2027, SUM(se_repite) AS se_repiten FROM feriados WHERE creado_por IS NULL;
