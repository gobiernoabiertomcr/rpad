// Generador de Notas (spec 2026-10-24-generador-de-notas, sección 4.1): el Word en la hoja membretada. Oficio Legal, los
// márgenes de la hoja membretada, el membrete a todo el ancho, la marca de agua detrás del texto y el pie con "Página X de Y".
// Puro, sin base: los bloques salen de construirNotaDgmit y el Word se abre con JSZip para leer su XML.
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import { HOJA, renderDocx } from '../services/notasWord.js';
import { construirNotaDgmit, LETRA } from '../services/notasGeneradorContenido.js';
import { validarImagenMembrete } from '../services/notasDigitalesPdf.js';

// ---------------------------------------------------------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------------------------------------------------------

// Un PNG RGB de un solo color, de ancho × alto píxeles, armado en memoria: la firma, IHDR, IDAT e IEND, con su CRC
const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (datos) => {
  let c = 0xffffffff;
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const bloquePng = (tipo, datos) => {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
};
const pngDePrueba = (ancho, alto) => {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // 8 bits por canal
  cabecera[9] = 2; // RGB
  const fila = Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, 0x80)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloquePng('IHDR', cabecera),
    bloquePng('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: alto }, () => fila)))),
    bloquePng('IEND', Buffer.alloc(0))
  ]);
};
const membreteDe = (datos) => Object.freeze({ datos, ...validarImagenMembrete(datos, 'image/png') });

// El membrete de la hoja membretada mide 1241 × 178: a todo el ancho entra en el margen de arriba
const MEMBRETE = membreteDe(pngDePrueba(1241, 178));
const MARCA = fs.readFileSync(new URL('../public/img/membrete-isotipo-aclarado.png', import.meta.url));
const PIE = 'www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.';
// ImageRun mide en píxeles a 96 ppp; en el XML, EMU (9525 por píxel). Un twip son 635 EMU
const EMU = (px) => px * 9525;
const EMU_POR_TWIP = 635;

const AREA = Object.freeze({ nombre: 'Secretaría de la Mujer, Género y Diversidad', articulo: 'la', area_superior: 'Intendencia', articulo_superior: 'la' });
const DATASETS = Object.freeze([
  Object.freeze({ titulo: 'Áreas específicas de género', frecuencia: 'Anualmente', datosSolicitados: 'Vigente al 30/09/2026', queSeSolicita: 'Listado completo y actualizado.' }),
  Object.freeze({ titulo: 'Atenciones de la línea 144', frecuencia: 'Trimestralmente (Acumulado)', datosSolicitados: 'Del 01/01/2026 al 30/09/2026', queSeSolicita: null })
]);
const nota = (cambios = {}) => construirNotaDgmit({
  tipo: 'interna', pedido: 'solicitud', fecha: '2026-10-24', numero: null, area: AREA, datasets: DATASETS, ...cambios
});

// El Word abierto: el cuerpo, los encabezados, los pies, los estilos y las imágenes
const abrir = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const leer = (nombre) => zip.file(nombre).async('string');
  const nombres = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const de = (patron) => Promise.all(nombres.filter(n => patron.test(n)).sort().map(leer));
  return {
    documento: await leer('word/document.xml'),
    estilos: await leer('word/styles.xml'),
    encabezados: await de(/^word\/header\d+\.xml$/),
    pies: await de(/^word\/footer\d+\.xml$/),
    imagenes: await Promise.all(nombres.filter(n => n.startsWith('word/media/')).map(n => zip.file(n).async('nodebuffer')))
  };
};
const conHoja = (bloques, opciones = { membrete: MEMBRETE, pie: PIE }) => renderDocx(bloques, opciones).then(abrir);

const cuantas = (xml, texto) => xml.split(texto).length - 1;
// Los anclajes (imágenes flotantes) de un XML
const anclajes = (xml) => xml.match(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/g) ?? [];
// Las tablas del cuerpo (las tablas de docx no se anidan)
const tablas = (xml) => xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
// El texto de un XML de Word: los <w:t> unidos, con las entidades de XML decodificadas
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const textoDe = (xml) => (xml.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) ?? [])
  .map(t => t.replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|apos);/g, e => ENTIDADES[e]))
  .join('');
// Los párrafos del cuerpo, fuera de las tablas
const parrafosFueraDeTablas = (xml) => (xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, '').match(/<w:p>[\s\S]*?<\/w:p>|<w:p\/>/g) ?? []);
const desdeElBody = (xml) => xml.slice(xml.indexOf('<w:body>'));

