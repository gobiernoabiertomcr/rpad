// La cinta del «recorrido típico» de la pestaña Métricas (spec 2026-10-24-metricas-y-reportes, 2.2): datos puros, probados con los
// tramos de los números reales al 24/10/2026 (los de la maqueta 7, armados a mano: sin base) y con cadenas armadas a mano. Lo que
// importa es lo que pidió el usuario: ningún texto de la cinta sale del dibujo ni se pisa con otro.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cintaDeMetricas, cintasDeLaVista, ALTURAS_DE_LA_CINTA as ALTURAS } from '../services/metricasCinta.js';
import { SIN_NOTAS_DGMIT, unidadDe, casosDe, vistaDe } from '../services/metricasReglas.js';
import { mapaDeLosCasos, HOY_DE_LAS_METRICAS } from './metricas-casos.js';

const GRIS_DGMIT = 'La cinta se completa cuando haya notas DGMIT cargadas';
const PASOS = [5, 10, 20, 30, 50, 100];

// Los tramos de vistaDe (Task 7), armados a mano: el nombre, el texto de la flecha, quién está a cargo y si es de la DGMIT
const DE_LA_CLAVE = {
  aviso: { nombre: 'Aviso anticipado', desde_hasta: 'Del aviso al vencimiento', responsable: 'DDPC', dgmit: false },
  tramite: { nombre: 'Trámite y entrega de la nota', desde_hasta: 'Del aviso a la nota en el área', responsable: 'DGMIT y DA', dgmit: true },
  respuesta: { nombre: 'Respuesta del área', desde_hasta: 'De la nota a la entrega', responsable: 'Área', dgmit: false },
  produccion: { nombre: 'Producción del relevamiento', desde_hasta: 'Del aviso a la entrega', responsable: 'DGMIT y DIT', dgmit: true },
  carga: { nombre: 'Preparación y carga', desde_hasta: 'De la entrega a la carga', responsable: 'DDPC', dgmit: false }
};

// Un tramo con su cifra (como cifraDelTramo: «En el día» con 0), o sin cifra con `vacio`
const tramo = (clave, valor, { dias = 'habiles', estadistico = 'mediana', ciclos = 12, vacio = null } = {}) => ({
  clave, ...DE_LA_CLAVE[clave],
  cifra: valor === null ? null : {
    valor, texto: valor === 0 ? 'En el día' : String(valor), unidad: valor === 0 ? '' : unidadDe(valor, dias),
    debajo: valor === 0 ? `${estadistico} en días ${dias === 'corridos' ? 'corridos' : 'hábiles'}` : `${estadistico} de ${ciclos} ciclos`,
    ciclos, orientativo: ciclos <= 4
  },
  vacio: valor === null ? (vacio ?? { titulo: 'Sin casos en 2026', texto: '' }) : null,
  en_curso: null,
  pendientes: clave === 'tramite' ? 0 : null
});

