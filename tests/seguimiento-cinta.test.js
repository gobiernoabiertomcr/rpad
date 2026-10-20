// La cinta del Seguimiento como datos (spec 2026-10-20-seguimiento-dataset-design, "La cinta"): funciones puras, probadas con los
// casos reales anonimizados de tests/seguimiento-casos.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';
import { movimientosDe, ciclosDe } from '../services/seguimientoReglas.js';
import { ventanaDe, cintaDe, textoDeVencido } from '../services/seguimientoCinta.js';

const f = (id) => ({ ...CASOS[id], catalogos: CATALOGOS });
const cinta = (id, extra) => {
  const fu = f(id);
  return cintaDe({ fuentes: fu, ciclos: ciclosDe(fu, HOY), movimientos: movimientosDe(fu), hoy: HOY, ...extra });
};
// La cinta de unas fuentes armadas a mano (a partir de un caso real)
const cintaDeFuentes = (fu, extra) => cintaDe({ fuentes: fu, ciclos: ciclosDe(fu, HOY), movimientos: movimientosDe(fu), hoy: HOY, ...extra });
const conDataset = (id, cambios) => ({ ...f(id), dataset: { ...CASOS[id].dataset, ...cambios } });

// La misma cuenta que la spec, escrita aparte: x = 30 + (n(día) + 0,5 − n(inicio)) / días de la ventana × 940
const numero = (dia) => Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)) / 86400000;
const xDe = (dia) => 30 + (numero(dia) + 0.5 - numero('2025-11-01')) / 365 * 940;
const casi = (a, b) => Math.abs(a - b) < 0.0001;

const baja = (datos) => ({
  id: 99, tipo: 'eliminar', estado: 'aprobado', creado: '2026-09-01 09:00:00', revisado: '2026-09-01 10:00:00',
  propuso: 'Ana María Uno', reviso: 'Bruno Pablo Dos', motivo: null, nuevos: {}, anteriores: {}, dataset_id: 52, ...datos
});
// Un movimiento armado a mano, para probar la agrupación sin depender de un caso
const mov = (tipo, fecha, extra = {}, titulo = `T ${tipo} ${fecha}`) => ({ tipo, fecha, momento: `${fecha} 08:00:00`, titulo, detalle: '', quien: [], extra });
const nota = (fecha, numero, estado = 'enviada') => mov('nota', fecha, { numero, anio: 2026, estado }, `Nota Digital N° ${numero}/26 a DGMIT`);
const email = (fecha, success = true) => mov('email', fecha, { success });
const sinCiclos = (movimientos, extra) => cintaDe({ fuentes: { dataset: { alta: '2025-11-01 09:00:00', meses: null, proxima: null } }, ciclos: null, movimientos, hoy: HOY, ...extra });

describe('ventanaDe', () => {
  it('ventana de 12 meses: de nov/2025 a oct/2026', () => {
    const v = ventanaDe('2026-10-20');
    assert.equal(v.desde, '2025-11-01'); assert.equal(v.hasta, '2026-10-31');
    assert.deepEqual(v.meses.map(m => m.etiqueta), ['nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct']);
  });
  it('cada mes trae su primer día y su año', () => {
    const v = ventanaDe('2026-10-20');
    assert.deepEqual(v.meses[0], { desde: '2025-11-01', etiqueta: 'nov', anio: 2025 });
    assert.deepEqual(v.meses[2], { desde: '2026-01-01', etiqueta: 'ene', anio: 2026 });
    assert.deepEqual(v.meses[11], { desde: '2026-10-01', etiqueta: 'oct', anio: 2026 });
  });
  it('cruza el año: en enero la ventana arranca en febrero del año anterior', () => {
    const v = ventanaDe('2027-01-15');
    assert.equal(v.desde, '2026-02-01'); assert.equal(v.hasta, '2027-01-31');
    assert.equal(v.meses.length, 12);
    assert.equal(v.meses[0].etiqueta, 'feb'); assert.equal(v.meses[11].etiqueta, 'ene');
    assert.equal(v.meses[11].anio, 2027);
  });
  it('el último día es el último del mes, también en febrero bisiesto y no bisiesto', () => {
    assert.equal(ventanaDe('2028-02-10').hasta, '2028-02-29');
    assert.equal(ventanaDe('2027-02-10').hasta, '2027-02-28');
    assert.equal(ventanaDe('2026-12-31').hasta, '2026-12-31');
    assert.equal(ventanaDe('2026-12-31').desde, '2026-01-01');
  });
  it('sin un día que exista, null (no tira error)', () => {
    for (const hoy of [null, undefined, '', '2026-02-30', '20/10/2026', 20261020]) assert.equal(ventanaDe(hoy), null);
  });
});

