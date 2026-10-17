// Reglas de las fechas de un dataset (spec 2026-10-17-fechas-datasets, secciones 2, 5 y 7): funciones puras, con la tabla
// de casos de la sección 7 y hoy = 17/10/2026
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_PEDIDO, NOMBRES_TIPO_PEDIDO, finDeMes, esFinDeMes, vencimientoDelMes, sumarMeses, corteDe, ultimoVencimientoPasado,
  tipoSugerido, tipoEfectivo, pedido, cubre, opcionesDeProxima, estadoDelDataset, topeDatosAl
} from '../services/fechasDatasetReglas.js';

const HOY = '2026-10-17';
const MANTENER = 'Mantener: se siguen debiendo datos de lo que se pidió';
const SIGUIENTE = 'Siguiente período';

// La tabla de la spec (sección 7). sugerida: la primera opción (null = sin opciones, porque no llegan datos); los campos
// que no trae no se comparan, salvo advertencia, que por defecto es null. otras: las demás opciones, en orden.
const CASOS = [
  {
    caso: 'Pauta, normal (acumulado, 3 meses)', tipo: 'acumulado', meses: 3,
    vence: '2027-01-31', datosAl: '2026-07-31', datosNuevo: '2026-12-31',
    pideHoy: 'Del 01/01/2026 al 31/12/2026',
    sugerida: { fecha: '2027-04-30', motivo: SIGUIENTE },
    otras: []
  },
  {
    caso: 'Pauta, entrega parcial', tipo: 'acumulado', meses: 3,
    vence: '2027-01-31', datosAl: '2026-07-31', datosNuevo: '2026-09-30',
    pideHoy: 'Del 01/01/2026 al 31/12/2026',
    sugerida: { fecha: '2027-04-30', motivo: SIGUIENTE, pideDespues: 'Del 01/10/2026 al 31/03/2027' },
    otras: [{ fecha: '2027-01-31', motivo: MANTENER, advertencia: null }]
  },
  {
    caso: 'Parque Automotor (acumulado, 12)', tipo: 'acumulado', meses: 12,
    vence: '2024-01-31', datosAl: '2022-12-31', datosNuevo: '2025-12-31',
    pideHoy: 'Del 01/01/2023 al 31/12/2025',
    sugerida: { fecha: '2027-01-31', motivo: 'Primer pedido que todavía no llegó', pideDespues: 'Del 01/01/2026 al 31/12/2026' },
    otras: [{ fecha: '2025-01-31', motivo: SIGUIENTE, advertencia: 'Ya pasó y pediría datos que ya llegaron' }]
  },
  {
    caso: 'Parque Automotor, solo 2023', tipo: 'acumulado', meses: 12,
    vence: '2024-01-31', datosAl: '2022-12-31', datosNuevo: '2023-12-31',
    pideHoy: 'Del 01/01/2023 al 31/12/2025',
    // Pasada: la sugerida es el siguiente período, que ya venció
    sugerida: { fecha: '2025-01-31', motivo: SIGUIENTE, advertencia: 'Ya pasó', pideDespues: 'Del 01/01/2024 al 31/12/2025' },
    otras: []
  },
  {
    caso: 'TMDA (anio_anterior, 12)', tipo: 'anio_anterior', meses: 12,
    vence: '2027-06-30', datosAl: '2025-12-31', datosNuevo: '2026-12-31',
    pideHoy: 'Del 01/01/2026 al 31/12/2026',
    sugerida: { fecha: '2028-06-30', motivo: SIGUIENTE },
    otras: []
  },
  {
    caso: 'Espacios Verdes (relevamiento, 24)', tipo: 'relevamiento', meses: 24,
    vence: '2027-03-31', datosAl: '2026-06-30', datosNuevo: '2027-03-31',
    pideHoy: 'Relevamiento actualizado',
    sugerida: { fecha: '2029-03-31', motivo: 'Relevamiento más la frecuencia' },
    otras: []
  },
  {
    caso: 'Presupuesto con perspectiva de género (ejercicio)', tipo: 'ejercicio', meses: 12,
    vence: '2027-01-31', datosAl: '2025-12-31', datosNuevo: null,
    pideHoy: 'Presupuestos de los ejercicios 2026 y 2027',
    sugerida: null,
    otras: []
  },
  {
    caso: 'Presupuesto Municipal (ejercicio, vencido)', tipo: 'ejercicio', meses: 12,
    vence: '2026-01-31', datosAl: '2025-12-31', datosNuevo: '2026-12-31',
    pideHoy: 'Presupuesto del ejercicio 2026',
    sugerida: { fecha: '2027-01-31', motivo: SIGUIENTE },
    otras: []
  },
  {
    caso: 'Gasto Público (acumulado, 6, vencido)', tipo: 'acumulado', meses: 6,
    vence: '2026-07-31', datosAl: '2025-12-31', datosNuevo: null,
    pideHoy: 'Del 01/01/2026 al 30/06/2026',
    sugerida: null,
    otras: []
  },
  {
    caso: 'Funcionarios Públicos (foto, 6)', tipo: 'foto', meses: 6,
    vence: '2026-07-31', datosAl: '2025-12-31', datosNuevo: null,
    pideHoy: 'Vigente al 30/06/2026',
    sugerida: null,
    otras: []
  }
];

