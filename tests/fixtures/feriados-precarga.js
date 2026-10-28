// La precarga de los feriados de 2026 y 2027 (database/updates/migracion-feriados-datos.sql) como la devuelve filasDeFeriados
// (services/feriadosDatos.js) en una base recién creada: las 28 filas, en el orden del archivo, que es el de las fechas (el de
// filasDeFeriados, ORDER BY fecha, id), con los id de 1 a 28, sin baja desde un año, activas y sin años que no rigen. Las tres que
// se repiten (el 23/02, el 28/07 y el 08/11) van una vez, con la fecha de 2026. tests/feriados-en-notas.test.js las ata al SQL: si
// la migración cambia, ese test falla. Congeladas: un test que quiera cambiarlas trabaja sobre una copia.

const fila = (id, fecha, nombre, tipo, trasladadoDe, seRepite) => Object.freeze({
  id, fecha, nombre, tipo, trasladado_de: trasladadoDe, se_repite: seRepite, hasta_anio: null, activo: 1, no_rige: Object.freeze([])
});

export const FILAS_PRECARGA = Object.freeze([
  // Los de 2026 (19)
  fila(1, '2026-01-02', 'Asueto administrativo municipal', 'no_laborable', null, 0),
  fila(2, '2026-02-16', 'Carnaval', 'nacional', null, 0),
  fila(3, '2026-02-17', 'Carnaval', 'nacional', null, 0),
  fila(4, '2026-02-23', 'Aniversario de Comodoro Rivadavia', 'municipal', null, 1),
  fila(5, '2026-03-23', 'Día no laborable con fines turísticos', 'no_laborable', null, 0),
  fila(6, '2026-04-02', 'Jueves Santo', 'no_laborable', null, 0),
  fila(7, '2026-04-03', 'Viernes Santo', 'nacional', null, 0),
  fila(8, '2026-04-30', 'Plebiscito de 1902', 'provincial', null, 0),
  fila(9, '2026-06-15', 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes', 'nacional', '2026-06-17', 0),
  fila(10, '2026-07-10', 'Día no laborable con fines turísticos', 'no_laborable', null, 0),
  fila(11, '2026-07-28', 'Desembarco de los colonos galeses (Gesta galesa)', 'provincial', null, 1),
  fila(12, '2026-08-17', 'Paso a la Inmortalidad del General José de San Martín', 'nacional', null, 0),
  fila(13, '2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'nacional', null, 0),
  fila(14, '2026-11-02', 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches', 'provincial', '2026-11-03', 0),
  fila(15, '2026-11-08', 'Día del Empleado Municipal', 'municipal', null, 1),
  fila(16, '2026-11-09', 'Visita de Su Santidad el Papa León XIV', 'nacional', null, 0),
  fila(17, '2026-11-23', 'Día de la Soberanía Nacional', 'nacional', '2026-11-20', 0),
  fila(18, '2026-12-07', 'Día no laborable con fines turísticos', 'no_laborable', null, 0),
  fila(19, '2026-12-13', 'Día del Petróleo Nacional', 'provincial', null, 0),
  // Los de 2027 (9)
  fila(20, '2027-02-08', 'Carnaval', 'nacional', null, 0),
  fila(21, '2027-02-09', 'Carnaval', 'nacional', null, 0),
  fila(22, '2027-03-25', 'Jueves Santo', 'no_laborable', null, 0),
  fila(23, '2027-03-26', 'Viernes Santo', 'nacional', null, 0),
  fila(24, '2027-06-21', 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes', 'nacional', '2027-06-17', 0),
  fila(25, '2027-08-16', 'Paso a la Inmortalidad del General José de San Martín', 'nacional', '2027-08-17', 0),
  fila(26, '2027-10-11', 'Día del Respeto a la Diversidad Cultural', 'nacional', '2027-10-12', 0),
  fila(27, '2027-11-01', 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches', 'provincial', '2027-11-03', 0),
  fila(28, '2027-12-13', 'Día del Petróleo Nacional', 'provincial', null, 0)
]);
