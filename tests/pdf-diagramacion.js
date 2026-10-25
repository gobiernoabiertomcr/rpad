// Diagramación de los PDF A4 que dibuja DocumentoNota (el anexo de los avisos, la hoja del Seguimiento y los reportes), para los
// tests: dónde cae cada texto, cada recuadro y cada línea fina, y que nada se pise. Antes había una copia en notas-anexo.test.js y
// otra en seguimiento-pdf.test.js (iguales salvo cómo se dibujaba): las dos usan esta.
import assert from 'node:assert/strict';
import { DocumentoNota } from '../services/notasDigitalesPdf.js';

const MM = 72 / 25.4;

// Diagramación de las hojas que dibuja `render` (una función async que arma el PDF), tomada de las llamadas a DocumentoNota
// mientras se dibuja:
// - textos: el rectángulo de cada texto, con la fuente, el tamaño y las opciones vigentes. El alto es el del ojo de
//   la letra (de la línea de ascendentes a la de descendentes), sin el interlineado de la última línea. Cada uno lleva
//   también el nombre de su fuente y su tamaño.
// - bloques: los rectángulos redondeados (en el anexo: estado, datos solicitados, tarjeta del QR, descripción, observaciones y
//   contacto; en el Seguimiento: la tarjeta del QR, los nodos del circuito y la línea del email al área; en los reportes: la
//   píldora, las tarjetas y las insignias de estado).
// - lineas: las líneas finas (rectángulos de hasta 1 punto de alto y 50 o más de ancho: encabezado, ficha, tablas, pie).
// - acentos: los filetes verticales del acento en el borde izquierdo (en el anexo, el del recuadro destacado, la descripción, y
//   el de los datos solicitados; el Seguimiento no tiene).
// Cada uno: { hoja, texto, x0, y0, x1, y1 }, con y desde el borde superior.
export const diagramacion = async (render) => {
  const textos = [];
  const bloques = [];
  const lineas = [];
  const acentos = [];
  const hojas = [];
  const indice = (hoja) => {
    if (!hojas.includes(hoja)) hojas.push(hoja);
    return hojas.indexOf(hoja);
  };
  const original = DocumentoNota.prototype.text;
  // rect y roundedRect son de PDFKit (DocumentoNota no los redefine): se tapan en DocumentoNota y después se quitan
  const { rect, roundedRect } = DocumentoNota.prototype;
  DocumentoNota.prototype.roundedRect = function (x, y, ancho, alto, radio) {
    bloques.push({ hoja: indice(this.page), texto: `bloque ${bloques.length}`, x0: x, y0: y, x1: x + ancho, y1: y + alto });
    return roundedRect.call(this, x, y, ancho, alto, radio);
  };
  DocumentoNota.prototype.rect = function (x, y, ancho, alto) {
    if (alto <= 1 && ancho >= 50) lineas.push({ hoja: indice(this.page), texto: `línea ${lineas.length}`, x0: x, y0: y, x1: x + ancho, y1: y + alto });
    // Filete vertical del acento, en el borde izquierdo del recuadro destacado
    if (ancho <= 5 && alto >= 20 && Math.abs(x - 15 * MM) < 0.1) acentos.push({ hoja: indice(this.page), texto: 'acento', x0: x, y0: y, x1: x + ancho, y1: y + alto });
    return rect.call(this, x, y, ancho, alto);
  };
  DocumentoNota.prototype.text = function (texto, x, y, opciones = {}) {
    const conInterlineado = this.currentLineHeight(true) + (opciones.lineGap ?? 0);
    let lineas = 1;
    let ancho = this.widthOfString(String(texto), opciones);
    let x0 = x;
    if (opciones.width) {
      lineas = Math.round(this.heightOfString(String(texto), opciones) / conInterlineado);
      // Con alto máximo, PDFKit escribe las líneas que entran (al menos una)
      if (opciones.height != null) lineas = Math.min(lineas, Math.max(1, Math.floor(opciones.height / conInterlineado + 1e-6)));
      if (lineas > 1) ancho = opciones.width;
      else if (opciones.align === 'right') x0 = x + opciones.width - ancho;
      else if (opciones.align === 'center') x0 = x + (opciones.width - ancho) / 2;
    }
    textos.push({
      hoja: indice(this.page), texto: String(texto), fuente: this._font.name, tamano: this._fontSize, x0, y0: y, x1: x0 + ancho,
      y1: y + (lineas - 1) * conInterlineado + this.currentLineHeight(false)
    });
    return original.call(this, texto, x, y, opciones);
  };
  try {
    await render();
  } finally {
    DocumentoNota.prototype.text = original;
    delete DocumentoNota.prototype.roundedRect;
    delete DocumentoNota.prototype.rect;
  }
  return { textos, bloques, lineas, acentos };
};

export const seCruzan = (a, b) => a.x0 < b.x1 - 0.1 && b.x0 < a.x1 - 0.1 && a.y0 < b.y1 - 0.1 && b.y0 < a.y1 - 0.1;
export const contiene = (a, b) => b.x0 >= a.x0 - 0.01 && b.x1 <= a.x1 + 0.01 && b.y0 >= a.y0 - 0.01 && b.y1 <= a.y1 + 0.01;
export const nombre = (c) => `"${c.texto.slice(0, 40)}" (${[c.x0, c.y0, c.x1, c.y1].map(v => v.toFixed(1)).join(', ')})`;

// Textos, bloques y líneas dentro de los márgenes de 15 mm de la hoja A4; ningún texto encima de otro ni bloques encimados; cada
// texto, dentro de un bloque o fuera de él (ninguno cruza un borde); y ninguna línea fina cruza un texto o un bloque
export const verificarDiagramacion = ({ textos, bloques, lineas }) => {
  for (const c of [...textos, ...bloques, ...lineas]) {
    assert.ok(c.x0 >= 15 * MM - 0.01 && c.x1 <= 195 * MM + 0.01, `${nombre(c)} sale de los márgenes laterales`);
    assert.ok(c.y0 >= 15 * MM - 0.01 && c.y1 <= 282 * MM + 0.01, `${nombre(c)} sale de los márgenes superior o inferior`);
  }
  const deLaMismaHoja = (lista, otra = lista) => lista.flatMap((a, i) => otra.slice(otra === lista ? i + 1 : 0)
    .filter(b => a.hoja === b.hoja).map(b => [a, b]));
  for (const [a, b] of deLaMismaHoja(textos)) assert.ok(!seCruzan(a, b), `se superponen ${nombre(a)} y ${nombre(b)}`);
  for (const [a, b] of deLaMismaHoja(bloques)) assert.ok(!seCruzan(a, b), `se superponen ${nombre(a)} y ${nombre(b)}`);
  for (const [bloque, texto] of deLaMismaHoja(bloques, textos)) {
    assert.ok(contiene(bloque, texto) || !seCruzan(bloque, texto), `${nombre(texto)} cruza el borde de ${nombre(bloque)}`);
  }
  for (const [linea, otro] of deLaMismaHoja(lineas, [...textos, ...bloques])) assert.ok(!seCruzan(linea, otro), `${nombre(linea)} cruza ${nombre(otro)}`);
};
