/**
 * Generador de Notas (spec 2026-10-24-generador-de-notas, sección 4.1): el Word (.docx) en la hoja membretada, a partir de los
 * bloques de `services/notasGeneradorContenido.js` (ver su JSDoc: Parte, Celda, Fila y Bloque). Lo usan la nota de la DGMIT y
 * la Nota Digital en Word (spec, sección 6).
 *
 * La hoja: oficio Legal de 8½ × 14″ (la misma `PAGINA` de 612 × 1008 pt del PDF de las Notas Digitales), con los márgenes de
 * la hoja membretada. En el encabezado, el membrete a todo el ancho, anclado a la hoja en (0, 0), y la marca de agua (el
 * isotipo aclarado) centrada y detrás del texto: las dos van en el encabezado, así salen en todas las hojas. En el pie, el
 * texto del membrete y "Página X de Y". Arial 12 en el cuerpo; las partes con letra, las celdas y las tablas, en la suya.
 *
 * Las medidas de la hoja, de los párrafos y de las tablas van en twips (20 por punto, 1440 por pulgada), y las de las
 * imágenes en píxeles a 96 ppp, como las pide la librería `docx` (8.5.0).
 */
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, TableLayoutType, HeightRule, PageNumber,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, HorizontalPositionAlign, VerticalPositionAlign, TextWrappingType
} from 'docx';
import { LETRA, ESPACIO } from './notasGeneradorContenido.js';
import { validarImagenMembrete } from './notasDigitalesPdf.js';
import { obtenerConfig } from './notasDigitalesDatos.js';

// La hoja, en twips: oficio Legal de 8½ × 14″ y los márgenes de la hoja membretada (3 cm a los costados, 3,5 arriba y 2,5
// abajo; el encabezado pegado al borde y el pie a 1,25 cm)
export const HOJA = Object.freeze({ ancho: 12240, alto: 20160, arriba: 1985, costados: 1701, abajo: 1417, encabezado: 0, pie: 708 });
// El ancho del texto: 8838 twips
const ANCHO_UTIL = HOJA.ancho - 2 * HOJA.costados;
// Las imágenes, en píxeles a 96 ppp (15 twips o 9525 EMU por píxel): el membrete, el ancho de la hoja (8½″) y, como mucho,
// el alto del margen de arriba (132 px); la marca de agua, unos 13 cm de lado
const TWIPS_POR_PX = 15;
const EMU_POR_PX = 9525;
const ANCHO_HOJA_PX = HOJA.ancho / TWIPS_POR_PX;
const ALTO_MAXIMO_MEMBRETE_PX = Math.floor(HOJA.arriba / TWIPS_POR_PX);
const LADO_MARCA_PX = 500;
// El espacio en blanco para firmar a mano: una pulgada
const ALTO_FIRMA = 1440;
// La letra del pie: Arial de 8 pt. Va en un estilo de párrafo y no en los runs: LibreOffice no les aplica la letra del run a
// los números de página (los campos) y, con la letra solo en el run, los dibuja en la letra por defecto (12 pt)
const ESTILO_PIE = 'PieRpad';
const LETRA_PIE = 16;

const ALINEACION = {
  izquierda: AlignmentType.LEFT, derecha: AlignmentType.RIGHT, centro: AlignmentType.CENTER, justificado: AlignmentType.JUSTIFIED
};
// Los bordes de la tabla: simples, finos (size en octavos de punto: 4 = ½ pt) y negros; la de las dos firmas, sin bordes
const BORDE = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: 'auto' };
const bordes = (borde) => ({ top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde });
const GRIS = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' };
const MARGEN_CELDA = { top: 60, bottom: 60, left: 100, right: 100 };
// Tablas con sinPartirPalabras (las de la Nota Digital en Word), como calcularAnchos del PDF de las Notas Digitales: la primera
// columna puede partir una palabra de más de 55 pt (MINIMO_TITULO del PDF), y cada mínimo suma 3 pt de holgura (probado con
// LibreOffice: con 1 pt, como el PDF, partía "Trimestralmente" en 8,5 y en 10 pt; con 2 pt ya no partía ninguna)
const MINIMO_TITULO = 1100;
const HOLGURA = 60;

// ---------------------------------------------------------------------------------------------------------------------------
// La marca de agua: el isotipo de Comodoro Rivadavia aclarado al 20 %, que se lee del disco una sola vez
// ---------------------------------------------------------------------------------------------------------------------------

