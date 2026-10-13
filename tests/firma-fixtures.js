// Imágenes para los tests (firma y banner del membrete): PNG y JPEG armados byte a byte, sanos o dañados.
// Nunca se versionan las imágenes institucionales reales: estas se generan en cada test.
import zlib from 'node:zlib';

const crc32 = (datos) => {
  let crc = 0xffffffff;
  for (const byte of datos) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const bloque = (tipo, contenido) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(contenido.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), contenido]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
};

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Filas sin comprimir de un PNG RGBA 8 bits: un byte de filtro por fila y 4 bytes por píxel
const filasRgba = (ancho, alto, filtro = 0) => Buffer.concat(Array.from({ length: alto }, (_, y) => {
  const fila = Buffer.alloc(1 + ancho * 4);
  fila[0] = filtro;
  for (let i = 1; i < fila.length; i++) fila[i] = (y * 13 + i * 7) % 256;
  return fila;
}));

// Pasadas del entrelazado Adam7 (x0, y0, dx, dy)
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
const filasEntrelazadas = (ancho, alto) => Buffer.concat(ADAM7.map(([x0, y0, dx, dy]) => {
  const w = Math.ceil((ancho - x0) / dx);
  const h = Math.ceil((alto - y0) / dy);
  return w > 0 && h > 0 ? filasRgba(w, h) : Buffer.alloc(0);
}));

// PNG RGBA (tipo de color 6) como el de una firma escaneada con fondo transparente.
// idat permite reemplazar los datos comprimidos para armar imágenes dañadas con bloques bien formados.
export const pngRgba = ({ ancho = 40, alto = 20, entrelazado = false, idat } = {}) => {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 6; // RGBA
  cabecera[12] = entrelazado ? 1 : 0;
  const crudo = entrelazado ? filasEntrelazadas(ancho, alto) : filasRgba(ancho, alto);
  return Buffer.concat([
    FIRMA_PNG,
    bloque('IHDR', cabecera),
    bloque('IDAT', idat ?? zlib.deflateSync(crudo)),
    bloque('IEND', Buffer.alloc(0))
  ]);
};

// PNG RGB (tipo de color 2, sin transparencia), como un banner exportado de Word: PDFKit lo guarda sin decodificarlo
export const pngRgb = ({ ancho = 40, alto = 20 } = {}) => {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  const crudo = Buffer.concat(Array.from({ length: alto }, (_, y) => {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let i = 1; i < fila.length; i++) fila[i] = (y * 5 + i * 3) % 256;
    return fila;
  }));
  return Buffer.concat([
    FIRMA_PNG,
    bloque('IHDR', cabecera),
    bloque('IDAT', zlib.deflateSync(crudo)),
    bloque('IEND', Buffer.alloc(0))
  ]);
};

// PNG RGBA con la cabecera válida pero los datos de la imagen dañados (cada uno tumbaba el proceso al generar el PDF)
export const pngsDanados = () => {
  const comprimido = zlib.deflateSync(filasRgba(40, 20));
  const cabeceraZlibRota = Buffer.from(comprimido);
  cabeceraZlibRota[0] = 0x00;
  cabeceraZlibRota[1] = 0x00;
  const sumaRota = Buffer.from(comprimido);
  sumaRota[sumaRota.length - 1] ^= 0xff;
  const completo = pngRgba();
  return {
    'IDAT con la cabecera zlib rota': pngRgba({ idat: cabeceraZlibRota }),
    'IDAT truncado': pngRgba({ idat: comprimido.subarray(0, Math.floor(comprimido.length / 2)) }),
    'IDAT con la suma de control rota': pngRgba({ idat: sumaRota }),
    'filtro de fila inválido': pngRgba({ idat: zlib.deflateSync(filasRgba(40, 20, 9)) }),
    'archivo cortado a la mitad': completo.subarray(0, Math.floor(completo.length / 2))
  };
};

// JPEG en escala de grises de 1x1 píxel: SOI, JFIF, tabla de cuantización, SOF0, tablas Huffman, SOS, un bloque y EOI
export const jpegMinimo = () => Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]), Buffer.alloc(64, 1),
  Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00]),
  Buffer.from([0xff, 0xc4, 0x00, 0x14, 0x00, 0x01]), Buffer.alloc(15), Buffer.from([0x00]),
  Buffer.from([0xff, 0xc4, 0x00, 0x14, 0x10, 0x01]), Buffer.alloc(15), Buffer.from([0x00]),
  Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
  Buffer.from([0x3f]),
  Buffer.from([0xff, 0xd9])
]);