// Los tramos de la DGMIT y del área mientras no hay ninguna nota DGMIT cargada (como hoy)
const SIN_NOTAS = {
  tramite: { titulo: SIN_NOTAS_DGMIT, texto: '10 notas pendientes de carga' },
  respuesta: { titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas' }
};

// Los números reales al 24/10/2026 (maqueta 7): días hábiles y corridos, con la mediana y con el promedio
const REALES = {
  externa: {
    mediana: { habiles: { aviso: 27, carga: 0 }, corridos: { aviso: 40, carga: 0 } },
    promedio: { habiles: { aviso: 28, carga: 1 }, corridos: { aviso: 41, carga: 1 } }
  },
  interna: {
    mediana: { habiles: { aviso: 41, produccion: 45, carga: 0 }, corridos: { aviso: 60, produccion: 62, carga: 0 } },
    promedio: { habiles: { aviso: 42, produccion: 56, carga: 1 }, corridos: { aviso: 60, produccion: 80, carga: 1 } }
  }
};

// Los tramos de una gestión con los números reales (la externa, sin notas DGMIT)
const tramosReales = (gestion, estadistico, dias) => {
  const v = REALES[gestion][estadistico][dias];
  const de = (clave, valor, ciclos) => tramo(clave, valor, { dias, estadistico, ciclos, vacio: SIN_NOTAS[clave] });
  return gestion === 'externa'
    ? [de('aviso', v.aviso, 32), de('tramite', null), de('respuesta', null), de('carga', v.carga, 23)]
    : [de('aviso', v.aviso, 3), de('produccion', v.produccion, 5), de('carga', v.carga, 5)];
};
const real = (gestion, estadistico, dias) => cintaDeMetricas(tramosReales(gestion, estadistico, dias), { gestion, dias, estadistico });

const COMBINACIONES = ['externa', 'interna'].flatMap((gestion) =>
  ['mediana', 'promedio'].flatMap((estadistico) => ['habiles', 'corridos'].map((dias) => ({ gestion, estadistico, dias }))));

// Lo que ocupa un texto, con la misma aproximación que la cinta: 6,6 por letra, 10 sobre la línea de base y 3 debajo
const LETRA = 6.6;
const caja = (x, y, texto, anclaje) => {
  const ancho = texto.length * LETRA;
  const x0 = anclaje === 'start' ? x : anclaje === 'end' ? x - ancho : x - ancho / 2;
  return { texto, x0, x1: x0 + ancho, y0: y - 10, y1: y + 3 };
};
const seTocan = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// Todos los textos que se escriben en la cinta: las marcas del eje, «vencimiento», el rótulo del eje, el del gris y los rótulos
const textosDe = (cinta) => [
  ...cinta.ticks.map((t) => caja(t.x, ALTURAS.ticks, t.texto, 'middle')),
  caja(cinta.vencimiento.x, ALTURAS.vencimiento.texto, 'vencimiento', 'middle'),
  caja(cinta.eje.x, cinta.eje.y, cinta.eje.texto, cinta.eje.anclaje),
  ...(cinta.gris?.texto ? [caja((cinta.gris.x0 + cinta.gris.x1) / 2, ALTURAS.textoDelGris, cinta.gris.texto, 'middle')] : []),
  ...cinta.rotulos.map((r) => caja(r.x, r.y, r.texto, r.anclaje))
];

// Ningún texto sale del dibujo (0 a 1000 y 0 a 156) ni se pisa con otro; ningún rótulo lo cruza la línea del vencimiento; el texto
// del gris queda adentro del gris, sin tocar la última marca
const sinPisadas = (cinta, cual) => {
  const textos = textosDe(cinta);
  for (const t of textos) {
    assert.ok(t.x0 >= 0 && t.x1 <= cinta.ancho && t.y0 >= 0 && t.y1 <= cinta.alto, `${cual}: «${t.texto}» sale del dibujo (${t.x0}–${t.x1})`);
  }
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      assert.ok(!seTocan(textos[i], textos[j]), `${cual}: «${textos[i].texto}» se pisa con «${textos[j].texto}»`);
    }
  }
  for (const r of cinta.rotulos) {
    const c = caja(r.x, r.y, r.texto, r.anclaje);
    if (c.y1 > ALTURAS.vencimiento.desde) {
      assert.ok(c.x1 < cinta.vencimiento.x || c.x0 > cinta.vencimiento.x, `${cual}: la línea del vencimiento cruza «${r.texto}»`);
    }
  }
  if (cinta.gris?.texto) {
    const c = caja((cinta.gris.x0 + cinta.gris.x1) / 2, ALTURAS.textoDelGris, cinta.gris.texto, 'middle');
    assert.ok(c.x0 >= cinta.gris.x0 + 10 && c.x1 <= cinta.gris.x1, `${cual}: el texto del gris no entra en el gris`);
  }
};

// Las marcas no se tocan: dos marcas que quedan separadas están a 18 o más (con el tamaño de la maqueta 7, un rombo al lado de un
// círculo necesita unos 18), y cada una dice todo lo que junta, en el orden de la cadena
const ORDEN_DE_LA_CADENA = ['aviso', 'nota', 'datos', 'carga'];
const marcasSinTocarse = (cinta, cual) => {
  for (let i = 1; i < cinta.marcas.length; i++) {
    assert.ok(cinta.marcas[i].x - cinta.marcas[i - 1].x >= 18, `${cual}: las marcas ${i - 1} y ${i} se tocan`);
  }
  for (const m of cinta.marcas) {
    assert.ok(m.tipos.length >= 1 && m.tipos.includes(m.tipo === 'datos-y-carga' ? 'datos' : m.tipo), `${cual}: ${JSON.stringify(m)}`);
    assert.deepEqual(m.tipos, ORDEN_DE_LA_CADENA.filter((tipo) => m.tipos.includes(tipo)), cual);
  }
  assert.deepEqual(cinta.marcas.flatMap((m) => m.tipos), ORDEN_DE_LA_CADENA.filter((tipo) => cinta.marcas.some((m) => m.tipos.includes(tipo))), cual);
};