const RUTA_MARCA = new URL('../public/img/membrete-isotipo-aclarado.png', import.meta.url);
let marcaDeAgua = null;
// Si la lectura falla, se vuelve a intentar en el próximo Word
const leerMarcaDeAgua = () => {
  marcaDeAgua ??= fs.promises.readFile(RUTA_MARCA).catch((error) => {
    marcaDeAgua = null;
    throw error;
  });
  return marcaDeAgua;
};

// ---------------------------------------------------------------------------------------------------------------------------
// Los bloques
// ---------------------------------------------------------------------------------------------------------------------------

// El texto como lo admite el XML del Word: docx (8.5.0) escribe tal cual en <w:t> los caracteres de control, U+FFFE, U+FFFF y los
// surrogates solos, y con ellos Word dice que el archivo está dañado. Los surrogates solos pasan a U+FFFD (el carácter de
// reemplazo) y los demás se quitan; el tab y los saltos de línea quedan, porque el XML los admite. Pasa por acá todo texto
// variable del Word: las partes de los bloques y el pie
const NO_ADMITIDOS_EN_EL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\ufffe\uffff]/g;
export const textoParaWord = (texto) => String(texto ?? '').toWellFormed().replace(NO_ADMITIDOS_EN_EL_XML, '');

// Una parte, en la letra `base` (medios puntos) si no trae la suya
const run = (parte, base) => new TextRun({
  text: textoParaWord(parte.texto),
  bold: parte.negrita ? true : undefined,
  italics: parte.cursiva ? true : undefined,
  underline: parte.subrayado ? {} : undefined,
  size: parte.letra ?? base,
  break: parte.salto ? 1 : undefined
});
const runs = (partes, base = LETRA.cuerpo) => partes.map(p => run(p, base));

const sumar = (lista) => lista.reduce((suma, n) => suma + n, 0);

// Anchos en twips que suman el ancho útil: cada uno, para abajo, y lo que sobra del redondeo va a la última columna (un ancho
// que la cuenta deja en 3758,9999… es 3759)
const enTwipsEnteros = (anchos) => {
  const columnas = anchos.map(a => Math.floor(a + 1e-6));
  columnas[columnas.length - 1] += ANCHO_UTIL - sumar(columnas);
  return columnas;
};

// Las proporciones de las columnas, en twips que suman el ancho útil
const anchosEnTwips = (anchos) => {
  const total = sumar(anchos);
  return enTwipsEnteros(anchos.map(a => (a * ANCHO_UTIL) / total));
};

// ---------------------------------------------------------------------------------------------------------------------------
// sinPartirPalabras: las columnas, como las del PDF de las Notas Digitales (calcularAnchos de notasDigitalesPdf.js)
// ---------------------------------------------------------------------------------------------------------------------------

// Las palabras se miden con la Helvetica de PDFKit, que tiene las mismas medidas que Arial, en un documento que nunca se escribe
let medidor = null;
const twipsDePalabra = (palabra, negrita, letra) => {
  medidor ??= new PDFDocument({ autoFirstPage: false });
  return medidor.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(letra / 2).widthOfString(palabra) * 20;
};

// La palabra más ancha de una celda, en twips, cada parte con su letra y su negrita (las palabras van separadas por espacios
// comunes: un espacio duro no corta)
const palabraMasAncha = (celda, letraDeLaTabla) => Math.max(0, ...celda.partes.flatMap(parte => String(parte.texto ?? '')
  .split(/[ \t\r\n\f]+/)
  .filter(Boolean)
  .map(palabra => twipsDePalabra(palabra, parte.negrita === true, parte.letra ?? celda.letra ?? letraDeLaTabla))));

// La palabra más ancha de cada columna, en twips, en las filas de títulos (encabezado) o en las demás. Una celda que abarca
// varias columnas no cuenta
const palabrasPorColumna = (bloque, deEncabezado) => {
  const palabras = bloque.anchos.map(() => 0);
  const letra = bloque.letra ?? LETRA.cuerpo;
  for (const fila of bloque.filas.filter(f => (f.encabezado === true) === deEncabezado)) {
    let columna = 0;
    for (const celda of fila.celdas) {
      const abarca = Math.max(1, celda.abarca ?? 1);
      if (abarca === 1 && columna < palabras.length) palabras[columna] = Math.max(palabras[columna], palabraMasAncha(celda, letra));
      columna += abarca;
    }
  }
  return palabras;
};

