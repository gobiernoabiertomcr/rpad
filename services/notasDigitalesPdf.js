// PDF de la Nota Digital con el formato de la Resolución 2820/2022: hoja oficio, Helvetica 12, membrete municipal.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6.6)
import zlib from 'node:zlib';
import PDFDocument from 'pdfkit';

const MM = 72 / 25.4;
const PAGINA = [216 * MM, 330 * MM];
// Sin banner del membrete el margen superior es de 25 mm; con banner, el alto del banner más 9 mm (nunca menos de 25)
const MARGENES = { top: 25 * MM, bottom: 25 * MM, left: 30 * MM, right: 30 * MM };
// El banner ocupa el ancho de la hoja con su alto proporcional, salvo que pase de 45 mm: entonces se achica, centrado
const ALTO_MAXIMO_BANNER = 45 * MM;
const SEPARACION_BANNER = 9 * MM;
// Ancho del texto de la hoja (entre los márgenes izquierdo y derecho)
const ANCHO_TEXTO = PAGINA[0] - MARGENES.left - MARGENES.right;
// Pie del membrete: Helvetica 10 centrado, con la línea de base a 12,5 mm del borde inferior. Si no entra en una
// línea se achica, nunca por debajo de 7 puntos (la configuración no guarda un pie que no entre ni así). Con ese
// pie, "Página p de t" sube a 17,5 mm: queda entre el contenido (que termina a 25 mm) y el pie, sin tocar ninguno.
const TAMANO_PIE = 10;
const TAMANO_MINIMO_PIE = 7;
const BASE_PIE = 12.5 * MM;
const BASE_PAGINACION = 17.5 * MM;
const NORMAL = 'Helvetica';
const NEGRITA = 'Helvetica-Bold';
const CURSIVA = 'Helvetica-Oblique';
// Proporción del ancho de cada columna: 6 columnas en avisos, 7 en reiteraciones
const PROPORCIONES = { 6: [32, 17, 12, 13, 11, 15], 7: [26, 14, 10, 11, 10, 13, 16] };
const TAMANO_TABLA = 8.5;
const RELLENO = 3;
// La primera columna (título del dataset) puede partir palabras larguísimas; las demás no
const MINIMO_TITULO = 55;
// Alto que necesitan el remitente, la firma y la línea CC: van juntos, sin que la firma quede sola en una hoja
const ALTO_CIERRE = 200;

// =====================================================
// Texto que Helvetica puede escribir (WinAnsi / CP1252)
// =====================================================
// Las fuentes estándar de PDFKit escriben un byte por carácter: los imprimibles de Latin-1 más los 27 caracteres
// que CP1252 pone en 0x80-0x9F. Cualquier otro (☎, →, emojis, uso privado, el acento suelto de un texto NFD) y los
// caracteres de control salen como basura y desordenan el resto de la línea.
const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const NO_ESCRIBIBLE = new RegExp(`[^\\n\\x20-\\x7e\\xa0-\\xff${CP1252_EXTRA}]`, 'gu');

// Último resguardo, para todo texto que se escribe o se mide en el PDF (DocumentoNota lo aplica siempre): NFC, los
// saltos de línea de Windows como "\n", el tabulador como espacio y lo que Helvetica no puede escribir como "?"
export const textoParaPdf = (texto) => String(texto ?? '').normalize('NFC')
  .replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(NO_ESCRIBIBLE, '?');

// Caracteres de un texto (ya en NFC) que el PDF no puede escribir, sin repetir, como se muestran en un mensaje
// (los invisibles, como U+0301). El tabulador y los saltos de línea no se marcan.
export const caracteresNoEscribibles = (texto) => [...new Set(String(texto).match(NO_ESCRIBIBLE) ?? [])]
  .filter(caracter => !'\t\r'.includes(caracter))
  .map(caracter => (/[\p{C}\p{M}\p{Z}]/u.test(caracter)
    ? `U+${caracter.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` : caracter));