describe('cintaDe: la regla de posición y los meses', () => {
  it('la forma de la cinta', () => {
    const c = cinta(52);
    assert.deepEqual(Object.keys(c).sort(), ['hoy', 'marcas', 'meses', 'textos', 'tramos', 'vencimientos']);
    assert.equal(c.meses.length, 12);
  });
  it('los meses cubren de x = 30 a x = 970 sin huecos, y el año va solo en el primero y en enero', () => {
    const c = cinta(52);
    assert.ok(casi(c.meses[0].x0, 30)); assert.ok(casi(c.meses[11].x1, 970));
    for (let i = 1; i < 12; i++) assert.ok(casi(c.meses[i].x0, c.meses[i - 1].x1));
    assert.deepEqual(c.meses.map(m => m.anio), [2025, null, 2026, null, null, null, null, null, null, null, null, null]);
    assert.ok(casi(c.meses[1].x0, 30 + 30 / 365 * 940)); // diciembre arranca 30 días después de noviembre
  });
  it('x(día) = 30 + (n(día) + 0,5 − n(inicio)) / 365 × 940', () => {
    const c = cinta(52);
    assert.ok(casi(c.hoy.x, xDe('2026-10-20')));
    assert.ok(casi(c.vencimientos[0].x, xDe('2026-01-31')));
    assert.ok(casi(c.vencimientos[1].x, xDe('2026-07-31')));
  });
  it('sin la ventana (hoy inválido), null', () => {
    assert.equal(cintaDe({ fuentes: f(52), ciclos: null, movimientos: [], hoy: 'mañana' }), null);
    assert.equal(cintaDe(), null);
    assert.equal(cintaDe(null), null);
  });
});

describe('cintaDe: casos reales', () => {
  it('52: la ✕ del 04/02 y la actualización caen en la misma x; la ✕ lleva 2', () => {
    const c = cinta(52);
    const rech = c.marcas.find(m => m.tipo === 'rech'), act = c.marcas.find(m => m.tipo === 'act' && m.detalle[0].startsWith('04/02/2026'));
    assert.equal(rech.cantidad, 2); assert.ok(Math.abs(rech.x - act.x) < 0.01);
    assert.ok(c.textos.some(t => t.texto === 'Vencido hace 81 días'));
    assert.deepEqual(c.vencimientos.map(v => v.texto), ['vence 31/01', 'vence 31/07']);
    assert.equal(c.marcas.find(m => m.etiqueta === 'Nota 2/26').fila, 'arriba');
  });
  it('11: rayado desde el alta y el texto con la fecha vieja', () => {
    assert.ok(cinta(11).textos.some(t => t.texto === 'Vencido desde el 31/01/2024 (hace 993 días)'));
    assert.equal(cinta(11).marcas.find(m => m.fila === 'arriba' && m.cantidad === 2).tipo, 'email'); // 06/12 y 10/12
  });
  // El rayado de 56 días mide 144,2 y, con la marca de la carga que lo cierra (±11), le quedan 133,2: "Estuvo vencido 56 días" (22 letras)
  // pide 22 × 6,6 + 10 = 155,2. Con la letra por defecto no entra y no va (ver "los textos de vencido"); con letras más chicas, sí.
  it('10: textos de los ciclos cerrados', () => { assert.ok(cinta(10, { letra: 5 }).textos.some(t => t.texto === 'Estuvo vencido 56 días')); });
  it('66: eventual, sin vencimientos, y el texto no pisa marcas', () => {
    const c = cinta(66); assert.deepEqual(c.vencimientos, []);
    const t = c.textos.find(x => x.tipo === 'eventual'), ancho = t.texto.length * 6.6 + 10;
    for (const m of c.marcas.filter(m => m.fila === 'banda')) assert.ok(Math.abs(m.x - t.x) >= ancho / 2 + 11 - 0.01);
  });
  it('81: hoy baja un renglón por "vence 31/10"', () => { assert.equal(cinta(81).hoy.renglon, 2); });
  it('toda x queda entre 30 y 970', () => { for (const id of Object.keys(CASOS)) for (const m of cinta(id).marcas) assert.ok(m.x >= 30 && m.x <= 970); });
  it('en todos los casos, tramos y textos quedan entre 30 y 970 y los tramos tienen largo', () => {
    for (const id of Object.keys(CASOS)) {
      const c = cinta(id);
      for (const t of c.tramos) assert.ok(t.x0 >= 30 - 1e-9 && t.x1 <= 970 + 1e-9 && t.x1 - t.x0 > 0.2, `${id}: ${JSON.stringify(t)}`);
      for (const t of c.textos) assert.ok(t.x >= 30 && t.x <= 970, `${id}: ${JSON.stringify(t)}`);
      for (const v of c.vencimientos) assert.ok(v.x >= 30 && v.x <= 970);
      assert.ok(c.hoy.x >= 30 && c.hoy.x <= 970 && (c.hoy.renglon === 1 || c.hoy.renglon === 2));
    }
  });
  it('cada marca lleva su fecha y su título, y la cantidad es el largo del detalle', () => {
    for (const id of Object.keys(CASOS)) {
      for (const m of cinta(id).marcas) {
        assert.equal(m.cantidad, m.detalle.length);
        for (const d of m.detalle) assert.match(d, /^\d{2}\/\d{2}\/\d{4}: .+/);
      }
    }
  });
});

