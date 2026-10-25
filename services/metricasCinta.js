// La cinta del «recorrido típico» de la pestaña Métricas como datos (spec 2026-10-24-metricas-y-reportes, 2.2): las cifras del
// circuito (la mediana o el promedio de cada tramo, los Tramo de vistaDe en services/metricasReglas.js) una detrás de la otra alrededor
// del vencimiento, con todo lo que después dibujan la pantalla (SVG) y el PDF (PDFKit) con los mismos números: el eje, la banda celeste
// antes del vencimiento, el rayado después, el gris donde la cadena se corta, los tramos, las marcas y los rótulos. Es orientativa, no
// un ciclo real. Función pura, como services/seguimientoCinta.js: un espacio de 1000 × 156, con la línea útil de x = 30 a x = 970 y las
// alturas fijas de ALTURAS_DE_LA_CINTA (las de la maqueta 7). Los textos se miden con 6,6 por letra (la pantalla; el PDF, con su letra:
// la opción `letra`, como en la cinta del Seguimiento), 10 sobre la línea de base y 3 debajo: ningún texto sale del dibujo ni se pisa con
// otro (pedido del usuario). Ninguna función tira error: con datos raros devuelve null o corta la cadena.
import { unidadDe, SIN_NOTAS_DGMIT, GESTIONES } from './metricasReglas.js';

const ANCHO = 1000;
const ALTO = 156;
const X_INICIAL = 30;
const X_FINAL = 970;
const ANCHO_UTIL = X_FINAL - X_INICIAL;

// Las alturas fijas del dibujo (las de la maqueta 7), para la pantalla y el PDF: las dos filas de los rótulos (la de arriba, sobre la
// punta de la línea del vencimiento, y la de los tramos, justo encima de sus segmentos), los segmentos, la banda, el centro de las
// marcas, el texto del gris, la línea del eje y sus números, la línea del vencimiento (de dónde a dónde) y su texto, y el rótulo del eje
export const ALTURAS_DE_LA_CINTA = Object.freeze({
  filaDeArriba: 26, filaDeLosTramos: 42,
  segmentos: Object.freeze({ y: 50, alto: 8 }), banda: Object.freeze({ y: 74, alto: 26 }), marcas: 87, textoDelGris: 91,
  linea: 118, ticks: 136, vencimiento: Object.freeze({ desde: 30, hasta: 118, texto: 148 }), textoDelEje: 152
});
const ALTURAS = ALTURAS_DE_LA_CINTA;

// El eje: el primer paso con el que quedan como mucho 8 marcas (sin contar la del vencimiento, que no lleva número), con un aire de
// 0,4 de paso antes del aviso y de 0,6 después del final, redondeados al paso. Más allá de 100 (más de unos 700 días), el menor
// múltiplo de 100 que sirve: se prueban unos cuantos y, si ninguno, uno que sirve seguro
const PASOS = Object.freeze([5, 10, 20, 30, 50, 100]);
const MARCAS_DEL_EJE = 8;
const AIRE_ANTES = 0.4;
const AIRE_DESPUES = 0.6;
const MULTIPLOS_A_PROBAR = 50;

// Las marcas a menos de esto se juntan en una (spec 2.2: las que se pisan se juntan). Sale de su tamaño en la maqueta 7: el borde de
// afuera de un círculo está a 7,75 (la entrega: radio 6,5 y borde) o a 8 (la carga: radio 7 y borde) de su centro, y el rombo del
// aviso, a 9,9 (media diagonal): un rombo al lado de un círculo necesita unos 18 para no tocarse. No es el 11 de la cinta del
// Seguimiento, donde un día mide unos 2,6 y las marcas son más chicas
const SEPARACION = 18;
// La medida aproximada de un texto: 6,6 por letra (la de la pantalla, si las opciones no dicen otra), 10 sobre la línea de base y 3
// debajo
const LETRA = 6.6;
const SOBRE_LA_BASE = 10;
const BAJO_LA_BASE = 3;
// Lo que se deja libre: entre el borde del dibujo y un texto, entre dos textos, entre una marca y su rótulo, entre la línea del
// vencimiento y un rótulo que se corre a su costado, y a cada lado del texto del gris (para que no toque la última marca)
const MARGEN = 4;
const AIRE_ENTRE_TEXTOS = 8;
const DESPEGUE_DE_LA_MARCA = 12;
const AIRE_DE_LA_LINEA = 10;
const AIRE_DEL_GRIS = 12;
// Con la cadena cortada, el lugar del gris (después del vencimiento o de lo último que se sabe) es 0,9 de lo que se dibuja antes; si
// su texto no entra, se agranda de a un cuarto
const LUGAR_DEL_GRIS = 0.9;
const VUELTAS_DEL_GRIS = 40;