// PDFKit con el resguardo: todo lo que se escribe (text) y se mide (widthOfString, heightOfString) pasa por
// textoParaPdf, así ninguna escritura de la nota puede saltearlo y las medidas coinciden con lo escrito.
// PDFKit llama a widthOfString por dentro con texto ya resguardado: aplicarlo de nuevo no lo cambia.
class DocumentoNota extends PDFDocument {
  text(texto, ...resto) { return super.text(textoParaPdf(texto), ...resto); }
  widthOfString(texto, ...resto) { return super.widthOfString(textoParaPdf(texto), ...resto); }
  heightOfString(texto, ...resto) { return super.heightOfString(textoParaPdf(texto), ...resto); }
}

// =====================================================
// Validación de las imágenes (firma y banner del membrete)
// =====================================================
// PDFKit decodifica los PNG con transparencia (o entrelazados) con png-js, que descomprime en un callback de zlib
// y lanza sus errores ahí: un PNG dañado no rechaza la promesa de renderPdf, tumba el proceso. Esta validación
// es síncrona y recorre la imagen como lo hará png-js, para rechazarla antes de que llegue a PDFKit.
export class ImagenInvalida extends Error {}
// Defecto encontrado al recorrer la imagen: validarImagen lo convierte en ImagenInvalida con el nombre de la imagen
class Defecto extends Error {}
const defecto = (detalle) => new Defecto(detalle);
// Cómo nombra a cada imagen el mensaje de error
const NOMBRES_IMAGEN = { firma: 'de la firma', membrete: 'del membrete' };

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// La firma ocupa 140 × 60 puntos y el banner, el ancho de la hoja: el límite solo acota la memoria que usa png-js
// al decodificarlas (4000 píxeles a lo ancho de una hoja oficio son unos 470 puntos por pulgada)
const MAXIMO_LADO_PNG = 4000;
// Tipo de color PNG → canales por píxel y profundidades válidas
const TIPOS_COLOR_PNG = { 0: [1, [1, 2, 4, 8, 16]], 2: [3, [8, 16]], 3: [1, [1, 2, 4, 8]], 4: [2, [8, 16]], 6: [4, [8, 16]] };
// Pasadas del entrelazado Adam7 (x0, y0, dx, dy), en el orden en que las recorre png-js
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

const validarPng = (datos) => {
  if (datos.length < FIRMA_PNG.length || !datos.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG)) throw defecto('no es un PNG');
  let cabecera = null;
  let paleta = false;
  const comprimidos = [];
  for (let pos = FIRMA_PNG.length, fin = false; !fin;) {
    if (pos + 12 > datos.length) throw defecto('el archivo está incompleto (falta el final del PNG)');
    const largo = datos.readUInt32BE(pos);
    const tipo = datos.toString('latin1', pos + 4, pos + 8);
    if (largo > 0x7fffffff || pos + 12 + largo > datos.length) throw defecto('el archivo está incompleto o tiene un bloque dañado');
    const contenido = datos.subarray(pos + 8, pos + 8 + largo);
    if (!cabecera && tipo !== 'IHDR') throw defecto('falta la cabecera del PNG');
    if (tipo === 'IHDR') {
      if (largo !== 13) throw defecto('la cabecera del PNG está dañada');
      cabecera = {
        ancho: contenido.readUInt32BE(0), alto: contenido.readUInt32BE(4), bits: contenido[8], color: contenido[9],
        compresion: contenido[10], filtro: contenido[11], entrelazado: contenido[12]
      };
    } else if (tipo === 'PLTE') {
      paleta = true;
    } else if (tipo === 'IDAT') {
      comprimidos.push(contenido);
    } else if (tipo === 'IEND') {
      fin = true;
    }
    pos += 12 + largo;
  }

  const { ancho, alto, bits, color, compresion, filtro, entrelazado } = cabecera;
  const tipoColor = TIPOS_COLOR_PNG[color];
  if (!tipoColor || !tipoColor[1].includes(bits) || compresion !== 0 || filtro !== 0 || ![0, 1].includes(entrelazado)) {
    throw defecto('el formato del PNG no es válido');
  }
  if (ancho < 1 || alto < 1) throw defecto('la imagen no tiene píxeles');
  if (ancho > MAXIMO_LADO_PNG || alto > MAXIMO_LADO_PNG) {
    throw defecto(`mide ${ancho} × ${alto} píxeles y el máximo es ${MAXIMO_LADO_PNG} × ${MAXIMO_LADO_PNG}`);
  }
  if (color === 3 && !paleta) throw defecto('falta la paleta de colores del PNG');
  if (comprimidos.length === 0) throw defecto('el PNG no tiene datos de imagen');

  // Filas de cada pasada como las arma png-js: un byte de filtro y ceil(bytes por píxel × ancho) bytes de datos
  const bytesPorPixel = (bits * tipoColor[0]) / 8;
  const pasadas = (entrelazado ? ADAM7 : [[0, 0, 1, 1]]).map(([x0, y0, dx, dy]) => ({
    filas: Math.max(0, Math.ceil((alto - y0) / dy)),
    largoFila: 1 + Math.max(0, Math.ceil(bytesPorPixel * Math.ceil((ancho - x0) / dx)))
  }));
  const esperado = pasadas.reduce((total, p) => total + p.filas * p.largoFila, 0);
  let crudo;
  try {
    crudo = zlib.inflateSync(Buffer.concat(comprimidos), { maxOutputLength: esperado + 1024 });
  } catch {
    throw defecto('los datos de la imagen están dañados y no se pueden descomprimir');
  }
  if (crudo.length < esperado) throw defecto('los datos de la imagen están incompletos');
  let inicioFila = 0;
  for (const { filas, largoFila } of pasadas) {
    for (let fila = 0; fila < filas; fila++, inicioFila += largoFila) {
      if (crudo[inicioFila] > 4) throw defecto('los datos de la imagen están dañados (filtro de fila inválido)');
    }
  }
};