// Ancho de cada columna, en twips: la proporción, ampliada lo justo para que su palabra más ancha entre con los márgenes de la
// celda (la primera, como mucho hasta MINIMO_TITULO), y recortada, en proporción, de las columnas con holgura. Si los mínimos no
// entran, la primera cede hasta su título y las demás se reparten lo que queda en proporción a su mínimo
const anchosSinPartir = (bloque, margen) => {
  const encabezado = palabrasPorColumna(bloque, true);
  const cuerpo = palabrasPorColumna(bloque, false);
  const total = sumar(bloque.anchos);
  const base = bloque.anchos.map(a => (a * ANCHO_UTIL) / total);
  const minimos = base.map((_, i) => {
    const palabra = Math.max(encabezado[i], cuerpo[i]);
    return Math.ceil(i === 0 ? Math.min(palabra, MINIMO_TITULO) : palabra) + 2 * margen + HOLGURA;
  });
  const otras = sumar(minimos.slice(1));
  if (minimos[0] + otras > ANCHO_UTIL) {
    const titulo = Math.max(Math.ceil(encabezado[0]) + 2 * margen + HOLGURA, ANCHO_UTIL - otras);
    return [titulo, ...minimos.slice(1).map(m => m * Math.min(1, (ANCHO_UTIL - titulo) / otras))];
  }
  const anchos = base.map((a, i) => Math.max(a, minimos[i]));
  const exceso = sumar(anchos) - ANCHO_UTIL;
  if (exceso <= 0) return anchos;
  const holguras = anchos.map((a, i) => a - minimos[i]);
  const totalHolgura = sumar(holguras);
  return anchos.map((a, i) => a - (exceso * holguras[i]) / totalHolgura);
};

// conLaSiguiente: el párrafo va en la misma hoja que lo que sigue (keepNext; Word lo respeta, LibreOffice no en las tablas).
// letra y margen: los de la tabla
const celdaDocx = (celda, ancho, conLaSiguiente, { letra, margen }) => new TableCell({
  width: { size: ancho, type: WidthType.DXA },
  columnSpan: celda.abarca > 1 ? celda.abarca : undefined,
  shading: celda.fondo === 'gris' ? GRIS : undefined,
  margins: { ...MARGEN_CELDA, left: margen, right: margen },
  children: [new Paragraph({ keepNext: conLaSiguiente || undefined, children: runs(celda.partes, celda.letra ?? letra) })]
});

// Una fila: cada celda, con el ancho de las columnas que abarca. La fila de títulos se repite arriba de cada hoja y ninguna
// fila se parte entre dos hojas. Una fila con la siguiente (keepNext en todos sus párrafos) no queda al pie de una hoja con
// la siguiente arriba de la otra
const filaDocx = (fila, columnas, conLaSiguiente, deLaTabla) => {
  let desde = 0;
  const celdas = fila.celdas.map((celda) => {
    const hasta = desde + Math.max(1, celda.abarca ?? 1);
    const ancho = sumar(columnas.slice(desde, hasta));
    desde = hasta;
    return celdaDocx(celda, ancho, conLaSiguiente, deLaTabla);
  });
  return new TableRow({ tableHeader: fila.encabezado === true || undefined, cantSplit: true, children: celdas });
};

// conLaSiguiente: la última fila va con lo que sigue a la tabla (la firma)
const tablaDocx = (bloque, conLaSiguiente) => {
  const deLaTabla = { letra: bloque.letra ?? LETRA.cuerpo, margen: bloque.margen ?? MARGEN_CELDA.left };
  const columnas = bloque.sinPartirPalabras === true
    ? enTwipsEnteros(anchosSinPartir(bloque, deLaTabla.margen))
    : anchosEnTwips(bloque.anchos);
  const ultima = bloque.filas.length - 1;
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    borders: bordes(BORDE),
    rows: bloque.filas.map((fila, i) => filaDocx(fila, columnas, fila.conLaSiguiente === true || (conLaSiguiente && i === ultima), deLaTabla))
  });
};

// El espacio en blanco para firmar a mano. Dos firmas van lado a lado, en una tabla sin bordes de dos celdas vacías.
// conLaSiguiente: va con lo que la sigue (la leyenda o la línea CC de una Nota Digital)
const firmaDocx = (bloque, conLaSiguiente) => {
  if (bloque.columnas !== 2) return new Paragraph({ spacing: { before: ALTO_FIRMA }, keepNext: conLaSiguiente || undefined, children: [] });
  const mitad = Math.floor(ANCHO_UTIL / 2);
  const columnas = [mitad, ANCHO_UTIL - mitad];
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    borders: bordes(SIN_BORDE),
    rows: [new TableRow({
      height: { value: ALTO_FIRMA, rule: HeightRule.ATLEAST },
      children: columnas.map(ancho => new TableCell({
        width: { size: ancho, type: WidthType.DXA }, children: [new Paragraph({ keepNext: conLaSiguiente || undefined, children: [] })]
      }))
    })]
  });
};

