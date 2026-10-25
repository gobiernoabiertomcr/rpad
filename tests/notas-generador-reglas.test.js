// Generador de Notas (spec 2026-10-24-generador-de-notas, secciones 3.2 y 7): las reglas puras del pedido de una nota de la
// DGMIT. La validación de lo que llega a la vista previa y a la descarga, qué datasets se pueden pedir y el orden de la tabla.
// Sin base ni Date local: hoy llega por parámetro como texto 'AAAA-MM-DD'.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LARGO_NUMERO, FECHA_MINIMA, DIAS_ADELANTE, TIPOS_NOTA, PEDIDOS, ORDEN_DE_CAMPOS, MENSAJES_GENERADOR,
  textoAlDia, textoDeOtraArea, validarPedidoDeNota, sePuedePedir, ordenDeLosDatasets
} from '../services/notasGeneradorReglas.js';

const HOY = '2026-10-24';
const VALIDO = Object.freeze({ fecha: '2026-10-24', tipo: 'interna', pedido: 'solicitud', area_id: 37, datasets: Object.freeze([58]) });
const REITERACION = Object.freeze({ ...VALIDO, pedido: 'reiteracion' });

// Solo los errores del pedido válido con un campo cambiado
const erroresCon = (cambio, hoy = HOY) => validarPedidoDeNota({ ...VALIDO, ...cambio }, hoy).errores;
const datosCon = (cambio, hoy = HOY) => validarPedidoDeNota({ ...VALIDO, ...cambio }, hoy).datos;

// 40 y 41 caracteres que en UTF-16 ocupan el doble: cuentan como el varchar de la base (Array.from), no como `length`
const EMOJI_40 = '😀'.repeat(40);
const EMOJI_41 = '😀'.repeat(41);

describe('constantes y textos', () => {
  it('los límites, la fecha mínima, los días hacia adelante, los tipos, los pedidos y el orden de los campos', () => {
    assert.equal(LARGO_NUMERO, 40);
    assert.equal(FECHA_MINIMA, '2025-01-01');
    assert.equal(DIAS_ADELANTE, 30);
    assert.deepEqual([...TIPOS_NOTA], ['interna', 'externa']);
    assert.deepEqual([...PEDIDOS], ['solicitud', 'reiteracion']);
    assert.deepEqual([...ORDEN_DE_CAMPOS], ['fecha', 'numero', 'tipo', 'pedido', 'anteriores', 'area', 'datasets']);
  });

  it('los mensajes de validación, al pie de la letra', () => {
    assert.deepEqual({ ...MENSAJES_GENERADOR }, {
      fecha: 'Elegí la fecha de la nota.',
      fechaFuera: 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.',
      numeroLargo: 'El número de la nota puede tener hasta 40 caracteres.',
      tipo: 'Elegí si la nota es interna o externa.',
      pedido: 'Elegí si es una solicitud o una reiteración.',
      anteriorLargo: 'Cada número de nota anterior puede tener hasta 40 caracteres.',
      area: 'Elegí el área.',
      datasets: 'Elegí al menos un dataset.'
    });
  });

  it('las constantes están congeladas', () => {
    assert.ok(Object.isFrozen(MENSAJES_GENERADOR));
    assert.ok(Object.isFrozen(TIPOS_NOTA));
    assert.ok(Object.isFrozen(PEDIDOS));
    assert.ok(Object.isFrozen(ORDEN_DE_CAMPOS));
  });

  it('los textos del dataset al día y del dataset de otra área (400)', () => {
    assert.equal(textoAlDia('Padrón de comercios'), '«Padrón de comercios» está al día: todavía no hay datos para pedir.');
    assert.equal(textoDeOtraArea('Áreas específicas de género'), '«Áreas específicas de género» no es del área elegida.');
  });
});

