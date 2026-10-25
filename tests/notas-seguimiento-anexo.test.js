// La reiteración en su propio anexo (spec 2026-10-24-reiteracion-en-su-anexo): cada hoja del anexo de una reiteración suma, en una
// copia de las fuentes de su dataset, la nota con la que viaja. Es el movimiento más nuevo, como las otras notas, cuenta en «Avisos
// del ciclo abierto» y tiene su marca en la cinta. Puro: los casos reales de tests/seguimiento-casos.js, sin base de datos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';
import { seguimientoDe } from '../services/seguimientoReglas.js';
import { OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { seguimientosDeLaNota, fuentesDeLaNota, notaPropiaDe } from '../services/notasDigitalesSeguimiento.js';

// Las opciones del circuito en el anexo (spec 2026-10-24-notas-dgmit, 7)
const ANEXO = { anexo: true };
const f = (id) => ({ ...CASOS[id], catalogos: CATALOGOS });
const mapaDe = (ids) => new Map(ids.map(id => [id, f(id)]));
// El pedido de cada caso calculado con hoy, como lo trae la selección de la reiteración (conPedido)
const PEDIDO = { 52: 'Vigente al 30/06/2026', 58: 'Vigente al 31/10/2026', 81: 'Vigente al 30/09/2026' };
// Un dataset de la nota como lo trae la selección: su vencimiento (el del ciclo abierto) y su pedido
const deLaNota = (id) => ({
  id, titulo: CASOS[id].dataset.titulo, vencimiento: CASOS[id].dataset.proxima, pedido: { desde: null, hasta: null, texto: PEDIDO[id] }
});
// El 52 venció el 31/07/2026 (externo; en el ciclo abierto, 5 emails a DGMIT y la Nota Digital N° 2/26) y el 58 vence el 30/11/2026
// (externo, próximo a vencer; en el ciclo abierto, un email). La tabla de la nota pone primero el próximo
const IDS = [52, 58];
const DATASETS = IDS.map(deLaNota);
// La reiteración N° 2/27 de un envío automático, generada a las 08:15:03 del día de la nota
const PROPIA = Object.freeze({
  numero: 2, anio: 2027, gestion: 'externa', enviada: `${HOY} 08:15:03`, para: 'a@x', cc: null, creado_por: null,
  firmante: 'Nombre Apellido Firmante'
});
// Lo que la nota sumada dice en cada caso
const ESPERADO = {
  52: {
    detalle: 'Reiteración de gestión externa: vencía el 31/07/2026. Pide: Vigente al 30/06/2026.',
    avisos: { titulo: '7 avisos', texto: '5 emails y las Notas Digitales N° 2/26 y 2/27' }, antes: '6 avisos'
  },
  58: {
    detalle: 'Reiteración de gestión externa: vence el 30/11/2026. Pide: Vigente al 31/10/2026.',
    avisos: { titulo: '2 avisos', texto: '1 email y la Nota Digital N° 2/27' }, antes: '1 aviso'
  }
};
const notasDigitales = (s) => s.movimientos.filter(m => m.tipo === 'nota');

describe('notaPropiaDe: la reiteración con la forma de una nota de fuentesDe', () => {
  it('enviada, con el número, la gestión, los destinatarios y quién la firmó; el vencimiento, la sección y el pedido, del dataset', () => {
    const nota = notaPropiaDe(deLaNota(52), HOY, PROPIA);
    assert.deepEqual(nota, {
      id: null, numero: 2, anio: 2027, tipo: 'reiteracion', gestion: 'externa', fecha: HOY, estado: 'enviada',
      enviada: '2026-10-20 08:15:03', para: 'a@x', cc: null, seccion: 'vencido', vencimiento: '2026-07-31',
      datos_solicitados: 'Vigente al 30/06/2026', creado_por: null, firmante: 'Nombre Apellido Firmante'
    });
    // Los mismos campos que una nota leída de la base (los casos tienen el formato de fuentesDe)
    assert.deepEqual(Object.keys(nota).sort(), Object.keys(CASOS[52].notas[0]).sort());
  });

  it('la sección, con la regla de notas_digitales_datasets: el que vence el día de la nota es de los próximos', () => {
    assert.equal(notaPropiaDe(deLaNota(58), HOY, PROPIA).seccion, 'proximo');
    assert.equal(notaPropiaDe({ id: 1, vencimiento: HOY, pedido: null }, HOY, PROPIA).seccion, 'proximo');
    assert.equal(notaPropiaDe({ id: 1, vencimiento: '2026-10-19', pedido: null }, HOY, PROPIA).seccion, 'vencido');
  });

  it('sin pedido (eventual), datos_solicitados es null; con quien la generó y con cc, los lleva', () => {
    assert.equal(notaPropiaDe({ id: 1, vencimiento: '2026-11-30', pedido: null }, HOY, PROPIA).datos_solicitados, null);
    assert.equal(notaPropiaDe({ id: 1, vencimiento: '2026-11-30' }, HOY, PROPIA).datos_solicitados, null);
    const generada = notaPropiaDe(deLaNota(58), HOY, { ...PROPIA, creado_por: 'Nombre Apellido Generador', cc: 'b@x, c@x' });
    assert.equal(generada.creado_por, 'Nombre Apellido Generador');
    assert.equal(generada.cc, 'b@x, c@x');
  });
});

describe('seguimientosDeLaNota con la reiteración que acompaña', () => {
  it('sin la nota propia da lo mismo que hoy', async () => {
    const ids = [52, 58, 81];
    const fuentes = mapaDe(ids);
    const lista = await seguimientosDeLaNota(ids.map(deLaNota), HOY, fuentes);
    // En el orden de la tabla: los próximos a vencer (58 y 81) y después el vencido (52)
    assert.deepEqual(lista, [58, 81, 52].map(id => seguimientoDe(fuentes.get(id), HOY, OPCIONES_CINTA_PDF, ANEXO)));
    assert.deepEqual(await seguimientosDeLaNota(ids.map(deLaNota), HOY, fuentes, null), lista);
  });

  it('la nota propia es el movimiento más nuevo, igual que las otras notas', async () => {
    const fuentes = mapaDe(IDS);
    const sin = await seguimientosDeLaNota(DATASETS, HOY, fuentes);
    const con = await seguimientosDeLaNota(DATASETS, HOY, fuentes, PROPIA);
    assert.deepEqual(con.map(s => s.ficha.id), [58, 52]);
    con.forEach((s, k) => {
      const id = s.ficha.id;
      const [primero, ...resto] = s.movimientos;
      assert.equal(primero.tipo, 'nota', `caso ${id}`);
      assert.equal(primero.titulo, 'Nota Digital N° 2/27 a DGMIT', `caso ${id}`);
      assert.equal(primero.fecha, HOY, `caso ${id}`);
      assert.equal(primero.momento, '2026-10-20 08:15:03', `caso ${id}`);
      assert.equal(primero.detalle, ESPERADO[id].detalle, `caso ${id}`);
      assert.deepEqual(primero.quien, ['Envío automático', 'Firmó Nombre Firmante'], `caso ${id}`);
      assert.equal(primero.extra.estado, 'enviada', `caso ${id}`);
      // El resto de los movimientos no cambia
      assert.deepEqual(resto, sin[k].movimientos, `caso ${id}`);
    });
  });

  it('si la generó una persona, «Generada por …»; sin pedido, el detalle no dice «Pide»', async () => {
    const fuentes = mapaDe([58]);
    const [s] = await seguimientosDeLaNota([{ ...deLaNota(58), pedido: null }], HOY, fuentes,
      { ...PROPIA, creado_por: 'Nombre Apellido Generador' });
    assert.deepEqual(s.movimientos[0].quien, ['Generada por Nombre Generador', 'Firmó Nombre Firmante']);
    assert.equal(s.movimientos[0].detalle, 'Reiteración de gestión externa: vence el 30/11/2026.');
  });

  it('la nota propia suma en los avisos del ciclo abierto y va en la cinta', async () => {
    const fuentes = mapaDe(IDS);
    const sin = await seguimientosDeLaNota(DATASETS, HOY, fuentes);
    const con = await seguimientosDeLaNota(DATASETS, HOY, fuentes, PROPIA);
    const cantidad = (s) => Number(s.circuito.avisos.titulo.match(/^\d+/)?.[0] ?? 0);
    con.forEach((s, k) => {
      const id = s.ficha.id;
      assert.equal(sin[k].circuito.avisos.titulo, ESPERADO[id].antes, `caso ${id}`);
      assert.equal(cantidad(s), cantidad(sin[k]) + 1, `caso ${id}`);
      assert.deepEqual(s.circuito.avisos, ESPERADO[id].avisos, `caso ${id}`);
      assert.match(s.circuito.avisos.texto, /2\/27$/, `caso ${id}`);
      const marcas = s.cinta.marcas.filter(m => m.etiqueta === 'Nota 2/27');
      assert.equal(marcas.length, 1, `caso ${id}`);
      assert.equal(marcas[0].fila, 'arriba', `caso ${id}`);
      assert.equal(marcas[0].tipo, 'nota', `caso ${id}`);
      assert.deepEqual(marcas[0].detalle, ['20/10/2026: Nota Digital N° 2/27 a DGMIT'], `caso ${id}`);
      // Fuera de la nota sumada, la cinta es la misma
      assert.deepEqual(s.cinta.marcas.filter(m => m.etiqueta !== 'Nota 2/27'), sin[k].cinta.marcas, `caso ${id}`);
    });
  });

  it('no modifica las fuentes', async () => {
    const casosAntes = structuredClone(IDS.map(id => CASOS[id]));
    const fuentes = mapaDe(IDS);
    const mapaAntes = structuredClone(fuentes);
    const largos = IDS.map(id => fuentes.get(id).notas.length);
    const primera = await seguimientosDeLaNota(DATASETS, HOY, fuentes, PROPIA);
    assert.deepEqual(IDS.map(id => CASOS[id]), casosAntes);
    assert.deepEqual(fuentes, mapaAntes);
    assert.deepEqual(IDS.map(id => fuentes.get(id).notas.length), largos);
    assert.deepEqual(IDS.map(id => CASOS[id].notas.length), largos);
    // Otra vez, lo mismo: la nota no se acumula de una llamada a la otra
    const segunda = await seguimientosDeLaNota(DATASETS, HOY, fuentes, PROPIA);
    assert.deepEqual(segunda, primera);
    for (const s of segunda) assert.equal(notasDigitales(s).filter(m => m.titulo === 'Nota Digital N° 2/27 a DGMIT').length, 1);
    // Y el Seguimiento sin la nota sigue siendo el de siempre
    assert.deepEqual(await seguimientosDeLaNota(DATASETS, HOY, fuentes),
      [58, 52].map(id => seguimientoDe(f(id), HOY, OPCIONES_CINTA_PDF, ANEXO)));
  });

  it('saca la reiteración de la misma fecha y gestión que ya estaba en las fuentes', async () => {
    // La reiteración real del día, ya guardada y leída con fuentesDe (la vista previa abierta después de la corrida)
    const guardada = {
      id: 99, numero: 2, anio: 2027, tipo: 'reiteracion', gestion: 'externa', fecha: HOY, estado: 'enviada', enviada: `${HOY} 08:15:20`,
      para: 'a@x', cc: null, seccion: 'vencido', vencimiento: '2026-07-31', datos_solicitados: 'Vigente al 30/06/2026', creado_por: null,
      firmante: 'Nombre Apellido Firmante'
    };
    const fuentes = new Map([[52, { ...f(52), notas: [...CASOS[52].notas, guardada] }]]);
    const deHoy = (s) => notasDigitales(s).filter(m => m.fecha === HOY);
    // La real: una sola vez
    const [real] = await seguimientosDeLaNota([deLaNota(52)], HOY, fuentes, PROPIA);
    assert.equal(deHoy(real).length, 1);
    assert.equal(deHoy(real)[0].titulo, 'Nota Digital N° 2/27 a DGMIT');
    assert.equal(real.circuito.avisos.titulo, '7 avisos');
    // La vista previa: la «XX» en lugar de la real, nunca las dos
    const [previa] = await seguimientosDeLaNota([deLaNota(52)], HOY, fuentes, { ...PROPIA, numero: 'XX', anio: null });
    assert.deepEqual(deHoy(previa).map(m => m.titulo), ['Nota Digital N° XX a DGMIT']);
    assert.deepEqual(previa.circuito.avisos, { titulo: '7 avisos', texto: '5 emails y las Notas Digitales N° 2/26 y XX' });
    assert.equal(fuentes.get(52).notas.length, CASOS[52].notas.length + 1, 'no la saca de las fuentes recibidas');
  });

  it('no saca una reiteración de otro día ni de la otra gestión, ni un aviso del mismo día', async () => {
    const otra = (cambios) => ({
      id: 98, numero: 9, anio: 2026, tipo: 'reiteracion', gestion: 'externa', fecha: '2026-10-14', estado: 'enviada',
      enviada: '2026-10-14 08:15:20', para: 'a@x', cc: null, seccion: 'vencido', vencimiento: '2026-07-31', datos_solicitados: null,
      creado_por: null, firmante: null, ...cambios
    });
    const titulos = async (nota) => {
      const fuentes = new Map([[52, { ...f(52), notas: [...CASOS[52].notas, nota] }]]);
      const [s] = await seguimientosDeLaNota([deLaNota(52)], HOY, fuentes, { ...PROPIA, numero: 'XX', anio: null });
      return notasDigitales(s).map(m => m.titulo);
    };
    // La reiteración del 14/10 se envió de verdad: queda, y la «XX» es la de hoy
    assert.deepEqual(await titulos(otra()), ['Nota Digital N° XX a DGMIT', 'Nota Digital N° 9/26 a DGMIT', 'Nota Digital N° 2/26 a DGMIT']);
    assert.deepEqual(await titulos(otra({ fecha: HOY, enviada: `${HOY} 08:15:20`, gestion: 'interna' })),
      ['Nota Digital N° 9/26 a DGMIT', 'Nota Digital N° XX a DGMIT', 'Nota Digital N° 2/26 a DGMIT']);
    assert.deepEqual(await titulos(otra({ fecha: HOY, enviada: `${HOY} 08:15:20`, tipo: 'aviso' })),
      ['Nota Digital N° 9/26 a DGMIT', 'Nota Digital N° XX a DGMIT', 'Nota Digital N° 2/26 a DGMIT']);
    // El 81 tuvo el aviso N° 3/26 el mismo día: sigue en su hoja
    const [s81] = await seguimientosDeLaNota([deLaNota(81)], HOY, mapaDe([81]), { ...PROPIA, numero: 'XX', anio: null });
    assert.deepEqual(notasDigitales(s81).map(m => m.titulo).sort(), ['Nota Digital N° 3/26 a DGMIT', 'Nota Digital N° XX a DGMIT']);
  });

  it('en la vista previa y la prueba, XX y PRUEBA', async () => {
    const fuentes = mapaDe(IDS);
    for (const numero of ['XX', 'PRUEBA']) {
      const lista = await seguimientosDeLaNota(DATASETS, HOY, fuentes, { ...PROPIA, numero, anio: null });
      for (const s of lista) {
        const id = s.ficha.id;
        assert.equal(s.movimientos[0].titulo, `Nota Digital N° ${numero} a DGMIT`, `caso ${id}`);
        assert.equal(s.movimientos[0].extra.anio, null, `caso ${id}`);
        const marca = s.cinta.marcas.find(m => m.etiqueta === `Nota ${numero}`);
        assert.ok(marca, `caso ${id}: sin la marca «Nota ${numero}»`);
        assert.equal(marca.fila, 'arriba', `caso ${id}`);
        assert.ok(s.circuito.avisos.texto.endsWith(` ${numero}`), `caso ${id}: ${s.circuito.avisos.texto}`);
        assert.doesNotMatch(JSON.stringify(s), /null\/|N° null|XX\/|PRUEBA\//, `caso ${id}`);
      }
    }
  });

  it('fuentesDeLaNota devuelve las fuentes que recibe, tal cual', async () => {
    const fuentes = mapaDe(IDS);
    assert.equal(await fuentesDeLaNota(DATASETS, fuentes), fuentes);
  });

  it('fuentesDeLaNota tira si falta la fuente de un dataset', async () => {
    const mensaje = 'El anexo de la reiteración necesita el Seguimiento de cada dataset: falta el del dataset 58';
    const sinEl58 = mapaDe([52]);
    await assert.rejects(fuentesDeLaNota(DATASETS, sinEl58), { message: mensaje });
    // seguimientosDeLaNota también, con la nota propia o sin ella: la reiteración no se genera
    await assert.rejects(seguimientosDeLaNota(DATASETS, HOY, sinEl58), { message: mensaje });
    await assert.rejects(seguimientosDeLaNota(DATASETS, HOY, sinEl58, PROPIA), { message: mensaje });
  });
});
