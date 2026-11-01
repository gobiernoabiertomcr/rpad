// Los dos casos de Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas), con los datos de las maquetas
// (docs/superpowers/specs/2026-10-26-mi-espacio-mockups) ajustados a la regla del arranque (spec, sección 4): la maqueta es
// anterior y lo cuenta todo, y acá, en los tipos con saldo inicial, lo cargado antes del 26/10/2026 queda como historia (ya
// está en el saldo). Las personas son las inventadas de la maqueta.
// Cada caso es `{ persona, estado }`: `persona`, con las columnas de `usuarios` que usa Mi espacio; `estado`, el `Estado` de
// services/miEspacioReglas.js, solo con las filas activas. Hoy, para los dos, es HOY, el lunes 26/10/2026, que es también el
// día del arranque. Los feriados son los 9 fijos y ninguno de la tabla (SIN_FERIADOS, que nadie modifica).
// Al final, un tercer caso, el de los días restituidos (JULIETA, con su hoy y sus feriados: ASUETOS).
// Los casos están congelados: un test que necesita otro dato arma una copia.

const congelado = (valor) => {
  if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.values(valor).forEach(congelado);
    Object.freeze(valor);
  }
  return valor;
};

export const HOY = '2026-10-26';

export const SIN_FERIADOS = new Set();

