// El gráfico del modal de cada tramo de la pestaña Métricas (spec 2026-11-07-metricas-cajones-y-ciclos, 5): datos puros, probados con
// ciclos inventados. Lo que importa es lo que promete la spec: el eje de 0 a un tope redondo, los puntos que se tocarían apilados, una
// columna de más de 8 con su «+N», y nada que salga del dibujo ni se pise con otra cosa (salvo la línea de la mediana, que cruza a
// propósito los puntos de su columna).
// Las cajas se miden como en services/metricasGrafico.js, pero de nuevo acá: un punto ocupa su radio más el anillo blanco (1) y, en
// curso, también su flecha a la derecha; un texto, 0,6 · letra por carácter de ancho y la letra de alto (0,8 sobre su línea de base y
// 0,2 debajo), con su anclaje (el «+N» y los números del eje, centrados).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { graficoDelTramo, GRAFICO } from '../services/metricasGrafico.js';

const EPS = 1e-6;

const cajaDeTexto = (x, y, texto, anclaje = 'middle') => {
  const ancho = texto.length * 0.6 * GRAFICO.letra;
  const x0 = anclaje === 'start' ? x : anclaje === 'end' ? x - ancho : x - ancho / 2;
  return { x0, x1: x0 + ancho, y0: y - 0.8 * GRAFICO.letra, y1: y + 0.2 * GRAFICO.letra };
};
const cajaDePunto = ({ x, y, estado }) => {
  const r = GRAFICO.radio + 1;
  return { x0: x - r, x1: x + r + (estado === 'en_curso' ? GRAFICO.flecha : 0), y0: y - r, y1: y + r };
};
// Se tocan si se superponen (dos bordes que coinciden no se tocan: los separa el anillo blanco de los puntos)
const seTocan = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

// Nada se sale de [0, ancho] × [0, alto] y nada se pisa: cada punto, cada «+N», la línea del eje, cada número del eje, el rótulo del
// eje, la línea vertical y su rótulo. La única excepción: un punto con la línea vertical
const revisar = (g) => {
  const cajas = [
    ...g.puntos.map((q) => ({ que: `el punto ${q.titulo} (${q.estado})`, tipo: 'punto', ...cajaDePunto(q) })),
    ...g.mas.map((m) => ({ que: `«${m.texto}»`, ...cajaDeTexto(m.x, m.y, m.texto) })),
    { que: 'la línea del eje', x0: g.eje.marcas[0].x, x1: g.eje.marcas.at(-1).x, y0: g.eje.y, y1: g.eje.y },
    ...g.eje.marcas.map((m) => ({ que: `el número ${m.texto} del eje`, ...cajaDeTexto(m.x, m.y, m.texto) })),
    { que: 'el rótulo del eje', ...cajaDeTexto(g.eje.rotulo.x, g.eje.rotulo.y, g.eje.rotulo.texto, g.eje.rotulo.anclaje) }
  ];
  if (g.linea) {
    const { x, y0, y1, rotulo } = g.linea;
    cajas.push(
      { que: 'la línea vertical', tipo: 'linea', x0: x, x1: x, y0, y1 },
      { que: 'el rótulo de la línea', ...cajaDeTexto(rotulo.x, rotulo.y, rotulo.texto, rotulo.anclaje) }
    );
  }
  for (const c of cajas) {
    assert.ok(c.x0 >= -EPS && c.x1 <= g.ancho + EPS && c.y0 >= -EPS && c.y1 <= g.alto + EPS, `${c.que} se sale: ${JSON.stringify(c)}`);
  }
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const [a, b] = [cajas[i], cajas[j]];
      if ([a.tipo, b.tipo].sort().join() === 'linea,punto') continue;
      assert.ok(!seTocan(a, b), `${a.que} y ${b.que} se pisan: ${JSON.stringify(a)} ${JSON.stringify(b)}`);
    }
  }
};

// Cada ciclo está dibujado o contado en el «+N» de su columna
const cuantos = (g) => g.puntos.length + g.mas.reduce((suma, m) => suma + Number(m.texto.slice(1)), 0);

