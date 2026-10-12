// PDF de la Nota Digital con el formato de la Resolución 2820/2022: hoja oficio, Helvetica 12.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6.6)
import zlib from 'node:zlib';
import PDFDocument from 'pdfkit';

const MM = 72 / 25.4;
const PAGINA = [216 * MM, 330 * MM];
const MARGENES = { top: 25 * MM, bottom: 25 * MM, left: 30 * MM, right: 30 * MM };
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
// Validación de la imagen de la firma
// =====================================================
// PDFKit decodifica los PNG con transparencia (o entrelazados) con png-js, que descomprime en un callback de zlib
// y lanza sus errores ahí: un PNG dañado no rechaza la promesa de renderPdf, tumba el proceso. Esta validación
// es síncrona y recorre la imagen como lo hará png-js, para rechazarla antes de que llegue a PDFKit.
export class ImagenInvalida extends Error {}
const imagenInvalida = (detalle) => new ImagenInvalida(`La imagen de la firma no es válida: ${detalle}`);

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Una firma ocupa 140 × 60 puntos en la nota: el límite solo acota la memoria que usa png-js al decodificarla
const MAXIMO_LADO_PNG = 4000;
// Tipo de color PNG → canales por píxel y profundidades válidas
const TIPOS_COLOR_PNG = { 0: [1, [1, 2, 4, 8, 16]], 2: [3, [8, 16]], 3: [1, [1, 2, 4, 8]], 4: [2, [8, 16]], 6: [4, [8, 16]] };
// Pasadas del entrelazado Adam7 (x0, y0, dx, dy), en el orden en que las recorre png-js
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

const validarPng = (datos) => {
  if (datos.length < FIRMA_PNG.length || !datos.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG)) throw imagenInvalida('no es un PNG');
  let cabecera = null;
  let paleta = false;
  const comprimidos = [];
  for (let pos = FIRMA_PNG.length, fin = false; !fin;) {
    if (pos + 12 > datos.length) throw imagenInvalida('el archivo está incompleto (falta el final del PNG)');
    const largo = datos.readUInt32BE(pos);
    const tipo = datos.toString('latin1', pos + 4, pos + 8);
    if (largo > 0x7fffffff || pos + 12 + largo > datos.length) throw imagenInvalida('el archivo está incompleto o tiene un bloque dañado');
    const contenido = datos.subarray(pos + 8, pos + 8 + largo);
    if (!cabecera && tipo !== 'IHDR') throw imagenInvalida('falta la cabecera del PNG');
    if (tipo === 'IHDR') {
      if (largo !== 13) throw imagenInvalida('la cabecera del PNG está dañada');
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
    throw imagenInvalida('el formato del PNG no es válido');
  }
  if (ancho < 1 || alto < 1) throw imagenInvalida('la imagen no tiene píxeles');
  if (ancho > MAXIMO_LADO_PNG || alto > MAXIMO_LADO_PNG) {
    throw imagenInvalida(`mide ${ancho} × ${alto} píxeles y el máximo es ${MAXIMO_LADO_PNG} × ${MAXIMO_LADO_PNG}`);
  }
  if (color === 3 && !paleta) throw imagenInvalida('falta la paleta de colores del PNG');
  if (comprimidos.length === 0) throw imagenInvalida('el PNG no tiene datos de imagen');

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
    throw imagenInvalida('los datos de la imagen están dañados y no se pueden descomprimir');
  }
  if (crudo.length < esperado) throw imagenInvalida('los datos de la imagen están incompletos');
  let inicioFila = 0;
  for (const { filas, largoFila } of pasadas) {
    for (let fila = 0; fila < filas; fila++, inicioFila += largoFila) {
      if (crudo[inicioFila] > 4) throw imagenInvalida('los datos de la imagen están dañados (filtro de fila inválido)');
    }
  }
};

// Marcadores SOF (inicio de cuadro) de JPEG: definen el tamaño y los canales de la imagen
const MARCADORES_SOF = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
const FIN_JPEG = Buffer.from([0xff, 0xd9]);

