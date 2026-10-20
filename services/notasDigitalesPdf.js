// PDF de la Nota Digital con el formato de la Resolución 2820/2022: hoja oficio, Helvetica 12, membrete municipal.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6.6)
import zlib from 'node:zlib';
import PDFDocument from 'pdfkit';
import { renglonesDeFirma } from './notasDigitalesContenido.js';

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
// Proporción del ancho de cada columna (spec 2026-10-17-fechas-datasets, 9 y 18): 4 columnas en los próximos a vencer de los
// avisos (desde el 18/10/2026 no llevan la fecha sugerida de envío), con "Datos solicitados" como la más ancha después del
// título; 7 en las reiteraciones (y en los vencidos que pudiera traer un aviso), con "Datos solicitados" en la cuarta, en lugar
// de "Última actualización" (le ceden el título, "Situación" e "Informado en"). Un pedido "Del … al …" ocupa uno o dos
// renglones (conFechasJuntas). Con los avisos reales de 2026, un área más ancha da tablas más bajas que un pedido en un solo
// renglón. (6: la tabla de los avisos anteriores a esa spec; ninguna nota nueva la usa)
// 5 en los próximos a vencer del aviso externo, con "Requiere nota DGMIT" en la cuarta (spec 2026-10-20-requiere-nota-y-anexo-
// reiteracion, 1.5; probadas con el aviso real del 22/12/2026): el encabezado ocupa tres renglones y "Del … al …", dos. La
// tabla externa de 7 columnas no usa las de 7 de acá: trae las suyas (seccion.proporciones, de construirNota).
const PROPORCIONES = { 4: [30, 26, 16, 28], 5: [28, 24, 15, 10, 23], 6: [32, 17, 12, 13, 11, 15], 7: [24, 14, 10, 15, 10, 12, 15] };
// Si alguna fila lleva el antecedente de los emails anteriores en "Informado en" (reiteraciones, en letra más chica),
// esa columna necesita más ancho para que la fila no crezca de más: lo cede sobre todo el título (la externa hace lo mismo con
// las suyas, en construirNota)
const PROPORCIONES_CON_SEGUNDA = { 7: [18, 14, 10, 13, 10, 10, 25] };
const TAMANO_TABLA = 8.5;
const RELLENO = 3;
// La primera columna (título del dataset) puede partir palabras larguísimas; las demás no
const MINIMO_TITULO = 55;
// Segunda parte, en letra más chica, de la celda "Informado en" de las reiteraciones (antecedente de los emails
// anteriores, spec 6.4), debajo del texto de la nota
const TAMANO_SECUNDARIO = 7;
const SEPARACION_SECUNDARIO = 1.5;
// Alto que necesitan el remitente, la firma y la línea CC: van juntos, sin que la firma quede sola en una hoja.
// Cuenta una línea por el nombre y una por el cargo de la firma; si no entran en ANCHO_FIRMA, renderPdf suma lo que ocupan de
// más, y también el renglón del personal contratado.
const ALTO_CIERRE = 200;
// Ancho en que se centran el nombre y el cargo de cada firma (puntos)
const ANCHO_FIRMA = 200;
// Letra del nombre y el cargo de la firma, y la del renglón del personal contratado (entre los dos: más chica, para que el
// cargo tenga preponderancia; en 9 pt entra en una línea de ANCHO_FIRMA)
const TAMANO_FIRMA = 11;
const TAMANO_RENGLON_CHICO = 9;
// Aire entre las firmas y la leyenda de una nota presentada por autorización (spec 2026-10-15, 7.2), en líneas de 11 pt
const ESPACIO_LEYENDA = 0.8;
// Espacio debajo de cada párrafo (en líneas de su letra) y alto que se reserva para el título "Justificación:"
const ESPACIO_PARRAFO = 0.6;
const ALTO_TITULO_JUSTIFICACION = 25;
// Aire de más arriba de la línea del anexo (puntos): con él queda más separada del último contacto (o de la tabla)
// que los contactos entre sí, y un poco más que de "Justificación:"
const AIRE_ANEXO = 6;
// Ítems con viñeta de los apartados de la nota de auditoría: la viñeta, a SANGRIA_ITEM del margen; el texto, SANGRIA_VINETA
// más adentro, con sus renglones alineados (sangría francesa). En puntos.
const SANGRIA_ITEM = 14;
const SANGRIA_VINETA = 10;

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
// También lo usa el anexo de los avisos (notasDigitalesAnexo.js).
export class DocumentoNota extends PDFDocument {
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

// Palabra más ancha de un texto como la mide PDFKit al partir líneas: cada palabra con el espacio que la sigue (la
// última, sin él). Si una palabra así no entra en el ancho de la celda, PDFKit la parte entre letras. PDFKit no corta en
// el espacio duro (U+00A0): lo que une es una sola palabra. Un salto de línea (la situación debajo de la fecha, un texto
// largo del detalle de la nota de auditoría) separa renglones: la última palabra de cada uno también va sin el espacio.
const anchosDePalabras = (doc, renglon) => {
  const palabras = renglon.split(/[^\S\u00a0]+/).filter(Boolean);
  return palabras.map((palabra, i) => doc.widthOfString(i < palabras.length - 1 ? `${palabra} ` : palabra));
};
const palabraMasAncha = (doc, texto, fuente, tamano) => {
  doc.font(fuente).fontSize(tamano);
  return Math.max(0, ...String(texto ?? '').split(/\r\n?|\n/).flatMap(renglon => anchosDePalabras(doc, renglon)));
};

// En las celdas, salvo la del título, "Del" y "al" no se separan de la fecha que los sigue: un pedido como "Del 01/01/2026
// al 31/12/2026" pasa a dos renglones como "Del 01/01/2026" y "al 31/12/2026", nunca con un "Del" solo arriba (spec
// 2026-10-17-fechas-datasets, 9: "Datos solicitados"). Tampoco el "N°" de una nota se separa de su número: "Informado en"
// de la reiteración, con dos o tres avisos (spec 2026-10-15, 7.6), no deja "Nota Digital N°" arriba y "10/26" abajo, son notas
// formales. Se unen con un espacio duro, que se escribe y se mide como un espacio.
const PREPOSICION_Y_FECHA = /\b(del|al) (?=\d{2}\/\d{2}\/\d{4})/gi;
const NUMERAL_Y_NUMERO = /N\u00b0 (?=\d)/g;
const conFechasJuntas = (seccion) => ({
  ...seccion,
  filas: seccion.filas.map(f => ({
    ...f,
    valores: f.valores.map((valor, i) => (i === 0
      ? valor
      : String(valor).replace(PREPOSICION_Y_FECHA, '$1\u00a0').replace(NUMERAL_Y_NUMERO, 'N\u00b0\u00a0')))
  }))
});

// La situación de las tablas externas (fila.situacion, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.5) va en la celda
// de la fecha ("Venció" o "Vence", seccion.columnaSituacion), en un renglón aparte y en la misma letra: se le suma al valor con un
// salto de línea. Así cuenta en el alto de la fila, en el ancho mínimo de la columna (sus palabras no se parten) y se dibuja con
// la celda. Una sección sin esa columna (las internas, la nota de auditoría) queda igual.
const conSituacionDebajo = (seccion) => {
  const columna = seccion.columnaSituacion;
  if (columna == null) return seccion;
  return {
    ...seccion,
    filas: seccion.filas.map(f => (f.situacion
      ? { ...f, valores: f.valores.map((valor, i) => (i === columna ? `${valor}\n${f.situacion}` : valor)) }
      : f))
  };
};

// Ancho de cada columna: la proporción base, ampliada lo justo para que ninguna palabra de las columnas que no son
// el título se parta (fechas, frecuencias, áreas, encabezados), y recortada de las columnas que tienen holgura.
// Si los mínimos no entran, cede primero el título (que puede partir palabras larguísimas).
const calcularAnchos = (doc, seccion, ancho) => {
  // Una sección puede traer sus proporciones (las tablas de la nota de auditoría y de su detalle, y la externa de 7 columnas)
  const proporciones = seccion.proporciones
    ?? (seccion.filas.some(f => f.informadoAnterior) ? PROPORCIONES_CON_SEGUNDA : PROPORCIONES)[seccion.columnas.length];
  const base = proporciones.map(p => (p / 100) * ancho);
  const ultima = seccion.columnas.length - 1;
  const minimos = seccion.columnas.map((titulo, i) => {
    const largo = Math.max(
      palabraMasAncha(doc, titulo, NEGRITA, TAMANO_TABLA),
      ...seccion.filas.map(f => palabraMasAncha(doc, f.valores[i], NORMAL, TAMANO_TABLA)),
      // La segunda parte, en letra más chica, de la última celda ("Informado en" de las reiteraciones)
      ...(i === ultima ? seccion.filas.map(f => palabraMasAncha(doc, f.informadoAnterior, NORMAL, TAMANO_SECUNDARIO)) : [])
    );
    // (en el detalle de la nota de auditoría una URL larga se parte dentro de su celda en lugar de achicar la de las etiquetas)
    return Math.min(largo, i === 0 ? MINIMO_TITULO : (seccion.partirPalabras ? base[i] - 2 * RELLENO - 1 : Infinity)) + 2 * RELLENO + 1;
  });
  const otras = minimos.slice(1).reduce((a, b) => a + b, 0);
  if (otras + minimos[0] > ancho) {
    // El título cede hasta el ancho de su encabezado; si ni así entran, las demás se reparten lo que queda en
    // proporción a su mínimo (alguna palabra se partirá: no hay ancho para todas)
    const titulo = Math.max(palabraMasAncha(doc, seccion.columnas[0], NEGRITA, TAMANO_TABLA) + 2 * RELLENO + 1, ancho - otras);
    return [titulo, ...minimos.slice(1).map(m => m * Math.min(1, (ancho - titulo) / otras))];
  }
  const anchos = base.map((a, i) => Math.max(a, minimos[i]));
  const exceso = anchos.reduce((a, b) => a + b, 0) - ancho;
  if (exceso <= 0) return anchos;
  const holguras = anchos.map((a, i) => a - minimos[i]);
  const totalHolgura = holguras.reduce((a, b) => a + b, 0);
  return anchos.map((a, i) => a - exceso * holguras[i] / totalHolgura);
};

// Prepara la tabla de una sección: devuelve cuánto alto necesitan el encabezado y la primera fila (con su fila de
// vencimiento, si la tiene, y su antecedente) para que quepan juntos, y la función que la dibuja.
// Una fila es { valores, url, antecedente, informadoAnterior, situacion, grupo }: el antecedente de los avisos va en una fila a
// todo el ancho debajo; informadoAnterior (reiteraciones) es la segunda parte de la última celda, debajo del texto de la nota
// y en letra más chica; situacion (tablas externas de 7 columnas) va debajo de la fecha, en su celda y en la misma letra; grupo
// (avisos con varios vencimientos, spec 18) es el texto de la fila a todo el ancho, en negrita, que abre un vencimiento y va
// arriba de la fila.
const prepararTabla = (doc, seccionDeLaNota, ancho) => {
  const seccion = conSituacionDebajo(conFechasJuntas(seccionDeLaNota));
  const anchos = calcularAnchos(doc, seccion, ancho);
  const limite = () => doc.page.height - doc.page.margins.bottom;
  const izquierda = MARGENES.left;
  const ultima = seccion.columnas.length - 1;

  // Alto del texto principal de una celda y, en la última, el de la segunda parte (con su separación)
  const altoPrincipal = (valor, i, fuente) => doc.font(fuente).fontSize(TAMANO_TABLA)
    .heightOfString(String(valor), { width: anchos[i] - 2 * RELLENO });
  const altoSegunda = (i, segunda) => (i === ultima && segunda
    ? SEPARACION_SECUNDARIO + doc.font(NORMAL).fontSize(TAMANO_SECUNDARIO).heightOfString(segunda, { width: anchos[i] - 2 * RELLENO })
    : 0);
  const altoDe = (valores, fuente, segunda = null) =>
    Math.max(...valores.map((v, i) => altoPrincipal(v, i, fuente) + altoSegunda(i, segunda))) + 2 * RELLENO;

  const altoAncha = (texto, fuente = CURSIVA) => {
    doc.font(fuente).fontSize(TAMANO_TABLA);
    return doc.heightOfString(texto, { width: ancho - 2 * RELLENO }) + 2 * RELLENO;
  };

  // reserva: alto que debe quedar libre a continuación (el antecedente no se separa de su fila)
  const fila = (valores, fuente, { url = null, reserva = 0, segunda = null } = {}) => {
    const alto = altoDe(valores, fuente, segunda);
    if (doc.y + alto + reserva > limite()) {
      doc.addPage();
      if (fuente !== NEGRITA) encabezado();
    }
    const y = doc.y;
    let x = izquierda;
    valores.forEach((valor, i) => {
      const anchoTexto = anchos[i] - 2 * RELLENO;
      doc.lineWidth(0.5).rect(x, y, anchos[i], alto).stroke();
      doc.font(fuente).fontSize(TAMANO_TABLA)
        .text(String(valor), x + RELLENO, y + RELLENO, { width: anchoTexto, link: i === 0 && url ? url : null });
      if (i === ultima && segunda) {
        // (se mide antes de elegir la letra chica: medir cambia la letra del documento)
        const ySegunda = y + RELLENO + altoPrincipal(valor, i, fuente) + SEPARACION_SECUNDARIO;
        doc.font(NORMAL).fontSize(TAMANO_SECUNDARIO).text(segunda, x + RELLENO, ySegunda, { width: anchoTexto });
        // Vuelve a la letra de la tabla: el aire que se deja debajo de ella se mide con la letra del documento
        doc.font(fuente).fontSize(TAMANO_TABLA);
      }
      x += anchos[i];
    });
    doc.x = izquierda;
    doc.y = y + alto;
  };

  const encabezado = () => fila(seccion.columnas, NEGRITA);

  // reserva: alto que debe quedar libre a continuación (la fila de vencimiento no se separa de la primera fila de su grupo)
  const filaAncha = (texto, fuente = CURSIVA, reserva = 0) => {
    const alto = altoAncha(texto, fuente);
    if (doc.y + alto + reserva > limite()) {
      doc.addPage();
      encabezado();
    }
    const y = doc.y;
    doc.lineWidth(0.5).rect(izquierda, y, ancho, alto).stroke();
    doc.font(fuente).fontSize(TAMANO_TABLA).text(texto, izquierda + RELLENO, y + RELLENO, { width: ancho - 2 * RELLENO });
    doc.x = izquierda;
    doc.y = y + alto;
  };

  // Lo que ocupa una fila con su antecedente (el que debe quedar a continuación de lo que se dibuje antes de ella)
  const altoConAntecedente = (f) => altoDe(f.valores, NORMAL, f.informadoAnterior) + (f.antecedente ? altoAncha(f.antecedente) : 0);

  const primera = seccion.filas[0];
  const altoInicio = altoDe(seccion.columnas, NEGRITA)
    + (primera ? (primera.grupo ? altoAncha(primera.grupo, NEGRITA) : 0) + altoConAntecedente(primera) : 0);

  const dibujar = () => {
    encabezado();
    for (const f of seccion.filas) {
      // (la fila de vencimiento se dibuja con lo que ocupa la primera fila de su grupo: nunca queda sola al pie de una hoja)
      if (f.grupo) filaAncha(f.grupo, NEGRITA, altoConAntecedente(f));
      fila(f.valores, NORMAL, { url: f.url, reserva: f.antecedente ? altoAncha(f.antecedente) : 0, segunda: f.informadoAnterior });
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

export const renderPdf = (nota, { firmaImagen = null, presentanteImagen = null, membreteImagen = null, membretePie = null } = {}) => new Promise((resolve, reject) => {
  try {
    // Una imagen dañada rechaza la promesa acá, antes de llegar a PDFKit (que tumbaría el proceso)
    if (firmaImagen) validarImagenFirma(firmaImagen);
    if (presentanteImagen) validarImagenFirma(presentanteImagen);
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
    const altoTexto = (texto, tamano = 12, fuente = NORMAL, anchoTexto = ancho) => {
      doc.font(fuente).fontSize(tamano);
      return doc.heightOfString(texto, { width: anchoTexto });
    };
    // Lo que avanza doc.moveDown(espacio) con esa fuente
    const altoEspacio = (espacio, tamano, fuente = NORMAL) => {
      doc.font(fuente).fontSize(tamano);
      return doc.currentLineHeight(true) * espacio;
    };
    // Lo que el nombre y el cargo de una firma ocupan de más que una línea cada uno (11 pt, en ANCHO_FIRMA): con textos
    // largos se parten en varias, y dos firmas lado a lado ocupan lo que la más alta. Una línea cada uno ya está en ALTO_CIERRE.
    // El renglón del personal contratado no está: se suma entero.
    const unaLineaDeFirma = altoTexto('X', TAMANO_FIRMA, NORMAL, ANCHO_FIRMA);
    const altoDeMas = (texto) => Math.max(0, altoTexto(texto, TAMANO_FIRMA, NORMAL, ANCHO_FIRMA) - unaLineaDeFirma);
    const altoFirmaDeMas = (firma) => renglonesDeFirma(firma).reduce((total, { texto, chico }) =>
      total + (chico ? altoTexto(texto, TAMANO_RENGLON_CHICO, NORMAL, ANCHO_FIRMA) : altoDeMas(texto)), 0);
    // El cierre mide el nombre y el cargo de más y, con presentante, la leyenda (todo medido, no estimado)
    const altoCierre = ALTO_CIERRE
      + Math.max(altoFirmaDeMas(nota.firma), nota.firma.presentante ? altoFirmaDeMas(nota.firma.presentante) : 0)
      + (nota.firma.presentante ? altoEspacio(ESPACIO_LEYENDA, 11) + altoTexto(nota.firma.leyenda, 9, CURSIVA) : 0);
    // Alto real de un contacto como lo dibuja el bucle de abajo: nombre en negrita 10, espacio y líneas en 10
    const altoContacto = (contacto) => altoTexto(contacto.nombre, 10, NEGRITA) + altoEspacio(0.1, 10, NEGRITA)
      + altoTexto(contacto.lineas.join('\n'), 10);
    const parrafo = (texto, { fuente = NORMAL, tamano = 12, align = 'justify', underline = false, espacio = ESPACIO_PARRAFO } = {}) => {
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

    // Párrafo de autorización de los avisos de la víspera de la licencia del firmante (spec 2026-10-15, 7.2): inmediatamente
    // después del primer párrafo. Va entero o pasa entero a la hoja siguiente (nunca un renglón suelto); como el primer
    // párrafo está arriba de la primera hoja, los dos quedan en la misma hoja.
    if (nota.autorizacion) {
      asegurarEspacio(altoTexto(nota.autorizacion) + altoEspacio(ESPACIO_PARRAFO, 12));
      parrafo(nota.autorizacion);
    }

    // Párrafo del adelanto (aviso en su fecha de un pedido que la nota de la víspera ya había adelantado, spec 7.6): enseguida
    // del de autorización, si lo hay, con el mismo cuidado: entero en la hoja o entero en la siguiente
    if (nota.adelanto) {
      asegurarEspacio(altoTexto(nota.adelanto) + altoEspacio(ESPACIO_PARRAFO, 12));
      parrafo(nota.adelanto);
    }

    // El título, la introducción (si tiene), el encabezado de la tabla y su primera fila viajan juntos (10 pt: separaciones)
    // (fuenteTitulo: la letra con la que se mide el título; las secciones de siempre lo miden en NORMAL, como hasta ahora, y las
    // del detalle de la nota de auditoría, que traen el título del dataset y pueden pasar a dos renglones, en NEGRITA, que
    // es como se dibuja)
    const altoInicioDe = (seccion, tabla, fuenteTitulo = NORMAL) => altoTexto(seccion.titulo, 12, fuenteTitulo)
      + (seccion.introduccion ? altoTexto(seccion.introduccion) : 0) + 10 + tabla.altoInicio;
    const dibujarSeccion = (seccion, fuenteTitulo = NORMAL) => {
      const tabla = prepararTabla(doc, seccion, ancho);
      asegurarEspacio(altoInicioDe(seccion, tabla, fuenteTitulo));
      parrafo(seccion.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      if (seccion.introduccion) parrafo(seccion.introduccion, { espacio: 0.4 });
      tabla.dibujar();
      doc.moveDown(0.8);
    };
    nota.secciones.forEach(seccion => dibujarSeccion(seccion));

    // Nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.3): el detalle de cada cambio; el título
    // viaja con el primero
    if (nota.detalles?.secciones.length) {
      const primera = nota.detalles.secciones[0];
      asegurarEspacio(altoTexto(nota.detalles.titulo, 12, NEGRITA) + altoEspacio(0.4, 12, NEGRITA)
        + altoInicioDe(primera, prepararTabla(doc, primera, ancho), NEGRITA));
      parrafo(nota.detalles.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.4 });
      nota.detalles.secciones.forEach(seccion => dibujarSeccion(seccion, NEGRITA));
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

    // Apartados de la nota de auditoría (spec 10.3): título, párrafos, ítems con viñeta y párrafos de cierre. Lo que se reserva
    // es exactamente lo que se dibuja (el alto de cada bloque y el aire que deja debajo): el título viaja con sus dos primeros
    // bloques (así "La auditoría consiste en verificar que:" no queda sola al pie de una hoja) y el último bloque del último
    // apartado, con el remitente, la firma y la línea CC (como el último párrafo de la justificación en las demás notas): la
    // firma no queda sola en una hoja, sin texto de la nota arriba.
    const apartados = nota.apartados ?? [];
    apartados.forEach((apartado, k) => {
      const anchoItem = ancho - SANGRIA_ITEM - SANGRIA_VINETA;
      // Los bloques del apartado en el orden en que se dibujan
      const bloques = [
        ...apartado.parrafos.map(texto => ({ texto, item: false })),
        ...apartado.items.map(texto => ({ texto, item: true })),
        ...(apartado.cierre ?? []).map(texto => ({ texto, item: false }))
      ];
      const ultimoApartado = k === apartados.length - 1;
      const cierraLaNota = (i) => ultimoApartado && i === bloques.length - 1;
      const alto = (i) => altoTexto(bloques[i].texto, 12, NORMAL, bloques[i].item ? anchoItem : ancho);
      // Lo que ocupa el bloque: su alto y el aire de debajo (un párrafo, ESPACIO_PARRAFO; un ítem, 0,2 líneas y, el último de
      // los ítems, 0,4 más)
      const ocupa = (i) => alto(i) + (bloques[i].item
        ? altoEspacio(0.2, 12) + (bloques[i + 1]?.item ? 0 : altoEspacio(0.4, 12))
        : altoEspacio(ESPACIO_PARRAFO, 12));
      // Lo que se reserva para el bloque: lo que ocupa si le sigue otro, o solo su alto; y, si cierra la nota, lo que ocupa más el cierre
      const reservaDe = (i) => (cierraLaNota(i) ? ocupa(i) + altoCierre : alto(i));
      const iniciales = Math.min(2, bloques.length);
      let reservaInicial = altoTexto(apartado.titulo, 12, NEGRITA) + altoEspacio(0.3, 12, NEGRITA) + (!bloques.length && ultimoApartado ? altoCierre : 0);
      for (let i = 0; i < iniciales; i++) reservaInicial += i === iniciales - 1 ? reservaDe(i) : ocupa(i);
      asegurarEspacio(reservaInicial);
      parrafo(apartado.titulo, { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      bloques.forEach(({ texto, item }, i) => {
        // (los dos primeros bloques ya se reservaron junto con el título)
        const reservado = i < iniciales;
        if (item) {
          if (!reservado) asegurarEspacio(reservaDe(i));
          const y = doc.y;
          doc.font(NORMAL).fontSize(12).text('•', MARGENES.left + SANGRIA_ITEM, y, { lineBreak: false });
          doc.text(texto, MARGENES.left + SANGRIA_ITEM + SANGRIA_VINETA, y, { width: anchoItem, align: 'left' });
          doc.moveDown(0.2);
          // Después del último ítem, más aire antes de lo que sigue
          if (!bloques[i + 1]?.item) doc.moveDown(0.4);
        } else {
          if (!reservado && cierraLaNota(i)) asegurarEspacio(reservaDe(i));
          parrafo(texto);
        }
      });
    });

    // El título de la justificación viaja con el primer párrafo; y el último párrafo, con el remitente, la firma y la línea CC.
    // Si hay un solo párrafo (o ninguno; la reiteración tiene uno) es a la vez el primero y el último: se reserva todo junto
    // antes de imprimir el título, para que no se cambie de hoja justo después de escribirlo.
    const ultimo = nota.justificacion.length - 1;
    const reservaDeLaJustificacion = ALTO_TITULO_JUSTIFICACION + altoTexto(nota.justificacion[0] || '') + (ultimo <= 0 ? altoCierre : 0);

    // La línea del anexo (avisos y reiteraciones) es un párrafo propio: lleva aire arriba, así no se lee como un dato más del
    // último contacto ni de la tabla (arriba de una hoja nueva, no). Viaja con lo que reserva la justificación (su título y su
    // primer párrafo y, si es también el último, el cierre): se reserva también el espacio que deja debajo (si no, el
    // reservado a continuación puede mandar el título a otra hoja).
    if (nota.anexo) {
      asegurarEspacio(AIRE_ANEXO + altoTexto(nota.anexo) + altoEspacio(ESPACIO_PARRAFO, 12) + reservaDeLaJustificacion);
      if (doc.y > doc.page.margins.top + 1) doc.y += AIRE_ANEXO;
      parrafo(nota.anexo, { align: 'left', espacio: ESPACIO_PARRAFO });
    }

    // (la nota de autorización no tiene justificación: el cierre se reserva solo)
    if (nota.justificacion.length) {
      asegurarEspacio(reservaDeLaJustificacion);
      parrafo('Justificación:', { fuente: NEGRITA, align: 'left', espacio: 0.3 });
      nota.justificacion.forEach((texto, i) => {
        if (i === ultimo && ultimo > 0) asegurarEspacio(altoTexto(texto) + altoCierre);
        parrafo(texto);
      });
    } else if (!apartados.length) {
      // (con apartados, el último bloque del último ya reservó el cierre)
      asegurarEspacio(altoCierre);
    }

    doc.moveDown(0.6);
    // La fecha con espacios que no se cortan: si no entra en el renglón del remitente pasa entera al siguiente
    // (nunca "2 de noviembre de" / "2026.")
    doc.font(NEGRITA).fontSize(12).text(nota.remitente, MARGENES.left, doc.y, { underline: true, continued: true })
      .font(NORMAL).text(`, ${nota.fechaLarga.replace(/ /g, ' ')}.`, { underline: false });

    // Firma: imagen (si está cargada), nombre y cargo (con el renglón chico del personal contratado entre los dos), centrados
    // en un ancho de 200 pt. El nombre baja 'bajada' puntos desde y (el alto de la imagen y un aire). Termina con la letra del
    // cargo (11 pt), como siempre. Devuelve dónde termina.
    const BAJADA_CON_IMAGEN = 64;
    const BAJADA_SIN_IMAGEN = 30;
    const dibujarFirma = (x, y, imagen, firma, bajada) => {
      if (imagen) doc.image(imagen, x + (ANCHO_FIRMA - 140) / 2, y, { fit: [140, 60], align: 'center', valign: 'bottom' });
      renglonesDeFirma(firma).forEach(({ texto, chico }, i) => {
        doc.font(NORMAL).fontSize(chico ? TAMANO_RENGLON_CHICO : TAMANO_FIRMA)
          .text(texto, x, i === 0 ? y + bajada : doc.y, { width: ANCHO_FIRMA, align: 'center' });
      });
      return doc.y;
    };
    const xDerecha = MARGENES.left + ancho - ANCHO_FIRMA;
    doc.moveDown(1.5);
    const yFirmas = doc.y;
    if (nota.firma.presentante) {
      // Dos firmas lado a lado: quien presenta a la izquierda, el titular a la derecha; debajo, la leyenda.
      // Los dos nombres bajan lo mismo aunque solo una de las firmas tenga imagen: así quedan a la misma altura
      const bajada = firmaImagen || presentanteImagen ? BAJADA_CON_IMAGEN : BAJADA_SIN_IMAGEN;
      const finIzquierda = dibujarFirma(MARGENES.left, yFirmas, presentanteImagen, nota.firma.presentante, bajada);
      const finDerecha = dibujarFirma(xDerecha, yFirmas, firmaImagen, nota.firma, bajada);
      doc.y = Math.max(finIzquierda, finDerecha);
      doc.moveDown(ESPACIO_LEYENDA);
      doc.font(CURSIVA).fontSize(9).text(nota.firma.leyenda, MARGENES.left, doc.y, { width: ancho, align: 'justify' });
      doc.font(NORMAL).fontSize(11);
    } else {
      dibujarFirma(xDerecha, yFirmas, firmaImagen, nota.firma, firmaImagen ? BAJADA_CON_IMAGEN : BAJADA_SIN_IMAGEN);
    }

    doc.moveDown(1.5);
    parrafo(nota.lineaCc, { tamano: 11, align: 'left' });

    agregarMembreteYPies(doc, nota, ancho, { banner, pie });
    doc.end();
  } catch (error) {
    reject(error);
  }
});
