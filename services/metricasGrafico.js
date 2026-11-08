// El gráfico de los ciclos de un tramo, en el modal de cada tramo de la pestaña Métricas (spec 2026-11-07-metricas-cajones-y-ciclos,
// 5): un punto por ciclo sobre los días corridos (lleno si cuenta en la cifra; un aro con una flecha a la derecha si está en curso, en
// «hace …»), el eje con sus números y «días corridos» al final, la mediana o el promedio como una línea vertical con su rótulo, y un
// «+N» arriba de una columna de más de 8 puntos. Como la cinta (services/metricasCinta.js), la geometría entera la arma el servidor y
// la página solo la dibuja (Ruling 19): las x, los niveles, las marcas del eje, los rótulos y el «+N» salen de acá, y lo que pidió el
// usuario (nada sale del dibujo ni se pisa con otra cosa) se prueba acá, sin navegador (tests/metricas-grafico.test.js). El gráfico va
// solo en la página: el PDF no lleva el modal.
// Función pura: sin pool, sin Date y sin las reglas de Métricas (los días y los textos ya vienen armados). Un espacio de GRAFICO.ancho
// de ancho y el alto que piden los puntos apilados. Lo que se mide:
// - un punto: su `y` es el centro; ocupa su radio más el anillo blanco (1) y, en curso, también su flecha (GRAFICO.flecha) a la derecha;
// - un texto: su `y` es la línea de base (la de SVG, sin `dominant-baseline`); ocupa 0,6 · letra por carácter de ancho y la letra de
//   alto, 0,8 sobre la base y 0,2 debajo, según su anclaje (el «+N» y los números del eje van centrados en su x).
// La única cosa que pisa a otra es la línea vertical, que cruza a propósito los puntos de su columna. Ninguna función tira error: con
// datos raros, el punto no va (o, sin ninguno o con un valor tan grande que el fin del eje no es finito, el gráfico no va).

export const GRAFICO = Object.freeze({ ancho: 760, izquierda: 18, derecha: 30, radio: 5.5, paso: 13, tope: 8, arriba: 34, abajo: 50, flecha: 11, letra: 12 });
const G = GRAFICO;

// El eje: el primer paso de la serie 1, 2, 5, 10, 20, 50, 100… con el que quedan 6 intervalos o menos
const INTERVALOS = 6;
const SERIE = Object.freeze([1, 2, 5]);
// Lo que mide un texto, en letras
const POR_CARACTER = 0.6;
const SOBRE_LA_BASE = 0.8;
const BAJO_LA_BASE = 0.2;
// El anillo blanco alrededor de cada punto
const ANILLO = 1;
// De dónde a dónde va la línea vertical, y su rótulo: al lado de su punta, con la base en 32 (el texto, de 22,4 a 34,4), arriba del
// nivel más alto (cuyo punto empieza en arriba + paso − radio − anillo = 40,5); a la izquierda de la línea si la línea está en los
// últimos 220 del dibujo (o si a la derecha no entra)
const LINEA_DESDE = 22;
const BASE_DEL_ROTULO_DE_LA_LINEA = 32;
const AIRE_DE_LA_LINEA = 6;
const ULTIMOS = 220;
// Debajo del nivel 0: la línea del eje 12 más abajo (el punto termina en 6,5), los números con su base 18 debajo de la línea (dejan
// lugar a una rayita de hasta 6) y «días corridos» con la suya 34 debajo, a la derecha, en su propia fila (en la de los números se
// pisaría con el último). Todo entra en GRAFICO.abajo (50)
const DEL_NIVEL_CERO_AL_EJE = 12;
const DEL_EJE_A_LOS_NUMEROS = 18;
const DEL_EJE_AL_ROTULO = 34;
// Lo que se deja libre a cada lado de un «+N»
const AIRE_DEL_MAS = 2;

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const redondo = (n) => Math.round(n * 100) / 100;
const anchoDe = (texto) => texto.length * POR_CARACTER * G.letra;

const pasoDelEje = (max) => {
  for (let potencia = 1; ; potencia *= 10) {
    for (const k of SERIE) if (max / (k * potencia) <= INTERVALOS) return k * potencia;
  }
};

// Lo que ocupa un punto (o un «+N») en su nivel, de izquierda a derecha
const cajaDelPunto = (x, estado) => ({ x0: x - G.radio - ANILLO, x1: x + G.radio + ANILLO + (estado === 'en_curso' ? G.flecha : 0) });
const cajaDelMas = (x, texto) => ({ x0: x - anchoDe(texto) / 2 - AIRE_DEL_MAS, x1: x + anchoDe(texto) / 2 + AIRE_DEL_MAS });
const seTocan = (a, b) => a.x0 < b.x1 && b.x0 < a.x1;

