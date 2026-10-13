// Lectura de los PDF que arma PDFKit, para los tests: texto, posición y tamaño de cada línea, e imágenes de cada hoja.
// Los flujos de contenido de PDFKit vienen comprimidos (Flate) y el texto en hexadecimal (WinAnsi).
import zlib from 'node:zlib';

const texto = (pdf) => pdf.toString('latin1');

// (el TextDecoder de Node trata windows-1252 como latin1: se completa a mano el rango 0x80-0x9f)
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const winAnsi = (bytes) => bytes.toString('latin1').replace(/[\x80-\x9f]/g, c => CP1252[c.charCodeAt(0) - 0x80]);

// Flujo de contenido (descomprimido) de cada hoja, en el orden de las hojas
export const contenidoPorHoja = (pdf) => {
  const objetos = new Map();
  for (const m of texto(pdf).matchAll(/(\d+) 0 obj\r?\n([\s\S]*?)endobj/g)) objetos.set(Number(m[1]), m[2]);
  const raiz = [...objetos.values()].find(cuerpo => /\/Type \/Pages/.test(cuerpo));
  const hojas = [...raiz.match(/\/Kids \[([^\]]*)\]/)[1].matchAll(/(\d+) 0 R/g)].map(m => Number(m[1]));
  return hojas.map(id => {
    const flujo = objetos.get(Number(objetos.get(id).match(/\/Contents (\d+) 0 R/)[1]));
    const inicio = flujo.match(/stream\r?\n/);
    const datos = flujo.substr(inicio.index + inicio[0].length, Number(flujo.match(/\/Length (\d+)/)[1]));
    return zlib.inflateSync(Buffer.from(datos, 'latin1')).toString('latin1');
  });
};

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

// Imágenes dibujadas en cada hoja: { nombre, x, y, ancho, alto }, con y medida desde el borde superior.
// PDFKit dibuja una imagen con "ancho 0 0 -alto x y+alto cm /I1 Do" sobre su sistema con origen arriba a la izquierda.
export const imagenesPorHoja = (pdf) => contenidoPorHoja(pdf).map(contenido =>
  [...contenido.matchAll(/(-?[\d.]+) 0 0 (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm\s+\/(\w+) Do/g)].map(([, a, d, e, f, nombre]) => ({
    nombre, x: Number(e), y: Number(f) + Number(d), ancho: Number(a), alto: -Number(d)
  })));

// Imágenes guardadas en el archivo: { ancho, alto } en píxeles de cada XObject de imagen (una imagen dibujada en
// varias hojas se guarda una vez; un PNG con transparencia suma otra para su máscara, del mismo tamaño)
export const imagenesGuardadas = (pdf) => [...texto(pdf).matchAll(/\d+ 0 obj\r?\n([\s\S]*?)(?:stream|endobj)/g)]
  .map(([, diccionario]) => diccionario)
  .filter(diccionario => /\/Subtype \/Image\b/.test(diccionario))
  .map(diccionario => ({ ancho: Number(diccionario.match(/\/Width (\d+)/)[1]), alto: Number(diccionario.match(/\/Height (\d+)/)[1]) }));
