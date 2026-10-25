/**
 * Generador de Notas (spec 2026-10-24-generador-de-notas, sección 4.1): el Word (.docx) en la hoja membretada, a partir de los
 * bloques de `services/notasGeneradorContenido.js` (ver su JSDoc: Parte, Celda, Fila y Bloque). Lo usan la nota de la DGMIT y
 * la Nota Digital en Word (spec, sección 6).
 *
 * La hoja: oficio Legal de 8½ × 14″ (la misma `PAGINA` de 612 × 1008 pt del PDF de las Notas Digitales), con los márgenes de
 * la hoja membretada. En el encabezado, el membrete a todo el ancho, anclado a la hoja en (0, 0), y la marca de agua (el
 * isotipo aclarado) centrada y detrás del texto: las dos van en el encabezado, así salen en todas las hojas. En el pie, el
 * texto del membrete y "Página X de Y". Arial 12 en el cuerpo; las partes con letra y las celdas, en la suya.
 *
 * Las medidas de la hoja, de los párrafos y de las tablas van en twips (20 por punto, 1440 por pulgada), y las de las
 * imágenes en píxeles a 96 ppp, como las pide la librería `docx` (8.5.0).
 */
import fs from 'node:fs';
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

// Una parte, en la letra `base` (medios puntos) si no trae la suya
const run = (parte, base) => new TextRun({
  text: parte.texto,
  bold: parte.negrita ? true : undefined,
  italics: parte.cursiva ? true : undefined,
  underline: parte.subrayado ? {} : undefined,
  size: parte.letra ?? base,
  break: parte.salto ? 1 : undefined
});
const runs = (partes, base = LETRA.cuerpo) => partes.map(p => run(p, base));

// Las proporciones de las columnas, en twips que suman el ancho útil (lo que sobra del redondeo va a la última)
const anchosEnTwips = (anchos) => {
  const total = anchos.reduce((suma, a) => suma + a, 0);
  const columnas = anchos.map(a => Math.floor((a * ANCHO_UTIL) / total));
  columnas[columnas.length - 1] += ANCHO_UTIL - columnas.reduce((suma, c) => suma + c, 0);
  return columnas;
};

// conLaSiguiente: el párrafo va en la misma hoja que lo que sigue (keepNext; Word lo respeta, LibreOffice no en las tablas)
const celdaDocx = (celda, ancho, conLaSiguiente) => new TableCell({
  width: { size: ancho, type: WidthType.DXA },
  columnSpan: celda.abarca > 1 ? celda.abarca : undefined,
  shading: celda.fondo === 'gris' ? GRIS : undefined,
  margins: MARGEN_CELDA,
  children: [new Paragraph({ keepNext: conLaSiguiente || undefined, children: runs(celda.partes, celda.letra ?? LETRA.cuerpo) })]
});

// Una fila: cada celda, con el ancho de las columnas que abarca. La fila de títulos se repite arriba de cada hoja y ninguna
// fila se parte entre dos hojas. Una fila con la siguiente (keepNext en todos sus párrafos) no queda al pie de una hoja con
// la siguiente arriba de la otra
const filaDocx = (fila, columnas, conLaSiguiente) => {
  let desde = 0;
  const celdas = fila.celdas.map((celda) => {
    const hasta = desde + Math.max(1, celda.abarca ?? 1);
    const ancho = columnas.slice(desde, hasta).reduce((suma, c) => suma + c, 0);
    desde = hasta;
    return celdaDocx(celda, ancho, conLaSiguiente);
  });
  return new TableRow({ tableHeader: fila.encabezado === true || undefined, cantSplit: true, children: celdas });
};

// conLaFirma: la última fila va con la firma que sigue a la tabla
const tablaDocx = (bloque, conLaFirma) => {
  const columnas = anchosEnTwips(bloque.anchos);
  const ultima = bloque.filas.length - 1;
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    borders: bordes(BORDE),
    rows: bloque.filas.map((fila, i) => filaDocx(fila, columnas, fila.conLaSiguiente === true || (conLaFirma && i === ultima)))
  });
};

// El espacio en blanco para firmar a mano. Dos firmas van lado a lado, en una tabla sin bordes de dos celdas vacías
const firmaDocx = (bloque) => {
  if (bloque.columnas !== 2) return new Paragraph({ spacing: { before: ALTO_FIRMA }, children: [] });
  const mitad = Math.floor(ANCHO_UTIL / 2);
  const columnas = [mitad, ANCHO_UTIL - mitad];
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    borders: bordes(SIN_BORDE),
    rows: [new TableRow({
      height: { value: ALTO_FIRMA, rule: HeightRule.ATLEAST },
      children: columnas.map(ancho => new TableCell({ width: { size: ancho, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }))
    })]
  });
};

// LibreOffice dibuja los números de página del pie (campos sin un valor guardado) con la letra del último run del cuerpo: si
// el cuerpo termina en un párrafo con texto (una leyenda en cursiva, la línea CC), los números salen en esa letra y no en la
// del pie. El último párrafo del cuerpo termina por eso en un run vacío y sin formato, que en Word no se ve
const runsDelFinal = (ultimo) => (ultimo ? [new TextRun('')] : []);

// Cada bloque, en uno o más elementos del cuerpo del Word. `ultimo`: es el último bloque del cuerpo. `conLaFirma`: el bloque
// siguiente es la firma, y el último párrafo de este va en la misma hoja que ella (el remitente con el espacio para firmar)
const DOCX_DE_BLOQUE = {
  parrafo: (b, { ultimo, conLaFirma }) => [new Paragraph({
    alignment: ALINEACION[b.alinear] ?? AlignmentType.LEFT,
    spacing: { before: b.antes ?? 0, after: b.despues ?? 0 },
    keepNext: conLaFirma || undefined,
    children: [...runs(b.partes), ...runsDelFinal(ultimo)]
  })],
  tabla: (b, { conLaFirma }) => [tablaDocx(b, conLaFirma)],
  // Un párrafo con viñeta por ítem; el último deja debajo el espacio de un párrafo del cuerpo
  lista: (b, { ultimo, conLaFirma }) => b.items.map((partes, i) => {
    const ultimoItem = i === b.items.length - 1;
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: ultimoItem ? ESPACIO.parrafo : 0 },
      keepNext: (conLaFirma && ultimoItem) || undefined,
      children: [...runs(partes), ...runsDelFinal(ultimo && ultimoItem)]
    });
  }),
  firma: (b) => [firmaDocx(b)]
};

const docxDeBloque = (bloque, i, bloques) => {
  const convertir = DOCX_DE_BLOQUE[bloque?.tipo];
  if (!convertir) throw new Error(`Bloque desconocido en el Word: ${bloque?.tipo}`);
  return convertir(bloque, { ultimo: i === bloques.length - 1, conLaFirma: bloques[i + 1]?.tipo === 'firma' });
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
  const cuerpo = bloques.flatMap(docxDeBloque);
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
      footers: { default: pieDePagina(String(pie ?? '').replace(/\s+/g, ' ').trim()) },
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