// Cada gestión después del aviso: los tramos en el orden del circuito, el hito en que termina cada uno (su marca) y el color de su
// segmento (lo de la DGMIT en violeta, el área en tinta y la carga en verde)
const CADENA = Object.freeze({
  externa: Object.freeze([
    Object.freeze({ clave: 'tramite', hito: 'nota', color: 'violeta' }),
    Object.freeze({ clave: 'respuesta', hito: 'datos', color: 'tinta' }),
    Object.freeze({ clave: 'carga', hito: 'carga', color: 'verde' })
  ]),
  interna: Object.freeze([
    Object.freeze({ clave: 'produccion', hito: 'datos', color: 'violeta' }),
    Object.freeze({ clave: 'carga', hito: 'carga', color: 'verde' })
  ])
});

const GRIS_SIN_NOTAS_DGMIT = 'La cinta se completa cuando haya notas DGMIT cargadas';
const GRIS_SIN_NOMBRE = 'La cinta se completa cuando haya casos de todos los tramos';

// La aclaración de la cinta (spec, 2.2), con el estadístico elegido
const ACLARACION = Object.freeze({
  mediana: 'La cinta pone las medianas una detrás de la otra: es orientativa, no un ciclo real.',
  promedio: 'La cinta pone los promedios uno detrás del otro: es orientativa, no un ciclo real.'
});

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

// La cifra de un tramo: sus días, 0 o más; null si no tiene (sin casos) o si no se puede leer
const valorDe = (tramo) => {
  const valor = esObjeto(tramo) && esObjeto(tramo.cifra) ? tramo.cifra.valor : null;
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
};

const nombreDe = (tramo) => (esObjeto(tramo) && typeof tramo.nombre === 'string' ? tramo.nombre.trim() : '');

// «12 días hábiles», «1 día corrido» o, con 0, «en el día»
const cuanto = (valor, dias) => (valor === 0 ? 'en el día' : `${valor} ${unidadDe(valor, dias)}`);

// Lo que dice el gris. Mientras no haya notas DGMIT cargadas, la cadena se corta en la DGMIT o en el área: «La cinta se completa
// cuando haya notas DGMIT cargadas». Si se corta en otro tramo sin casos, cuál y por qué: «Producción del relevamiento: sin casos en
// 2026» (el «Sin casos en 2026» de vistaDe)
const textoDelGris = (corte, tramite) => {
  const sinNotas = esObjeto(tramite) && esObjeto(tramite.vacio) && tramite.vacio.titulo === SIN_NOTAS_DGMIT;
  if (sinNotas && (corte.clave === 'tramite' || corte.clave === 'respuesta')) return GRIS_SIN_NOTAS_DGMIT;
  const nombre = nombreDe(corte.tramo);
  if (nombre === '') return GRIS_SIN_NOMBRE;
  const vacio = esObjeto(corte.tramo.vacio) && typeof corte.tramo.vacio.titulo === 'string' ? corte.tramo.vacio.titulo.trim() : '';
  const titulo = vacio === '' ? 'Sin casos' : vacio;
  return `${nombre}: ${titulo.charAt(0).toLowerCase()}${titulo.slice(1)}`;
};

// La escala de `desde` (el aviso) a `hasta` (el final), con su paso, sus extremos y la x de cada día
const escalaDe = (desde, hasta) => {
  const medir = (paso) => ({
    paso,
    min: Math.floor((desde - AIRE_ANTES * paso) / paso) * paso,
    max: Math.ceil((hasta + AIRE_DESPUES * paso) / paso) * paso
  });
  // El vencimiento (el 0) queda siempre adentro y no lleva número: las marcas con número son (max − min) / paso
  const sirve = ({ paso, min, max }) => (max - min) / paso <= MARCAS_DEL_EJE;
  let elegida = PASOS.map(medir).find(sirve);
  if (!elegida) {
    // (max − min) / paso es menos que (hasta − desde) / paso + 3: con un paso de un quinto del largo, sirve seguro
    const largo = hasta - desde;
    const primero = Math.max(2, Math.floor(largo / 800));
    for (let k = primero; !elegida && k < primero + MULTIPLOS_A_PROBAR; k++) {
      const escala = medir(100 * k);
      if (sirve(escala)) elegida = escala;
    }
    elegida ??= medir(100 * Math.max(2, Math.ceil(largo / 500)));
  }
  const { paso, min, max } = elegida;
  return { paso, min, max, x: (dia) => X_INICIAL + ((dia - min) / (max - min)) * ANCHO_UTIL };
};