// Los días de las marcas del eje, leídos de su texto («−40», «+10»)
const diasDeLosTicks = (cinta) => cinta.ticks.map((t) => Number(t.texto.replace('−', '-').replace('+', '')));

const casi = (real, esperado, cual) => assert.ok(Math.abs(real - esperado) < 1e-9, `${cual}: ${real} ≠ ${esperado}`);

describe('cintaDeMetricas', () => {
  it('externa sin notas: banda hasta el vencimiento, gris con el texto y solo la marca del aviso', () => {
    const cinta = real('externa', 'mediana', 'habiles');
    assert.equal(cinta.ancho, 1000);
    assert.equal(cinta.alto, 156);
    // Del aviso (27 días hábiles antes) a 0,9 × 27 después, con el aire: de −40 a +40 de a 10
    assert.deepEqual(cinta.ticks.map((t) => t.texto), ['−40', '−30', '−20', '−10', '+10', '+20', '+30', '+40']);
    casi(cinta.ticks[0].x, 30, 'la primera marca del eje');
    casi(cinta.ticks[7].x, 970, 'la última marca del eje');
    // La línea del eje viaja con la cinta, de punta a punta de la línea útil: la página y el PDF no la copian
    assert.deepEqual(cinta.linea, { x0: 30, x1: 970 });
    casi(cinta.vencimiento.x, 500, 'el vencimiento');
    const xAviso = 30 + (13 / 80) * 940;
    assert.deepEqual(cinta.marcas.map((m) => m.tipo), ['aviso']);
    casi(cinta.marcas[0].x, xAviso, 'la marca del aviso');
    casi(cinta.banda.x0, xAviso, 'la banda empieza en el aviso');
    assert.equal(cinta.banda.x1, cinta.vencimiento.x);
    assert.deepEqual(cinta.gris, { x0: cinta.vencimiento.x, x1: 970, texto: GRIS_DGMIT });
    assert.equal(cinta.rayado, null);
    assert.deepEqual(cinta.segmentos, []);
    assert.deepEqual(cinta.rotulos.map((r) => [r.texto, r.color]), [['Aviso · 27 días hábiles antes', 'tinta']]);
    assert.deepEqual(cinta.eje, { x: 30, y: 152, texto: 'días hábiles respecto del vencimiento', anclaje: 'start' });
    assert.equal(cinta.aclaracion, 'La cinta pone las medianas una detrás de la otra: es orientativa, no un ciclo real.');
    // Las alturas viajan con la cinta: la página no las copia
    assert.deepEqual(cinta.alturas, ALTURAS);
    assert.deepEqual(cinta.marcas[0].tipos, ['aviso']);
  });

  it('interna con carga 0: una sola marca datos-y-carga con «Entrega y carga, el mismo día»', () => {
    for (const dias of ['habiles', 'corridos']) {
      const cinta = real('interna', 'mediana', dias);
      const { aviso, produccion } = REALES.interna.mediana[dias];
      assert.deepEqual(cinta.marcas.map((m) => m.tipo), ['aviso', 'datos-y-carga'], dias);
      const juntas = cinta.marcas[1];
      assert.deepEqual(juntas.tipos, ['datos', 'carga'], dias);
      // La producción en violeta, del aviso a la entrega; la carga (0 días) no tiene largo: no va entre los segmentos
      assert.deepEqual(cinta.segmentos.map((s) => s.color), ['violeta'], dias);
      assert.equal(cinta.segmentos[0].x0, cinta.marcas[0].x);
      assert.equal(cinta.segmentos[0].x1, juntas.x);
      assert.equal(cinta.segmentos[0].texto, `Producción del relevamiento · ${produccion} ${unidadDe(produccion, dias)}`);
      const rotulo = cinta.rotulos.find((r) => r.texto.startsWith('Entrega y carga'));
      assert.equal(rotulo.texto, 'Entrega y carga, el mismo día', dias);
      assert.equal(rotulo.color, 'verde');
      // Los datos llegan después del vencimiento: del vencimiento a la carga, rayado; la cadena está entera, sin gris
      assert.ok(aviso < produccion);
      assert.deepEqual(cinta.rayado, { x0: cinta.vencimiento.x, x1: juntas.x });
      assert.equal(cinta.gris, null);
      assert.ok(cinta.rotulos.some((r) => r.texto === `Aviso · ${aviso} ${unidadDe(aviso, dias)} antes`), dias);
    }
  });

  it('interna con promedio: «Entrega y carga, 1 día corrido después»', () => {
    const corridos = real('interna', 'promedio', 'corridos');
    assert.deepEqual(corridos.marcas.map((m) => m.tipo), ['aviso', 'datos-y-carga']);
    assert.ok(corridos.rotulos.some((r) => r.texto === 'Entrega y carga, 1 día corrido después'));
    assert.ok(!corridos.rotulos.some((r) => r.texto.includes('el mismo día')), 'nunca dice «el mismo día» si no lo fue');
    assert.equal(corridos.aclaracion, 'La cinta pone los promedios uno detrás del otro: es orientativa, no un ciclo real.');
    // En días hábiles, la entrega y la carga quedan a 11,75: con el tamaño de las marcas se pisarían, así que se juntan
    const habiles = real('interna', 'promedio', 'habiles');
    assert.deepEqual(habiles.marcas.map((m) => [m.tipo, m.tipos]), [['aviso', ['aviso']], ['datos-y-carga', ['datos', 'carga']]]);
    assert.ok(habiles.rotulos.some((r) => r.texto === 'Entrega y carga, 1 día hábil después'));
    assert.ok(!habiles.rotulos.some((r) => r.texto.startsWith('Carga · ')));
    // A 18 o más, ya no se pisan: dos marcas, y el rótulo de la carga sola
    const separadas = cintaDeMetricas([tramo('aviso', 41), tramo('produccion', 20), tramo('carga', 2)], { gestion: 'interna' });
    assert.deepEqual(separadas.marcas.map((m) => m.tipo), ['aviso', 'datos', 'carga']);
    assert.ok(separadas.marcas[2].x - separadas.marcas[1].x >= 18);
    assert.ok(separadas.rotulos.some((r) => r.texto === 'Carga · 2 días hábiles después'));
  });

  it('marcas que se juntan con el aviso o con la nota: la marca dice todo lo que junta y el rótulo de la carga coincide', () => {
    // Todo el mismo día del vencimiento: el aviso, la entrega y la carga en una sola marca (se dibuja el aviso)
    const interna = cintaDeMetricas([tramo('aviso', 0), tramo('produccion', 0), tramo('carga', 0)], { gestion: 'interna' });
    assert.deepEqual(interna.marcas, [{ x: interna.vencimiento.x, tipo: 'aviso', tipos: ['aviso', 'datos', 'carga'] }]);
    assert.deepEqual(interna.segmentos, []);
    const textos = interna.rotulos.map((r) => r.texto);
    assert.ok(textos.includes('Aviso · el mismo día del vencimiento'));
    assert.ok(textos.includes('Entrega y carga, el mismo día'));
    sinPisadas(interna, 'todo el mismo día');
    // La nota, la entrega y la carga el mismo día (se dibuja la nota), y la carga al lado de esa marca
    const externa = cintaDeMetricas([tramo('aviso', 27), tramo('tramite', 10), tramo('respuesta', 0), tramo('carga', 0)], { gestion: 'externa' });
    assert.deepEqual(externa.marcas.map((m) => [m.tipo, m.tipos]), [['aviso', ['aviso']], ['nota', ['nota', 'datos', 'carga']]]);
    const carga = externa.rotulos.find((r) => r.texto === 'Entrega y carga, el mismo día');
    assert.ok(carga);
    casi(Math.abs(carga.x - externa.marcas[1].x), 12, 'el rótulo de la carga, al lado de la marca de la nota');
    assert.deepEqual(externa.segmentos.map((s) => s.color), ['violeta']);
    sinPisadas(externa, 'la nota, la entrega y la carga juntas');
    marcasSinTocarse(interna, 'todo el mismo día');
    marcasSinTocarse(externa, 'la nota, la entrega y la carga juntas');
  });

  it('en las cuatro combinaciones y las dos gestiones de los casos reales, ningún rótulo sale del dibujo ni se pisa con otro', () => {
    for (const { gestion, estadistico, dias } of COMBINACIONES) {
      const cual = `${gestion}, ${estadistico}, ${dias}`;
      const cinta = real(gestion, estadistico, dias);
      sinPisadas(cinta, cual);
      marcasSinTocarse(cinta, cual);
      // Los rótulos que pide la spec están todos: el del aviso siempre y, en la interna, el de la carga y el de la producción
      const { aviso } = REALES[gestion][estadistico][dias];
      const textos = cinta.rotulos.map((r) => r.texto);
      assert.ok(textos.includes(`Aviso · ${aviso} ${unidadDe(aviso, dias)} antes`), cual);
      if (gestion === 'interna') {
        assert.ok(textos.some((t) => t.startsWith('Entrega y carga') || t.startsWith('Carga · ')), cual);
        assert.ok(textos.some((t) => t.startsWith('Producción del relevamiento · ')), cual);
      } else {
        assert.equal(cinta.gris.texto, GRIS_DGMIT, cual);
      }
      assert.equal(cinta.eje.texto, `${dias === 'corridos' ? 'días corridos' : 'días hábiles'} respecto del vencimiento`, cual);
      assert.ok(cinta.ticks.length <= 8, cual);
      assert.deepEqual(cinta.linea, { x0: 30, x1: 970 }, cual);
    }
  });

  it('sin cifra del aviso devuelve null', () => {
    const sinAviso = tramosReales('interna', 'mediana', 'habiles').map((t) => (t.clave === 'aviso' ? tramo('aviso', null) : t));
    assert.equal(cintaDeMetricas(sinAviso, { gestion: 'interna', dias: 'habiles', estadistico: 'mediana' }), null);
    assert.equal(cintaDeMetricas(sinAviso.filter((t) => t.clave !== 'aviso'), { gestion: 'interna' }), null);
    // Un año sin ningún caso: vistaDe no da cifras, y la cinta no se dibuja
    const vacia = vistaDe([], { anio: 2026, al: HOY_DE_LAS_METRICAS });
    assert.equal(cintaDeMetricas(vacia.circuito.externa, { gestion: 'externa' }), null);
    assert.equal(cintaDeMetricas(vacia.circuito.interna, { gestion: 'interna' }), null);
    for (const raro of [undefined, null, 'tramos', 3, {}]) assert.equal(cintaDeMetricas(raro, { gestion: 'externa' }), null);
  });

  it('con la vista de los casos reales: la externa se corta en la DGMIT y la interna en la producción, que no tiene casos', () => {
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });
    const vista = vistaDe(casos, { anio: 2026, al: HOY_DE_LAS_METRICAS });
    const externa = cintaDeMetricas(vista.circuito.externa, { gestion: 'externa', dias: 'habiles', estadistico: 'mediana' });
    assert.equal(externa.gris.texto, GRIS_DGMIT);
    assert.deepEqual(externa.marcas.map((m) => m.tipo), ['aviso']);
    const interna = cintaDeMetricas(vista.circuito.interna, { gestion: 'interna', dias: 'habiles', estadistico: 'mediana' });
    assert.equal(interna.gris.texto, 'Producción del relevamiento: sin casos en 2026');
    assert.deepEqual(interna.segmentos, []);
    assert.deepEqual(interna.marcas.map((m) => m.tipo), ['aviso']);
    sinPisadas(externa, 'externa de la vista');
    sinPisadas(interna, 'interna de la vista');
  });

  it('externa con notas DGMIT: la cadena entera, con los tramos en violeta, tinta y verde, y el rayado hasta la carga', () => {
    // La de la maqueta 1: 28 días hábiles de anticipación, 12 de trámite, 35 de respuesta y 2 de carga
    const tramos = [tramo('aviso', 28), tramo('tramite', 12), tramo('respuesta', 35), tramo('carga', 2)];
    const cinta = cintaDeMetricas(tramos, { gestion: 'externa', dias: 'habiles', estadistico: 'mediana' });
    assert.deepEqual(diasDeLosTicks(cinta), [-40, -30, -20, -10, 10, 20, 30]);
    const x = (d) => 30 + ((d + 40) / 70) * 940;
    assert.deepEqual(cinta.marcas.map((m) => m.tipo), ['aviso', 'nota', 'datos', 'carga']);
    [-28, -16, 19, 21].forEach((d, i) => casi(cinta.marcas[i].x, x(d), cinta.marcas[i].tipo));
    assert.deepEqual(cinta.segmentos.map((s) => [s.color, s.texto]), [
      ['violeta', 'Trámite y entrega de la nota · 12 días hábiles'],
      ['tinta', 'Respuesta del área · 35 días hábiles'],
      ['verde', 'Preparación y carga · 2 días hábiles']
    ]);
    casi(cinta.rayado.x0, x(0), 'el rayado empieza en el vencimiento');
    casi(cinta.rayado.x1, x(21), 'y termina en la carga');
    assert.equal(cinta.gris, null);
    assert.deepEqual(cinta.rotulos.map((r) => r.texto).sort(), [
      'Aviso · 28 días hábiles antes', 'Carga · 2 días hábiles después', 'Respuesta del área · 35 días hábiles',
      'Trámite y entrega de la nota · 12 días hábiles'
    ]);
    // La carga no entra a la derecha de su marca: va a la izquierda, con anclaje end
    const carga = cinta.rotulos.find((r) => r.texto.startsWith('Carga'));
    assert.equal(carga.anclaje, 'end');
    assert.ok(carga.x < cinta.marcas[3].x);
    // La respuesta cruza el vencimiento: su rótulo se corre a un costado de la línea, sin dejar su tramo
    const respuesta = cinta.rotulos.find((r) => r.texto.startsWith('Respuesta'));
    assert.equal(respuesta.y, ALTURAS.filaDeLosTramos);
    sinPisadas(cinta, 'externa completa');
  });

  it('cortada en otro tramo: dibuja hasta donde se sabe (con el rayado, si ya pasó el vencimiento) y el gris dice qué falta', () => {
    // Con notas DGMIT, un trámite de 40 días hábiles y la respuesta sin casos en el año
    const tramos = [tramo('aviso', 27), tramo('tramite', 40), tramo('respuesta', null), tramo('carga', 1)];
    const cinta = cintaDeMetricas(tramos, { gestion: 'externa', dias: 'habiles', estadistico: 'mediana' });
    assert.deepEqual(cinta.marcas.map((m) => m.tipo), ['aviso', 'nota']);
    assert.deepEqual(cinta.segmentos.map((s) => s.color), ['violeta']);
    assert.deepEqual(cinta.rayado, { x0: cinta.vencimiento.x, x1: cinta.marcas[1].x });
    assert.deepEqual(cinta.gris, { x0: cinta.marcas[1].x, x1: 970, texto: 'Respuesta del área: sin casos en 2026' });
    sinPisadas(cinta, 'cortada en la respuesta');
    // Si la DGMIT tiene casos pero el área no, no se culpa a la falta de notas DGMIT
    assert.ok(!cinta.gris.texto.includes('DGMIT'));
  });

  it('el rótulo del eje va abajo a la izquierda, y a la derecha si a la izquierda se pisaría con «vencimiento»', () => {
    // Una cadena que termina mucho después del vencimiento deja el vencimiento cerca del borde izquierdo
    const tramos = [tramo('aviso', 27), tramo('tramite', 60), tramo('respuesta', 150), tramo('carga', 3)];
    const cinta = cintaDeMetricas(tramos, { gestion: 'externa', dias: 'habiles', estadistico: 'mediana' });
    assert.ok(cinta.vencimiento.x < 300);
    assert.deepEqual(cinta.eje, { x: 970, y: 152, texto: 'días hábiles respecto del vencimiento', anclaje: 'end' });
    sinPisadas(cinta, 'larga');
    assert.equal(real('interna', 'mediana', 'corridos').eje.anclaje, 'start');
  });

  it('la escala: paso de 5, 10, 20, 30, 50 o 100, como mucho 8 marcas, de x = 30 a x = 970, y nada se pisa (interna y externa con notas)', () => {
    // Cadenas internas y externas con las cifras de la DGMIT y del área (con notas DGMIT cargadas)
    const cadenas = [];
    for (const dias of ['habiles', 'corridos']) {
      for (const aviso of [0, 1, 5, 27, 41, 60, 90]) {
        for (const produccion of [0, 1, 3, 20, 45, 80, 150, 300, 700]) {
          for (const carga of [0, 1, 2, 5, 30]) {
            cadenas.push({ gestion: 'interna', dias, cifras: { aviso, produccion, carga } });
          }
        }
      }
      for (const aviso of [0, 1, 27, 41]) {
        for (const tramite of [0, 1, 12, 60]) {
          for (const respuesta of [0, 3, 35, 150, 400]) {
            for (const carga of [0, 1, 5]) cadenas.push({ gestion: 'externa', dias, cifras: { aviso, tramite, respuesta, carga } });
          }
        }
      }
    }
    assert.equal(cadenas.length, 630 + 480);
    for (const { gestion, dias, cifras } of cadenas) {
      const cual = `${gestion}, ${dias}, ${JSON.stringify(cifras)}`;
      const tramos = Object.entries(cifras).map(([clave, valor]) => tramo(clave, valor, { dias }));
      const cinta = cintaDeMetricas(tramos, { gestion, dias, estadistico: 'mediana' });
      const enDias = diasDeLosTicks(cinta);
      assert.ok(enDias.length >= 1 && enDias.length <= 8, `${cual}: ${enDias.length} marcas`);
      const conCero = [...enDias, 0].sort((a, b) => a - b);
      const paso = conCero[1] - conCero[0];
      assert.ok(PASOS.includes(paso) || (paso > 100 && paso % 100 === 0), `${cual}: paso ${paso}`);
      for (let i = 1; i < conCero.length; i++) assert.equal(conCero[i] - conCero[i - 1], paso, cual);
      casi(Math.min(...cinta.ticks.map((t) => t.x)), 30, cual);
      casi(Math.max(...cinta.ticks.map((t) => t.x)), 970, cual);
      for (const m of cinta.marcas) assert.ok(m.x > 30 && m.x < 970, `${cual}: la marca ${m.tipo} sale de la línea`);
      assert.ok(cinta.vencimiento.x > 30 && cinta.vencimiento.x < 970, cual);
      assert.ok(cinta.segmentos.every((s) => s.x1 > s.x0), `${cual}: un segmento sin largo`);
      assert.equal(cinta.gris, null, cual);
      sinPisadas(cinta, cual);
      marcasSinTocarse(cinta, cual);
      assert.ok(cinta.rotulos.some((r) => r.texto.startsWith('Aviso · ')), `${cual}: falta el rótulo del aviso`);
    }
  });

  it('singular y plural: «1 día hábil», «1 día corrido» y «2 días hábiles»; un aviso de 0 días es el día del vencimiento', () => {
    // Los textos de los rótulos y de los tramos
    const textos = (aviso, produccion, carga, dias) => {
      const cinta = cintaDeMetricas(
        [tramo('aviso', aviso, { dias }), tramo('produccion', produccion, { dias }), tramo('carga', carga, { dias })],
        { gestion: 'interna', dias }
      );
      return [...cinta.rotulos, ...cinta.segmentos].map((r) => r.texto);
    };
    assert.ok(textos(1, 30, 1, 'habiles').includes('Aviso · 1 día hábil antes'));
    assert.ok(textos(1, 30, 1, 'corridos').includes('Aviso · 1 día corrido antes'));
    assert.ok(textos(2, 30, 2, 'habiles').includes('Aviso · 2 días hábiles antes'));
    assert.ok(textos(0, 30, 0, 'habiles').includes('Aviso · el mismo día del vencimiento'));
    assert.ok(textos(41, 1, 0, 'habiles').includes('Producción del relevamiento · 1 día hábil'));
    assert.ok(textos(41, 45, 1, 'corridos').includes('Preparación y carga · 1 día corrido'));
    assert.ok(textos(41, 45, 2, 'habiles').includes('Preparación y carga · 2 días hábiles'));
  });

  it('no tira con datos raros: lo que no sirve corta la cadena, y las opciones raras son las de entrada', () => {
    const raros = [
      [tramo('aviso', 27), null, 'x', { clave: 'tramite', cifra: { valor: Number.NaN } }, { clave: 'respuesta', cifra: 'mucho' }],
      [tramo('aviso', 27), { clave: 'tramite', cifra: { valor: -3 } }],
      [{ ...tramo('aviso', 27), nombre: undefined }, { clave: 'tramite' }]
    ];
    for (const tramos of raros) {
      const cinta = cintaDeMetricas(tramos, { gestion: 'externa' });
      assert.deepEqual(cinta.marcas.map((m) => m.tipo), ['aviso']);
      assert.ok(cinta.gris.texto.length > 0);
      sinPisadas(cinta, JSON.stringify(tramos));
    }
    assert.equal(cintaDeMetricas([tramo('aviso', -1)], {}), null);
    assert.equal(cintaDeMetricas([tramo('aviso', Number.POSITIVE_INFINITY)], {}), null);
    // Sin opciones: externa, días hábiles y mediana
    const porDefecto = cintaDeMetricas(tramosReales('externa', 'mediana', 'habiles'));
    assert.deepEqual(porDefecto, real('externa', 'mediana', 'habiles'));
    assert.deepEqual(cintaDeMetricas(tramosReales('externa', 'mediana', 'habiles'), { gestion: 'x', dias: 'y', estadistico: 'z' }), porDefecto);
    // Un número enorme no cuelga la escala: el paso sigue en múltiplos de 100 y con 8 marcas o menos; un número del eje que no
    // entraría en el dibujo no va, y nada se pisa
    for (const tramos of [
      [tramo('aviso', 27), tramo('produccion', 1e9), tramo('carga', 0)],
      [tramo('aviso', 1e9), tramo('produccion', 3), tramo('carga', 1e9)],
      [tramo('aviso', 27), tramo('produccion', 1e15), tramo('carga', 1e15)]
    ]) {
      const enorme = cintaDeMetricas(tramos, { gestion: 'interna' });
      const cual = `enorme ${tramos.map((t) => t.cifra.valor).join(', ')}`;
      assert.ok(enorme.ticks.length <= 8, cual);
      sinPisadas(enorme, cual);
      marcasSinTocarse(enorme, cual);
    }
  });

  it('las alturas fijas del dibujo son las de la maqueta, y viajan con la cinta', () => {
    const esperadas = {
      filaDeArriba: 26, filaDeLosTramos: 42, segmentos: { y: 50, alto: 8 }, banda: { y: 74, alto: 26 }, marcas: 87, textoDelGris: 91,
      linea: 118, ticks: 136, vencimiento: { desde: 30, hasta: 118, texto: 148 }, textoDelEje: 152
    };
    assert.deepEqual(ALTURAS, esperadas);
    assert.ok(Object.isFrozen(ALTURAS));
    for (const { gestion, estadistico, dias } of COMBINACIONES) assert.deepEqual(real(gestion, estadistico, dias).alturas, esperadas);
    // Lo que manda el servidor es JSON: las alturas llegan enteras a la página
    assert.deepEqual(JSON.parse(JSON.stringify(real('interna', 'mediana', 'habiles'))).alturas, esperadas);
  });
});