// LibreOffice dibuja los números de página del pie (campos sin un valor guardado) con la letra del último run del cuerpo: si
// el cuerpo termina en un párrafo con texto (una leyenda en cursiva, la línea CC), los números salen en esa letra y no en la
// del pie. El último párrafo del cuerpo termina por eso en un run vacío y sin formato, que en Word no se ve
const runsDelFinal = (ultimo) => (ultimo ? [new TextRun('')] : []);

// Cada bloque, en uno o más elementos del cuerpo del Word. `ultimo`: es el último bloque del cuerpo. `conLaSiguiente`: el
// último párrafo de este bloque va en la misma hoja que el bloque siguiente (keepNext). El cierre va junto: el bloque anterior
// a la firma (el remitente), la firma y lo que la sigue (en una Nota Digital, la leyenda de las dos firmas y la línea CC),
// como en el PDF de las Notas Digitales
const DOCX_DE_BLOQUE = {
  parrafo: (b, { ultimo, conLaSiguiente }) => [new Paragraph({
    alignment: ALINEACION[b.alinear] ?? AlignmentType.LEFT,
    spacing: { before: b.antes ?? 0, after: b.despues ?? 0 },
    keepNext: conLaSiguiente || undefined,
    children: [...runs(b.partes), ...runsDelFinal(ultimo)]
  })],
  tabla: (b, { conLaSiguiente }) => [tablaDocx(b, conLaSiguiente)],
  // Un párrafo con viñeta por ítem; el último deja debajo el espacio de un párrafo del cuerpo
  lista: (b, { ultimo, conLaSiguiente }) => b.items.map((partes, i) => {
    const ultimoItem = i === b.items.length - 1;
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: ultimoItem ? ESPACIO.parrafo : 0 },
      keepNext: (conLaSiguiente && ultimoItem) || undefined,
      children: [...runs(partes), ...runsDelFinal(ultimo && ultimoItem)]
    });
  }),
  firma: (b, { conLaSiguiente }) => [firmaDocx(b, conLaSiguiente)]
};

// firma: dónde está la (primera) firma; -1, sin firma
const docxDeBloque = (bloque, i, bloques, firma) => {
  const convertir = DOCX_DE_BLOQUE[bloque?.tipo];
  if (!convertir) throw new Error(`Bloque desconocido en el Word: ${bloque?.tipo}`);
  const ultimo = i === bloques.length - 1;
  return convertir(bloque, { ultimo, conLaSiguiente: !ultimo && firma >= 0 && i >= firma - 1 });
};

// ---------------------------------------------------------------------------------------------------------------------------
// La hoja: encabezado y pie
// ---------------------------------------------------------------------------------------------------------------------------

// El tamaño del membrete en píxeles y su posición horizontal en EMU: a todo el ancho de la hoja si así entra en el margen de
// arriba (el membrete de la hoja membretada, 1241 × 178, mide 117 px de alto); si no, del alto del margen, con su proporción
// y centrado
const medidasDelMembrete = ({ ancho, alto }) => {
  const altoATodoElAncho = Math.round((alto * ANCHO_HOJA_PX) / ancho);
  if (altoATodoElAncho <= ALTO_MAXIMO_MEMBRETE_PX) return { ancho: ANCHO_HOJA_PX, alto: altoATodoElAncho, x: 0 };
  const anchoAchicado = Math.max(1, Math.round((ancho * ALTO_MAXIMO_MEMBRETE_PX) / alto));
  return { ancho: anchoAchicado, alto: ALTO_MAXIMO_MEMBRETE_PX, x: Math.round(((ANCHO_HOJA_PX - anchoAchicado) / 2) * EMU_POR_PX) };
};

// El membrete: flotante, anclado al borde de arriba de la hoja y delante del texto, que no lo tapa: nunca pasa el margen
const imagenDelMembrete = ({ datos, ...tamano }) => {
  const medidas = medidasDelMembrete(tamano);
  return new ImageRun({
    data: datos,
    transformation: { width: medidas.ancho, height: medidas.alto },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: medidas.x },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
      wrap: { type: TextWrappingType.NONE },
      allowOverlap: true,
      behindDocument: false
    },
    altText: { name: 'Membrete', title: 'Membrete', description: 'Membrete de la Municipalidad de Comodoro Rivadavia' }
  });
};

// La marca de agua: flotante, centrada en la hoja en los dos ejes y detrás del texto
const imagenDeLaMarca = (datos) => new ImageRun({
  data: datos,
  transformation: { width: LADO_MARCA_PX, height: LADO_MARCA_PX },
  floating: {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
    wrap: { type: TextWrappingType.NONE },
    allowOverlap: true,
    behindDocument: true
  },
  altText: { name: 'Marca de agua', title: 'Marca de agua', description: 'Isotipo de Comodoro Rivadavia' }
});