// Marcadores SOF (inicio de cuadro) de JPEG: definen el tamaño y los canales de la imagen
const MARCADORES_SOF = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
const FIN_JPEG = Buffer.from([0xff, 0xd9]);

// Recorre los segmentos hasta el inicio de los datos (SOS): tiene que haber un SOF válido antes y el EOI al final
const validarJpeg = (datos) => {
  if (datos.length < 4 || datos[0] !== 0xff || datos[1] !== 0xd8) throw defecto('no es un JPEG');
  let pos = 2;
  let cuadro = false;
  for (;;) {
    if (pos + 4 > datos.length) throw defecto('el archivo está incompleto');
    if (datos[pos] !== 0xff) throw defecto('la estructura del JPEG está dañada');
    const marcador = datos[pos + 1];
    if (marcador === 0xff) { pos += 1; continue; } // byte de relleno
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) { pos += 2; continue; } // marcadores sin largo
    if (marcador === 0xd8 || marcador === 0xd9) throw defecto('la estructura del JPEG está dañada');
    const largo = datos.readUInt16BE(pos + 2);
    if (largo < 2 || pos + 2 + largo > datos.length) throw defecto('el archivo está incompleto o tiene un segmento dañado');
    if (MARCADORES_SOF.includes(marcador)) {
      if (largo < 8) throw defecto('la cabecera del JPEG está dañada');
      const alto = datos.readUInt16BE(pos + 5);
      const ancho = datos.readUInt16BE(pos + 7);
      if (!alto || !ancho || ![1, 3, 4].includes(datos[pos + 9])) throw defecto('la cabecera del JPEG no es válida');
      cuadro = true;
    }
    pos += 2 + largo;
    if (marcador === 0xda) break;
  }
  if (!cuadro) throw defecto('falta la cabecera de la imagen JPEG');
  if (datos.indexOf(FIN_JPEG, pos) === -1) throw defecto('el archivo está incompleto (falta el final del JPEG)');
};

const tipoDeImagen = (datos) => ({ 0x89: 'image/png', 0xff: 'image/jpeg' }[datos[0]] ?? null);