describe('la tabla de casos de la spec (sección 7), con hoy = 17/10/2026', () => {
  for (const c of CASOS) {
    describe(c.caso, () => {
      // Se calcula dentro de cada it: si tirara error, falla ese test y no la carga de toda la tabla
      const opcionesDelCaso = () => opcionesDeProxima({ vencimiento: c.vence, tipo: c.tipo, meses: c.meses, datosNuevo: c.datosNuevo, hoy: HOY });

      it('lo que pide hoy', () => {
        assert.equal(pedido({ vencimiento: c.vence, tipo: c.tipo, datosAl: c.datosAl, meses: c.meses, hoy: HOY }).texto, c.pideHoy);
      });

      it('la sugerida', () => {
        const opciones = opcionesDelCaso();
        if (c.sugerida === null) {
          assert.deepEqual(opciones, []);
          return;
        }
        const [primera] = opciones;
        assert.equal(primera.sugerida, true);
        assert.equal(primera.fecha, c.sugerida.fecha);
        assert.equal(primera.motivo, c.sugerida.motivo);
        assert.equal(primera.advertencia, c.sugerida.advertencia ?? null);
        if (c.sugerida.pideDespues) assert.equal(primera.pideDespues, c.sugerida.pideDespues);
      });

      it('las otras opciones', () => {
        const otras = opcionesDelCaso().slice(1);
        assert.ok(otras.every(o => o.sugerida === false), 'solo la primera es la sugerida');
        assert.deepEqual(otras.map(({ fecha, motivo, advertencia }) => ({ fecha, motivo, advertencia })), c.otras);
      });
    });
  }
});