describe('cintaDe: tramos', () => {
  it('52: antes del alta, el ciclo de antes de la actualización simple, dos ciclos y lo vencido de cada uno, con las x de la fórmula', () => {
    const t = cinta(52).tramos;
    assert.deepEqual(t.map(x => x.tipo), ['antes', 'ciclo', 'ciclo', 'vencido', 'ciclo', 'vencido']);
    const esperado = [[30, xDe('2025-12-01')], [xDe('2025-12-01'), xDe('2025-12-17')], [xDe('2025-12-17'), xDe('2026-01-31')],
      [xDe('2026-01-31'), xDe('2026-02-04')], [xDe('2026-02-04'), xDe('2026-07-31')], [xDe('2026-07-31'), xDe('2026-10-20')]];
    t.forEach((tramo, i) => { assert.ok(casi(tramo.x0, esperado[i][0]), `x0 de ${i}`); assert.ok(casi(tramo.x1, esperado[i][1]), `x1 de ${i}`); });
  });
  it('58: el ciclo de antes de la actualización simple (sin vencimiento conocido) es un tramo de ciclo, sin "vence" ni vencido', () => {
    const c = cinta(58);
    assert.deepEqual(c.tramos.map(x => x.tipo), ['antes', 'ciclo', 'ciclo', 'futuro']);
    const esperado = [[30, xDe('2025-12-02')], [xDe('2025-12-02'), xDe('2025-12-16')], [xDe('2025-12-16'), xDe('2026-10-20')], [xDe('2026-10-20'), 970]];
    c.tramos.forEach((tramo, i) => { assert.ok(casi(tramo.x0, esperado[i][0]), `x0 de ${i}`); assert.ok(casi(tramo.x1, esperado[i][1]), `x1 de ${i}`); });
    assert.deepEqual(c.vencimientos, []);
    assert.equal(c.textos.some(t => t.tipo === 'vencido'), false);
  });
  it('un ciclo sin vencimiento y sin cierre no se dibuja como ciclo ni tira error', () => {
    const fu = f(58);
    const ciclos = [{ inicio: '2025-12-02', venc: null, cierre: null, como: null, desde: '2025-12-02 09:00:00', hasta: null, diasVencido: 0 }];
    assert.doesNotThrow(() => cintaDe({ fuentes: fu, ciclos, movimientos: movimientosDe(fu), hoy: HOY }));
    const c = cintaDe({ fuentes: fu, ciclos, movimientos: movimientosDe(fu), hoy: HOY });
    assert.equal(c.tramos.some(t => t.tipo === 'ciclo'), false);
    assert.deepEqual(c.vencimientos, []);
  });
  it('81: el ciclo abierto llega hasta hoy y de hoy al vencimiento va el tramo futuro', () => {
    const t = cinta(81).tramos;
    assert.deepEqual(t.map(x => x.tipo), ['antes', 'ciclo', 'futuro']);
    assert.ok(casi(t[1].x1, xDe('2026-10-20')) && casi(t[2].x0, xDe('2026-10-20')) && casi(t[2].x1, xDe('2026-10-31')));
  });
  it('11: el vencimiento está antes de la ventana: el ciclo no se dibuja y todo el tramo es vencido, hasta hoy', () => {
    const t = cinta(11).tramos;
    assert.deepEqual(t.map(x => x.tipo), ['antes', 'vencido']);
    assert.ok(casi(t[1].x0, xDe('2025-12-01')) && casi(t[1].x1, xDe('2026-10-20')));
  });
  it('un dataset anterior a la ventana no tiene tramo "antes" y arranca en x = 30', () => {
    const fu = conDataset(52, { alta: '2025-06-01 10:00:00' });
    const c = cintaDeFuentes(fu, { ciclos: [{ inicio: '2025-06-01', venc: '2026-07-31', cierre: null, como: null, desde: '2025-06-01 10:00:00', hasta: null, diasVencido: 81 }] });
    assert.deepEqual(c.tramos.map(x => x.tipo), ['ciclo', 'vencido']);
    assert.ok(casi(c.tramos[0].x0, 30));
    assert.ok(!c.textos.some(t => t.tipo === 'antes'));
  });
  it('el vencimiento más allá de la ventana se recorta en x = 970', () => {
    const c = cinta(52, { ciclos: [{ inicio: '2026-02-04', venc: '2027-03-31', cierre: null, como: null, desde: '2026-02-04 09:58:15', hasta: null, diasVencido: 0 }] });
    const futuro = c.tramos.find(t => t.tipo === 'futuro');
    assert.ok(casi(futuro.x1, 970));
    assert.deepEqual(c.vencimientos, []); // el 31/03/2027 no cae en la ventana
  });
  it('un ciclo cerrado antes de vencer no tiene tramo vencido ni "vence"', () => {
    const c = cinta(52, { ciclos: [
      { inicio: '2026-01-10', venc: '2026-06-30', cierre: '2026-05-10', como: 'actualizacion', desde: '2026-01-10 10:00:00', hasta: '2026-05-10 10:00:00', diasVencido: 0 },
      { inicio: '2026-05-10', venc: '2026-10-25', cierre: null, como: null, desde: '2026-05-10 10:00:00', hasta: null, diasVencido: 0 }] });
    assert.deepEqual(c.tramos.map(t => t.tipo), ['antes', 'ciclo', 'ciclo', 'futuro']);
    assert.ok(casi(c.tramos[1].x1, xDe('2026-05-10')));
    assert.deepEqual(c.vencimientos.map(v => v.texto), ['vence 25/10']);
  });
  it('10: un ciclo cerrado antes de su vencimiento (13/10, vencía el 31/10) no tiene tramo futuro: solo el abierto', () => {
    const c = cinta(10);
    assert.equal(c.tramos.filter(t => t.tipo === 'futuro').length, 1);
    assert.ok(casi(c.tramos.filter(t => t.tipo === 'futuro')[0].x0, xDe('2026-10-20')));
  });
  it('dado de baja: el ciclo termina en la baja (sin tramo futuro) y la baja no es una marca', () => {
    const fu = { ...f(52), cambios: [...CASOS[52].cambios, baja()] };
    const ciclos = ciclosDe(fu, HOY);
    assert.equal(ciclos.at(-1).como, 'baja');
    const c = cintaDeFuentes(fu);
    const ultimo = c.tramos.at(-1);
    assert.ok(casi(ultimo.x1, xDe('2026-09-01')));
    assert.ok(!c.tramos.some(t => t.tipo === 'futuro'));
    assert.ok(!c.marcas.some(m => m.tipo === 'baja'));
    assert.ok(!c.marcas.some(m => m.detalle.some(d => /Baja del RPAD/.test(d))));
  });
  it('un eventual dado de baja también termina en la baja', () => {
    const fu = { ...f(66), cambios: [...CASOS[66].cambios, baja({ dataset_id: 66 })] };
    const c = cintaDeFuentes(fu);
    assert.ok(casi(c.tramos.at(-1).x1, xDe('2026-09-01')));
  });
});