// Valida de forma síncrona una imagen (PNG o JPEG) y devuelve su tamaño a la vista en píxeles. Si no sirve, lanza
// ImagenInvalida con un mensaje para mostrar que nombra la imagen ("de la firma", "del membrete").
// Sin mime, el tipo se deduce de los primeros bytes, como hace PDFKit.
const validarImagen = (datos, mime, uso) => {
  const invalida = (detalle) => new ImagenInvalida(`La imagen ${NOMBRES_IMAGEN[uso]} no es válida: ${detalle}`);
  if (!Buffer.isBuffer(datos) || datos.length === 0) throw invalida('el archivo está vacío');
  const tipo = mime ?? tipoDeImagen(datos);
  try {
    if (tipo === 'image/png') validarPng(datos);
    else if (tipo === 'image/jpeg') validarJpeg(datos);
    else throw defecto('debe ser PNG o JPEG');
    // Último control: el lector de PDFKit (síncrono) tiene que poder abrirla
    const imagen = new PDFDocument({ autoFirstPage: false }).openImage(datos);
    // El tamaño a la vista: un JPEG con orientación EXIF 5 a 8 está guardado girado 90° y PDFKit lo dibuja derecho
    const girada = imagen.orientation > 4;
    return { ancho: girada ? imagen.height : imagen.width, alto: girada ? imagen.width : imagen.height };
  } catch (error) {
    if (error instanceof Defecto) throw invalida(error.message);
    throw invalida(`no se puede leer (${error?.message ?? error})`);
  }
};

export const validarImagenFirma = (datos, mime) => validarImagen(datos, mime, 'firma');
export const validarImagenMembrete = (datos, mime) => validarImagen(datos, mime, 'membrete');

// Tamaño y posición del banner en la hoja (en puntos), a partir de su tamaño en píxeles
const medidasBanner = ({ ancho, alto }) => {
  const anchoHoja = PAGINA[0];
  const escala = Math.min(anchoHoja / ancho, ALTO_MAXIMO_BANNER / alto);
  return { ancho: ancho * escala, alto: alto * escala, x: (anchoHoja - ancho * escala) / 2 };
};

// Texto del pie del membrete (resguardado) en una sola línea; null si no hay
const textoPie = (pie) => textoParaPdf(pie).replace(/\s+/g, ' ').trim() || null;

// Si el pie del membrete entra en una línea con la letra más chica que se usa (7 puntos), medido con PDFKit sobre
// el ancho real del texto de la hoja. Un pie vacío entra.
export const pieEntraEnUnaLinea = (pie) => {
  const texto = textoPie(pie);
  if (!texto) return true;
  return new DocumentoNota({ autoFirstPage: false }).font(NORMAL).fontSize(TAMANO_MINIMO_PIE).widthOfString(texto) <= ANCHO_TEXTO;
};

// Ancho de cada columna: la proporción base, ampliada lo justo para que no se corten fechas,
// frecuencias ni encabezados, y recortada de las columnas que tienen holgura
const calcularAnchos = (doc, seccion, ancho) => {
  const base = PROPORCIONES[seccion.columnas.length].map(p => (p / 100) * ancho);
  const palabraMasLarga = (texto, fuente) => {
    doc.font(fuente).fontSize(TAMANO_TABLA);
    return Math.max(...String(texto).split(/\s+/).map(palabra => doc.widthOfString(palabra)));
  };
  const minimos = seccion.columnas.map((titulo, i) => {
    const largo = Math.max(palabraMasLarga(titulo, NEGRITA), ...seccion.filas.map(f => palabraMasLarga(f.valores[i], NORMAL)));
    return Math.min(largo, i === 0 ? MINIMO_TITULO : Infinity) + 2 * RELLENO + 1;
  });
  if (minimos.reduce((a, b) => a + b, 0) > ancho) return base;
  const anchos = base.map((a, i) => Math.max(a, minimos[i]));
  const exceso = anchos.reduce((a, b) => a + b, 0) - ancho;
  if (exceso <= 0) return anchos;
  const holguras = anchos.map((a, i) => a - minimos[i]);
  const totalHolgura = holguras.reduce((a, b) => a + b, 0);
  return anchos.map((a, i) => a - exceso * holguras[i] / totalHolgura);
};