describe('pedido (secciones 2, 5 y 7)', () => {
  it('devuelve desde, hasta y el texto', () => {
    assert.deepEqual(pedido({ vencimiento: '2024-01-31', tipo: 'acumulado', datosAl: '2022-12-31', meses: 12, hoy: HOY }),
      { desde: '2023-01-01', hasta: '2025-12-31', texto: 'Del 01/01/2023 al 31/12/2025' });
    assert.deepEqual(pedido({ vencimiento: '2026-07-31', tipo: 'foto', datosAl: '2025-12-31', meses: 6, hoy: HOY }),
      { desde: '2026-06-30', hasta: '2026-06-30', texto: 'Vigente al 30/06/2026' });
    assert.deepEqual(pedido({ vencimiento: '2027-01-31', tipo: 'ejercicio', datosAl: '2025-12-31', meses: 12, hoy: HOY }),
      { desde: '2026-01-01', hasta: '2027-12-31', texto: 'Presupuestos de los ejercicios 2026 y 2027' });
    assert.deepEqual(pedido({ vencimiento: '2031-12-31', tipo: 'edicion', datosAl: '2022-05-31', meses: 120, hoy: HOY }),
      { desde: null, hasta: null, texto: 'Próxima edición disponible' });
  });

  it('R2 y R3: del 1/1 del año del corte al corte; con la próxima en enero, el año anterior completo', () => {
    assert.equal(pedido({ vencimiento: '2026-10-31', tipo: 'acumulado', meses: 3, hoy: '2026-08-01' }).texto, 'Del 01/01/2026 al 30/09/2026');
    assert.equal(pedido({ vencimiento: '2026-05-31', tipo: 'acumulado', meses: 4, hoy: '2026-03-01' }).texto, 'Del 01/01/2026 al 30/04/2026');
    assert.equal(pedido({ vencimiento: '2027-01-31', tipo: 'acumulado', meses: 12, hoy: HOY }).texto, 'Del 01/01/2026 al 31/12/2026');
  });

  it('R7: el final avanza solo cuando pasa otro vencimiento del ciclo, y el que cae hoy ya cuenta', () => {
    const trimestral = (hoy) => pedido({ vencimiento: '2027-01-31', tipo: 'acumulado', datosAl: '2026-09-30', meses: 3, hoy }).hasta;
    assert.equal(trimestral('2027-04-29'), '2026-12-31');
    assert.equal(trimestral('2027-04-30'), '2027-03-31');
    // Sin hoy o sin frecuencia no hay R7: el pedido de ese vencimiento tal cual
    assert.equal(pedido({ vencimiento: '2024-01-31', tipo: 'acumulado', meses: 12 }).hasta, '2023-12-31');
    assert.equal(pedido({ vencimiento: '2024-01-31', tipo: 'acumulado', meses: null, hoy: HOY }).hasta, '2023-12-31');
  });

  it('R7 también en ejercicio y en foto', () => {
    // Pasó el 31/01/2027: también se debe el presupuesto de 2027
    assert.equal(pedido({ vencimiento: '2026-01-31', tipo: 'ejercicio', datosAl: '2025-12-31', meses: 12, hoy: '2027-02-15' }).texto,
      'Presupuestos de los ejercicios 2026 y 2027');
    // Pasó el 31/01/2027: la foto se pide a su corte
    assert.equal(pedido({ vencimiento: '2026-07-31', tipo: 'foto', meses: 6, hoy: '2027-02-01' }).texto, 'Vigente al 31/12/2026');
  });

  it('lo que falta arranca el 1° del mes siguiente al de "Datos al": nunca el 29/02', () => {
    // R5: "Datos al" 28/02/2028 es el fin de febrero de 2028, aunque 2028 sea bisiesto
    assert.equal(pedido({ vencimiento: '2029-03-31', tipo: 'acumulado', datosAl: '2028-02-28', meses: 1, hoy: '2029-03-01' }).texto,
      'Del 01/03/2028 al 28/02/2029');
    assert.equal(pedido({ vencimiento: '2030-06-30', tipo: 'anio_anterior', datosAl: '2028-02-28', meses: 12, hoy: '2029-03-01' }).texto,
      'Del 01/03/2028 al 31/12/2029');
  });

  it('anio_anterior: el último año calendario cerrado al corte', () => {
    assert.equal(pedido({ vencimiento: '2027-01-31', tipo: 'anio_anterior', meses: 12, hoy: HOY }).texto, 'Del 01/01/2026 al 31/12/2026');
    assert.equal(pedido({ vencimiento: '2026-12-31', tipo: 'anio_anterior', meses: 12, hoy: HOY }).texto, 'Del 01/01/2025 al 31/12/2025');
    // Todo lo que falta, aunque cruce el año
    assert.equal(pedido({ vencimiento: '2027-06-30', tipo: 'anio_anterior', datosAl: '2024-12-31', meses: 12, hoy: HOY }).texto,
      'Del 01/01/2025 al 31/12/2026');
  });

  it('ejercicio: uno, dos o tres o más ejercicios', () => {
    const ejercicio = (datosAl) => pedido({ vencimiento: '2027-01-31', tipo: 'ejercicio', datosAl, meses: 12, hoy: HOY }).texto;
    assert.equal(ejercicio('2026-12-31'), 'Presupuesto del ejercicio 2027');
    assert.equal(ejercicio(null), 'Presupuesto del ejercicio 2027');
    assert.equal(ejercicio('2025-12-31'), 'Presupuestos de los ejercicios 2026 y 2027');
    assert.equal(ejercicio('2024-12-31'), 'Presupuestos de los ejercicios 2025 a 2027');
    assert.equal(ejercicio('2023-12-31'), 'Presupuestos de los ejercicios 2024 a 2027');
    // El primer ejercicio que falta es el del año siguiente al de "Datos al"
    assert.equal(ejercicio('2026-06-30'), 'Presupuesto del ejercicio 2027');
    assert.equal(ejercicio('2025-06-30'), 'Presupuestos de los ejercicios 2026 y 2027');
  });

  it('un vencimiento viejo que no es fin de mes cuenta como el fin de su mes', () => {
    assert.equal(pedido({ vencimiento: '2026-03-29', tipo: 'acumulado', meses: 1, hoy: '2026-03-01' }).texto, 'Del 01/01/2026 al 28/02/2026');
  });

  it('eventual, un tipo desconocido o un vencimiento inválido dan null', () => {
    assert.equal(pedido({ vencimiento: '2026-07-31', tipo: 'eventual', meses: null, hoy: HOY }), null);
    assert.equal(pedido({ vencimiento: '2026-07-31', tipo: 'otro', meses: 6, hoy: HOY }), null);
    for (const vencimiento of [null, undefined, '', '0000-00-00', '2026-02-30', '31/07/2026']) {
      assert.equal(pedido({ vencimiento, tipo: 'acumulado', meses: 6, hoy: HOY }), null);
      assert.equal(pedido({ vencimiento, tipo: 'relevamiento', meses: 6, hoy: HOY }), null);
    }
  });
});