// ---------------------------------------------------------------------------------------------------------------------------
// La hoja
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderDocx: la hoja', () => {
  it('HOJA es oficio Legal de 8½ × 14″ con los márgenes de la hoja membretada, en twips', () => {
    assert.deepEqual({ ...HOJA }, { ancho: 12240, alto: 20160, arriba: 1985, costados: 1701, abajo: 1417, encabezado: 0, pie: 708 });
    // La misma hoja que el PDF de las Notas Digitales: 612 × 1008 pt (20 twips por punto)
    assert.equal(HOJA.ancho / 20, 612);
    assert.equal(HOJA.alto / 20, 1008);
    assert.ok(Object.isFrozen(HOJA));
  });

  it('devuelve un Buffer que es un .docx (un ZIP)', async () => {
    const buffer = await renderDocx(nota(), { membrete: MEMBRETE, pie: PIE });
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 2).toString('latin1'), 'PK');
  });

  it('la sección es oficio, con los márgenes de la hoja membretada y el encabezado pegado al borde', async () => {
    const { documento } = await conHoja(nota());
    assert.match(documento, /<w:pgSz w:w="12240" w:h="20160"/);
    assert.match(documento, /<w:pgMar w:top="1985" w:right="1701" w:bottom="1417" w:left="1701" w:header="0" w:footer="708"/);
    // Una sola sección, con su encabezado y su pie en todas las hojas
    assert.equal(cuantas(documento, '<w:sectPr'), 1);
    assert.match(documento, /<w:headerReference w:type="default"/);
    assert.match(documento, /<w:footerReference w:type="default"/);
  });

  it('el estilo por defecto es Arial de 12 pt', async () => {
    const { estilos } = await conHoja(nota());
    const defecto = estilos.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)[0];
    assert.match(defecto, /<w:rFonts w:ascii="Arial"/);
    assert.match(defecto, /<w:sz w:val="24"\/>/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// El encabezado: el membrete y la marca de agua
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderDocx: el encabezado', () => {
  it('tiene dos imágenes flotantes: el membrete, delante, y la marca de agua, detrás del texto', async () => {
    const { encabezados } = await conHoja(nota());
    assert.equal(encabezados.length, 1);
    const anclas = anclajes(encabezados[0]);
    assert.equal(anclas.length, 2);
    assert.equal(anclas.filter(a => /behindDoc="1"/.test(a)).length, 1);
    assert.equal(anclas.filter(a => /behindDoc="0"/.test(a)).length, 1);
  });

  it('el membrete va anclado a la hoja en (0, 0), a todo el ancho y con su proporción', async () => {
    const { encabezados } = await conHoja(nota());
    const membrete = anclajes(encabezados[0]).find(a => /behindDoc="0"/.test(a));
    assert.match(membrete, /<wp:positionH relativeFrom="page"><wp:posOffset>0<\/wp:posOffset><\/wp:positionH>/);
    assert.match(membrete, /<wp:positionV relativeFrom="page"><wp:posOffset>0<\/wp:posOffset><\/wp:positionV>/);
    assert.match(membrete, /<wp:wrapNone\/>/);
    assert.match(membrete, /allowOverlap="1"/);
    // 816 px = 8½″ a 96 ppp: el ancho de la hoja
    const alto = Math.round(MEMBRETE.alto * 816 / MEMBRETE.ancho);
    assert.match(membrete, new RegExp(`<wp:extent cx="${EMU(816)}" cy="${EMU(alto)}"/>`));
  });

  it('un membrete alto no pasa el margen de arriba: se achica con su proporción y se centra', async () => {
    // Un PNG cuadrado del repo (225 × 225) y uno de 447 × 160: a todo el ancho medirían 816 y 292 px de alto
    for (const datos of [fs.readFileSync(new URL('../public/img/icon.png', import.meta.url)), pngDePrueba(447, 160)]) {
      const membrete = membreteDe(datos);
      const { encabezados } = await conHoja(nota(), { membrete, pie: PIE });
      const ancla = anclajes(encabezados[0]).find(a => /behindDoc="0"/.test(a));
      const [, cx, cy] = ancla.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/).map(Number);
      // El alto, el del margen de arriba (1985 twips) como mucho: 132 px
      assert.ok(cy <= HOJA.arriba * EMU_POR_TWIP, `cy ${cy}`);
      assert.equal(cy, EMU(132));
      // El ancho, proporcional
      assert.equal(cx, EMU(Math.round(membrete.ancho * 132 / membrete.alto)));
      // Centrado: lo que le falta para el ancho de la hoja, repartido a los dos lados
      const x = Number(ancla.match(/<wp:positionH relativeFrom="page"><wp:posOffset>(\d+)<\/wp:posOffset><\/wp:positionH>/)[1]);
      assert.ok(Math.abs(x - (EMU(816) - cx) / 2) <= 1, `x ${x}`);
      assert.match(ancla, /<wp:positionV relativeFrom="page"><wp:posOffset>0<\/wp:posOffset><\/wp:positionV>/);
    }
  });

  it('la marca de agua va centrada en la hoja, en los dos ejes, en unos 500 × 500 px', async () => {
    const { encabezados } = await conHoja(nota());
    const marca = anclajes(encabezados[0]).find(a => /behindDoc="1"/.test(a));
    assert.match(marca, /<wp:positionH relativeFrom="page"><wp:align>center<\/wp:align><\/wp:positionH>/);
    assert.match(marca, /<wp:positionV relativeFrom="page"><wp:align>center<\/wp:align><\/wp:positionV>/);
    assert.match(marca, /<wp:wrapNone\/>/);
    assert.match(marca, new RegExp(`<wp:extent cx="${EMU(500)}" cy="${EMU(500)}"/>`));
  });

  it('las imágenes del Word son el membrete recibido y el isotipo aclarado', async () => {
    const { imagenes } = await conHoja(nota());
    assert.equal(imagenes.length, 2);
    assert.ok(imagenes.some(i => i.equals(MEMBRETE.datos)));
    assert.ok(imagenes.some(i => i.equals(MARCA)));
  });

  it('con membrete null, el encabezado tiene una sola imagen: la marca de agua', async () => {
    const { encabezados, imagenes } = await conHoja(nota(), { membrete: null, pie: PIE });
    const anclas = anclajes(encabezados[0]);
    assert.equal(anclas.length, 1);
    assert.match(anclas[0], /behindDoc="1"/);
    assert.equal(imagenes.length, 1);
    assert.ok(imagenes[0].equals(MARCA));
  });

  it('la marca de agua se lee del disco una sola vez', async () => {
    await renderDocx(nota(), { membrete: null, pie: PIE });
    const lectura = mock.method(fs.promises, 'readFile');
    try {
      await renderDocx(nota(), { membrete: null, pie: PIE });
      await renderDocx(nota(), { membrete: MEMBRETE, pie: PIE });
      assert.equal(lectura.mock.callCount(), 0);
    } finally {
      lectura.mock.restore();
    }
  });

  it('si la lectura de la marca de agua falla, el Word falla y el próximo la vuelve a leer', async () => {
    // Una copia nueva del módulo, con la caché vacía (la de arriba ya leyó la marca)
    const { renderDocx: renderNuevo } = await import('../services/notasWord.js?marca-que-falla');
    const fallida = mock.method(fs.promises, 'readFile', () => Promise.reject(new Error('x')));
    try {
      await assert.rejects(renderNuevo(nota(), { membrete: null, pie: PIE }), { message: 'x' });
      assert.equal(fallida.mock.callCount(), 1);
    } finally {
      fallida.mock.restore();
    }
    const lectura = mock.method(fs.promises, 'readFile');
    try {
      const { imagenes } = await abrir(await renderNuevo(nota(), { membrete: null, pie: PIE }));
      assert.equal(lectura.mock.callCount(), 1);
      assert.ok(imagenes[0].equals(MARCA));
    } finally {
      lectura.mock.restore();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// El pie
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderDocx: el pie', () => {
  it('tiene el texto del pie y, en el renglón siguiente, "Página X de Y" con los campos PAGE y NUMPAGES', async () => {
    const { pies } = await conHoja(nota());
    assert.equal(pies.length, 1);
    const [pie] = pies;
    assert.ok(pie.includes(PIE));
    assert.match(pie, /<w:instrText[^>]*>PAGE<\/w:instrText>/);
    assert.match(pie, /<w:instrText[^>]*>NUMPAGES<\/w:instrText>/);
    assert.equal(textoDe(pie), `${PIE}Página  de `);
    // Un solo párrafo, centrado y con el estilo del pie; el renglón nuevo es un salto antes de "Página"
    assert.equal(cuantas(pie, '<w:p>'), 1);
    assert.match(pie, /<w:pStyle w:val="PieRpad"\/><w:jc w:val="center"\/>/);
    assert.match(pie, /<w:br\/><w:t xml:space="preserve">Página <\/w:t>/);
  });

  it('la letra del pie (Arial de 8 pt) va en el estilo PieRpad, no en los runs', async () => {
    const { estilos, pies } = await conHoja(nota());
    const estilo = estilos.match(/<w:style [^>]*w:styleId="PieRpad"[\s\S]*?<\/w:style>/)?.[0];
    assert.ok(estilo, 'falta el estilo PieRpad');
    assert.match(estilo, /<w:rFonts w:ascii="Arial"/);
    assert.match(estilo, /<w:sz w:val="16"\/>/);
    assert.doesNotMatch(pies[0], /<w:sz /);
  });

  it('sin texto del pie, solo "Página X de Y", sin un renglón vacío arriba', async () => {
    for (const pie of ['', '   ', null, undefined]) {
      const { pies } = await conHoja(nota(), { membrete: MEMBRETE, pie });
      assert.equal(textoDe(pies[0]), 'Página  de ');
      assert.doesNotMatch(pies[0], /<w:br\/>/);
    }
  });

  // LibreOffice dibuja los números de página con la letra del último run del cuerpo (probado con LibreOffice: un cuerpo que
  // termina en una leyenda en cursiva de 10 pt daba "Página 1 de 1" con los números en cursiva de 10 pt)
  it('si el cuerpo termina en un párrafo con texto, su último run va vacío y sin formato; los demás párrafos, no', async () => {
    const RUN_NEUTRO = '<w:r><w:t xml:space="preserve"></w:t></w:r></w:p>';
    const leyenda = { tipo: 'parrafo', alinear: 'justificado', partes: [{ texto: 'Leyenda', cursiva: true, letra: 20 }] };
    const otro = { tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Remitente', negrita: true }] };
    const { documento } = await conHoja([otro, leyenda]);
    const parrafos = parrafosFueraDeTablas(desdeElBody(documento));
    assert.ok(parrafos.at(-1).endsWith(RUN_NEUTRO));
    assert.ok(!parrafos.at(-2).endsWith(RUN_NEUTRO));
    // También el último ítem de una lista final
    const lista = { tipo: 'lista', items: [[{ texto: 'Uno', cursiva: true }], [{ texto: 'Dos', cursiva: true }]] };
    const conLista = parrafosFueraDeTablas(desdeElBody((await conHoja([otro, lista])).documento));
    assert.ok(conLista.at(-1).endsWith(RUN_NEUTRO));
    assert.ok(!conLista.at(-2).endsWith(RUN_NEUTRO));
  });

  it('el texto del pie va en un solo renglón (los espacios y saltos de más se juntan)', async () => {
    const { pies } = await conHoja(nota(), { membrete: MEMBRETE, pie: '  www.comodoroweb.gov.ar –\n  Moreno 815  ' });
    assert.ok(pies[0].includes('<w:t xml:space="preserve">www.comodoroweb.gov.ar – Moreno 815</w:t>'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// El cuerpo
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderDocx: el cuerpo', () => {
  it('tiene el REF, el área y "Qué se solicita:"', async () => {
    const { documento } = await conHoja(nota());
    const texto = textoDe(documento);
    assert.ok(texto.includes('REF.: "Solicitud de datos para el Portal de Datos Abiertos Municipal"'));
    assert.ok(texto.includes('Nota N° ____/26'));
    assert.ok(texto.includes(AREA.nombre));
    assert.equal(cuantas(texto, 'Qué se solicita:'), DATASETS.length);
    assert.ok(texto.includes('DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL, 24 de octubre de 2026.'));
  });

  it('cada párrafo lleva su alineación y sus espacios', async () => {
    const { documento } = await conHoja(nota());
    const parrafos = parrafosFueraDeTablas(desdeElBody(documento));
    const ref = parrafos.find(p => textoDe(p).startsWith('REF.:'));
    assert.match(ref, /<w:jc w:val="right"\/>/);
    assert.match(ref, /<w:spacing w:before="0" w:after="100"\/>/);
    const pedido = parrafos.find(p => textoDe(p).startsWith('Solicito a Ud.'));
    assert.match(pedido, /<w:jc w:val="both"\/>/);
    const justificacion = parrafos.find(p => textoDe(p) === 'Justificación:');
    assert.match(justificacion, /<w:jc w:val="left"\/>/);
    assert.match(justificacion, /<w:spacing w:before="240" w:after="200"\/>/);
  });

  it('negrita, subrayado y cursiva van en los runs', async () => {
    const { documento } = await conHoja(nota());
    const run = (texto) => documento.match(new RegExp(`<w:r><w:rPr>(?:(?!</w:r>)[\\s\\S])*?<w:t xml:space="preserve">${texto}</w:t></w:r>`))?.[0] ?? '';
    // El destinatario, en negrita y subrayado
    const destinatario = run('SUBSECRETARÍA DE MODERNIZACIÓN Y TRANSPARENCIA');
    assert.match(destinatario, /<w:b\/>/);
    assert.match(destinatario, /<w:u w:val="single"\/>/);
    // El área, solo en negrita
    const area = run(AREA.nombre);
    assert.match(area, /<w:b\/>/);
    assert.doesNotMatch(area, /<w:u /);
    // "Qué se solicita:", en cursiva
    assert.match(run('Qué se solicita:'), /<w:i\/>/);
  });

  it('las partes del cuerpo van en 12 pt y una parte con letra, en la suya', async () => {
    const bloques = [{ tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Grande' }, { texto: 'Chica', letra: 16 }] }];
    const { documento } = await conHoja(bloques);
    assert.match(documento, /<w:sz w:val="24"\/>(?:(?!<\/w:r>)[\s\S])*?<w:t xml:space="preserve">Grande<\/w:t>/);
    assert.match(documento, /<w:sz w:val="16"\/>(?:(?!<\/w:r>)[\s\S])*?<w:t xml:space="preserve">Chica<\/w:t>/);
  });

  it('una parte con salto empieza en un renglón nuevo', async () => {
    const bloques = [{ tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Uno' }, { texto: 'Dos', salto: true }] }];
    const { documento } = await conHoja(bloques);
    assert.match(documento, /<w:br\/><w:t xml:space="preserve">Dos<\/w:t>/);
    assert.doesNotMatch(documento, /<w:br\/><w:t xml:space="preserve">Uno<\/w:t>/);
  });

  // Review Focus 2: los números raros salen tal cual
  it('el texto sale tal cual, escapado: rayas, comillas tipográficas, emoji, < y &', async () => {
    const numero = '12/26 — “bis” 😀 <A&B>';
    const { documento } = await conHoja(nota({ numero }));
    assert.ok(documento.includes(`<w:t xml:space="preserve"> 12/26 — “bis” 😀 &lt;A&amp;B&gt;</w:t>`));
    assert.ok(textoDe(documento).includes(`Nota N° ${numero}`));
  });

  it('una lista sale con viñetas, un párrafo por ítem', async () => {
    const bloques = [{ tipo: 'lista', items: [[{ texto: 'Primero' }], [{ texto: 'Segundo', negrita: true }]] }];
    const { documento } = await conHoja(bloques);
    const items = parrafosFueraDeTablas(desdeElBody(documento)).filter(p => /<w:numPr>/.test(p));
    assert.deepEqual(items.map(textoDe), ['Primero', 'Segundo']);
    assert.match(items[1], /<w:b\/>/);
  });

  it('un bloque desconocido es un error', async () => {
    await assert.rejects(renderDocx([{ tipo: 'imagen' }], { membrete: null, pie: '' }), /imagen/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// La tabla
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderDocx: la tabla', () => {
  it('ocupa el ancho útil, con columnas fijas sacadas de las proporciones', async () => {
    const { documento } = await conHoja(nota());
    const [tabla] = tablas(documento);
    assert.match(tabla, /<w:tblW w:type="dxa" w:w="8838"\/>/);
    assert.match(tabla, /<w:tblLayout w:type="fixed"\/>/);
    const columnas = [...tabla.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
    assert.equal(columnas.length, 3);
    assert.equal(columnas.reduce((s, c) => s + c, 0), 8838);
    // ANCHOS_TABLA = [38, 24, 38]
    assert.deepEqual(columnas.map(c => Math.round(c / 8838 * 100)), [38, 24, 38]);
  });

  it('las columnas suman el ancho útil aunque las proporciones no den números enteros', async () => {
    const bloques = [{ tipo: 'tabla', anchos: [18, 14, 10, 10, 13, 10, 25], filas: [{ celdas: Array.from({ length: 7 }, () => ({ partes: [{ texto: 'x' }] })) }] }];
    const { documento } = await conHoja(bloques);
    const columnas = [...tablas(documento)[0].matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
    assert.equal(columnas.length, 7);
    assert.equal(columnas.reduce((s, c) => s + c, 0), 8838);
  });

  it('bordes simples finos negros', async () => {
    const { documento } = await conHoja(nota());
    const bordes = tablas(documento)[0].match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)[0];
    for (const lado of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
      assert.match(bordes, new RegExp(`<w:${lado} w:val="single" w:color="000000" w:sz="4"/>`), lado);
    }
  });

  it('el encabezado se repite en cada hoja, sobre gris claro', async () => {
    const { documento } = await conHoja(nota());
    const filas = tablas(documento)[0].match(/<w:tr>[\s\S]*?<\/w:tr>/g);
    assert.match(filas[0], /<w:tblHeader\/>/);
    assert.equal(cuantas(filas[0], 'w:fill="D9D9D9"'), 3);
    assert.equal(textoDe(filas[0]), 'Conjunto de datosFrecuenciaDatos solicitados');
    // Las demás filas, sin encabezado ni gris
    for (const fila of filas.slice(1)) {
      assert.doesNotMatch(fila, /<w:tblHeader/);
      assert.doesNotMatch(fila, /D9D9D9/);
    }
  });

  it('el "Qué se solicita" ocupa las tres columnas, y cada celda lleva su letra', async () => {
    const { documento } = await conHoja(nota());
    const filas = tablas(documento)[0].match(/<w:tr>[\s\S]*?<\/w:tr>/g);
    assert.equal(filas.length, 1 + 2 * DATASETS.length);
    const queSeSolicita = filas[2];
    assert.match(queSeSolicita, /<w:gridSpan w:val="3"\/>/);
    assert.match(queSeSolicita, /<w:tcW w:type="dxa" w:w="8838"\/>/);
    assert.ok(textoDe(queSeSolicita).startsWith('Qué se solicita: Listado completo'));
    // Tabla en 10 pt y "Qué se solicita" en 9
    assert.ok([...filas[1].matchAll(/<w:sz w:val="(\d+)"\/>/g)].every(m => Number(m[1]) === LETRA.tabla));
    assert.ok([...queSeSolicita.matchAll(/<w:sz w:val="(\d+)"\/>/g)].every(m => Number(m[1]) === LETRA.queSeSolicita));
    assert.ok([...filas[0].matchAll(/<w:sz w:val="(\d+)"\/>/g)].every(m => Number(m[1]) === LETRA.tabla));
  });

  it('la fila de cada dataset va con su "Qué se solicita": keepNext en todos sus párrafos; las demás filas, sin él', async () => {
    const { documento } = await conHoja(nota());
    const filas = tablas(documento)[0].match(/<w:tr>[\s\S]*?<\/w:tr>/g);
    const parrafosDe = (fila) => fila.match(/<w:p>[\s\S]*?<\/w:p>/g);
    // El encabezado, dataset, "Qué se solicita", dataset, "Qué se solicita"
    assert.equal(filas.length, 5);
    for (const i of [1, 3]) {
      assert.equal(parrafosDe(filas[i]).length, 3);
      assert.ok(parrafosDe(filas[i]).every(p => /<w:keepNext\/>/.test(p)), `fila ${i}`);
    }
    for (const i of [0, 2, 4]) assert.doesNotMatch(filas[i], /<w:keepNext/, `fila ${i}`);
  });

  it('una celda que abarca columnas suma sus anchos', async () => {
    const bloques = [{
      tipo: 'tabla',
      anchos: [50, 25, 25],
      filas: [{ celdas: [{ partes: [{ texto: 'a' }], abarca: 2 }, { partes: [{ texto: 'b' }] }] }]
    }];
    const { documento } = await conHoja(bloques);
    const [tabla] = tablas(documento);
    const columnas = [...tabla.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
    const celdas = tabla.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
    const ancho = (celda) => Number(celda.match(/<w:tcW w:type="dxa" w:w="(\d+)"\/>/)[1]);
    assert.match(celdas[0], /<w:gridSpan w:val="2"\/>/);
    assert.doesNotMatch(celdas[1], /<w:gridSpan/);
    assert.equal(ancho(celdas[0]), columnas[0] + columnas[1]);
    assert.equal(ancho(celdas[1]), columnas[2]);
    assert.equal(ancho(celdas[0]) + ancho(celdas[1]), 8838);
  });
});

// La Nota Digital en Word (spec, sección 6): sus tablas de 7 columnas, en 8,5 pt y con el relleno del PDF, y las columnas
// ensanchadas para que ninguna palabra se parta, como en el PDF de las Notas Digitales
describe('renderDocx: la letra, el margen y las palabras de una tabla', () => {
  const celda = (texto, extra = {}) => ({ partes: [{ texto, ...(extra.negrita ? { negrita: true } : {}) }], ...(extra.letra ? { letra: extra.letra } : {}), ...(extra.abarca ? { abarca: extra.abarca } : {}) });
  const columnasDe = (tabla) => [...tabla.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
  const suma = (lista) => lista.reduce((s, n) => s + n, 0);
  // Arial mide como la Helvetica de PDFKit: el ancho de una palabra en twips (20 por punto), en una letra en medios puntos
  const medidor = new PDFDocument({ autoFirstPage: false });
  const twipsDe = (palabra, letra, negrita = false) => medidor.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(letra / 2).widthOfString(palabra) * 20;
  const ENCABEZADO = ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Requiere nota DGMIT', 'Datos solicitados', 'Vence', 'Informado en'];
  const FILA = ['Dataset de ejemplo', 'Área de ejemplo', 'Cuatrimestralmente', 'Sí', 'Del 01/01/2026 al 31/10/2026', '30/11/2026', 'Nota Digital N° 1/26 (03/10/2026).'];
  const deSiete = (extra = {}) => [{
    tipo: 'tabla', anchos: [24, 14, 10, 10, 15, 12, 15], letra: 17, margen: 60, ...extra,
    filas: [{ encabezado: true, celdas: ENCABEZADO.map(t => celda(t, { negrita: true })) }, { celdas: FILA.map(t => celda(t)) }]
  }];

  it('las celdas sin letra van en la de la tabla; las que la traen, en la suya', async () => {
    const bloques = [{ tipo: 'tabla', anchos: [50, 50], letra: 17, filas: [{ celdas: [celda('a'), celda('b', { letra: 14 })] }] }];
    const celdas = tablas((await conHoja(bloques)).documento)[0].match(/<w:tc>[\s\S]*?<\/w:tc>/g);
    assert.match(celdas[0], /<w:sz w:val="17"\/>/);
    assert.match(celdas[1], /<w:sz w:val="14"\/>/);
  });

  it('el margen de la tabla va a los costados de cada celda (arriba y abajo, 60 como siempre); sin margen, 100', async () => {
    const margenes = async (extra) => {
      const bloques = [{ tipo: 'tabla', anchos: [50, 50], ...extra, filas: [{ celdas: [celda('a'), celda('b')] }] }];
      return tablas((await conHoja(bloques)).documento)[0].match(/<w:tcMar>[\s\S]*?<\/w:tcMar>/g);
    };
    for (const mar of await margenes({ margen: 60 })) {
      assert.equal(mar, '<w:tcMar><w:top w:type="dxa" w:w="60"/><w:left w:type="dxa" w:w="60"/><w:bottom w:type="dxa" w:w="60"/><w:right w:type="dxa" w:w="60"/></w:tcMar>');
    }
    for (const mar of await margenes({})) {
      assert.equal(mar, '<w:tcMar><w:top w:type="dxa" w:w="60"/><w:left w:type="dxa" w:w="100"/><w:bottom w:type="dxa" w:w="60"/><w:right w:type="dxa" w:w="100"/></w:tcMar>');
    }
  });

  it('con sinPartirPalabras, cada columna mide al menos su palabra más ancha y los márgenes; las que tienen holgura ceden', async () => {
    const columnas = columnasDe(tablas((await conHoja(deSiete({ sinPartirPalabras: true }))).documento)[0]);
    assert.equal(columnas.length, 7);
    assert.equal(suma(columnas), 8838);
    // Cada columna, salvo la primera, entra su palabra más ancha (la del encabezado va en negrita) con 60 twips a cada lado y 3 pt
    // de holgura (LibreOffice, con 1 pt, partía "Trimestralmente" en 8,5 pt)
    const palabras = ENCABEZADO.map((titulo, i) => Math.max(
      ...titulo.split(' ').map(p => twipsDe(p, 17, true)),
      ...FILA[i].split(' ').map(p => twipsDe(p, 17))
    ));
    for (let i = 1; i < 7; i++) assert.ok(columnas[i] >= palabras[i] + 180, `columna ${i}: ${columnas[i]} < ${palabras[i] + 180}`);
    // "Cuatrimestralmente" no entra en el 10 % (883 twips): la Frecuencia se ensancha, y el título, con holgura, cede
    assert.ok(columnas[2] > 884);
    assert.ok(columnas[0] < Math.floor(8838 * 0.24));
  });

  it('sin sinPartirPalabras, las columnas son las proporciones tal cual, aunque una palabra no entre', async () => {
    const columnas = columnasDe(tablas((await conHoja(deSiete())).documento)[0]);
    assert.deepEqual(columnas, [2121, 1237, 883, 883, 1325, 1060, 1329]);
  });

  it('la primera columna se ensancha como mucho hasta 55 pt de palabra; una celda que abarca varias columnas no cuenta', async () => {
    const bloques = [{
      tipo: 'tabla', anchos: [10, 45, 45], sinPartirPalabras: true,
      filas: [{ celdas: [celda('x'.repeat(80)), celda('a'), celda('b')] }, { celdas: [celda('y'.repeat(300), { abarca: 3 })] }]
    }];
    const columnas = columnasDe(tablas((await conHoja(bloques)).documento)[0]);
    // 55 pt (1100 twips), los márgenes de siempre (100 a cada lado) y 3 pt de holgura
    assert.equal(columnas[0], 1360);
    assert.ok(Math.abs(columnas[1] - columnas[2]) <= 1);
    assert.equal(suma(columnas), 8838);
  });

  it('si las palabras no entran ni así, la primera cede hasta su encabezado y las demás se reparten lo que queda', async () => {
    const larga = 'Interjurisdiccionalidades';
    const bloques = [{
      tipo: 'tabla', anchos: [24, 14, 10, 10, 15, 12, 15], letra: 24, sinPartirPalabras: true,
      filas: [
        { encabezado: true, celdas: ['Título', ...Array(6).fill(larga)].map(t => celda(t, { negrita: true })) },
        { celdas: Array(7).fill(larga).map(t => celda(t)) }
      ]
    }];
    const columnas = columnasDe(tablas((await conHoja(bloques)).documento)[0]);
    assert.equal(suma(columnas), 8838);
    assert.ok(columnas.every(c => c > 0));
    // El título queda del ancho de su encabezado, "Título" en negrita de 12 pt, con los márgenes y la holgura
    assert.ok(Math.abs(columnas[0] - (twipsDe('Título', 24, true) + 260)) <= 1, String(columnas[0]));
    // Las demás, iguales entre sí (la misma palabra)
    assert.ok(columnas.slice(1, -1).every(c => Math.abs(c - columnas[1]) <= 1));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// La firma
// ---------------------------------------------------------------------------------------------------------------------------

describe('renderDocx: el espacio para la firma', () => {
  it('con una columna, un párrafo vacío con 1440 twips antes, sin tabla', async () => {
    const bloques = [{ tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Remitente' }] }, { tipo: 'firma', columnas: 1 }];
    const { documento } = await conHoja(bloques);
    assert.equal(tablas(documento).length, 0);
    const parrafos = parrafosFueraDeTablas(desdeElBody(documento));
    const firma = parrafos.at(-1);
    assert.match(firma, /<w:spacing w:before="1440"/);
    assert.equal(textoDe(firma), '');
  });

  it('con dos columnas, una tabla sin bordes y sin texto de dos celdas de 1440 twips de alto como mínimo', async () => {
    const bloques = [{ tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Remitente' }] }, { tipo: 'firma', columnas: 2 }];
    const { documento } = await conHoja(bloques);
    const [firma] = tablas(documento);
    assert.ok(firma, 'falta la tabla de las dos firmas');
    assert.equal(textoDe(firma), '');
    assert.doesNotMatch(firma, /<w:t[ >]/);
    assert.equal(cuantas(firma, '<w:tc>'), 2);
    assert.match(firma, /<w:trHeight w:val="1440" w:hRule="atLeast"\/>/);
    assert.match(firma, /<w:tblW w:type="dxa" w:w="8838"\/>/);
    const bordes = firma.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)[0];
    assert.doesNotMatch(bordes, /w:val="single"/);
  });

  it('el remitente va con el espacio de la firma (keepNext); los otros párrafos, no', async () => {
    const { documento } = await conHoja(nota());
    const parrafos = parrafosFueraDeTablas(desdeElBody(documento));
    const remitente = parrafos.at(-2);
    assert.ok(textoDe(remitente).startsWith('DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL'));
    assert.match(remitente, /<w:keepNext\/>/);
    assert.ok(parrafos.slice(0, -2).every(p => !/<w:keepNext/.test(p)));
    assert.doesNotMatch(parrafos.at(-1), /<w:keepNext/);
  });

  // La Nota Digital en Word sigue a la firma con la leyenda y el CC: el cierre va junto, como en el PDF (dibujarCierre)
  it('lo que sigue a la firma va con ella: la firma y la leyenda, keepNext; el último párrafo, no', async () => {
    const remitente = { tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Remitente' }] };
    const leyenda = { tipo: 'parrafo', alinear: 'justificado', partes: [{ texto: 'Leyenda', cursiva: true }] };
    const cc = { tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'CC' }] };
    const conDos = desdeElBody((await conHoja([remitente, { tipo: 'firma', columnas: 2 }, leyenda, cc])).documento);
    const [firmas] = tablas(conDos);
    assert.equal(cuantas(firmas, '<w:keepNext/>'), 2);
    const parrafos = parrafosFueraDeTablas(conDos);
    assert.deepEqual(parrafos.map(p => [textoDe(p), /<w:keepNext\/>/.test(p)]), [['Remitente', true], ['Leyenda', true], ['CC', false]]);
    // Con una firma, su párrafo vacío va con el CC
    const conUna = parrafosFueraDeTablas(desdeElBody((await conHoja([remitente, { tipo: 'firma', columnas: 1 }, cc])).documento));
    assert.deepEqual(conUna.map(p => /<w:keepNext\/>/.test(p)), [true, true, false]);
  });

  it('también con dos firmas, y lo que va antes de la firma puede ser una lista o una tabla', async () => {
    const remitente = { tipo: 'parrafo', alinear: 'izquierda', partes: [{ texto: 'Remitente' }] };
    const conDos = parrafosFueraDeTablas(desdeElBody((await conHoja([remitente, { tipo: 'firma', columnas: 2 }])).documento));
    assert.match(conDos.find(p => textoDe(p) === 'Remitente'), /<w:keepNext\/>/);
    // Una lista: solo su último ítem
    const lista = { tipo: 'lista', items: [[{ texto: 'Uno' }], [{ texto: 'Dos' }]] };
    const items = parrafosFueraDeTablas(desdeElBody((await conHoja([lista, { tipo: 'firma', columnas: 1 }])).documento)).filter(p => /<w:numPr>/.test(p));
    assert.doesNotMatch(items[0], /<w:keepNext/);
    assert.match(items[1], /<w:keepNext\/>/);
    // Una tabla: los párrafos de su última fila
    const tabla = { tipo: 'tabla', anchos: [50, 50], filas: [1, 2].map(n => ({ celdas: [{ partes: [{ texto: `a${n}` }] }, { partes: [{ texto: `b${n}` }] }] })) };
    const filas = tablas((await conHoja([tabla, { tipo: 'firma', columnas: 1 }])).documento)[0].match(/<w:tr>[\s\S]*?<\/w:tr>/g);
    assert.doesNotMatch(filas[0], /<w:keepNext/);
    assert.equal(cuantas(filas[1], '<w:keepNext/>'), 2);
  });

  it('la nota de la DGMIT termina en el espacio de una firma', async () => {
    const { documento } = await conHoja(nota({ tipo: 'externa' }));
    const parrafos = parrafosFueraDeTablas(desdeElBody(documento));
    assert.match(parrafos.at(-1), /<w:spacing w:before="1440"/);
    assert.equal(tablas(documento).length, 1);
  });
});