describe('cintaDe: eventual y sin fecha', () => {
  it('66: un tramo eventual del alta a hoy, con "Frecuencia eventual: sin vencimiento"', () => {
    const c = cinta(66);
    assert.deepEqual(c.tramos.map(t => t.tipo), ['antes', 'eventual']);
    assert.ok(casi(c.tramos[1].x0, xDe('2025-12-02')) && casi(c.tramos[1].x1, xDe('2026-10-20')));
    assert.ok(c.textos.some(t => t.tipo === 'eventual' && t.texto === 'Frecuencia eventual: sin vencimiento'));
  });
  it('con meses y sin próxima: "Sin fecha de próxima actualización"', () => {
    const c = cintaDeFuentes(conDataset(66, { meses: 12, proxima: null }));
    assert.ok(c.textos.some(t => t.tipo === 'eventual' && t.texto === 'Sin fecha de próxima actualización'));
    assert.ok(!c.textos.some(t => t.texto === 'Frecuencia eventual: sin vencimiento'));
    assert.deepEqual(c.vencimientos, []);
  });
  it('un eventual anterior a la ventana arranca en x = 30', () => {
    const c = cintaDeFuentes(conDataset(66, { alta: '2024-01-10 09:00:00' }));
    assert.deepEqual(c.tramos.map(t => t.tipo), ['eventual']);
    assert.ok(casi(c.tramos[0].x0, 30));
  });
});