describe('cubre: el pedido de ese vencimiento, sin R7', () => {
  it('compara con el hasta de ese vencimiento, aunque hoy se pida más', () => {
    // Hoy Parque Automotor pide hasta el 31/12/2025, pero lo que se pidió para el 31/01/2024 era hasta el 31/12/2023
    assert.equal(cubre('2023-12-31', '2024-01-31', 'acumulado', 12), true);
    assert.equal(cubre('2023-11-30', '2024-01-31', 'acumulado', 12), false);
    assert.equal(cubre('2026-06-30', '2026-07-31', 'foto', 6), true);
    assert.equal(cubre('2026-12-31', '2027-06-30', 'anio_anterior', 12), true);
    assert.equal(cubre('2026-12-31', '2027-01-31', 'ejercicio', 12), false);
  });

  it('sin hasta (edición, relevamiento, eventual) o con fechas inválidas, nunca cubre', () => {
    assert.equal(cubre('2031-12-31', '2031-12-31', 'edicion', 120), false);
    assert.equal(cubre('2027-03-31', '2027-03-31', 'relevamiento', 24), false);
    assert.equal(cubre('2027-03-31', '2027-03-31', 'eventual', null), false);
    assert.equal(cubre(null, '2024-01-31', 'acumulado', 12), false);
    assert.equal(cubre('2025-12-31', '0000-00-00', 'acumulado', 12), false);
  });
});

describe('opcionesDeProxima: bordes', () => {
  const opciones = (cambios) => opcionesDeProxima({
    vencimiento: '2027-01-31', tipo: 'acumulado', meses: 3, datosNuevo: '2026-12-31', hoy: HOY, ...cambios
  });

  it('edición: una sola, el siguiente período', () => {
    assert.deepEqual(opciones({ vencimiento: '2031-12-31', tipo: 'edicion', meses: 120, datosNuevo: '2022-05-31' }), [{
      fecha: '2041-12-31', motivo: SIGUIENTE, sugerida: true, advertencia: null, pideDespues: 'Próxima edición disponible'
    }]);
  });

  it('relevamiento: no necesita vencimiento, y avisa si la fecha ya pasó', () => {
    const [relevamiento] = opciones({ vencimiento: null, tipo: 'relevamiento', meses: 6, datosNuevo: '2025-12-31' });
    assert.deepEqual(relevamiento, {
      fecha: '2026-06-30', motivo: 'Relevamiento más la frecuencia', sugerida: true, advertencia: 'Ya pasó', pideDespues: 'Relevamiento actualizado'
    });
  });

  it('un vencimiento que no es fin de mes se ofrece como el fin de su mes', () => {
    assert.deepEqual(opciones({ vencimiento: '2027-01-15', datosNuevo: '2026-09-30' }).map(o => o.fecha), ['2027-04-30', '2027-01-31']);
  });

  it('eventual o entradas inválidas: lista vacía', () => {
    assert.deepEqual(opciones({ tipo: 'eventual', meses: null }), []);
    assert.deepEqual(opciones({ tipo: 'otro' }), []);
    assert.deepEqual(opciones({ meses: null }), []);
    assert.deepEqual(opciones({ meses: 0 }), []);
    assert.deepEqual(opciones({ datosNuevo: '2026-13-31' }), []);
    assert.deepEqual(opciones({ vencimiento: '0000-00-00' }), []);
    assert.deepEqual(opciones({ hoy: null }), []);
  });
});