// Qué marca se dibuja cuando varias se juntan: la del aviso, si está; si no, la de la nota DGMIT; la entrega y la carga juntas son
// una sola, 'datos-y-carga'
const tipoDelGrupo = (tipos) => {
  if (tipos.includes('aviso')) return 'aviso';
  if (tipos.includes('nota')) return 'nota';
  if (tipos.includes('datos') && tipos.includes('carga')) return 'datos-y-carga';
  return tipos[0];
};

// Lo que ocupa un texto ({ x0, x1, y0, y1 }), según su anclaje, con `letra` por letra
const anchoDe = (texto, letra) => texto.length * letra;
const cajaDe = (x, y, texto, anclaje, letra) => {
  const ancho = anchoDe(texto, letra);
  const x0 = anclaje === 'start' ? x : anclaje === 'end' ? x - ancho : x - ancho / 2;
  return { x0, x1: x0 + ancho, y0: y - SOBRE_LA_BASE, y1: y + BAJO_LA_BASE };
};
const seTocan = (a, b) => a.x0 < b.x1 + AIRE_ENTRE_TEXTOS && b.x0 < a.x1 + AIRE_ENTRE_TEXTOS && a.y0 < b.y1 && b.y0 < a.y1;
const adentro = (caja) => caja.x0 >= MARGEN && caja.x1 <= ANCHO - MARGEN && caja.y0 >= 0 && caja.y1 <= ALTO;