describe('cintasDeLaVista', () => {
  it('las dos cintas de una vista, cada una la de cintaDeMetricas con el circuito de su gestión; sin vista, las dos null', () => {
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });
    for (const { estadistico, dias } of COMBINACIONES.filter((c) => c.gestion === 'externa')) {
      const vista = vistaDe(casos, { anio: 2026, al: HOY_DE_LAS_METRICAS, estadistico, dias });
      assert.deepEqual(cintasDeLaVista(vista, { estadistico, dias }), {
        externa: cintaDeMetricas(vista.circuito.externa, { gestion: 'externa', dias, estadistico }),
        interna: cintaDeMetricas(vista.circuito.interna, { gestion: 'interna', dias, estadistico })
      }, `${estadistico}-${dias}`);
    }
    for (const vista of [null, undefined, 'x', [], {}, { circuito: null }, { circuito: { externa: 'x' } }]) {
      assert.deepEqual(cintasDeLaVista(vista, { estadistico: 'mediana', dias: 'habiles' }), { externa: null, interna: null }, JSON.stringify(vista));
    }
    // Sin opciones, las de entrada
    const vista = vistaDe(casos, { anio: 2026, al: HOY_DE_LAS_METRICAS });
    assert.deepEqual(cintasDeLaVista(vista), cintasDeLaVista(vista, { estadistico: 'mediana', dias: 'habiles' }));
  });
});