describe('cintaDe: textos', () => {
  it('"Todavía no estaba en el RPAD" solo si hay más de 260 unidades antes del alta', () => {
    const t81 = cinta(81).textos.find(t => t.tipo === 'antes');
    assert.equal(t81.texto, 'Todavía no estaba en el RPAD');
    assert.ok(casi(t81.x, (30 + xDe('2026-10-19')) / 2));
    // el alta del 52 queda en x ≈ 108: no hay lugar
    assert.ok(!cinta(52).textos.some(t => t.tipo === 'antes'));
    // el límite: 260 de ancho es la fecha en que xAlta − 30 pasa de 260 (≈ día 101: 2026-02-10)
    const justo = (alta) => cintaDeFuentes(conDataset(66, { alta: `${alta} 09:00:00` })).textos.some(t => t.tipo === 'antes');
    assert.equal(justo('2026-02-10'), true);
    assert.equal(justo('2026-02-09'), false);
  });
  it('26: el vencimiento anterior a la ventana dice la fecha vieja y los días', () => {
    assert.ok(cinta(26).textos.some(t => t.tipo === 'vencido' && t.texto === 'Vencido desde el 31/03/2025 (hace 568 días)'));
  });
  it('los textos de vencido del ciclo abierto y del cerrado', () => {
    const c52 = cinta(52).textos.filter(t => t.tipo === 'vencido').map(t => t.texto);
    assert.deepEqual(c52, ['Vencido hace 81 días']); // los 4 días del primer ciclo no dejan lugar para su texto
    assert.deepEqual(cinta(9).textos.filter(t => t.tipo === 'vencido').map(t => t.texto), ['Estuvo vencido 406 días', 'Estuvo vencido 162 días']);
    // los de 18 y 56 días del 10 no dejan lugar para su texto, y el 52 (4 días) tampoco
    assert.ok(!cinta(10).textos.some(t => t.tipo === 'vencido'));
  });
  it('textoDeVencido: con "1 día" en singular', () => {
    const cerrado = { venc: '2026-03-01', cierre: '2026-03-02', diasVencido: 1 };
    const abierto = { venc: '2026-10-19', cierre: null, diasVencido: 1 };
    const viejo = { venc: '2024-01-31', cierre: null, diasVencido: 1 };
    assert.equal(textoDeVencido(cerrado, '2025-11-01'), 'Estuvo vencido 1 día');
    assert.equal(textoDeVencido(abierto, '2025-11-01'), 'Vencido hace 1 día');
    assert.equal(textoDeVencido(viejo, '2025-11-01'), 'Vencido desde el 31/01/2024 (hace 1 día)');
    assert.equal(textoDeVencido({ ...cerrado, diasVencido: 2 }, '2025-11-01'), 'Estuvo vencido 2 días');
    assert.equal(textoDeVencido({ ...abierto, diasVencido: 0 }, '2025-11-01'), null);
    // el vencimiento justo el primer día de la ventana todavía está en la ventana
    assert.equal(textoDeVencido({ venc: '2025-11-01', cierre: null, diasVencido: 5 }, '2025-11-01'), 'Vencido hace 5 días');
    assert.equal(textoDeVencido({ venc: '2025-10-31', cierre: null, diasVencido: 6 }, '2025-11-01'), 'Vencido desde el 31/10/2025 (hace 6 días)');
  });
  it('un cerrado con el vencimiento anterior a la ventana también dice "Estuvo vencido"', () => {
    assert.equal(textoDeVencido({ venc: '2024-01-31', cierre: '2026-01-05', diasVencido: 705 }, '2025-11-01'), 'Estuvo vencido 705 días');
  });
  it('el texto va en el hueco libre más grande de la banda y, si no entra, no va', () => {
    const entra = cinta(52).textos.find(t => t.tipo === 'vencido');
    const tramo = cinta(52).tramos.filter(t => t.tipo === 'vencido').at(-1);
    assert.ok(entra.x - ('Vencido hace 81 días'.length * 6.6 + 10) / 2 >= tramo.x0 - 1e-9);
    assert.ok(entra.x + ('Vencido hace 81 días'.length * 6.6 + 10) / 2 <= tramo.x1 + 1e-9);
    // con letras enormes no entra ningún texto de vencido, y los tramos siguen
    const grande = cinta(52, { letra: 100 });
    assert.deepEqual(grande.textos, []);
    assert.equal(grande.tramos.length, 6);
  });
  it('el texto se corre al hueco más grande cuando una marca de la banda cae dentro del tramo', () => {
    // un cambio en la ficha el 07/08 (x ≈ 750) deja un hueco de 7 a su izquierda y otro de unas 180 unidades a su derecha: el texto va
    // en el mayor. (Un cambio que no toca la próxima ni la carga no cierra el ciclo.)
    const ficha = { id: 98, tipo: 'editar', estado: 'aprobado', creado: '2026-08-07 09:00:00', revisado: '2026-08-07 10:00:00', propuso: 'Ana María Uno',
      reviso: 'Bruno Pablo Dos', motivo: null, nuevos: { descripcion: 'Nueva' }, anteriores: { descripcion: 'Vieja' }, dataset_id: 52 };
    const fu = { ...f(52), cambios: [...CASOS[52].cambios, ficha] };
    const c = cintaDeFuentes(fu);
    const t = c.textos.find(x => x.tipo === 'vencido');
    const marca = c.marcas.find(m => m.fila === 'banda' && m.detalle[0].startsWith('07/08/2026'));
    assert.ok(t.x > marca.x + 11);
    assert.ok(Math.abs(t.x - marca.x) >= ('Vencido hace 81 días'.length * 6.6 + 10) / 2 + 11 - 0.01);
  });
});

