// El recorrido típico de la pestaña Métricas (spec 2026-11-08-metricas-recorrido-tipico, 4 y 5): datos puros, probados con cadenas
// armadas a mano con cifras inventadas (el repo es público: ninguna es de producción) y, para cintasDeLaVista, con la vista de los casos
// de tests/metricas-casos.js. Lo que importa: los textos de la spec al pie de la letra, los anchos que suman 100, los porcentajes por el
// resto mayor, el vencimiento y la regla del aviso, cada caso borde, y que nunca tira.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as moduloDeLaCinta from '../services/metricasCinta.js';
import { cintaDeMetricas, cintasDeLaVista, FORMA_DE_LA_CINTA } from '../services/metricasCinta.js';
import { SIN_NOTAS_DGMIT, casosDe, vistaDe } from '../services/metricasReglas.js';
import { mapaDeLosCasos, HOY_DE_LAS_METRICAS } from './metricas-casos.js';

// Los nombres de los tramos, como los arma vistaDe
const NOMBRE = Object.freeze({
  aviso: 'Aviso anticipado',
  tramite: 'Redacción y entrega de nota',
  respuesta: 'Respuesta del área',
  produccion: 'Producción del relevamiento',
  carga: 'Preparación y carga'
});

// Un tramo como los de vistaDe, con lo que lee la cinta: su cifra (null: sin casos, con el vacío de vistaDe), sus hábiles (los que trae
// en la vista en corridos; null si no los trae) y lo que se quiera pisar (`extra`)
const tramo = (clave, nombre, valor, habiles = null, extra = {}) => ({
  clave,
  nombre,
  cifra: valor === null ? null : { valor, orientativo: false },
  vacio: valor === null ? { titulo: 'Sin casos en 2026', texto: '' } : null,
  habiles: habiles === null ? null : { valor: habiles },
  ...extra
});
const aviso = (valor, habiles, extra) => tramo('aviso', NOMBRE.aviso, valor, habiles, extra);
const redaccion = (valor, habiles, extra) => tramo('tramite', NOMBRE.tramite, valor, habiles, extra);
const respuesta = (valor, habiles, extra) => tramo('respuesta', NOMBRE.respuesta, valor, habiles, extra);
const produccion = (valor, habiles, extra) => tramo('produccion', NOMBRE.produccion, valor, habiles, extra);
const carga = (valor, habiles, extra) => tramo('carga', NOMBRE.carga, valor, habiles, extra);

const EXTERNA = Object.freeze({ gestion: 'externa', dias: 'corridos', estadistico: 'mediana' });
const INTERNA = Object.freeze({ gestion: 'interna', dias: 'corridos', estadistico: 'mediana' });

// La externa completa del ejemplo de la spec, en días corridos con los hábiles (cifras inventadas)
const externaCompleta = () => [aviso(35, 24), redaccion(38, 25), respuesta(47, 32), carga(0, 0)];

const BAJADA_EXTERNA = 'Cuánto lleva un pedido de la gestión externa, desde el pedido de la DDPC hasta la publicación en el portal.';
const BAJADA_INTERNA = 'Cuánto lleva un pedido de la gestión interna, desde el pedido de la DDPC hasta la publicación en el portal.';
const ACLARACION_MEDIANA = 'El total suma las medianas de cada tramo: es una referencia, no la duración de un caso.';
const ACLARACION_PROMEDIO = 'El total suma los promedios de cada tramo: es una referencia, no la duración de un caso.';
const SIN_TOTAL = { antes: 'El total se completa cuando haya casos de todos los tramos', cifra: '', despues: '' };

// Todos los textos y todos los números de un objeto, recorrido entero
const textosDe = (valor) => {
  if (typeof valor === 'string') return [valor];
  return valor !== null && typeof valor === 'object' ? Object.values(valor).flatMap(textosDe) : [];
};
const numerosDe = (valor) => {
  if (typeof valor === 'number') return [valor];
  return valor !== null && typeof valor === 'object' ? Object.values(valor).flatMap(numerosDe) : [];
};
// Ningún texto dice NaN, undefined ni null, y todo número es finito
const sinRarezas = (cinta, cual) => {
  for (const texto of textosDe(cinta)) assert.doesNotMatch(texto, /NaN|undefined|null|Infinity/, `${cual}: «${texto}»`);
  for (const numero of numerosDe(cinta)) assert.ok(Number.isFinite(numero), `${cual}: ${numero}`);
};
const sinPorcentajes = (cinta, cual) => {
  for (const texto of textosDe(cinta)) assert.ok(!texto.includes('%'), `${cual}: «${texto}»`);
};