describe('fechas: bordes (sección 7)', () => {
  it('sumarMeses llega a febrero en 28, también en un bisiesto, y sale de él', () => {
    assert.equal(sumarMeses('2027-11-30', 3), '2028-02-28');
    assert.equal(sumarMeses('2028-02-28', 1), '2028-03-31');
    assert.equal(sumarMeses('2028-01-31', 1), '2028-02-28');
  });

  it('sumarMeses cruza de diciembre a enero, hacia adelante y hacia atrás', () => {
    assert.equal(sumarMeses('2026-12-31', 1), '2027-01-31');
    assert.equal(sumarMeses('2027-01-31', -1), '2026-12-31');
    assert.equal(sumarMeses('2026-10-31', 24), '2028-10-31');
    assert.equal(sumarMeses('2026-10-15', 0), '2026-10-31');
  });

  it('corteDe: el fin del mes anterior, con febrero en 28', () => {
    assert.equal(corteDe('2028-03-31'), '2028-02-28');
    assert.equal(corteDe('2027-01-31'), '2026-12-31');
    assert.equal(corteDe('2026-07-31'), '2026-06-30');
  });

  it('esFinDeMes', () => {
    assert.equal(esFinDeMes('2028-02-28'), true);
    assert.equal(esFinDeMes('2026-10-31'), true);
    for (const valor of ['2028-02-29', '2027-03-29', '2026-10-30', '0000-00-00', '', null, undefined, 20261031]) {
      assert.equal(esFinDeMes(valor), false, String(valor));
    }
  });

  it('finDeMes y vencimientoDelMes', () => {
    assert.equal(finDeMes(2028, 2), '2028-02-28');
    assert.equal(finDeMes(2026, 4), '2026-04-30');
    assert.equal(finDeMes(2026, 12), '2026-12-31');
    assert.equal(vencimientoDelMes('2026-10-15'), '2026-10-31');
    assert.equal(vencimientoDelMes('2028-02-29'), '2028-02-28');
  });

  it('ultimoVencimientoPasado: suma la frecuencia mientras siga en el pasado', () => {
    assert.equal(ultimoVencimientoPasado('2024-01-31', 12, HOY), '2026-01-31');
    assert.equal(ultimoVencimientoPasado('2026-07-31', 6, HOY), '2026-07-31');
    assert.equal(ultimoVencimientoPasado('2027-01-31', 3, HOY), '2027-01-31');
    assert.equal(ultimoVencimientoPasado('2026-07-31', 3, '2026-10-31'), '2026-10-31');
    assert.equal(ultimoVencimientoPasado('2024-01-31', null, HOY), '2024-01-31');
  });

  it('las fechas inválidas devuelven null y nunca tiran error', () => {
    for (const valor of [null, undefined, '', '0000-00-00', '2026-02-29', '2026-13-31', 'hoy', 42, {}]) {
      assert.equal(sumarMeses(valor, 1), null);
      assert.equal(corteDe(valor), null);
      assert.equal(vencimientoDelMes(valor), null);
      assert.equal(ultimoVencimientoPasado(valor, 12, HOY), null);
      assert.equal(ultimoVencimientoPasado('2024-01-31', 12, valor), null);
      assert.equal(topeDatosAl('acumulado', valor), null);
    }
    assert.equal(sumarMeses('2026-10-31', 1.5), null);
    assert.equal(sumarMeses('2026-10-31', null), null);
    assert.equal(finDeMes(2026, 13), null);
    assert.equal(finDeMes(2026, 0), null);
    assert.equal(finDeMes('2026', 1), null);
    assert.equal(pedido(), null);
    assert.equal(pedido(null), null);
    assert.equal(cubre(), false);
    assert.deepEqual(opcionesDeProxima(), []);
    assert.deepEqual(opcionesDeProxima(null), []);
    assert.deepEqual(estadoDelDataset(null), { estado: 'eventual', dias: null });
    assert.equal(tipoEfectivo(null), 'eventual');
  });
});

