// Lectura de los PDF que arma PDFKit, para los tests: texto, posición y tamaño de cada línea, e imágenes de cada hoja.
// Los flujos de contenido de PDFKit vienen comprimidos (Flate) y el texto en hexadecimal (WinAnsi).
import zlib from 'node:zlib';

const texto = (pdf) => pdf.toString('latin1');

// (el TextDecoder de Node trata windows-1252 como latin1: se completa a mano el rango 0x80-0x9f)
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const winAnsi = (bytes) => bytes.toString('latin1').replace(/[\x80-\x9f]/g, c => CP1252[c.charCodeAt(0) - 0x80]);

// Cada hoja, en orden: su flujo de contenido (descomprimido) y su alto en puntos
const hojasDelPdf = (pdf) => {
  const objetos = new Map();
  for (const m of texto(pdf).matchAll(/(\d+) 0 obj\r?\n([\s\S]*?)endobj/g)) objetos.set(Number(m[1]), m[2]);
  const raiz = [...objetos.values()].find(cuerpo => /\/Type \/Pages/.test(cuerpo));
  const hojas = [...raiz.match(/\/Kids \[([^\]]*)\]/)[1].matchAll(/(\d+) 0 R/g)].map(m => Number(m[1]));
  return hojas.map(id => {
    const hoja = objetos.get(id);
    const flujo = objetos.get(Number(hoja.match(/\/Contents (\d+) 0 R/)[1]));
    const inicio = flujo.match(/stream\r?\n/);
    const datos = flujo.substr(inicio.index + inicio[0].length, Number(flujo.match(/\/Length (\d+)/)[1]));
    return {
      contenido: zlib.inflateSync(Buffer.from(datos, 'latin1')).toString('latin1'),
      alto: Number(hoja.match(/\/MediaBox \[\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s*\]/)[1])
    };
  });
};

// Flujo de contenido (descomprimido) de cada hoja, en el orden de las hojas
export const contenidoPorHoja = (pdf) => hojasDelPdf(pdf).map(hoja => hoja.contenido);

// Texto de un operador TJ. En el texto justificado PDFKit no escribe los espacios: los reemplaza por ajustes
// negativos grandes (más de 250 milésimas de em). El interletrado normal (kerning) es de unas pocas decenas.
const textoDeTj = (contenido) => [...contenido.matchAll(/<([0-9a-f]*)>|(-?\d+(?:\.\d+)?)/gi)]
  .map(([, hex, ajuste]) => hex !== undefined ? winAnsi(Buffer.from(hex, 'hex')) : (Number(ajuste) < -150 ? ' ' : ''))
  .join('').replace(/\s+/g, ' ').trim();

// Cada línea de texto de cada hoja, en el orden en que se dibujó: { texto, x, base, tamano }.
// base: altura de la línea de base medida desde el borde inferior de la hoja (en puntos).
export const textosPorHoja = (pdf) => contenidoPorHoja(pdf).map(contenido =>
  [...contenido.matchAll(/BT\s([\s\S]*?)\sET/g)].flatMap(([, bloque]) => {
    const posicion = bloque.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/);
    const fuente = bloque.match(/\/\w+ (-?[\d.]+) Tf/);
    return [...bloque.matchAll(/\[([^\]]*)\]\s*TJ/g)].map(tj => ({
      texto: textoDeTj(tj[1]), x: Number(posicion[1]), base: Number(posicion[2]), tamano: Number(fuente[1])
    }));
  }));

// Texto de cada hoja: las líneas (operadores TJ) en el orden en que se dibujaron
export const lineasPorHoja = (pdf) => textosPorHoja(pdf).map(textos => textos.map(t => t.texto));

// Producto de matrices afines de PDF [a b c d e f]: primero m, después n (como "cm" encadena la matriz actual)
const componer = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [
  a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F
];

// Imágenes dibujadas en cada hoja: { nombre, x, y, ancho, alto }, el rectángulo que ocupan en la hoja (también si
// PDFKit las gira por la orientación EXIF), con x e y medidas desde el borde izquierdo y el superior.
// Sigue las matrices "cm" y el apilado q/Q del flujo hasta cada "/I1 Do", que dibuja el cuadrado unitario.
export const imagenesPorHoja = (pdf) => hojasDelPdf(pdf).map(({ contenido, alto: altoHoja }) => {
  const imagenes = [];
  const pila = [];
  let actual = [1, 0, 0, 1, 0, 0];
  const operadores = /(?:^|\s)(q|Q)(?=\s|$)|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm|\/(\w+) Do/g;
  for (const [, apilado, a, b, c, d, e, f, nombre] of contenido.matchAll(operadores)) {
    if (apilado === 'q') pila.push(actual);
    else if (apilado === 'Q') actual = pila.pop();
    else if (nombre) {
      const [ma, mb, mc, md, me, mf] = actual;
      const esquinas = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [ma * x + mc * y + me, mb * x + md * y + mf]);
      const xs = esquinas.map(p => p[0]);
      const ys = esquinas.map(p => p[1]);
      imagenes.push({
        nombre, x: Math.min(...xs), y: altoHoja - Math.max(...ys),
        ancho: Math.max(...xs) - Math.min(...xs), alto: Math.max(...ys) - Math.min(...ys)
      });
    } else {
      actual = componer([a, b, c, d, e, f].map(Number), actual);
    }
  }
  return imagenes;
});

// Imágenes guardadas en el archivo: { ancho, alto } en píxeles de cada XObject de imagen (una imagen dibujada en
// varias hojas se guarda una vez; un PNG con transparencia suma otra para su máscara, del mismo tamaño)
export const imagenesGuardadas = (pdf) => [...texto(pdf).matchAll(/\d+ 0 obj\r?\n([\s\S]*?)(?:stream|endobj)/g)]
  .map(([, diccionario]) => diccionario)
  .filter(diccionario => /\/Subtype \/Image\b/.test(diccionario))
  .map(diccionario => ({ ancho: Number(diccionario.match(/\/Width (\d+)/)[1]), alto: Number(diccionario.match(/\/Height (\d+)/)[1]) }));