// El número de una cifra grande con porcentaje ('45 %' es 45 y 'menos del 1 %', 0); null si no es un porcentaje
const numeroDelPorcentaje = (grande) => {
  if (grande === 'menos del 1 %') return 0;
  return /^\d+ %$/.test(grande) ? Number.parseInt(grande, 10) : null;
};
const sumar = (valores) => valores.reduce((total, valor) => total + valor, 0);

describe('cintaDeMetricas: el recorrido típico', () => {
  it('la externa completa: el total, los porcentajes, los anchos y el vencimiento', () => {
    const cinta = cintaDeMetricas(externaCompleta(), EXTERNA);
    assert.equal(FORMA_DE_LA_CINTA, 'recorrido');
    assert.deepEqual(Object.keys(cinta), ['forma', 'titulo', 'bajada', 'total', 'partes', 'carga', 'portal', 'vencimiento', 'aviso',
      'orientativos', 'lista', 'lista_siempre', 'aclaracion', 'descripcion']);
    assert.equal(cinta.forma, 'recorrido');
    assert.equal(cinta.titulo, 'El recorrido típico');
    assert.equal(cinta.bajada, BAJADA_EXTERNA);
    assert.deepEqual(cinta.total, { antes: 'En total, unos ', cifra: '85 días corridos', despues: ' (57 hábiles)' });
    assert.deepEqual(cinta.partes.map((p) => [p.clave, p.actor, p.ancho, p.grande, p.dias]), [
      ['tramite', 'dgmit', 44.71, '45 %', '38 días corridos (25 hábiles)'],
      ['respuesta', 'area', 55.29, '55 %', '47 días corridos (32 hábiles)']
    ]);
    assert.deepEqual(cinta.partes.map((p) => [p.nombre, p.angosta]), [[NOMBRE.tramite, false], [NOMBRE.respuesta, false]]);
    assert.deepEqual(cinta.partes.map((p) => Object.keys(p)), [0, 1].map(() => ['clave', 'actor', 'ancho', 'angosta', 'grande', 'nombre', 'dias']));
    assert.deepEqual(cinta.carga, { clave: 'carga', actor: 'ddpc', grande: 'En el día', nombre: 'Preparación y carga', dias: '' });
    assert.deepEqual(cinta.portal, { nombre: 'Portal', texto: 'datos publicados' });
    assert.deepEqual(cinta.vencimiento, { x: 41.18 });
    assert.deepEqual(cinta.aviso, {
      rotulo: 'Aviso anticipado:', texto: '35 días corridos (24 hábiles)', ancho: 41.18, sigue: false, vencimiento: 'vencimiento'
    });
    assert.deepEqual(cinta.orientativos, []);
    assert.deepEqual(cinta.lista, [
      { actor: 'dgmit', nombre: NOMBRE.tramite, texto: '38 días corridos (25 hábiles) · 45 %' },
      { actor: 'area', nombre: NOMBRE.respuesta, texto: '47 días corridos (32 hábiles) · 55 %' },
      { actor: 'ddpc', nombre: NOMBRE.carga, texto: 'en el día' }
    ]);
    assert.equal(cinta.lista_siempre, false);
    assert.equal(cinta.aclaracion, ACLARACION_MEDIANA);
    sinRarezas(cinta, 'la externa completa');
  });

  it('los porcentajes suman 100 por el resto mayor', () => {
    // Las cadenas salen de un generador con semilla fija (Park y Miller), siempre las mismas: la redacción y la respuesta, de 0 a 60
    // días, y la carga, de 0 a 3
    let semilla = 20261108;
    const azar = (n) => {
      semilla = (semilla * 48271) % 2147483647;
      return semilla % n;
    };
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      const valores = [azar(61), azar(61), azar(4)];
      const cual = valores.join(', ');
      const cinta = cintaDeMetricas([aviso(10), redaccion(valores[0]), respuesta(valores[1]), carga(valores[2])], EXTERNA);
      const total = sumar(valores);
      const grandes = [...cinta.partes.map((p) => p.grande), cinta.carga.grande];
      if (total > 0) {
        const porcentajes = grandes.map(numeroDelPorcentaje);
        assert.equal(sumar(porcentajes.map((p) => p ?? 0)), 100, cual);
        valores.forEach((valor, i) => {
          // Un tramo de 0 días no lleva porcentaje; los otros, a menos de 1 de su parte exacta
          if (valor === 0) assert.equal(grandes[i], 'En el día', cual);
          else assert.ok(Math.abs(porcentajes[i] - (100 * valor) / total) < 1, `${cual}: ${grandes[i]}`);
        });
      } else sinPorcentajes(cinta, cual);
      for (const parte of cinta.partes) assert.ok(parte.ancho >= 0, `${cual}: ${parte.ancho}`);
      assert.ok(Math.abs(sumar(cinta.partes.map((p) => p.ancho)) - 100) < 0.011, cual);
      sinRarezas(cinta, cual);
    }
    // A igual resto, el punto que falta va al primero en la cadena
    const tercios = cintaDeMetricas([redaccion(1), respuesta(1), carga(1)], EXTERNA);
    assert.deepEqual([...tercios.partes.map((p) => p.grande), tercios.carga.grande], ['34 %', '33 %', '33 %']);
    const otros = cintaDeMetricas([redaccion(2), respuesta(1), carga(4)], EXTERNA);
    assert.deepEqual([...otros.partes.map((p) => p.grande), otros.carga.grande], ['29 %', '14 %', '57 %']);
  });

  it('la carga de unos días: su porcentaje y sus días, a ancho fijo', () => {
    const cinta = cintaDeMetricas([aviso(35, 24), redaccion(38, 25), respuesta(47, 32), carga(2, 1)], EXTERNA);
    assert.equal(cinta.carga.grande, '2 %');
    assert.equal(cinta.carga.dias, '2 días corridos (1 hábil)');
    assert.equal(cinta.carga.actor, 'ddpc');
    // La carga no está en la línea a escala, y los anchos son los mismos que con la carga en el día
    assert.deepEqual(cinta.partes.map((p) => p.clave), ['tramite', 'respuesta']);
    assert.deepEqual(cinta.partes.map((p) => p.ancho), [44.71, 55.29]);
    assert.deepEqual(cinta.partes.map((p) => p.grande), ['44 %', '54 %']);
    assert.deepEqual(cinta.total, { antes: 'En total, unos ', cifra: '87 días corridos', despues: ' (58 hábiles)' });
    assert.equal(cinta.lista[2].texto, '2 días corridos (1 hábil) · 2 %');
    // En la interna, sus días
    const interna = cintaDeMetricas([aviso(20, 14), produccion(90, 61), carga(2, 1)], INTERNA);
    assert.deepEqual(interna.carga, { clave: 'carga', actor: 'ddpc', grande: '2 días corridos', nombre: NOMBRE.carga, dias: '(1 hábil)' });
    assert.equal(interna.lista[1].texto, '2 días corridos (1 hábil)');
  });

  it('menos del 1 %', () => {
    const cinta = cintaDeMetricas([aviso(35), redaccion(300), respuesta(300), carga(1)], EXTERNA);
    assert.equal(cinta.carga.grande, 'menos del 1 %');
    assert.equal(cinta.carga.dias, '1 día corrido');
    assert.deepEqual(cinta.partes.map((p) => p.grande), ['50 %', '50 %']);
    assert.equal(cinta.lista[2].texto, '1 día corrido · menos del 1 %');
    assert.ok(cinta.descripcion.includes('Preparación y carga: 1 día corrido, menos del 1 %.'), cinta.descripcion);
  });

  it('la interna: los días en grande, sin porcentajes', () => {
    const cinta = cintaDeMetricas([aviso(20, 14), produccion(90, 61), carga(0, 0)], INTERNA);
    assert.equal(cinta.bajada, BAJADA_INTERNA);
    assert.deepEqual(cinta.partes, [{
      clave: 'produccion', actor: 'dgmit', ancho: 100, angosta: false, grande: '90 días corridos', nombre: NOMBRE.produccion,
      dias: '(61 hábiles)'
    }]);
    assert.equal(cinta.partes[0].grande, '90 días corridos');
    assert.equal(cinta.partes[0].dias, '(61 hábiles)');
    assert.equal(cinta.partes[0].ancho, 100);
    assert.deepEqual(cinta.carga, { clave: 'carga', actor: 'ddpc', grande: 'En el día', nombre: NOMBRE.carga, dias: '' });
    assert.deepEqual(cinta.lista, [
      { actor: 'dgmit', nombre: NOMBRE.produccion, texto: '90 días corridos (61 hábiles)' },
      { actor: 'ddpc', nombre: NOMBRE.carga, texto: 'en el día' }
    ]);
    assert.equal(cinta.lista[0].texto, '90 días corridos (61 hábiles)');
    assert.deepEqual(cinta.total, { antes: 'En total, unos ', cifra: '90 días corridos', despues: ' (61 hábiles)' });
    assert.deepEqual(cinta.vencimiento, { x: 22.22 });
    assert.equal(cinta.aviso.ancho, 22.22);
    assert.equal(cinta.aclaracion, ACLARACION_MEDIANA);
    sinPorcentajes(cinta, 'la interna');
    sinRarezas(cinta, 'la interna');
  });

  it('un tramo sin casos: gris, sin total ni porcentajes ni vencimiento', () => {
    const cinta = cintaDeMetricas([aviso(35, 24), redaccion(38, 25), respuesta(null), carga(0, 0)], EXTERNA);
    assert.equal(cinta.partes[0].grande, '38 días corridos');
    assert.equal(cinta.partes[0].dias, '(25 hábiles)');
    assert.equal(cinta.partes[0].actor, 'dgmit');
    assert.deepEqual(
      [cinta.partes[1].actor, cinta.partes[1].grande, cinta.partes[1].dias],
      ['gris', 'Sin casos', 'se completa cuando haya casos']
    );
    assert.deepEqual(cinta.total, SIN_TOTAL);
    assert.equal(cinta.total.antes, 'El total se completa cuando haya casos de todos los tramos');
    assert.equal(cinta.total.cifra, '');
    assert.equal(cinta.vencimiento, null);
    assert.equal(cinta.aviso.ancho, null);
    assert.equal(cinta.aviso.texto, '35 días corridos (24 hábiles) antes del vencimiento');
    assert.deepEqual([cinta.aviso.sigue, cinta.aviso.vencimiento], [false, '']);
    // El gris ocupa el 70 % de lo que suman los tramos con cifra
    const gris = Math.round(((100 * Math.max(0.7 * 38, 1)) / (38 + 26.6)) * 100) / 100;
    assert.equal(cinta.partes[1].ancho, gris);
    assert.equal(cinta.partes[0].ancho, Math.round((100 - gris) * 100) / 100);
    assert.equal(cinta.aclaracion, '');
    assert.equal(cinta.lista[1].texto, 'sin casos todavía');
    assert.equal(cinta.lista[1].actor, 'gris');
    sinPorcentajes(cinta, 'un tramo sin casos');
    sinRarezas(cinta, 'un tramo sin casos');

    // La carga sin casos: va en gris y, como con cualquier tramo sin casos, no hay total, ni regla del aviso, ni vencimiento (aunque los
    // tramos a escala tengan cifra)
    const sinCarga = cintaDeMetricas([aviso(35, 24), redaccion(38, 25), respuesta(47, 32), carga(null)], EXTERNA);
    assert.deepEqual(sinCarga.carga, { clave: 'carga', actor: 'gris', grande: 'Sin casos', nombre: NOMBRE.carga, dias: 'se completa cuando haya casos' });
    assert.deepEqual(sinCarga.total, SIN_TOTAL);
    assert.deepEqual(sinCarga.partes.map((p) => p.grande), ['38 días corridos', '47 días corridos']);
    assert.equal(sinCarga.vencimiento, null);
    assert.deepEqual(sinCarga.aviso, {
      rotulo: 'Aviso anticipado:', texto: '35 días corridos (24 hábiles) antes del vencimiento', ancho: null, sigue: false, vencimiento: ''
    });
    assert.ok(sinCarga.descripcion.endsWith('Aviso anticipado: 35 días corridos (24 hábiles) antes del vencimiento.'), sinCarga.descripcion);
    sinPorcentajes(sinCarga, 'la carga sin casos');
    sinRarezas(sinCarga, 'la carga sin casos');
    // Lo mismo con un aviso más largo que los tramos a escala: sin total no hay `sigue` ni «la publicación llega…»
    const largoSinCarga = cintaDeMetricas([aviso(95, 66), redaccion(38, 25), respuesta(47, 32), carga(null)], EXTERNA);
    assert.equal(largoSinCarga.vencimiento, null);
    assert.deepEqual(largoSinCarga.aviso, {
      rotulo: 'Aviso anticipado:', texto: '95 días corridos (66 hábiles) antes del vencimiento', ancho: null, sigue: false, vencimiento: ''
    });
    assert.ok(largoSinCarga.descripcion.endsWith('Aviso anticipado: 95 días corridos (66 hábiles) antes del vencimiento.'), largoSinCarga.descripcion);
  });

  it('sin notas DGMIT: la redacción dice que falta cargarlas', () => {
    const sinNotas = { vacio: { titulo: SIN_NOTAS_DGMIT, texto: '10 notas pendientes de carga' } };
    const cinta = cintaDeMetricas([aviso(35, 24), redaccion(null, null, sinNotas), respuesta(null), carga(0, 0)], EXTERNA);
    assert.deepEqual(cinta.partes.map((p) => [p.actor, p.grande, p.dias]), [
      ['gris', 'Sin casos', 'se completa cuando haya notas DGMIT cargadas'],
      ['gris', 'Sin casos', 'se completa cuando haya casos']
    ]);
    assert.equal(cinta.partes[0].dias, 'se completa cuando haya notas DGMIT cargadas');
    // Los dos sin cifra se reparten el ancho
    assert.deepEqual(cinta.partes.map((p) => p.ancho), [50, 50]);
    assert.deepEqual(cinta.total, SIN_TOTAL);
  });

  it('el aviso más largo que el circuito', () => {
    const cinta = cintaDeMetricas([aviso(50, 34), produccion(31, 21), carga(1, 1)], INTERNA);
    assert.deepEqual(cinta.aviso, {
      rotulo: 'Aviso anticipado:',
      texto: '50 días corridos (34 hábiles); la publicación llega 18 días corridos antes del vencimiento',
      ancho: 100,
      sigue: true,
      vencimiento: ''
    });
    assert.equal(cinta.vencimiento, null);
    assert.deepEqual([cinta.carga.grande, cinta.carga.dias], ['1 día corrido', '(1 hábil)']);
    assert.ok(cinta.descripcion.endsWith(
      'Aviso anticipado: 50 días corridos (34 hábiles); la publicación llega 18 días corridos antes del vencimiento.'
    ), cinta.descripcion);
    // El vencimiento dentro de la carga (el aviso, más largo que los tramos a escala pero no que el total): al final de la zona a escala
    const enLaCarga = cintaDeMetricas([aviso(32, 22), produccion(31, 21), carga(1, 1)], INTERNA);
    assert.deepEqual(enLaCarga.vencimiento, { x: 100 });
    assert.deepEqual(enLaCarga.aviso, {
      rotulo: 'Aviso anticipado:', texto: '32 días corridos (22 hábiles)', ancho: 100, sigue: false, vencimiento: 'vencimiento'
    });
  });

  it('el aviso en los bordes', () => {
    // De 0 días: la regla no tiene largo
    const enElDia = cintaDeMetricas([aviso(0, 0), redaccion(12, 8), respuesta(18, 12), carga(0, 0)], EXTERNA);
    assert.equal(enElDia.aviso.texto, 'el mismo día del vencimiento');
    assert.equal(enElDia.vencimiento.x, 0);
    assert.deepEqual([enElDia.aviso.ancho, enElDia.aviso.sigue, enElDia.aviso.vencimiento], [0, false, 'vencimiento']);
    assert.ok(enElDia.descripcion.endsWith('Aviso anticipado: el mismo día del vencimiento.'), enElDia.descripcion);
    // Igual a la suma de los tramos a escala, con la carga en el día: el vencimiento al final, sin `sigue`
    const igual = cintaDeMetricas([aviso(30, 20), redaccion(12, 8), respuesta(18, 12), carga(0, 0)], EXTERNA);
    assert.equal(igual.vencimiento.x, 100);
    assert.equal(igual.aviso.sigue, false);
    assert.deepEqual([igual.aviso.ancho, igual.aviso.vencimiento], [100, 'vencimiento']);
    // Sin cifra: un renglón sin regla, y la cinta se dibuja igual
    const sinCasos = cintaDeMetricas([aviso(null), redaccion(12, 8), respuesta(18, 12), carga(0, 0)], EXTERNA);
    assert.notEqual(sinCasos, null);
    assert.equal(sinCasos.aviso.texto, 'sin casos todavía');
    assert.equal(sinCasos.aviso.ancho, null);
    assert.deepEqual([sinCasos.aviso.sigue, sinCasos.aviso.vencimiento, sinCasos.vencimiento], [false, '', null]);
    assert.ok(sinCasos.descripcion.endsWith('Aviso anticipado: sin casos todavía.'), sinCasos.descripcion);
    // Sin el tramo del aviso, lo mismo
    assert.deepEqual(cintaDeMetricas([redaccion(12, 8), respuesta(18, 12), carga(0, 0)], EXTERNA), sinCasos);
  });

  it('ceros', () => {
    const cinta = cintaDeMetricas([aviso(0, 0), redaccion(0, 0), respuesta(0, 0), carga(0, 0)], EXTERNA);
    assert.deepEqual(cinta.partes.map((p) => p.ancho), [50, 50]);
    assert.deepEqual([...cinta.partes.map((p) => [p.grande, p.dias]), [cinta.carga.grande, cinta.carga.dias]],
      [['En el día', ''], ['En el día', ''], ['En el día', '']]);
    assert.deepEqual(cinta.total, { antes: 'En total, ', cifra: 'en el día', despues: '' });
    assert.deepEqual(cinta.lista.map((l) => l.texto), ['en el día', 'en el día', 'en el día']);
    assert.deepEqual(cinta.vencimiento, { x: 100 });
    assert.equal(cinta.aviso.texto, 'el mismo día del vencimiento');
    assert.equal(cinta.aclaracion, ACLARACION_MEDIANA);
    assert.ok(cinta.descripcion.startsWith('El recorrido típico de un pedido de la gestión externa: en total, en el día. '), cinta.descripcion);
    sinPorcentajes(cinta, 'ceros');
    sinRarezas(cinta, 'ceros');
    // En la interna y en días hábiles, lo mismo
    const interna = cintaDeMetricas([aviso(0), produccion(0), carga(0)], { gestion: 'interna' });
    assert.deepEqual(interna.partes.map((p) => [p.ancho, p.grande, p.dias]), [[100, 'En el día', '']]);
    assert.deepEqual(interna.total, { antes: 'En total, ', cifra: 'en el día', despues: '' });
    sinRarezas(interna, 'ceros en la interna');
    // Un tramo en 0 al lado de uno sin casos: el sin casos ocupa todo
    const conGris = cintaDeMetricas([redaccion(0), respuesta(null), carga(0)], EXTERNA);
    assert.deepEqual(conGris.partes.map((p) => [p.ancho, p.grande]), [[0, 'En el día'], [100, 'Sin casos']]);
    sinRarezas(conGris, 'un cero y un gris');
  });

  it('un tramo angosto', () => {
    const cinta = cintaDeMetricas([aviso(35), redaccion(2), respuesta(50), carga(0)], EXTERNA);
    assert.equal(cinta.partes[0].angosta, true);
    assert.equal(cinta.partes[1].angosta, false);
    assert.equal(cinta.lista_siempre, true);
    // Con el 12 % justo, no es angosto
    const justo = cintaDeMetricas([aviso(35), redaccion(12), respuesta(88), carga(0)], EXTERNA);
    assert.deepEqual(justo.partes.map((p) => [p.ancho, p.angosta]), [[12, false], [88, false]]);
    assert.equal(justo.lista_siempre, false);
  });

  it('orientativo', () => {
    const conPocos = { cifra: { valor: 35, orientativo: true } };
    const cinta = cintaDeMetricas([aviso(35, 24, conPocos), redaccion(38, 25), respuesta(47, 32), carga(0, 0)], EXTERNA);
    assert.deepEqual(cinta.orientativos, ['Aviso anticipado: con tan pocos casos, es orientativo.']);
    // Uno por tramo, con el aviso primero y después en el orden de la cadena
    const varios = cintaDeMetricas([
      carga(0, 0, { cifra: { valor: 0, orientativo: true } }), respuesta(47, 32, { cifra: { valor: 47, orientativo: true } }),
      redaccion(38, 25), aviso(35, 24, conPocos)
    ], EXTERNA);
    assert.deepEqual(varios.orientativos, [
      'Aviso anticipado: con tan pocos casos, es orientativo.',
      'Respuesta del área: con tan pocos casos, es orientativo.',
      'Preparación y carga: con tan pocos casos, es orientativo.'
    ]);
    // Solo con `true`
    const casi = cintaDeMetricas([aviso(35, 24, { cifra: { valor: 35, orientativo: 'true' } }), redaccion(38, 25), respuesta(47, 32),
      carga(0, 0)], EXTERNA);
    assert.deepEqual(casi.orientativos, []);
  });

  it('la vista en hábiles y el promedio', () => {
    // En días hábiles (los de entrada), «N días hábiles», sin paréntesis aunque los tramos traigan hábiles
    const cinta = cintaDeMetricas([aviso(24, 17), redaccion(25, 18), respuesta(32, 22), carga(0, 0)], { gestion: 'externa' });
    assert.deepEqual(cinta, cintaDeMetricas([aviso(24), redaccion(25), respuesta(32), carga(0)], { gestion: 'externa', dias: 'habiles' }));
    assert.deepEqual(cinta.total, { antes: 'En total, unos ', cifra: '57 días hábiles', despues: '' });
    assert.deepEqual(cinta.partes.map((p) => [p.grande, p.dias]), [['44 %', '25 días hábiles'], ['56 %', '32 días hábiles']]);
    assert.equal(cinta.aviso.texto, '24 días hábiles');
    assert.deepEqual(cinta.lista.map((l) => l.texto), ['25 días hábiles · 44 %', '32 días hábiles · 56 %', 'en el día']);
    for (const texto of textosDe(cinta)) assert.doesNotMatch(texto, /días? corridos?|\(/, texto);
    // La interna en días hábiles: los días en grande, sin nada debajo
    const interna = cintaDeMetricas([aviso(14), produccion(61), carga(1)], { gestion: 'interna', dias: 'habiles' });
    assert.deepEqual([interna.partes[0].grande, interna.partes[0].dias], ['61 días hábiles', '']);
    assert.deepEqual([interna.carga.grande, interna.carga.dias], ['1 día hábil', '']);
    assert.deepEqual(interna.total, { antes: 'En total, unos ', cifra: '62 días hábiles', despues: '' });
    // El aviso más largo que el circuito, en días hábiles
    const sigue = cintaDeMetricas([aviso(34), produccion(21), carga(1)], { gestion: 'interna', dias: 'habiles' });
    assert.equal(sigue.aviso.texto, '34 días hábiles; la publicación llega 12 días hábiles antes del vencimiento');
    // En la vista en hábiles, un tramo de 0 días también es «En el día»
    assert.deepEqual([cinta.carga.grande, cinta.carga.dias, cinta.lista[2].texto], ['En el día', '', 'en el día']);
    // Con el promedio, la frase de abajo dice «los promedios»
    const promedio = cintaDeMetricas(externaCompleta(), { ...EXTERNA, estadistico: 'promedio' });
    assert.equal(promedio.aclaracion, ACLARACION_PROMEDIO);
    assert.equal(cintaDeMetricas(externaCompleta(), EXTERNA).aclaracion, ACLARACION_MEDIANA);
    // Sin total, ninguna frase
    assert.equal(cintaDeMetricas([aviso(35), redaccion(38), respuesta(null), carga(0)], { ...EXTERNA, estadistico: 'promedio' }).aclaracion, '');
  });

  it('descripcion', () => {
    assert.equal(cintaDeMetricas(externaCompleta(), EXTERNA).descripcion,
      'El recorrido típico de un pedido de la gestión externa: en total, unos 85 días corridos (57 hábiles). '
      + 'Redacción y entrega de nota: 38 días corridos (25 hábiles), 45 %. Respuesta del área: 47 días corridos (32 hábiles), 55 %. '
      + 'Preparación y carga: en el día. Aviso anticipado: 35 días corridos (24 hábiles) antes del vencimiento.');
    // Con un tramo sin casos, el aviso dice «antes del vencimiento» una sola vez
    assert.equal(cintaDeMetricas([aviso(35, 24), redaccion(38, 25), respuesta(null), carga(0, 0)], EXTERNA).descripcion,
      'El recorrido típico de un pedido de la gestión externa: el total se completa cuando haya casos de todos los tramos. '
      + 'Redacción y entrega de nota: 38 días corridos (25 hábiles). Respuesta del área: sin casos todavía. '
      + 'Preparación y carga: en el día. Aviso anticipado: 35 días corridos (24 hábiles) antes del vencimiento.');
    assert.equal(cintaDeMetricas([aviso(20, 14), produccion(90, 61), carga(0, 0)], INTERNA).descripcion,
      'El recorrido típico de un pedido de la gestión interna: en total, unos 90 días corridos (61 hábiles). '
      + 'Producción del relevamiento: 90 días corridos (61 hábiles). Preparación y carga: en el día. '
      + 'Aviso anticipado: 20 días corridos (14 hábiles) antes del vencimiento.');
  });

  it('datos raros: nunca tira', () => {
    for (const raro of [null, undefined, {}, [], 'x', 3]) assert.equal(cintaDeMetricas(raro), null, String(raro));
    // Sin ningún tramo del circuito con cifra (el aviso no alcanza), no se dibuja
    assert.equal(cintaDeMetricas([aviso(35), redaccion(null), respuesta(null), carga(null)], EXTERNA), null);
    assert.equal(cintaDeMetricas([aviso(35), produccion(null), carga(null)], INTERNA), null);
    assert.equal(cintaDeMetricas([
      tramo('tramite', NOMBRE.tramite, -3), tramo('respuesta', NOMBRE.respuesta, Number.NaN), tramo('carga', NOMBRE.carga, '2')
    ], EXTERNA), null);
    assert.equal(cintaDeMetricas([null, 3, 'x', [], {}, { clave: 'carga', cifra: 'x' }, { clave: 'tramite', cifra: { valor: Infinity } }],
      EXTERNA), null);
    // Un aviso que no se puede leer cuenta como sin cifra
    const conAvisoRaro = [tramo('aviso', NOMBRE.aviso, 'x', null, { cifra: { valor: 'x', orientativo: true } }), redaccion(10), respuesta(10),
      carga(0)];
    let cinta;
    assert.doesNotThrow(() => { cinta = cintaDeMetricas(conAvisoRaro, EXTERNA); });
    assert.notEqual(cinta, null);
    assert.deepEqual(cinta.aviso, { rotulo: 'Aviso anticipado:', texto: 'sin casos todavía', ancho: null, sigue: false, vencimiento: '' });
    assert.equal(cinta.vencimiento, null);
    assert.deepEqual(cinta.orientativos, []);
    assert.deepEqual(cinta, cintaDeMetricas([redaccion(10), respuesta(10), carga(0)], EXTERNA));
    // Unos hábiles que no se pueden leer: los días sin paréntesis
    const habilesRaros = cintaDeMetricas([aviso(35, 'x'), redaccion(10, -1), respuesta(10, Number.NaN), carga(0, 0)], EXTERNA);
    assert.deepEqual(habilesRaros.partes.map((p) => p.dias), ['10 días corridos', '10 días corridos']);
    assert.deepEqual(habilesRaros.total, { antes: 'En total, unos ', cifra: '20 días corridos', despues: '' });
    assert.equal(habilesRaros.aviso.texto, '35 días corridos; la publicación llega 15 días corridos antes del vencimiento');
    // Una gestión sin carga: va en gris, sin total ni regla del aviso
    const sinCarga = cintaDeMetricas([aviso(35), redaccion(38), respuesta(47)], EXTERNA);
    assert.deepEqual([sinCarga.carga.actor, sinCarga.carga.grande, sinCarga.total.cifra], ['gris', 'Sin casos', '']);
    assert.deepEqual([sinCarga.vencimiento, sinCarga.aviso.ancho], [null, null]);
    // Un tramo sin nombre: ningún texto empieza con «: »
    const sinNombre = cintaDeMetricas([{ clave: 'tramite', cifra: { valor: 10, orientativo: true } }, respuesta(10), carga(0)], EXTERNA);
    assert.equal(sinNombre.partes[0].nombre, '');
    assert.deepEqual(sinNombre.orientativos, ['Con tan pocos casos, es orientativo.']);
    assert.ok(sinNombre.descripcion.includes(': en total, unos 20 días corridos. 10 días corridos, 50 %. Respuesta del área'), sinNombre.descripcion);
    // Opciones raras: las de entrada (externa, días hábiles, mediana)
    const tramos = externaCompleta();
    for (const opciones of [null, 'x', 3, [], { gestion: 3, dias: [], estadistico: {} }, { gestion: 'EXTERNA', dias: 'Corridos' }]) {
      assert.deepEqual(cintaDeMetricas(tramos, opciones), cintaDeMetricas(tramos), JSON.stringify(opciones));
    }
    assert.deepEqual(cintaDeMetricas(tramos), cintaDeMetricas(tramos, { gestion: 'externa', dias: 'habiles', estadistico: 'mediana' }));
    // La opción `letra` ya no existe: no cambia nada
    assert.deepEqual(cintaDeMetricas(tramos, { ...EXTERNA, letra: 8 }), cintaDeMetricas(tramos, EXTERNA));
    for (const c of [cinta, habilesRaros, sinCarga, sinNombre]) sinRarezas(c, JSON.stringify(c));
  });
});