// Planta permanente y administradora: las cuatro licencias del arranque para atrás (la franquicia del 15/10, los estudios,
// la médica y la franquicia del 14/09) no descuentan; el franco del 23/10 sí, porque no tiene saldo inicial
export const PLANTA = congelado({
  persona: {
    id: 1, nombre_completo: 'Laura Gómez', rol: 'admin', vinculo: 'planta_permanente', email: 'laura.gomez@rpad.test',
    activo: 1
  },
  estado: {
    modalidad: 'planta',
    arranque: '2026-10-26',
    anios: [{ anio: 2026, dias_vacaciones: 20, estudios: 'universitario' }],
    saldos: [
      { concepto: 'vacaciones', anio: 2024, cantidad: 8 },
      { concepto: 'vacaciones', anio: 2025, cantidad: 20 },
      { concepto: 'vacaciones', anio: 2026, cantidad: 10 },
      { concepto: 'franquicias', anio: 2026, cantidad: 17 },
      { concepto: 'estudios', anio: 2026, cantidad: 6 },
      { concepto: 'medica', anio: 2026, cantidad: 3 },
      { concepto: 'familiar', anio: 2026, cantidad: 2 }
    ],
    licencias: [
      { id: 6, tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-09', horas: null },
      { id: 5, tipo: 'franco', desde: '2026-10-23', hasta: '2026-10-23', horas: null },
      { id: 4, tipo: 'franquicia', desde: '2026-10-15', hasta: '2026-10-15', horas: 2 },
      { id: 3, tipo: 'estudios', desde: '2026-10-01', hasta: '2026-10-02', horas: null },
      { id: 2, tipo: 'medica', desde: '2026-09-21', hasta: '2026-09-23', horas: null },
      { id: 1, tipo: 'franquicia', desde: '2026-09-14', hasta: '2026-09-14', horas: 7 }
    ],
    horasExtras: [
      // Junio: 7 h
      { id: 1, fecha: '2026-06-09', desde: '18:00', hasta: '22:00' },
      { id: 2, fecha: '2026-06-16', desde: '18:00', hasta: '21:00' },
      // Julio: 5 h
      { id: 3, fecha: '2026-07-07', desde: '18:00', hasta: '21:00' },
      { id: 4, fecha: '2026-07-14', desde: '18:00', hasta: '20:00' },
      // Agosto: 14 h
      { id: 5, fecha: '2026-08-04', desde: '18:00', hasta: '21:30' },
      { id: 6, fecha: '2026-08-11', desde: '18:00', hasta: '21:30' },
      { id: 7, fecha: '2026-08-18', desde: '18:00', hasta: '21:30' },
      { id: 8, fecha: '2026-08-25', desde: '18:00', hasta: '21:30' },
      // Septiembre: 7,5 h
      { id: 9, fecha: '2026-09-10', desde: '18:00', hasta: '22:00' },
      { id: 10, fecha: '2026-09-17', desde: '18:00', hasta: '21:30' },
      // Octubre: 10,5 h
      { id: 11, fecha: '2026-10-06', desde: '18:00', hasta: '21:30' },
      { id: 12, fecha: '2026-10-14', desde: '17:00', hasta: '21:00' },
      { id: 13, fecha: '2026-10-22', desde: '19:00', hasta: '22:00' }
    ]
  }
});

// Contrato y lectora: los estudios del 13/10 no descuentan (son anteriores al arranque); las horas a favor de octubre sí
export const CONTRATO = congelado({
  persona: {
    id: 2, nombre_completo: 'Sofía Paz', rol: 'lector', vinculo: 'contrato', email: 'sofia.paz@rpad.test', activo: 1
  },
  estado: {
    modalidad: 'contrato',
    arranque: '2026-10-26',
    anios: [{ anio: 2026, dias_vacaciones: 15, estudios: 'secundario' }],
    saldos: [
      { concepto: 'vacaciones', anio: 2024, cantidad: 0 },
      { concepto: 'vacaciones', anio: 2025, cantidad: 5 },
      { concepto: 'vacaciones', anio: 2026, cantidad: 8 },
      { concepto: 'estudios', anio: 2026, cantidad: 3 },
      { concepto: 'medica', anio: 2026, cantidad: 0 },
      { concepto: 'familiar', anio: 2026, cantidad: 3 },
      { concepto: 'horas_no_utilizadas', anio: 2026, cantidad: 6.5 }
    ],
    licencias: [
      { id: 4, tipo: 'familiar', desde: '2026-10-30', hasta: '2026-10-30', horas: null },
      { id: 3, tipo: 'horas_a_favor', desde: '2026-10-20', hasta: '2026-10-20', horas: 2 },
      { id: 2, tipo: 'estudios', desde: '2026-10-13', hasta: '2026-10-15', horas: null },
      { id: 1, tipo: 'horas_a_favor', desde: '2026-10-09', hasta: '2026-10-09', horas: 7 }
    ],
    // La planilla de contrato (spec 2026-10-27-mi-espacio-horas): de ahí salen sus horas a favor y su tabla de horas extras
    // (contrato no tiene horas extras de planta). Los mismos días y los mismos totales que tenían sus horas extras de antes de
    // la planilla. En un día hábil cuenta la salida desde las 15:00
    salidas: [
      // Septiembre: 10,5 h
      { id: 1, fecha: '2026-09-10', entrada: null, salida: '19:00', nota: null },
      { id: 2, fecha: '2026-09-17', entrada: null, salida: '19:00', nota: null },
      { id: 3, fecha: '2026-09-24', entrada: null, salida: '17:30', nota: null },
      // Octubre: 4 h
      { id: 4, fecha: '2026-10-21', entrada: null, salida: '19:00', nota: null }
    ]
  }
});

// Julieta Ferreyra, la persona inventada de la maqueta de los días restituidos (spec 2026-10-31-mi-espacio-dias-restituidos,
// 5): planta permanente y administradora, 20 días por año, arranque el lunes 02/11/2026 y un saldo de 19 días de la 2024, 15
// de la 2025 y 10 de la 2026. Tiene vacaciones del viernes 11/12/2026 al viernes 08/01/2027: 19 días hábiles, todos de la
// 2024 (vence el 31/12/2026). El martes 22/12/2026, con las vacaciones ya cargadas, administración cargó los asuetos del
// jueves 24 y del jueves 31/12/2026 (ASUETOS, los únicos feriados de la tabla: los 9 fijos los pone esDiaHabil), así que la
// foto (`restituibles`) guarda esos dos días, todavía sin tanda ni pedido. Su hoy depende del momento de la maqueta: el
// 22/12/2026, el día de los asuetos, o el lunes 11/01/2027, cuando vuelve
export const ASUETOS = new Set(['2026-12-24', '2026-12-31']);

export const JULIETA = congelado({
  persona: {
    id: 3, nombre_completo: 'Julieta Ferreyra', rol: 'admin', vinculo: 'planta_permanente',
    email: 'julieta.ferreyra@rpad.test', activo: 1
  },
  estado: {
    modalidad: 'planta',
    arranque: '2026-11-02',
    anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }],
    saldos: [
      { concepto: 'vacaciones', anio: 2024, cantidad: 19 },
      { concepto: 'vacaciones', anio: 2025, cantidad: 15 },
      { concepto: 'vacaciones', anio: 2026, cantidad: 10 }
    ],
    licencias: [{ id: 1, tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08', horas: null }],
    horasExtras: [],
    salidas: [],
    restituibles: [
      { id: 1, licencia_id: 1, feriado_id: 1, fecha: '2026-12-24', tanda: null, restitucion_id: null },
      { id: 2, licencia_id: 1, feriado_id: 2, fecha: '2026-12-31', tanda: null, restitucion_id: null }
    ],
    restituciones: []
  }
});