// Prepara la tabla de una sección: devuelve cuánto alto necesitan el encabezado y la primera fila (con su
// antecedente) para que quepan juntos, y la función que la dibuja
const prepararTabla = (doc, seccion, ancho) => {
  const anchos = calcularAnchos(doc, seccion, ancho);
  const limite = () => doc.page.height - doc.page.margins.bottom;
  const izquierda = MARGENES.left;

  const altoDe = (valores, fuente) => {
    doc.font(fuente).fontSize(TAMANO_TABLA);
    return Math.max(...valores.map((v, i) => doc.heightOfString(String(v), { width: anchos[i] - 2 * RELLENO }))) + 2 * RELLENO;
  };

  const altoAncha = (texto) => {
    doc.font(CURSIVA).fontSize(TAMANO_TABLA);
    return doc.heightOfString(texto, { width: ancho - 2 * RELLENO }) + 2 * RELLENO;
  };

  // reserva: alto que debe quedar libre a continuación (el antecedente no se separa de su fila)
  const fila = (valores, fuente, url = null, reserva = 0) => {
    const alto = altoDe(valores, fuente);
    if (doc.y + alto + reserva > limite()) {
      doc.addPage();
      if (fuente !== NEGRITA) encabezado();
    }
    const y = doc.y;
    let x = izquierda;
    valores.forEach((valor, i) => {
      doc.lineWidth(0.5).rect(x, y, anchos[i], alto).stroke();
      doc.font(fuente).fontSize(TAMANO_TABLA)
        .text(String(valor), x + RELLENO, y + RELLENO, { width: anchos[i] - 2 * RELLENO, link: i === 0 && url ? url : null });
      x += anchos[i];
    });
    doc.x = izquierda;
    doc.y = y + alto;
  };

  const encabezado = () => fila(seccion.columnas, NEGRITA);

  const filaAncha = (texto) => {
    const alto = altoAncha(texto);
    if (doc.y + alto > limite()) {
      doc.addPage();
      encabezado();
    }
    const y = doc.y;
    doc.lineWidth(0.5).rect(izquierda, y, ancho, alto).stroke();
    doc.font(CURSIVA).fontSize(TAMANO_TABLA).text(texto, izquierda + RELLENO, y + RELLENO, { width: ancho - 2 * RELLENO });
    doc.x = izquierda;
    doc.y = y + alto;
  };

  const primera = seccion.filas[0];
  const altoInicio = altoDe(seccion.columnas, NEGRITA)
    + (primera ? altoDe(primera.valores, NORMAL) + (primera.antecedente ? altoAncha(primera.antecedente) : 0) : 0);

  const dibujar = () => {
    encabezado();
    for (const f of seccion.filas) {
      fila(f.valores, NORMAL, f.url, f.antecedente ? altoAncha(f.antecedente) : 0);
      if (f.antecedente) filaAncha(f.antecedente);
    }
  };

  return { altoInicio, dibujar };
};