// El gráfico de los ciclos de un tramo:
//   { ancho: 760, alto,
//     eje: { y,                                     // la línea del eje, de la primera marca a la última
//            marcas: [{ x, y, texto }],             // los números del eje ('0', '50'…), centrados en su x, con su base en y
//            rotulo: { x, y, texto: 'días corridos', anclaje: 'end' } },
//     linea: { x, y0: 22, y1, rotulo: { x, y, texto, anclaje: 'start' | 'end' } } | null,   // de 22 a la línea del eje
//     puntos: [{ x, y, estado: 'cuenta' | 'en_curso', titulo }],                             // los que se dibujan, de menos días a más
//     mas: [{ x, y, texto }] }                      // «+N», centrado en su x, con su base en y
// `puntos`: [{ valor, estado, titulo }], los días corridos de cada ciclo (los que cuentan y los en curso; las notas pendientes de
// carga no, porque no tienen días), con su título ya armado, que va tal cual. `opciones.linea`: { valor, texto } (la cifra, en días
// corridos, y su rótulo ya armado) o null (sin cifra: sin línea). null sin ningún punto con días, o si el fin del eje no es finito.
// - El eje va de 0 al mayor valor (o al de la línea, y al menos 1) redondeado hacia arriba a un múltiplo de su paso.
// - Los puntos, de menos días a más: una columna es el mismo valor y el mismo estado; si la columna ya tiene GRAFICO.tope puntos, el
//   punto no se dibuja y suma al «+N» de su columna; si no, va en el nivel más bajo donde no toca nada de ese nivel. Los niveles se
//   cuentan desde abajo y cada uno ocupa GRAFICO.paso de alto: todo lo de un nivel queda en su franja, así que lo de dos niveles
//   distintos no se toca.
// - El «+N» va centrado en su columna, un nivel arriba de su punto más alto (su texto, centrado en ese nivel). Si ahí toca algo de ese
//   nivel o la línea vertical, va al lado de la línea (a la derecha y, si no entra, a la izquierda) o, si tampoco, un nivel más arriba.
// - alto = arriba + niveles · paso + abajo, con los niveles de los puntos y de los «+N».
export const graficoDelTramo = (puntos, opciones) => {
  const validos = (Array.isArray(puntos) ? puntos : [])
    .filter((p) => esObjeto(p) && Number.isFinite(p.valor) && p.valor >= 0)
    .map((p) => ({ valor: p.valor, estado: p.estado === 'en_curso' ? 'en_curso' : 'cuenta', titulo: p.titulo }));
  if (validos.length === 0) return null;
  const o = esObjeto(opciones) ? opciones : {};
  const linea = esObjeto(o.linea) && Number.isFinite(o.linea.valor) && o.linea.valor >= 0
    ? { valor: o.linea.valor, texto: typeof o.linea.texto === 'string' ? o.linea.texto : '' }
    : null;

  // El eje
  const max = validos.reduce((mayor, p) => Math.max(mayor, p.valor), Math.max(1, linea?.valor ?? 0));
  const paso = pasoDelEje(max);
  const tope = Math.ceil(max / paso) * paso;
  // Con un valor absurdo, el fin del eje redondeado a su paso puede no ser finito, y el bucle de las marcas no terminaría
  if (!Number.isFinite(tope)) return null;
  const xDe = (valor) => redondo(G.izquierda + (valor / tope) * (G.ancho - G.izquierda - G.derecha));
  const xDeLaLinea = linea === null ? null : xDe(linea.valor);

  // Lo que ocupa cada nivel (de abajo hacia arriba), los puntos que se dibujan y los «+N», con su nivel
  const niveles = [];
  const libre = (nivel, caja) => !(niveles[nivel] ?? []).some((otra) => seTocan(caja, otra));
  const ocupar = (nivel, caja) => (niveles[nivel] ??= []).push(caja);
  const dibujados = [];
  const masDeLasColumnas = [];

  // El «+N» de una columna, desde un nivel arriba de su punto más alto
  const colocarElMas = (xDeLaColumna, desde, texto) => {
    const mitad = anchoDe(texto) / 2;
    const centrado = Math.min(Math.max(xDeLaColumna, mitad), G.ancho - mitad);
    const lugares = [centrado];
    if (xDeLaLinea !== null) lugares.push(xDeLaLinea + AIRE_DE_LA_LINEA + mitad, xDeLaLinea - AIRE_DE_LA_LINEA - mitad);
    const sirve = (nivel, x) => {
      const caja = cajaDelMas(x, texto);
      const adentro = x - mitad >= 0 && x + mitad <= G.ancho;
      const cruzaLaLinea = xDeLaLinea !== null && caja.x0 < xDeLaLinea && xDeLaLinea < caja.x1;
      return adentro && !cruzaLaLinea && libre(nivel, caja);
    };
    // Más arriba de todo lo ocupado no hay nada: solo pueden faltar la línea o el ancho, y entonces va centrado
    const ultimo = Math.max(niveles.length, desde);
    for (let nivel = desde; nivel <= ultimo; nivel++) {
      const x = lugares.find((lugar) => sirve(nivel, lugar));
      if (x !== undefined || nivel === ultimo) {
        const elegido = x ?? centrado;
        ocupar(nivel, cajaDelMas(elegido, texto));
        masDeLasColumnas.push({ x: redondo(elegido), nivel, texto });
        return;
      }
    }
  };

  const orden = (estado) => (estado === 'cuenta' ? 0 : 1);
  const ordenados = [...validos].sort((a, b) => a.valor - b.valor || orden(a.estado) - orden(b.estado));
  for (let i = 0; i < ordenados.length;) {
    let j = i;
    while (j < ordenados.length && ordenados[j].valor === ordenados[i].valor && ordenados[j].estado === ordenados[i].estado) j++;
    const columna = ordenados.slice(i, j);
    const x = xDe(columna[0].valor);
    let masAlto = -1;
    for (const punto of columna.slice(0, G.tope)) {
      const caja = cajaDelPunto(x, punto.estado);
      let nivel = 0;
      while (!libre(nivel, caja)) nivel++;
      ocupar(nivel, caja);
      dibujados.push({ x, nivel, estado: punto.estado, titulo: punto.titulo });
      masAlto = Math.max(masAlto, nivel);
    }
    if (columna.length > G.tope) colocarElMas(x, masAlto + 1, `+${columna.length - G.tope}`);
    i = j;
  }

  // Los niveles, a su y: el 0 abajo, el más alto en arriba + paso
  const fondo = G.arriba + niveles.length * G.paso;
  const yDe = (nivel) => fondo - nivel * G.paso;
  const yDelEje = fondo + DEL_NIVEL_CERO_AL_EJE;

  const marcas = [];
  for (let k = 0; k * paso <= tope; k++) marcas.push({ x: xDe(k * paso), y: yDelEje + DEL_EJE_A_LOS_NUMEROS, texto: String(k * paso) });

  let lineaDelGrafico = null;
  if (linea !== null) {
    const x = xDeLaLinea;
    const ancho = anchoDe(linea.texto);
    const entraALaDerecha = x + AIRE_DE_LA_LINEA + ancho <= G.ancho;
    const entraALaIzquierda = x - AIRE_DE_LA_LINEA - ancho >= 0;
    let anclaje = x > G.ancho - ULTIMOS ? 'end' : 'start';
    if (anclaje === 'start' && !entraALaDerecha && entraALaIzquierda) anclaje = 'end';
    if (anclaje === 'end' && !entraALaIzquierda && entraALaDerecha) anclaje = 'start';
    lineaDelGrafico = {
      x,
      y0: LINEA_DESDE,
      y1: yDelEje,
      rotulo: {
        x: redondo(anclaje === 'start' ? x + AIRE_DE_LA_LINEA : x - AIRE_DE_LA_LINEA),
        y: BASE_DEL_ROTULO_DE_LA_LINEA,
        texto: linea.texto,
        anclaje
      }
    };
  }

  // El texto del «+N», centrado en su nivel: su base, (0,8 − 0,2) / 2 de letra por debajo del centro
  const bajarAlCentro = ((SOBRE_LA_BASE - BAJO_LA_BASE) / 2) * G.letra;
  return {
    ancho: G.ancho,
    alto: fondo + G.abajo,
    eje: {
      y: yDelEje,
      marcas,
      rotulo: { x: G.ancho - G.derecha, y: yDelEje + DEL_EJE_AL_ROTULO, texto: 'días corridos', anclaje: 'end' }
    },
    linea: lineaDelGrafico,
    puntos: dibujados.map(({ x, nivel, estado, titulo }) => ({ x, y: yDe(nivel), estado, titulo })),
    mas: masDeLasColumnas.map(({ x, nivel, texto }) => ({ x, y: redondo(yDe(nivel) + bajarAlCentro), texto }))
  };
};