// Recorre los segmentos hasta el inicio de los datos (SOS): tiene que haber un SOF válido antes y el EOI al final
const validarJpeg = (datos) => {
  if (datos.length < 4 || datos[0] !== 0xff || datos[1] !== 0xd8) throw imagenInvalida('no es un JPEG');
  let pos = 2;
  let cuadro = false;
  for (;;) {
    if (pos + 4 > datos.length) throw imagenInvalida('el archivo está incompleto');
    if (datos[pos] !== 0xff) throw imagenInvalida('la estructura del JPEG está dañada');
    const marcador = datos[pos + 1];
    if (marcador === 0xff) { pos += 1; continue; } // byte de relleno
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) { pos += 2; continue; } // marcadores sin largo
    if (marcador === 0xd8 || marcador === 0xd9) throw imagenInvalida('la estructura del JPEG está dañada');
    const largo = datos.readUInt16BE(pos + 2);
    if (largo < 2 || pos + 2 + largo > datos.length) throw imagenInvalida('el archivo está incompleto o tiene un segmento dañado');
    if (MARCADORES_SOF.includes(marcador)) {
      if (largo < 8) throw imagenInvalida('la cabecera del JPEG está dañada');
      const alto = datos.readUInt16BE(pos + 5);
      const ancho = datos.readUInt16BE(pos + 7);
      if (!alto || !ancho || ![1, 3, 4].includes(datos[pos + 9])) throw imagenInvalida('la cabecera del JPEG no es válida');
      cuadro = true;
    }
    pos += 2 + largo;
    if (marcador === 0xda) break;
  }
  if (!cuadro) throw imagenInvalida('falta la cabecera de la imagen JPEG');
  if (datos.indexOf(FIN_JPEG, pos) === -1) throw imagenInvalida('el archivo está incompleto (falta el final del JPEG)');
};

const tipoDeImagen = (datos) => ({ 0x89: 'image/png', 0xff: 'image/jpeg' }[datos[0]] ?? null);

// Valida de forma síncrona una imagen de firma (PNG o JPEG). Lanza un Error con un mensaje para mostrar si no sirve.
// Sin mime, el tipo se deduce de los primeros bytes, como hace PDFKit.
export const validarImagenFirma = (datos, mime) => {
  if (!Buffer.isBuffer(datos) || datos.length === 0) throw imagenInvalida('el archivo está vacío');
  const tipo = mime ?? tipoDeImagen(datos);
  try {
    if (tipo === 'image/png') validarPng(datos);
    else if (tipo === 'image/jpeg') validarJpeg(datos);
    else throw imagenInvalida('debe ser PNG o JPEG');
    // Último control: el lector de PDFKit (síncrono) tiene que poder abrirla
    new PDFDocument({ autoFirstPage: false }).openImage(datos);
  } catch (error) {
    if (error instanceof ImagenInvalida) throw error;
    throw imagenInvalida(`no se puede leer (${error?.message ?? error})`);
  }
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
  const limite = () => doc.page.height - MARGENES.bottom;
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

const agregarPies = (doc, nota, ancho) => {
  const { start, count } = doc.bufferedPageRange();
  if (count < 2) return;
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    // Sin margen inferior temporalmente: escribir debajo del margen agregaría una hoja
    const inferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(NORMAL).fontSize(8).text(`Nota Digital N° ${nota.numeroTexto} – Página ${i + 1} de ${count}`,
      MARGENES.left, doc.page.height - inferior / 2, { width: ancho, align: 'center', lineBreak: false });
    doc.page.margins.bottom = inferior;
  }
};

export const renderPdf = (nota, { firmaImagen = null } = {}) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: PAGINA,
    margins: MARGENES,
    bufferPages: true,
    info: { Title: `Nota Digital ${nota.numeroTexto}`, Author: 'Dirección de Datos Públicos y Comunicación', Subject: nota.asunto }
  });
  const partes = [];
  doc.on('data', parte => partes.push(parte));
  doc.on('end', () => resolve(Buffer.concat(partes)));
  doc.on('error', reject);

  try {
    // Una imagen dañada rechaza la promesa acá, antes de llegar a PDFKit (que tumbaría el proceso)
    if (firmaImagen) validarImagenFirma(firmaImagen);
    const ancho = doc.page.width - MARGENES.left - MARGENES.right;
    const asegurarEspacio = (alto) => {
      // (si ya está arriba de una hoja, un bloque más alto que la hoja no justifica dejarla en blanco)
      if (doc.y + alto > doc.page.height - MARGENES.bottom && doc.y > MARGENES.top + 1) doc.addPage();
    };
    const altoTexto = (texto, tamano = 12) => {
      doc.font(NORMAL).fontSize(tamano);
      return doc.heightOfString(texto, { width: ancho });
    };
    const parrafo = (texto, { fuente = NORMAL, tamano = 12, align = 'justify', underline = false, espacio = 0.6 } = {}) => {
      doc.font(fuente).fontSize(tamano).text(texto, MARGENES.left, doc.y, { width: ancho, align, underline });
      doc.moveDown(espacio);
    };

    // REF., número y destinatario
    doc.font(NEGRITA).fontSize(12).text('REF.:', MARGENES.left, MARGENES.top, { underline: true, continued: true })
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
      asegurarEspacio(70);
      parrafo('Datos de contacto de las áreas responsables', { fuente: NEGRITA, align: 'left', espacio: 0.4 });
      for (const contacto of nota.contactos) {
        asegurarEspacio(14 * (contacto.lineas.length + 1));
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

    agregarPies(doc, nota, ancho);
    doc.end();
  } catch (error) {
    reject(error);
  }
});