const encabezado = (membrete, marca) => new Header({
  children: [new Paragraph({ children: [...(membrete ? [imagenDelMembrete(membrete)] : []), imagenDeLaMarca(marca)] })]
});

// El pie: el texto del membrete en un renglón y, debajo, "Página X de Y". Sin texto, solo "Página X de Y"
const pieDePagina = (texto) => new Footer({
  children: [new Paragraph({
    style: ESTILO_PIE,
    alignment: AlignmentType.CENTER,
    children: [
      ...(texto ? [new TextRun(texto)] : []),
      new TextRun({ break: texto ? 1 : undefined, children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES] })
    ]
  })]
});

/**
 * El Word de una nota, en la hoja membretada.
 * @param {import('./notasGeneradorContenido.js').Bloque[]} bloques
 * @param {Object} hoja
 * @param {{ datos: Buffer, ancho: number, alto: number }|null} hoja.membrete La imagen del encabezado y su tamaño en píxeles
 *   (el de `validarImagenMembrete`); null, sin membrete (queda la marca de agua).
 * @param {string} [hoja.pie] El texto del pie (`notas_digitales_config.membrete_pie`), en un renglón; vacío, solo las páginas.
 * @returns {Promise<Buffer>}
 */
export const renderDocx = async (bloques, { membrete = null, pie = '' } = {}) => {
  const firma = bloques.findIndex(b => b?.tipo === 'firma');
  const cuerpo = bloques.flatMap((bloque, i) => docxDeBloque(bloque, i, bloques, firma));
  const documento = new Document({
    creator: 'RPAD',
    styles: {
      default: { document: { run: { font: 'Arial', size: LETRA.cuerpo } } },
      paragraphStyles: [{ id: ESTILO_PIE, name: 'Pie RPAD', basedOn: 'Normal', run: { font: 'Arial', size: LETRA_PIE } }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: HOJA.ancho, height: HOJA.alto },
          margin: {
            top: HOJA.arriba, right: HOJA.costados, bottom: HOJA.abajo, left: HOJA.costados, header: HOJA.encabezado, footer: HOJA.pie
          }
        }
      },
      headers: { default: encabezado(membrete, await leerMarcaDeAgua()) },
      footers: { default: pieDePagina(textoParaWord(String(pie ?? '').replace(/\s+/g, ' ')).trim()) },
      children: cuerpo
    }]
  });
  return Packer.toBuffer(documento);
};

/**
 * El membrete y el pie del Word, los de las Notas Digitales (`notas_digitales_config`). Nunca tira: un Word sin membrete es
 * mejor que un error. Si la configuración no se puede leer, `{ membrete: null, pie: '' }`; si la imagen no es válida
 * (`ImagenInvalida`), el membrete es null y el pie, el que haya. Los dos casos se registran.
 * @returns {Promise<{ membrete: { datos: Buffer, ancho: number, alto: number }|null, pie: string }>}
 */
export const membreteParaWord = async () => {
  let config;
  try {
    config = await obtenerConfig();
  } catch (error) {
    console.error('No se pudo leer el membrete de las Notas Digitales para el Word:', error);
    return { membrete: null, pie: '' };
  }
  const pie = config.membrete_pie ?? '';
  if (!config.membrete_imagen) return { membrete: null, pie };
  try {
    const { ancho, alto } = validarImagenMembrete(config.membrete_imagen, config.membrete_mime || null);
    return { membrete: { datos: config.membrete_imagen, ancho, alto }, pie };
  } catch (error) {
    console.error('El membrete de las Notas Digitales no sirve para el Word:', error);
    return { membrete: null, pie };
  }
};

/**
 * El membrete para la hoja de la vista previa: el mismo que lleva el Word (membreteParaWord, que nunca tira), con la imagen como un
 * data URL. Si el Word sale sin membrete (no hay imagen, o no sirve), la vista previa tampoco lo muestra.
 * @returns {Promise<{ imagen: string|null, pie: string }>}
 */
export const membreteParaLaVistaPrevia = async () => {
  const { membrete, pie } = await membreteParaWord();
  if (!membrete) return { imagen: null, pie };
  // membreteParaWord solo deja pasar un PNG o un JPEG que se pudo abrir: un PNG empieza con 0x89 y un JPEG con 0xFF
  const tipo = membrete.datos[0] === 0x89 ? 'image/png' : 'image/jpeg';
  return { imagen: `data:${tipo};base64,${membrete.datos.toString('base64')}`, pie };
};