// Membrete (banner y pie) y numeración de cada hoja: se dibujan al final, cuando ya se sabe cuántas hojas hay.
// banner: { imagen (abierta con doc.openImage, así el archivo la guarda una sola vez), ancho, alto, x } o null.
const agregarMembreteYPies = (doc, nota, ancho, { banner, pie }) => {
  const { start, count } = doc.bufferedPageRange();
  if (count < 2 && !banner && !pie) return;
  // Un pie más ancho que el texto de la hoja se achica para entrar en una línea (hacia abajo, al centésimo de punto),
  // hasta 7 puntos: uno que no entra ni así (la configuración no lo guarda) sale en 7 puntos, centrado.
  // Se centra a mano y se escribe sin ancho: el ajuste de líneas de PDFKit mide palabra por palabra, sin el
  // interletrado entre el espacio y la palabra siguiente, y podría partir en dos un pie que sí entra.
  doc.font(NORMAL).fontSize(TAMANO_PIE);
  const tamanoPie = pie
    ? Math.max(TAMANO_MINIMO_PIE, Math.min(TAMANO_PIE, Math.floor(TAMANO_PIE * ancho / doc.widthOfString(pie) * 100) / 100))
    : null;
  const xPie = pie ? MARGENES.left + (ancho - doc.fontSize(tamanoPie).widthOfString(pie)) / 2 : null;
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    // Sin margen inferior temporalmente: escribir debajo del margen agregaría una hoja
    const inferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    if (banner) doc.image(banner.imagen, banner.x, 0, { width: banner.ancho, height: banner.alto });
    // Con baseline 'alphabetic' la y es la de la línea de base
    if (pie) doc.font(NORMAL).fontSize(tamanoPie).text(pie, xPie, doc.page.height - BASE_PIE, { lineBreak: false, baseline: 'alphabetic' });
    if (count > 1) {
      const paginacion = `Nota Digital N° ${nota.numeroTexto} – Página ${i + 1} de ${count}`;
      doc.font(NORMAL).fontSize(8);
      if (pie) {
        doc.text(paginacion, MARGENES.left, doc.page.height - BASE_PAGINACION, { width: ancho, align: 'center', lineBreak: false, baseline: 'alphabetic' });
      } else {
        doc.text(paginacion, MARGENES.left, doc.page.height - inferior / 2, { width: ancho, align: 'center', lineBreak: false });
      }
    }
    doc.page.margins.bottom = inferior;
  }
};