describe('graficoDelTramo', () => {
  const p = (valor, estado = 'cuenta', titulo = `D${valor}`) => ({ valor, estado, titulo });
  it('sin puntos, null', () => assert.equal(graficoDelTramo([], { linea: null }), null));
  it('las marcas del eje: de 0 al tope redondeado, con 6 intervalos o menos', () => {
    const g = graficoDelTramo([p(0), p(137)], { linea: null });
    assert.deepEqual(g.eje.marcas.map((m) => m.texto), ['0', '50', '100', '150']);
    assert.equal(g.eje.marcas[0].x, GRAFICO.izquierda);
    assert.equal(g.eje.marcas.at(-1).x, GRAFICO.ancho - GRAFICO.derecha);
  });
  it('los que se tocarían se apilan, y una columna de más de 8 dice «+N»', () => {
    const doce = Array.from({ length: 12 }, (_, i) => p(20, 'cuenta', `D${i}`));
    const g = graficoDelTramo(doce, { linea: { valor: 20, texto: 'mediana: 20 días corridos' } });
    assert.equal(g.puntos.length, 8);
    assert.deepEqual(g.mas.map((m) => m.texto), ['+4']);
    assert.equal(new Set(g.puntos.map((q) => q.y)).size, 8);
  });
  it('un en curso ocupa también su flecha', () => {
    const g = graficoDelTramo([p(0), p(99, 'en_curso'), p(100)], { linea: null });
    const [curso, cuenta] = [g.puntos.find((q) => q.estado === 'en_curso'), g.puntos.find((q) => q.titulo === 'D100')];
    assert.notEqual(curso.y, cuenta.y);
  });
  it('sin línea, sin línea; a la derecha, el rótulo se ancla al final', () => {
    const dos = [p(10), p(100)];
    assert.equal(graficoDelTramo(dos, { linea: null }).linea, null);
    assert.equal(graficoDelTramo(dos, { linea: { valor: 100, texto: 'mediana: 100 días corridos' } }).linea.rotulo.anclaje, 'end');
    assert.equal(graficoDelTramo(dos, { linea: { valor: 10, texto: 'mediana: 10 días corridos' } }).linea.rotulo.anclaje, 'start');
  });
  it('nada se sale ni se pisa', () => {
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) % 400);
    const puntos = Array.from({ length: 60 }, (_, i) => p(azar(), i % 5 === 0 ? 'en_curso' : 'cuenta', `D${i}`));
    const g = graficoDelTramo(puntos, { linea: { valor: 120, texto: 'mediana: 120 días corridos' } });
    // cajas: cada punto (radio, más la flecha en curso), cada «+N», cada marca del eje, el rótulo del eje y el de la línea,
    // con el ancho del texto estimado como 0,6 · letra por carácter: todas adentro de [0, ancho] × [0, alto], y ninguna toca a otra
    // salvo un punto con la línea vertical (la línea cruza la columna de la mediana a propósito)
    assert.ok(g.puntos.some((q) => q.estado === 'en_curso') && g.linea !== null);
    assert.equal(cuantos(g), 60);
    revisar(g);
  });

  it('la línea va de 22 a la base, el eje, y los textos del eje y de los puntos, tal cual', () => {
    const g = graficoDelTramo([p(3, 'cuenta', 'Dataset de ejemplo: 3 días corridos (2 hábiles)'), p(9, 'en_curso')],
      { linea: { valor: 3, texto: 'mediana: 3 días corridos' } });
    assert.equal(g.ancho, GRAFICO.ancho);
    assert.equal(g.linea.y0, 22);
    assert.equal(g.linea.y1, g.eje.y);
    assert.equal(g.linea.rotulo.texto, 'mediana: 3 días corridos');
    assert.deepEqual(g.eje.rotulo, { ...g.eje.rotulo, texto: 'días corridos', anclaje: 'end' });
    assert.deepEqual(g.puntos.map((q) => [q.titulo, q.estado]),
      [['Dataset de ejemplo: 3 días corridos (2 hábiles)', 'cuenta'], ['D9', 'en_curso']]);
    assert.ok(g.puntos.every((q) => q.y < g.eje.y));
    revisar(g);
  });

  it('el «+N» de la columna de la línea no se pisa con ella, en las dos puntas del eje', () => {
    for (const valor of [0, 20]) {
      const doce = Array.from({ length: 12 }, (_, i) => p(valor, 'cuenta', `D${i}`));
      const g = graficoDelTramo([...doce, p(5)], { linea: { valor, texto: valor === 0 ? 'mediana: en el día' : 'mediana: 20 días corridos' } });
      assert.deepEqual(g.mas.map((m) => m.texto), ['+4']);
      assert.equal(cuantos(g), 13);
      revisar(g);
    }
  });

  it('muchos ciclos juntos: columnas vecinas apiladas, varios «+N» y en curso, y nada se pisa', () => {
    let semilla = 11;
    const azar = (n) => ((semilla = (semilla * 16807) % 2147483647) % n);
    const puntos = Array.from({ length: 160 }, (_, i) => p(30 + azar(12), i % 7 === 0 ? 'en_curso' : 'cuenta', `D${i}`));
    for (const linea of [null, { valor: 35, texto: 'mediana: 35 días corridos' }, { valor: 36.5, texto: 'promedio: 36,5 días corridos' }]) {
      const g = graficoDelTramo(puntos, { linea });
      assert.ok(g.mas.length >= 2);
      assert.equal(cuantos(g), 160);
      revisar(g);
    }
  });

  // Un valor absurdo no deja sin fin el bucle de las marcas del eje: con 1e308 el fin del eje (1,2e308) es finito y el gráfico va, con todos
  // sus números finitos; desde unos 1,5e308, redondeado a su paso, el fin del eje es Infinity y el gráfico no va
  it('un valor absurdo: el fin del eje finito, o null', () => {
    const numeros = (valor) => (typeof valor === 'number' ? [valor]
      : valor !== null && typeof valor === 'object' ? Object.values(valor).flatMap(numeros) : []);
    const g = graficoDelTramo([p(3), p(1e308)], { linea: { valor: 1e308, texto: 'mediana: 1e308 días corridos' } });
    assert.ok(g !== null);
    assert.ok(g.eje.marcas.length <= 8);
    assert.ok(numeros(g).every(Number.isFinite), JSON.stringify(g));
    for (const valor of [1.7e308, Number.MAX_VALUE]) {
      assert.equal(graficoDelTramo([p(3), p(valor)], { linea: null }), null, String(valor));
      assert.equal(graficoDelTramo([p(3)], { linea: { valor, texto: 'mediana' } }), null, String(valor));
    }
  });

  it('solo en curso: los aros, sin línea', () => {
    const g = graficoDelTramo([p(40, 'en_curso'), p(41, 'en_curso')], { linea: null });
    assert.deepEqual(g.puntos.map((q) => q.estado), ['en_curso', 'en_curso']);
    assert.equal(g.linea, null);
    revisar(g);
  });
});