// La cinta de una gestión, con todo lo que hace falta para dibujarla igual en la pantalla y en el PDF:
//   { ancho: 1000, alto: 156,
//     linea: { x0: 30, x1: 970 },           // la línea del eje: la línea útil, de punta a punta (la página y el PDF no la copian)
//     ticks: [{ x, texto }],                // los números del eje ('−40', '+10'), sin el 0: ahí va «vencimiento»
//     banda: { x0, x1 },                    // del aviso al vencimiento (celeste)
//     rayado: { x0, x1 } | null,            // del vencimiento a la carga (o a lo último que se sabe), si es posterior
//     gris: { x0, x1, texto } | null,       // la cadena se corta: de lo último que se sabe (o del vencimiento) al final
//     vencimiento: { x },
//     segmentos: [{ x0, x1, texto, color: 'violeta' | 'tinta' | 'verde' }],  // solo los tramos con largo (x1 > x0)
//     marcas: [{ x, tipo: 'aviso' | 'nota' | 'datos' | 'carga' | 'datos-y-carga',  // la que se dibuja
//                tipos: ['aviso' | 'nota' | 'datos' | 'carga'] }],                // todo lo que junta, en el orden de la cadena
//     rotulos: [{ x, y, texto, anclaje: 'start' | 'middle' | 'end', color: 'tinta' | 'violeta' | 'verde' }],
//     eje: { x, y: 152, texto: 'días hábiles respecto del vencimiento', anclaje: 'start' | 'end' },
//     aclaracion,
//     alturas }                             // ALTURAS_DE_LA_CINTA: la página las recibe con la cinta, no las copia
// Los días van respecto del vencimiento (el aviso, antes; lo que pasa después, después) y en lo que se eligió en el selector: las
// cifras de los tramos ya vienen así. La cadena: el aviso, la anticipación antes del vencimiento; después, uno detrás del otro, los
// tramos de la gestión (externa: trámite, respuesta y carga; interna: producción y carga). Se corta en el primero sin cifra, y no se
// suman tramos para tapar el hueco (spec, 2.2). Los segmentos llevan su texto («Producción del relevamiento · 45 días hábiles»), para
// el título del dibujo o una descripción en texto; lo que se escribe en el dibujo son los rótulos, que pueden no ir si no entran:
// - el del aviso («Aviso · 27 días hábiles antes») y el de la carga («Entrega y carga, el mismo día» si se juntan con la entrega y la
//   carga es 0, «Entrega y carga, 1 día corrido después» si se juntan y no lo es, y si no «Carga · 2 días hábiles después») van al lado
//   de su marca, a la derecha si entran en el dibujo y si no a la izquierda (anclaje end), en la fila de arriba (y = 26), sobre la punta
//   de la línea del vencimiento, o, si ahí se pisan, en la de los tramos (y = 42);
// - el de cada tramo (menos la carga, que lo dice su marca) va centrado sobre su segmento en la fila de los tramos (y = 42); si la línea
//   del vencimiento lo cruza o se pisa con otro, a un costado de la línea sin dejar su tramo; y si no, pasa a la fila libre de arriba
//   (y = 26). Si no entra en ningún lado, no va.
// Ninguno sale del dibujo ni se pisa con otro texto (los números del eje, «vencimiento», el rótulo del eje, el del gris y los otros
// rótulos). `tramos`: los de vistaDe para la gestión (circuito.externa o circuito.interna); `opciones`: { gestion: 'externa' (la de
// entrada) | 'interna', dias: 'habiles' (los de entrada) | 'corridos', estadistico: 'mediana' (el de entrada) | 'promedio', letra:
// cuánto mide una letra (6,6, la de la pantalla, si no es un número positivo; el PDF pasa la suya: OPCIONES_CINTA_PDF de
// services/reportesMetricasPdf.js) }. null si el aviso anticipado no tiene cifra (sin casos: la cinta no se dibuja) o si `tramos` no es
// una lista.
export const cintaDeMetricas = (tramos, opciones) => {
  if (!Array.isArray(tramos)) return null;
  const o = esObjeto(opciones) ? opciones : {};
  const gestion = o.gestion === 'interna' ? 'interna' : 'externa';
  const dias = o.dias === 'corridos' ? 'corridos' : 'habiles';
  const estadistico = o.estadistico === 'promedio' ? 'promedio' : 'mediana';
  const letra = Number.isFinite(o.letra) && o.letra > 0 ? o.letra : LETRA;
  const tramoDe = (clave) => tramos.find((t) => esObjeto(t) && t.clave === clave) ?? null;
  const anticipacion = valorDe(tramoDe('aviso'));
  if (anticipacion === null) return null;

  // La cadena, en días respecto del vencimiento
  const aviso = -anticipacion;
  const cadena = [];
  let alcance = aviso;
  let corte = null;
  for (const eslabon of CADENA[gestion]) {
    const tramo = tramoDe(eslabon.clave);
    const valor = valorDe(tramo);
    if (valor === null) {
      corte = { clave: eslabon.clave, tramo };
      break;
    }
    cadena.push({ ...eslabon, tramo, valor, desde: alcance, hasta: alcance + valor });
    alcance += valor;
  }

  // La escala va del aviso a la carga o al vencimiento, lo que sea después. Con la cadena cortada, sigue el lugar del gris, que se
  // agranda hasta que entre su texto
  const ultimo = Math.max(alcance, 0);
  const textoGris = corte === null ? null : textoDelGris(corte, tramoDe('tramite'));
  let escala;
  if (corte === null) escala = escalaDe(aviso, ultimo);
  else {
    let lugar = LUGAR_DEL_GRIS * (ultimo - aviso);
    escala = escalaDe(aviso, ultimo + lugar);
    const haceFalta = anchoDe(textoGris, letra) + 2 * AIRE_DEL_GRIS;
    for (let vuelta = 0; vuelta < VUELTAS_DEL_GRIS && X_FINAL - escala.x(ultimo) < haceFalta; vuelta++) {
      lugar = lugar * 1.25 + 1;
      escala = escalaDe(aviso, ultimo + lugar);
    }
  }
  const { x } = escala;
  const xVencimiento = x(0);
  let gris = null;
  if (corte !== null) {
    const x0 = x(ultimo);
    const entra = X_FINAL - x0 >= anchoDe(textoGris, letra) + 2 * AIRE_DEL_GRIS;
    gris = { x0, x1: X_FINAL, texto: entra ? textoGris : '' };
  }

  // Las marcas: el aviso y el final de cada tramo. Las que caen a menos de 18 de la primera de su grupo se juntan en una, que lleva
  // todo lo que junta (`tipos`, en el orden de la cadena) y se dibuja como `tipo`
  const grupos = [];
  for (const hito of [{ tipo: 'aviso', x: x(aviso) }, ...cadena.map((t) => ({ tipo: t.hito, x: x(t.hasta) }))]) {
    const grupo = grupos[grupos.length - 1];
    if (grupo && hito.x - grupo.x < SEPARACION) grupo.tipos.push(hito.tipo);
    else grupos.push({ x: hito.x, tipos: [hito.tipo] });
  }
  const marcas = grupos.map((grupo) => ({ x: grupo.x, tipo: tipoDelGrupo(grupo.tipos), tipos: grupo.tipos }));

  const textoDelTramo = (t) => {
    const nombre = nombreDe(t.tramo);
    return nombre === '' ? cuanto(t.valor, dias) : `${nombre} · ${cuanto(t.valor, dias)}`;
  };
  // Un tramo de 0 días no tiene largo: no va entre los segmentos (lo dicen su marca y, si entra, su rótulo)
  const segmentos = cadena.filter((t) => t.valor > 0)
    .map((t) => ({ x0: x(t.desde), x1: x(t.hasta), texto: textoDelTramo(t), color: t.color }));

  // Lo que ya ocupa lugar: «vencimiento» y la línea del vencimiento, que cruza la fila de los tramos
  const ocupado = [
    cajaDe(xVencimiento, ALTURAS.vencimiento.texto, 'vencimiento', 'middle', letra),
    { x0: xVencimiento, x1: xVencimiento, y0: ALTURAS.vencimiento.desde, y1: ALTURAS.vencimiento.hasta }
  ];
  const libre = (caja) => adentro(caja) && !ocupado.some((otra) => seTocan(caja, otra));

  // Los números del eje, sin el 0. Con las cifras de siempre entran todos (con 8 o menos hay 117,5 entre uno y otro); uno que no
  // entraría en el dibujo o se pisaría (solo con números absurdos, de muchas cifras) no va
  const ticks = [];
  for (let i = 0; i <= (escala.max - escala.min) / escala.paso; i++) {
    const dia = escala.min + i * escala.paso;
    const tick = { x: x(dia), texto: dia > 0 ? `+${dia}` : `−${-dia}` };
    const caja = cajaDe(tick.x, ALTURAS.ticks, tick.texto, 'middle', letra);
    if (dia !== 0 && libre(caja)) {
      ticks.push(tick);
      ocupado.push(caja);
    }
  }

  // El rótulo del eje va abajo a la izquierda (a la derecha se pisaba con «vencimiento»), salvo que el vencimiento quede tan a la
  // izquierda que ahí se pise: entonces, a la derecha (los dos lados a la vez no pueden pisarse)
  const textoDelEje = `${unidadDe(2, dias)} respecto del vencimiento`;
  const eje = libre(cajaDe(X_INICIAL, ALTURAS.textoDelEje, textoDelEje, 'start', letra))
    ? { x: X_INICIAL, y: ALTURAS.textoDelEje, texto: textoDelEje, anclaje: 'start' }
    : { x: X_FINAL, y: ALTURAS.textoDelEje, texto: textoDelEje, anclaje: 'end' };
  ocupado.push(cajaDe(eje.x, eje.y, eje.texto, eje.anclaje, letra));
  if (gris?.texto) ocupado.push(cajaDe((gris.x0 + gris.x1) / 2, ALTURAS.textoDelGris, gris.texto, 'middle', letra));

  // Un rótulo va en el primero de sus lugares que esté libre; si no hay ninguno, no va
  const rotulos = [];
  const colocar = (texto, color, lugares) => {
    for (const lugar of lugares) {
      const caja = cajaDe(lugar.x, lugar.y, texto, lugar.anclaje, letra);
      if (libre(caja)) {
        ocupado.push(caja);
        rotulos.push({ x: lugar.x, y: lugar.y, texto, anclaje: lugar.anclaje, color });
        return;
      }
    }
  };
  // Al lado de una marca: a la derecha si entra en el dibujo y si no a la izquierda; en la fila de arriba y, si ahí se pisa, en la de
  // los tramos
  const alLadoDe = (xDeLaMarca, texto) => {
    const derecha = xDeLaMarca + DESPEGUE_DE_LA_MARCA + anchoDe(texto, letra) <= ANCHO - MARGEN;
    const lado = derecha
      ? { x: xDeLaMarca + DESPEGUE_DE_LA_MARCA, anclaje: 'start' }
      : { x: xDeLaMarca - DESPEGUE_DE_LA_MARCA, anclaje: 'end' };
    return [ALTURAS.filaDeArriba, ALTURAS.filaDeLosTramos].map((y) => ({ ...lado, y }));
  };
  // Sobre un tramo: centrado en la fila de los tramos (sin salir del dibujo); a un costado de la línea del vencimiento, con el centro
  // dentro del tramo; o centrado en la fila libre de arriba
  const sobreElTramo = (x0, x1, texto) => {
    const mitad = anchoDe(texto, letra) / 2;
    const centro = Math.min(Math.max((x0 + x1) / 2, MARGEN + mitad), ANCHO - MARGEN - mitad);
    const enElTramo = (c) => c >= x0 && c <= x1;
    const lugares = [{ x: centro, y: ALTURAS.filaDeLosTramos, anclaje: 'middle' }];
    if (enElTramo(xVencimiento - AIRE_DE_LA_LINEA - mitad)) {
      lugares.push({ x: xVencimiento - AIRE_DE_LA_LINEA, y: ALTURAS.filaDeLosTramos, anclaje: 'end' });
    }
    if (enElTramo(xVencimiento + AIRE_DE_LA_LINEA + mitad)) {
      lugares.push({ x: xVencimiento + AIRE_DE_LA_LINEA, y: ALTURAS.filaDeLosTramos, anclaje: 'start' });
    }
    lugares.push({ x: centro, y: ALTURAS.filaDeArriba, anclaje: 'middle' });
    return lugares;
  };

  // Primero los rótulos de las marcas (el del aviso y el de la carga, que pide la spec) y después los de los tramos, en orden
  const textoDelAviso = anticipacion === 0
    ? 'Aviso · el mismo día del vencimiento'
    : `Aviso · ${anticipacion} ${unidadDe(anticipacion, dias)} antes`;
  colocar(textoDelAviso, 'tinta', alLadoDe(x(aviso), textoDelAviso));
  const carga = cadena.find((t) => t.clave === 'carga');
  if (carga) {
    // El rótulo de la carga va al lado de la marca que la lleva y dice lo que esa marca junta: «Entrega y carga…» si también lleva la
    // entrega (con 0 días, siempre), aunque se dibuje como el aviso o la nota que caen ahí mismo
    const marca = marcas.find((m) => m.tipos.includes('carga'));
    const despues = `${carga.valor} ${unidadDe(carga.valor, dias)} después`;
    const texto = !marca.tipos.includes('datos') ? `Carga · ${despues}`
      : carga.valor === 0 ? 'Entrega y carga, el mismo día' : `Entrega y carga, ${despues}`;
    colocar(texto, 'verde', alLadoDe(marca.x, texto));
  }
  for (const t of cadena.filter((eslabon) => eslabon.clave !== 'carga')) {
    const texto = textoDelTramo(t);
    colocar(texto, t.color, sobreElTramo(x(t.desde), x(t.hasta), texto));
  }

  return {
    ancho: ANCHO,
    alto: ALTO,
    linea: { x0: X_INICIAL, x1: X_FINAL },
    ticks,
    banda: { x0: x(aviso), x1: xVencimiento },
    rayado: alcance > 0 ? { x0: xVencimiento, x1: x(alcance) } : null,
    gris,
    vencimiento: { x: xVencimiento },
    segmentos,
    marcas,
    rotulos,
    eje,
    aclaracion: ACLARACION[estadistico],
    alturas: ALTURAS
  };
};

// Las cintas de una vista (la de vistaDe con `estadistico` y `dias`): { externa, interna }, cada una la de cintaDeMetricas con el
// circuito de su gestión (null si no se dibuja). Así las guarda la foto (services/metricasFoto.js) y así las arma la API de métricas en
// vivo (controllers/metricasController.js), con la letra de la pantalla; el PDF las arma con la suya (`letra`, la de cintaDeMetricas),
// también en un año con foto, desde el circuito guardado. Nunca tira: sin vista, las dos null.
export const cintasDeLaVista = (vista, opciones) => {
  const { estadistico, dias, letra } = esObjeto(opciones) ? opciones : {};
  const circuito = esObjeto(vista) && esObjeto(vista.circuito) ? vista.circuito : {};
  return Object.fromEntries(GESTIONES.map((gestion) => [gestion, cintaDeMetricas(circuito[gestion], { gestion, dias, estadistico, letra })]));
};