export const renderPdf = (nota, { firmaImagen = null, membreteImagen = null, membretePie = null } = {}) => new Promise((resolve, reject) => {
  try {
    // Una imagen dañada rechaza la promesa acá, antes de llegar a PDFKit (que tumbaría el proceso)
    if (firmaImagen) validarImagenFirma(firmaImagen);
    const banner = membreteImagen ? medidasBanner(validarImagenMembrete(membreteImagen)) : null;
    const pie = textoPie(membretePie);

    // El margen superior vale para todas las hojas (PDFKit lo aplica también a las que agrega addPage)
    const superior = banner ? Math.max(MARGENES.top, banner.alto + SEPARACION_BANNER) : MARGENES.top;
    const doc = new DocumentoNota({
      size: PAGINA,
      margins: { ...MARGENES, top: superior },
      bufferPages: true,
      info: { Title: `Nota Digital ${nota.numeroTexto}`, Author: 'Dirección de Datos Públicos y Comunicación', Subject: nota.asunto }
    });
    const partes = [];
    doc.on('data', parte => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    if (banner) banner.imagen = doc.openImage(membreteImagen);

    const ancho = ANCHO_TEXTO;
    const asegurarEspacio = (alto) => {
      // (si ya está arriba de una hoja, un bloque más alto que la hoja no justifica dejarla en blanco)
      if (doc.y + alto > doc.page.height - doc.page.margins.bottom && doc.y > doc.page.margins.top + 1) doc.addPage();
    };
    const altoTexto = (texto, tamano = 12, fuente = NORMAL) => {
      doc.font(fuente).fontSize(tamano);
      return doc.heightOfString(texto, { width: ancho });
    };
    // Lo que avanza doc.moveDown(espacio) con esa fuente
    const altoEspacio = (espacio, tamano, fuente = NORMAL) => {
      doc.font(fuente).fontSize(tamano);
      return doc.currentLineHeight(true) * espacio;
    };
    // Alto real de un contacto como lo dibuja el bucle de abajo: nombre en negrita 10, espacio y líneas en 10
    const altoContacto = (contacto) => altoTexto(contacto.nombre, 10, NEGRITA) + altoEspacio(0.1, 10, NEGRITA)
      + altoTexto(contacto.lineas.join('\n'), 10);
    const parrafo = (texto, { fuente = NORMAL, tamano = 12, align = 'justify', underline = false, espacio = 0.6 } = {}) => {
      doc.font(fuente).fontSize(tamano).text(texto, MARGENES.left, doc.y, { width: ancho, align, underline });
      doc.moveDown(espacio);
    };

    // REF., número y destinatario
    doc.font(NEGRITA).fontSize(12).text('REF.:', MARGENES.left, doc.page.margins.top, { underline: true, continued: true })
      .font(NORMAL).text(` "${nota.ref}"`, { underline: false });
    doc.moveDown(0.3);
    parrafo(`Nota Digital N° ${nota.numeroTexto}`, { fuente: NEGRITA, align: 'right', espacio: 1.2 });
    parrafo(nota.destinatario, { fuente: NEGRITA, underline: true, align: 'left', espacio: 1 });
    parrafo(nota.parrafoInicial);

    for (const seccion of nota.secciones) {
      // El título, la introducción, el encabezado de la tabla y su primera fila viajan juntos (10 pt: separaciones)
      const tabla = prepararTabla(doc, seccion, ancho);
      asegurarEspacio(altoTexto(seccion.titulo) + altoTexto(seccion.introduccion) + 10 + tabla.altoInicio);
      parrafo(seccion.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      parrafo(seccion.introduccion, { espacio: 0.4 });
      tabla.dibujar();
      doc.moveDown(0.8);
    }

    if (nota.contactos.length) {
      // El título viaja con el primer contacto entero (medido, no estimado): nunca queda solo al pie de una hoja
      const titulo = 'Datos de contacto de las áreas responsables';
      asegurarEspacio(altoTexto(titulo, 12, NEGRITA) + altoEspacio(0.4, 12, NEGRITA) + altoContacto(nota.contactos[0]));
      parrafo(titulo, { fuente: NEGRITA, align: 'left', espacio: 0.4 });
      for (const contacto of nota.contactos) {
        asegurarEspacio(altoContacto(contacto));
        parrafo(contacto.nombre, { fuente: NEGRITA, tamano: 10, align: 'left', espacio: 0.1 });
        parrafo(contacto.lineas.join('\n'), { tamano: 10, align: 'left', espacio: 0.5 });
      }
    }

    // El título viaja con el primer párrafo; y el último párrafo, con el remitente, la firma y la línea CC.
    // Si hay un solo párrafo (o ninguno) es a la vez el primero y el último: se reserva todo junto antes
    // de imprimir el título, para que no se cambie de hoja justo después de escribirlo.
    const ultimo = nota.justificacion.length - 1;
    asegurarEspacio(25 + altoTexto(nota.justificacion[0] || '') + (ultimo <= 0 ? ALTO_CIERRE : 0));
    parrafo('Justificación:', { fuente: NEGRITA, align: 'left', espacio: 0.3 });
    nota.justificacion.forEach((texto, i) => {
      if (i === ultimo && ultimo > 0) asegurarEspacio(altoTexto(texto) + ALTO_CIERRE);
      parrafo(texto);
    });

    doc.moveDown(0.6);
    doc.font(NEGRITA).fontSize(12).text(nota.remitente, MARGENES.left, doc.y, { underline: true, continued: true })
      .font(NORMAL).text(`, ${nota.fechaLarga}.`, { underline: false });

    // Firma a la derecha: imagen (si está cargada), nombre y cargo
    const anchoFirma = 200;
    const xFirma = MARGENES.left + ancho - anchoFirma;
    doc.moveDown(1.5);
    let y = doc.y;
    if (firmaImagen) {
      doc.image(firmaImagen, xFirma + (anchoFirma - 140) / 2, y, { fit: [140, 60], align: 'center', valign: 'bottom' });
      y += 64;
    } else {
      y += 30;
    }
    doc.font(NORMAL).fontSize(11).text(nota.firma.nombre, xFirma, y, { width: anchoFirma, align: 'center' });
    doc.text(nota.firma.cargo, xFirma, doc.y, { width: anchoFirma, align: 'center' });

    doc.moveDown(1.5);
    parrafo(nota.lineaCc, { tamano: 11, align: 'left' });

    agregarMembreteYPies(doc, nota, ancho, { banner, pie });
    doc.end();
  } catch (error) {
    reject(error);
  }
});