describe('cintaDe: vencimientos y hoy', () => {
  it('11 y 26: el vencimiento antes de la ventana no lleva etiqueta "vence"', () => {
    assert.deepEqual(cinta(11).vencimientos, []);
    assert.deepEqual(cinta(26).vencimientos, []);
  });
  it('10: solo los ciclos que llegaron a su vencimiento llevan "vence dd/mm"', () => {
    const fu = f(10), ciclos = ciclosDe(fu, HOY);
    const esperados = ciclos.filter(c => c.venc >= '2025-11-01' && c.venc <= '2026-10-31' && (!c.cierre || c.cierre >= c.venc)).map(c => `vence ${c.venc.slice(8)}/${c.venc.slice(5, 7)}`);
    assert.deepEqual(cinta(10).vencimientos.map(v => v.texto), esperados);
  });
  it('hoy queda en el renglón 1 si ningún vencimiento está a menos de 62', () => {
    assert.equal(cinta(52).hoy.renglon, 1);
    assert.equal(cinta(66).hoy.renglon, 1);
  });
  it('hoy baja un renglón con un vencimiento a menos de 62 y no con uno a 62 o más', () => {
    const con = (venc) => cinta(52, { ciclos: [{ inicio: '2026-02-04', venc, cierre: null, como: null, desde: '2026-02-04 09:58:15', hasta: null, diasVencido: 0 }] }).hoy.renglon;
    assert.equal(con('2026-10-31'), 2);
    assert.equal(con('2026-07-31'), 1); // venció hace 81 días: lejos
    // 62 unidades son 24,07 días: a 24 días (26/09) baja y a 25 (25/09) no
    assert.equal(con('2026-09-25'), 1);
    assert.equal(con('2026-09-26'), 2);
  });
});