describe('cintasDeLaVista', () => {
  it('cintasDeLaVista', () => {
    // Con la vista de los casos de tests/metricas-casos.js, en las cuatro combinaciones
    const casos = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });
    for (const estadistico of ['mediana', 'promedio']) {
      for (const dias of ['habiles', 'corridos']) {
        const vista = vistaDe(casos, { anio: 2026, al: HOY_DE_LAS_METRICAS, estadistico, dias });
        const cintas = cintasDeLaVista(vista, { estadistico, dias });
        assert.deepEqual(Object.keys(cintas), ['externa', 'interna']);
        for (const gestion of ['externa', 'interna']) {
          assert.deepEqual(cintas[gestion], cintaDeMetricas(vista.circuito[gestion], { gestion, dias, estadistico }), `${gestion}, ${estadistico}, ${dias}`);
        }
      }
    }
    // Con una vista armada a mano, las dos se dibujan
    const vista = { circuito: { externa: externaCompleta(), interna: [aviso(20, 14), produccion(90, 61), carga(0, 0)] } };
    const cintas = cintasDeLaVista(vista, { estadistico: 'promedio', dias: 'corridos' });
    assert.deepEqual(cintas, {
      externa: cintaDeMetricas(vista.circuito.externa, { gestion: 'externa', dias: 'corridos', estadistico: 'promedio' }),
      interna: cintaDeMetricas(vista.circuito.interna, { gestion: 'interna', dias: 'corridos', estadistico: 'promedio' })
    });
    assert.deepEqual([cintas.externa.bajada, cintas.interna.bajada], [BAJADA_EXTERNA, BAJADA_INTERNA]);
    assert.equal(cintas.interna.aclaracion, ACLARACION_PROMEDIO);
    // Sin opciones (o con unas raras), las de entrada; `letra` no cambia nada
    assert.deepEqual(cintasDeLaVista(vista), cintasDeLaVista(vista, { estadistico: 'mediana', dias: 'habiles' }));
    assert.deepEqual(cintasDeLaVista(vista, null), cintasDeLaVista(vista));
    assert.deepEqual(cintasDeLaVista(vista, { estadistico: 'mediana', dias: 'habiles', letra: 8 }), cintasDeLaVista(vista));
    // Sin vista, las dos null
    for (const rara of [null, undefined, 'x', [], {}, { circuito: null }, { circuito: { externa: 'x' } }]) {
      assert.deepEqual(cintasDeLaVista(rara, { estadistico: 'mediana', dias: 'habiles' }), { externa: null, interna: null }, JSON.stringify(rara));
    }
  });

  it('el módulo exporta la forma, la cinta y las de la vista (sin las alturas)', () => {
    assert.deepEqual(Object.keys(moduloDeLaCinta).sort(), ['FORMA_DE_LA_CINTA', 'cintaDeMetricas', 'cintasDeLaVista']);
  });
});