describe('validarPedidoDeNota', () => {
  it('el pedido mínimo: sin número ni notas anteriores, sin errores', () => {
    assert.deepEqual(validarPedidoDeNota(VALIDO, HOY), {
      datos: { fecha: '2026-10-24', numero: null, tipo: 'interna', pedido: 'solicitud', anteriores: [], area_id: 37, datasets: [58] },
      errores: {}
    });
  });

  it('un pedido completo: el número recortado, las notas anteriores limpias y los ids como números, sin repetidos', () => {
    const resultado = validarPedidoDeNota({
      fecha: '2026-09-30', numero: '  156/26  ', tipo: 'externa', pedido: 'reiteracion',
      anteriores: [' 97/26 ', '97/26', '', '102/26'], area_id: '37', datasets: [58, '12', 58, '58', 3]
    }, HOY);
    assert.deepEqual(resultado, {
      datos: {
        fecha: '2026-09-30', numero: '156/26', tipo: 'externa', pedido: 'reiteracion',
        anteriores: ['97/26', '102/26'], area_id: 37, datasets: [58, 12, 3]
      },
      errores: {}
    });
  });

  it('fecha: del 01/01/2025 a hoy + 30; 2024-12-31 y hoy + 31, fechaFuera; 2026-02-29 y lo que no es una fecha, fecha', () => {
    for (const fecha of ['2025-01-01', '2026-01-15', HOY, '2026-11-23']) {
      assert.deepEqual(erroresCon({ fecha }), {}, fecha);
      assert.equal(datosCon({ fecha }).fecha, fecha);
    }
    for (const fecha of ['2024-12-31', '2026-11-24', '2027-01-01']) {
      assert.deepEqual(erroresCon({ fecha }), { fecha: MENSAJES_GENERADOR.fechaFuera }, fecha);
      assert.equal(datosCon({ fecha }).fecha, null, fecha);
    }
    for (const fecha of ['2026-02-29', '2026-02-30', '24/10/2026', '2026-10-24 ', ' 2026-10-24', '2026-10-24T00:00:00', '2026-1-5', '', null, undefined, 20261024]) {
      assert.deepEqual(erroresCon({ fecha }), { fecha: MENSAJES_GENERADOR.fecha }, String(fecha));
      assert.equal(datosCon({ fecha }).fecha, null, String(fecha));
    }
    // Hoy + 30 cruza el año y los bisiestos como texto
    assert.deepEqual(erroresCon({ fecha: '2027-01-14' }, '2026-12-15'), {});
    assert.deepEqual(erroresCon({ fecha: '2027-01-15' }, '2026-12-15'), { fecha: MENSAJES_GENERADOR.fechaFuera });
    assert.deepEqual(erroresCon({ fecha: '2028-02-29' }, '2028-02-15'), {});
    assert.deepEqual(erroresCon({ fecha: '2028-03-16' }, '2028-02-15'), {});
    assert.deepEqual(erroresCon({ fecha: '2028-03-17' }, '2028-02-15'), { fecha: MENSAJES_GENERADOR.fechaFuera });
  });

  it('sin un hoy válido no se puede saber si la fecha se pasa de los 30 días: fechaFuera, sin tirar', () => {
    for (const hoy of [undefined, null, '', '24/10/2026', '2026-02-30', 20261024]) {
      assert.deepEqual(validarPedidoDeNota(VALIDO, hoy).errores, { fecha: MENSAJES_GENERADOR.fechaFuera }, String(hoy));
    }
  });

  it('número: opcional; 40 emoji sí, 41 numeroLargo; lo que no es texto, numeroLargo (sin tirar)', () => {
    for (const numero of [undefined, null, '', '   ', '\t\n']) {
      assert.deepEqual(erroresCon({ numero }), {}, JSON.stringify(numero));
      assert.equal(datosCon({ numero }).numero, null, JSON.stringify(numero));
    }
    assert.deepEqual(erroresCon({ numero: EMOJI_40 }), {});
    assert.equal(datosCon({ numero: `  ${EMOJI_40}  ` }).numero, EMOJI_40, 'los espacios de los extremos no cuentan');
    assert.deepEqual(erroresCon({ numero: EMOJI_41 }), { numero: MENSAJES_GENERADOR.numeroLargo });
    assert.equal(datosCon({ numero: EMOJI_41 }).numero, null);
    assert.deepEqual(erroresCon({ numero: `A${' '.repeat(39)}B` }), { numero: MENSAJES_GENERADOR.numeroLargo }, 'los espacios del medio sí cuentan');
    // Los números raros salen tal cual: rayas, comillas tipográficas, varias barras
    const raro = '“N° 156”/26 — DGMIT/MCR/A';
    assert.deepEqual(erroresCon({ numero: raro }), {});
    assert.equal(datosCon({ numero: raro }).numero, raro);
    for (const numero of [125, 0, true, false, {}, ['156/26'], () => '156/26']) {
      assert.deepEqual(erroresCon({ numero }), { numero: MENSAJES_GENERADOR.numeroLargo }, String(numero));
      assert.equal(datosCon({ numero }).numero, null, String(numero));
    }
  });

  it('tipo: interna o externa; cualquier otro valor da el error del tipo', () => {
    assert.deepEqual(erroresCon({ tipo: 'externa' }), {});
    for (const tipo of ['escalonada', 'Interna', 'EXTERNA', ' interna', '', null, undefined, 1, ['interna'], {}]) {
      assert.deepEqual(erroresCon({ tipo }), { tipo: MENSAJES_GENERADOR.tipo }, JSON.stringify(tipo));
      assert.equal(datosCon({ tipo }).tipo, null, JSON.stringify(tipo));
    }
  });

  it('pedido: solicitud o reiteración; cualquier otro valor da el error del pedido', () => {
    assert.deepEqual(erroresCon({ pedido: 'reiteracion' }), {});
    for (const pedido of ['x', 'Solicitud', 'reiteración', ' solicitud', '', null, undefined, 1, ['solicitud']]) {
      assert.deepEqual(erroresCon({ pedido }), { pedido: MENSAJES_GENERADOR.pedido }, JSON.stringify(pedido));
      assert.equal(datosCon({ pedido }).pedido, null, JSON.stringify(pedido));
    }
  });

  it('notas anteriores: con reiteración, recortadas, sin vacías ni repetidas y en el orden recibido; con solicitud, []', () => {
    const anteriores = [' 97/26 ', '97/26', '', '102/26'];
    assert.deepEqual(validarPedidoDeNota({ ...REITERACION, anteriores }, HOY).datos.anteriores, ['97/26', '102/26']);
    assert.deepEqual(validarPedidoDeNota({ ...REITERACION, anteriores }, HOY).errores, {});
    assert.deepEqual(datosCon({ anteriores }).anteriores, [], 'con solicitud no hay notas anteriores');
    // Sin lista, o con una vacía, o solo con vacías, ninguna
    for (const valor of [undefined, null, [], ['', '   ', null, undefined]]) {
      const { datos, errores } = validarPedidoDeNota({ ...REITERACION, anteriores: valor }, HOY);
      assert.deepEqual(errores, {}, JSON.stringify(valor));
      assert.deepEqual(datos.anteriores, [], JSON.stringify(valor));
    }
    // Las repetidas se comparan ya recortadas; mayúsculas distintas son números distintos
    assert.deepEqual(validarPedidoDeNota({ ...REITERACION, anteriores: ['102/26', ' 97/26', '97/26 ', 'a/26', 'A/26'] }, HOY).datos.anteriores,
      ['102/26', '97/26', 'a/26', 'A/26']);
  });

  it('notas anteriores: 40 emoji sí; 41, o algo que no es un texto, anteriorLargo y el campo entero en null', () => {
    assert.deepEqual(validarPedidoDeNota({ ...REITERACION, anteriores: [EMOJI_40, '97/26'] }, HOY).datos.anteriores, [EMOJI_40, '97/26']);
    for (const valor of [[EMOJI_41], ['97/26', EMOJI_41], ['97/26', 97], [true], [{}], [['97/26']], '97/26', 97, {}]) {
      const { datos, errores } = validarPedidoDeNota({ ...REITERACION, anteriores: valor }, HOY);
      assert.deepEqual(errores, { anteriores: MENSAJES_GENERADOR.anteriorLargo }, JSON.stringify(valor));
      assert.equal(datos.anteriores, null, JSON.stringify(valor));
    }
    // Con solicitud no se miran: no hay error
    assert.deepEqual(erroresCon({ anteriores: [EMOJI_41, 97] }), {});
    assert.deepEqual(datosCon({ anteriores: [EMOJI_41, 97] }).anteriores, []);
  });

  it('área: un entero positivo (como número o como texto de solo dígitos); cualquier otra cosa da el error del área', () => {
    assert.equal(datosCon({ area_id: '37' }).area_id, 37);
    assert.equal(datosCon({ area_id: 1 }).area_id, 1);
    for (const area_id of [0, -1, 1.5, 'x', '37 ', ' 37', '1e3', '', null, undefined, true, [37], {}, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.deepEqual(erroresCon({ area_id }), { area: MENSAJES_GENERADOR.area }, String(area_id));
      assert.equal(datosCon({ area_id }).area_id, null, String(area_id));
    }
  });

  it('datasets: [] y [5, "x"] dan el error; ["7", 7, 8] da [7, 8]', () => {
    for (const datasets of [[], [5, 'x'], [0], [-1], [1.5], ['a'], [null], '5', 5, null, undefined, {}]) {
      assert.deepEqual(erroresCon({ datasets }), { datasets: MENSAJES_GENERADOR.datasets }, JSON.stringify(datasets));
      assert.equal(datosCon({ datasets }).datasets, null, JSON.stringify(datasets));
    }
    assert.deepEqual(datosCon({ datasets: ['7', 7, 8] }).datasets, [7, 8]);
  });

  it('los errores siguen ORDEN_DE_CAMPOS (el primero es el que va en `error` y `campo`)', () => {
    const conPedidoMalo = validarPedidoDeNota(
      { datasets: [], area_id: 0, pedido: 'x', tipo: 'escalonada', numero: 125, fecha: '2024-12-31' }, HOY).errores;
    assert.deepEqual(Object.keys(conPedidoMalo), ['fecha', 'numero', 'tipo', 'pedido', 'area', 'datasets']);
    const conAnteriorLargo = validarPedidoDeNota(
      { datasets: [5, 'x'], area_id: 'x', anteriores: [EMOJI_41], pedido: 'reiteracion', tipo: 'otra', numero: EMOJI_41, fecha: '2026-02-29' }, HOY).errores;
    assert.deepEqual(Object.keys(conAnteriorLargo), ['fecha', 'numero', 'tipo', 'anteriores', 'area', 'datasets']);
    for (const errores of [conPedidoMalo, conAnteriorLargo]) {
      assert.deepEqual(Object.keys(errores), ORDEN_DE_CAMPOS.filter((campo) => errores[campo]));
    }
  });

  it('nunca tira con entradas raras: lo que no es un objeto da los errores de los campos obligatorios', () => {
    const obligatorios = {
      fecha: MENSAJES_GENERADOR.fecha,
      tipo: MENSAJES_GENERADOR.tipo,
      pedido: MENSAJES_GENERADOR.pedido,
      area: MENSAJES_GENERADOR.area,
      datasets: MENSAJES_GENERADOR.datasets
    };
    const nada = { fecha: null, numero: null, tipo: null, pedido: null, anteriores: [], area_id: null, datasets: null };
    for (const entrada of [null, undefined, 'texto', 5, true, [], () => VALIDO, {}]) {
      const resultado = validarPedidoDeNota(entrada, HOY);
      assert.deepEqual(resultado.errores, obligatorios, String(entrada));
      assert.deepEqual(resultado.datos, nada, String(entrada));
    }
    assert.deepEqual(validarPedidoDeNota().errores, obligatorios);
    // Un cuerpo grande no traba el servidor: los repetidos se sacan en tiempo lineal
    const muchos = Array.from({ length: 100000 }, (_, i) => `${i + 1}/26`);
    const inicio = performance.now();
    const grande = validarPedidoDeNota({ ...REITERACION, anteriores: [...muchos, ...muchos] }, HOY);
    const demora = performance.now() - inicio;
    assert.deepEqual(grande.errores, {});
    assert.deepEqual(grande.datos.anteriores, muchos);
    assert.ok(demora < 1000, `100.000 números tardaron ${Math.round(demora)} ms`);
  });
});

describe('sePuedePedir', () => {
  it('al día no; vencidos, próximos, eventuales y sin fecha sí', () => {
    assert.equal(sePuedePedir('actualizado'), false);
    for (const estado of ['atrasado', 'sin-respuesta', 'proximo', 'eventual', 'sin-fecha']) {
      assert.equal(sePuedePedir(estado), true, estado);
    }
  });
});

describe('ordenDeLosDatasets', () => {
  // Con hoy 24/10/2026: los días y las próximas son los de estadoDelDataset
  const vencido85 = { titulo: 'Recaudación', dias: -85, estado: 'sin-respuesta', proxima: '2026-07-31' };
  const vencido450 = { titulo: 'Licencias de conducir', dias: -450, estado: 'sin-respuesta', proxima: '2025-07-31' };
  const proximo37 = { titulo: 'Habilitaciones', dias: 37, estado: 'proximo', proxima: '2026-11-30' };
  const alDia = { titulo: 'Padrón de comercios', dias: 158, estado: 'actualizado', proxima: '2027-03-31' };
  const eventual = { titulo: 'Arbolado', dias: null, estado: 'eventual', proxima: null };

  it('los vencidos (el más vencido primero), los próximos, el al día y el eventual', () => {
    const datasets = [alDia, eventual, vencido85, proximo37, vencido450];
    const copia = [...datasets];
    const ordenados = ordenDeLosDatasets(datasets);
    assert.deepEqual(ordenados, [vencido450, vencido85, proximo37, alDia, eventual]);
    assert.notEqual(ordenados, datasets, 'es una copia');
    assert.deepEqual(datasets, copia, 'la lista recibida no cambia');
  });

  it('los próximos por días; el resto por próxima, con los sin próxima al final', () => {
    const proximo7 = { titulo: 'Zoonosis', dias: 7, estado: 'proximo', proxima: '2026-10-31' };
    const vencido24 = { titulo: 'Zoonosis 2025', dias: -24, estado: 'atrasado', proxima: '2026-09-30' };
    const alDiaMasLejos = { titulo: 'Agua potable', dias: 249, estado: 'actualizado', proxima: '2027-06-30' };
    const sinFecha = { titulo: 'Becas', dias: null, estado: 'sin-fecha', proxima: null };
    const ordenados = ordenDeLosDatasets([sinFecha, alDiaMasLejos, eventual, proximo37, alDia, proximo7, vencido24]);
    assert.deepEqual(ordenados, [vencido24, proximo7, proximo37, alDia, alDiaMasLejos, eventual, sinFecha]);
  });

  it('los empates van por título, en castellano (la Á con la A)', () => {
    const vencidoA = { titulo: 'Árboles', dias: -85, estado: 'sin-respuesta', proxima: '2026-07-31' };
    const vencidoB = { titulo: 'Bicicletas', dias: -85, estado: 'sin-respuesta', proxima: '2026-07-31' };
    const proximoA = { titulo: 'Ómnibus', dias: 37, estado: 'proximo', proxima: '2026-11-30' };
    const proximoB = { titulo: 'Plazas', dias: 37, estado: 'proximo', proxima: '2026-11-30' };
    const alDiaA = { titulo: 'Cementerios', dias: 158, estado: 'actualizado', proxima: '2027-03-31' };
    const sinFechaA = { titulo: 'Archivo', dias: null, estado: 'sin-fecha', proxima: null };
    assert.deepEqual(
      ordenDeLosDatasets([sinFechaA, alDia, proximoB, vencidoB, eventual, alDiaA, proximoA, vencidoA]),
      [vencidoA, vencidoB, proximoA, proximoB, alDiaA, alDia, eventual, sinFechaA]
    );
  });

  it('una lista vacía da una lista vacía', () => {
    assert.deepEqual(ordenDeLosDatasets([]), []);
  });
});