describe('cintaDe: marcas', () => {
  it('cada tipo va en su fila', () => {
    const c = sinCiclos([nota('2026-02-01', 1), email('2026-03-01'), mov('alta', '2026-04-01'), mov('act', '2026-05-01'), mov('actp', '2026-06-01'),
      mov('cambio', '2026-07-01'), mov('cambiop', '2026-08-01'), mov('area', '2026-09-01', { success: true }), mov('rech', '2026-10-01')]);
    const fila = Object.fromEntries(c.marcas.map(m => [m.tipo, m.fila]));
    assert.deepEqual(fila, { nota: 'arriba', email: 'arriba', alta: 'banda', act: 'banda', actp: 'banda', cambio: 'banda', cambiop: 'banda', area: 'abajo', rech: 'abajo' });
  });
  it('no van: auditoría, baja, emails fallidos y notas que no están enviadas', () => {
    const c = sinCiclos([mov('auditoria', '2026-02-01'), mov('baja', '2026-03-01'), email('2026-04-01', false), mov('area', '2026-05-01', { success: false }),
      nota('2026-06-01', 3, 'pendiente'), nota('2026-07-01', 4, 'fallida'), mov('nota', '2026-08-01', {}), email('2026-09-01', true)]);
    assert.deepEqual(c.marcas.map(m => m.tipo), ['email']);
  });
  it('las marcas fuera de la ventana no van', () => {
    const c = sinCiclos([mov('act', '2025-10-31'), mov('act', '2025-11-01'), mov('act', '2026-10-31'), mov('act', '2026-11-01')]);
    assert.deepEqual(c.marcas.map(m => m.detalle[0].slice(0, 10)), ['01/11/2025', '31/10/2026']);
  });
  it('se juntan si la distancia al primero del grupo es menor que la separación: 4 días (10,3) sí, 5 días (12,9) no', () => {
    const juntas = sinCiclos([mov('act', '2026-03-01'), mov('act', '2026-03-05')]);
    assert.equal(juntas.marcas.length, 1); assert.equal(juntas.marcas[0].cantidad, 2);
    const separadas = sinCiclos([mov('act', '2026-03-01'), mov('act', '2026-03-06')]);
    assert.equal(separadas.marcas.length, 2);
  });
  it('la cuenta es contra el primero del grupo, no contra la anterior: una cadena de marcas no se junta toda', () => {
    // 4 días entre cada una (10,3): la segunda se une a la primera; la tercera está a 8 días (20,6) del primero y arranca otro grupo
    const c = sinCiclos([mov('act', '2026-03-01'), mov('act', '2026-03-05'), mov('act', '2026-03-09')]);
    assert.deepEqual(c.marcas.map(m => m.cantidad), [2, 1]);
  });
  it('la x de un grupo es el centro de sus marcas', () => {
    const c = sinCiclos([mov('act', '2026-03-01'), mov('act', '2026-03-05')]);
    assert.ok(casi(c.marcas[0].x, (xDe('2026-03-01') + xDe('2026-03-05')) / 2));
  });
  it('la separación y la letra se pueden elegir (el PDF usa 12 y 8,4)', () => {
    const datos = [mov('act', '2026-03-01'), mov('act', '2026-03-06')]; // 5 días: 12,9
    assert.equal(sinCiclos(datos).marcas.length, 2);
    assert.equal(sinCiclos(datos, { separacion: 12 }).marcas.length, 2);
    assert.equal(sinCiclos(datos, { separacion: 13 }).marcas.length, 1);
    assert.equal(sinCiclos(datos, { separacion: 13 }).marcas[0].cantidad, 2);
  });
  it('en un mismo día, la de más prioridad: nota, email, act, actp, cambio, cambiop, alta, rech, area', () => {
    const orden = ['act', 'actp', 'cambio', 'cambiop', 'alta'];
    for (let i = 0; i < orden.length; i++) {
      const juntos = orden.slice(i).reverse().map(t => mov(t, '2026-04-10'));
      assert.equal(sinCiclos(juntos).marcas[0].tipo, orden[i]);
    }
    assert.equal(sinCiclos([mov('area', '2026-04-10', { success: true }), mov('rech', '2026-04-10')]).marcas[0].tipo, 'rech');
    assert.equal(sinCiclos([email('2026-04-10'), nota('2026-04-10', 3)]).marcas[0].tipo, 'nota');
    assert.equal(sinCiclos([email('2026-04-10')]).marcas[0].tipo, 'email');
  });
  it('las filas no se mezclan: un email y una actualización del mismo día son dos marcas', () => {
    const c = sinCiclos([email('2026-04-10'), mov('act', '2026-04-10')]);
    assert.deepEqual(c.marcas.map(m => [m.fila, m.cantidad]).sort(), [['arriba', 1], ['banda', 1]]);
  });
  it('el detalle lleva "dd/mm/aaaa: título" de cada una, de la más vieja a la más nueva', () => {
    const c = sinCiclos([mov('act', '2026-03-05', {}, 'Segunda'), mov('act', '2026-03-01', {}, 'Primera')]);
    assert.deepEqual(c.marcas[0].detalle, ['01/03/2026: Primera', '05/03/2026: Segunda']);
  });
  it('en un mismo día el detalle sigue el momento', () => {
    const tarde = { ...mov('act', '2026-03-01', {}, 'Tarde'), momento: '2026-03-01 15:00:00' };
    const temprano = { ...mov('act', '2026-03-01', {}, 'Temprano'), momento: '2026-03-01 09:00:00' };
    assert.deepEqual(sinCiclos([tarde, temprano]).marcas[0].detalle, ['01/03/2026: Temprano', '01/03/2026: Tarde']);
  });
  it('la etiqueta: "Nota n/aa", con " y " si hay varias, y null si el grupo no tiene notas', () => {
    assert.equal(sinCiclos([nota('2026-03-01', 3)]).marcas[0].etiqueta, 'Nota 3/26');
    assert.equal(sinCiclos([nota('2026-03-01', 3), nota('2026-03-03', 4)]).marcas[0].etiqueta, 'Nota 3/26 y Nota 4/26');
    assert.equal(sinCiclos([email('2026-03-01'), email('2026-03-02')]).marcas[0].etiqueta, null);
    assert.equal(sinCiclos([mov('act', '2026-03-01')]).marcas[0].etiqueta, null);
    // un email junto a una nota: la etiqueta es la de la nota
    assert.equal(sinCiclos([email('2026-03-01'), nota('2026-03-02', 5)]).marcas[0].etiqueta, 'Nota 5/26');
  });
  it('52: las notas y los emails a DGMIT van arriba, los emails al área abajo y las actualizaciones en la banda', () => {
    const c = cinta(52);
    const tipos = (fila) => [...new Set(c.marcas.filter(m => m.fila === fila).map(m => m.tipo))].sort();
    assert.deepEqual(tipos('arriba'), ['email', 'nota']);
    assert.deepEqual(tipos('banda'), ['act', 'alta']);
    assert.deepEqual(tipos('abajo'), ['area', 'rech']);
  });
  it('42: el email que falló no es una marca', () => {
    const fu = f(42), fallidos = fu.emails.filter(e => !e.success).length;
    assert.ok(fallidos >= 1);
    const marcas = cintaDeFuentes(fu).marcas.filter(m => m.fila === 'arriba' || m.fila === 'abajo');
    const enviados = fu.emails.filter(e => e.success && e.enviado >= '2025-11-01').length;
    assert.equal(marcas.reduce((n, m) => n + m.cantidad, 0), enviados);
  });
});