describe('estadoDelDataset', () => {
  const estado = (proxima, cambios = {}) => estadoDelDataset({ proxima, meses: 12, tipoGestion: 'externa', hoy: HOY, ...cambios });

  it('vence hoy: próximo, con 0 días', () => {
    assert.deepEqual(estado(HOY), { estado: 'proximo', dias: 0 });
  });

  it('próximo hasta 60 días; desde 61, actualizado', () => {
    assert.deepEqual(estado('2026-12-16'), { estado: 'proximo', dias: 60 });
    assert.deepEqual(estado('2026-12-17'), { estado: 'actualizado', dias: 61 });
  });

  it('vencido ayer: atrasado si es interna, sin respuesta si es externa', () => {
    assert.deepEqual(estado('2026-10-16', { tipoGestion: 'interna' }), { estado: 'atrasado', dias: -1 });
    assert.deepEqual(estado('2026-10-16', { tipoGestion: 'externa' }), { estado: 'sin-respuesta', dias: -1 });
  });

  it('sin frecuencia en meses: eventual; sin próxima: sin fecha', () => {
    assert.deepEqual(estado('2026-12-31', { meses: null }), { estado: 'eventual', dias: null });
    assert.deepEqual(estado(null), { estado: 'sin-fecha', dias: null });
    assert.deepEqual(estado('0000-00-00'), { estado: 'sin-fecha', dias: null });
  });
});

describe('tipo de pedido (sección 5)', () => {
  it('los tipos y sus nombres en pantalla', () => {
    assert.deepEqual(TIPOS_PEDIDO, ['acumulado', 'foto', 'anio_anterior', 'ejercicio', 'edicion', 'relevamiento', 'eventual']);
    assert.deepEqual(NOMBRES_TIPO_PEDIDO, {
      acumulado: 'Acumulado', foto: 'Foto al corte', anio_anterior: 'Año anterior completo', ejercicio: 'Ejercicio que empieza',
      edicion: 'Próxima edición', relevamiento: 'Relevamiento interno', eventual: 'Eventual'
    });
  });

  it('tipoSugerido', () => {
    assert.equal(tipoSugerido('externa', 3), 'acumulado');
    assert.equal(tipoSugerido('externa', 12), 'acumulado');
    assert.equal(tipoSugerido('externa', 24), 'foto');
    assert.equal(tipoSugerido('interna', 12), 'relevamiento');
    assert.equal(tipoSugerido('interna', null), 'eventual');
    assert.equal(tipoSugerido('externa', null), 'eventual');
  });

  it('tipoEfectivo respeta el guardado; sin guardado, el sugerido', () => {
    assert.equal(tipoEfectivo({ tipo_pedido: 'ejercicio', tipo_gestion: 'externa', meses: 12 }), 'ejercicio');
    assert.equal(tipoEfectivo({ tipo_pedido: null, tipo_gestion: 'externa', meses: 12 }), 'acumulado');
    assert.equal(tipoEfectivo({ tipo_pedido: 'otro', tipo_gestion: 'interna', meses: 24 }), 'relevamiento');
  });
});

describe('topeDatosAl', () => {
  it('el fin del mes actual; en ejercicio, el 31/12 del año siguiente', () => {
    assert.equal(topeDatosAl('acumulado', HOY), '2026-10-31');
    assert.equal(topeDatosAl('relevamiento', '2028-02-29'), '2028-02-28');
    assert.equal(topeDatosAl('ejercicio', HOY), '2027-12-31');
  });
});