describe('cintaDe: datos raros y pureza', () => {
  it('sin ciclos, sin movimientos y sin fuentes, no tira error', () => {
    assert.doesNotThrow(() => cintaDe({ hoy: HOY }));
    assert.doesNotThrow(() => cintaDe({ fuentes: {}, ciclos: [], movimientos: [], hoy: HOY }));
    assert.doesNotThrow(() => cintaDe({ fuentes: null, ciclos: undefined, movimientos: null, hoy: HOY }));
    const c = cintaDe({ fuentes: {}, ciclos: [], movimientos: [], hoy: HOY });
    assert.equal(c.meses.length, 12); assert.deepEqual(c.marcas, []); assert.deepEqual(c.vencimientos, []);
    assert.deepEqual(c.tramos.map(t => t.tipo), ['eventual']); // sin alta: del inicio de la ventana a hoy
  });
  it('movimientos y ciclos con basura se ignoran', () => {
    const c = cintaDe({
      fuentes: f(52),
      ciclos: [null, { inicio: 'x', venc: '2026-07-31' }, { inicio: '2026-02-04', venc: '2026-07-31', cierre: 'basura', diasVencido: 81 }],
      movimientos: [null, 7, { tipo: 'act' }, { tipo: 'act', fecha: '2026-02-30' }, { tipo: 'desconocido', fecha: '2026-03-01' }, mov('act', '2026-03-01')],
      hoy: HOY
    });
    assert.equal(c.marcas.length, 1);
    assert.deepEqual(c.tramos.map(t => t.tipo), ['antes', 'ciclo', 'vencido']);
  });
  it('el alta el mismo día que hoy: sin error y sin tramos de largo cero', () => {
    const fu = conDataset(81, { alta: `${HOY} 08:00:00` });
    const c = cintaDeFuentes(fu);
    for (const t of c.tramos) assert.ok(t.x1 - t.x0 > 0.2);
    assert.ok(c.tramos.some(t => t.tipo === 'futuro'));
  });
  it('un alta posterior a hoy no tira error', () => {
    assert.doesNotThrow(() => cintaDeFuentes(conDataset(81, { alta: '2026-12-01 08:00:00' })));
  });
  it('la próxima que no es fin de mes (2027-03-29) se dibuja como viene', () => {
    const c = cinta(38, { ciclos: [{ inicio: '2025-12-01', venc: '2027-03-29', cierre: null, como: null, desde: '2025-12-01 12:16:22', hasta: null, diasVencido: 0 }] });
    assert.ok(c.tramos.some(t => t.tipo === 'futuro' && casi(t.x1, 970)));
  });
  it('no modifica lo que recibe', () => {
    const fu = structuredClone(f(52)), ciclos = ciclosDe(fu, HOY), movimientos = movimientosDe(fu);
    const antes = JSON.stringify([fu, ciclos, movimientos]);
    const congelar = (x) => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); Object.values(x).forEach(congelar); } };
    congelar(fu); congelar(ciclos); congelar(movimientos);
    cintaDe({ fuentes: fu, ciclos, movimientos, hoy: HOY });
    assert.equal(JSON.stringify([fu, ciclos, movimientos]), antes);
  });
  it('es determinista: dos veces, lo mismo', () => {
    assert.deepEqual(cinta(52), cinta(52));
  });
});
