// Anexo de los avisos de Notas Digitales: una hoja A4 por dataset, con un diseño de ficha monocromático.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6.7)
import QRCode from 'qrcode';
import { DocumentoNota } from './notasDigitalesPdf.js';
import { formatoCorto, diasEntre } from './notasDigitalesCalendario.js';

const MM = 72 / 25.4;
const ANCHO = 210 * MM;
const ALTO = 297 * MM;
// Todo se dibuja dentro de los márgenes de 15 mm, también el encabezado y el pie
const MARGEN = 15 * MM;
const IZQUIERDA = MARGEN;
const DERECHA = ANCHO - MARGEN;
const ABAJO = ALTO - MARGEN;
const CONTENIDO = ANCHO - 2 * MARGEN;
const NORMAL = 'Helvetica';
const NEGRITA = 'Helvetica-Bold';
// Monocromático: gris oscuro para el texto, grises claros para fondos y líneas y un único acento azul suave.
// Impreso en blanco y negro, el acento queda como un gris medio.
const COLOR = {
  tinta: '#1F2933', gris: '#52606D', rotulo: '#7B8794', grisClaro: '#9AA5B1', linea: '#D9DEE3', fondo: '#F3F5F8',
  acento: '#3E6A99', acentoSuave: '#E4ECF5', blanco: '#FFFFFF'
};
const CORTE = '… (continúa en el portal)';
// Helvetica (regular y negrita): la línea de ascendentes (y de mayúsculas) está a 0,718 em sobre la línea de base
// y la de descendentes, a 0,207 em debajo. PDFKit ubica el texto por el borde superior de la línea.
const ASCENDENTE = 0.718;
const DESCENDENTE = 0.207;

// Separaciones verticales entre las partes de la hoja
const DESPUES_ENCABEZADO = 20;
const ANTES_LINEA_DE_TIEMPO = 20;
const ANTES_FICHA = 20;
const ANTES_TEXTOS = 16;
const ENTRE_BLOQUES = 10;
const SOBRE_PIE = 12;

// Rótulos (mayúsculas chicas con interletrado) y valores de la ficha y del contacto, en columnas
const ROTULO = 6.5;
const ALTO_ROTULO = 9.5;
const SEPARACION_COLUMNAS = 5 * MM;
const anchoDeColumna = (ancho, columnas) => (ancho - SEPARACION_COLUMNAS * (columnas - 1)) / columnas;
// Textos de los bloques (descripción y observaciones): de 10 a 8 puntos, con algo de aire entre líneas
const TEXTO_MAXIMO = 10;
const TEXTO_MINIMO = 8;
const INTERLINEA_TEXTO = 1.2;
const RELLENO = 11;
const ANCHO_INTERIOR = CONTENIDO - 2 * RELLENO;
// Alto de un bloque sin su texto: rótulo arriba y relleno abajo
const SOBRE_TEXTO = 22;
const BAJO_TEXTO = 7;
// Líneas que la descripción y las observaciones conservan, como mínimo, cuando falta lugar
const MINIMO_LINEAS = { descripcion: 3, observaciones: 2 };

const ALTO_ESTADO = 20;
const ALTO_LINEA_DE_TIEMPO = 44;
const LADO_QR = 30 * MM;
const RELLENO_QR = 6;
const ANCHO_TARJETA_QR = LADO_QR + 2 * RELLENO_QR;
const ALTO_TARJETA_QR = LADO_QR + RELLENO_QR + 18;
const SEPARACION_QR = 7 * MM;

// y del borde superior de un texto para que su línea de base quede en "base"
const desdeBase = (base, tamano) => base - ASCENDENTE * tamano;

// Texto de la base listo para medir: sin espacios en los extremos de cada línea ni más de una línea en blanco seguida
const limpiar = (texto) => String(texto ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).join('\n')
  .replace(/\n{3,}/g, '\n\n').trim();

// Mayor n entre 0 y tope que cumple la condición (que vale para todos los menores)
const mayorQueCumple = (tope, cumple) => {
  let desde = 0;
  let hasta = tope;
  while (desde < hasta) {
    const medio = Math.ceil((desde + hasta) / 2);
    if (cumple(medio)) desde = medio;
    else hasta = medio - 1;
  }
  return desde;
};

// Ajusta un texto a un ancho y a un alto (o a una cantidad de líneas): achica la letra de max a min, de a medio
// punto, y si aun así no entra lo corta en el último fin de palabra que entra, seguido de CORTE (si no entra ni una
// palabra, corta entre letras). Mide con las mismas opciones con las que lo escribe "escribir".
// Devuelve { texto, tamano, alto, fuente, opciones, cortado }, con el alto que ocupa.
const ajustar = (doc, texto, { ancho, alto = null, lineas = null, max, min = max, fuente = NORMAL, opciones = {} }) => {
  const limpio = limpiar(texto);
  const medidas = { width: ancho, ...opciones };
  const medir = (t, tamano) => doc.font(fuente).fontSize(tamano).heightOfString(t, medidas);
  const tope = (tamano) => (alto ?? lineas * (doc.font(fuente).fontSize(tamano).currentLineHeight(true) + (opciones.lineGap ?? 0))) + 0.01;
  for (let tamano = max; tamano >= min; tamano -= 0.5) {
    const ocupa = medir(limpio, tamano);
    if (ocupa <= tope(tamano)) return { texto: limpio, tamano, alto: ocupa, fuente, opciones: medidas, cortado: false };
  }
  const entra = (t) => medir(t, min) <= tope(min);
  const conCorte = (hasta) => `${limpio.slice(0, hasta).replace(/[\s.,;:–-]+$/u, '')}${CORTE}`;
  const finesDePalabra = [...limpio.matchAll(/\S(?=\s)/gu)].map(m => m.index + m[0].length);
  const palabras = mayorQueCumple(finesDePalabra.length, k => entra(conCorte(finesDePalabra[k - 1])));
  const hasta = palabras > 0 ? finesDePalabra[palabras - 1] : mayorQueCumple(limpio.length, k => entra(conCorte(k)));
  const cortado = conCorte(hasta);
  return { texto: cortado, tamano: min, alto: medir(cortado, min), fuente, opciones: medidas, cortado: true };
};

// Escribe un texto ajustado con su borde superior en y. La holgura en el alto evita que un redondeo deje afuera la
// última línea y no alcanza para una línea más. Con interlineado negativo suma ese interlineado: PDFKit decide si
// sigue otra línea con el alto de línea sin él.
const escribir = (doc, ajuste, x, y, color, extra = {}) => {
  const holgura = 1 + Math.max(0, -(ajuste.opciones.lineGap ?? 0));
  doc.font(ajuste.fuente).fontSize(ajuste.tamano).fillColor(color)
    .text(ajuste.texto, x, y, { ...ajuste.opciones, height: ajuste.alto + holgura, ...extra });
};

// Una sola línea de texto en un ancho: si no entrara, PDFKit la termina con "…" en lugar de pasar a otra línea
const renglon = (doc, texto, x, y, { ancho, tamano, fuente = NORMAL, color = COLOR.tinta, align = 'left', espaciado = 0 }) => {
  doc.font(fuente).fontSize(tamano).fillColor(color);
  doc.text(texto, x, y, {
    width: ancho, align, characterSpacing: espaciado, height: doc.currentLineHeight(true) + 1, ellipsis: true
  });
};

const rotulo = (doc, texto, x, y, ancho, color = COLOR.rotulo, align = 'left') => renglon(doc, String(texto).toUpperCase(), x, y, {
  ancho, tamano: ROTULO, fuente: NEGRITA, color, align, espaciado: 0.5
});

// Línea fina horizontal (un rectángulo lleno: más nítido que un trazo de medio punto)
const filete = (doc, x, y, ancho, color = COLOR.linea) => doc.rect(x, y - 0.3, ancho, 0.6).fill(color);

// =====================================================
// Partes de la hoja
// =====================================================

// Encabezado: el área a la izquierda y el número y la fecha de la nota a la derecha, sobre una línea fina con un
// tramo del acento. Devuelve la y donde termina.
const dibujarEncabezado = (doc, anexo) => {
  const mitad = CONTENIDO / 2;
  const base1 = MARGEN + ASCENDENTE * 9.5;
  const base2 = base1 + 11.5;
  renglon(doc, 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', IZQUIERDA, desdeBase(base1, 7.5),
    { ancho: mitad, tamano: 7.5, fuente: NEGRITA, color: COLOR.tinta, espaciado: 0.6 });
  renglon(doc, 'Municipalidad de Comodoro Rivadavia', IZQUIERDA, desdeBase(base2, 7.5), { ancho: mitad, tamano: 7.5, color: COLOR.gris });
  renglon(doc, `Anexo – Nota Digital N° ${anexo.numeroTexto}`, IZQUIERDA + mitad, desdeBase(base1, 9.5),
    { ancho: mitad, tamano: 9.5, fuente: NEGRITA, align: 'right' });
  renglon(doc, anexo.fechaLarga, IZQUIERDA + mitad, desdeBase(base2, 7.5), { ancho: mitad, tamano: 7.5, color: COLOR.gris, align: 'right' });
  const yLinea = base2 + 9;
  filete(doc, IZQUIERDA, yLinea, CONTENIDO);
  doc.rect(IZQUIERDA, yLinea - 1, 28, 2).fill(COLOR.acento);
  return yLinea + 1;
};

// Pie: línea fina y "Anexo – Nota Digital N° n/aa · Hoja i de t", con los descendentes sobre el margen inferior.
// Devuelve la y de la línea, el límite de todo lo que va arriba.
const dibujarPie = (doc, anexo, i, total) => {
  const y = desdeBase(ABAJO - DESCENDENTE * 7.5, 7.5);
  const yLinea = y - 8;
  filete(doc, IZQUIERDA, yLinea, CONTENIDO);
  renglon(doc, `Anexo – Nota Digital N° ${anexo.numeroTexto} · Hoja ${i + 1} de ${total}`, IZQUIERDA, y,
    { ancho: CONTENIDO, tamano: 7.5, color: COLOR.gris, align: 'right' });
  return yLinea;
};

// Indicador de estado: píldora con el acento suave, un punto y el texto en el acento
const dibujarEstado = (doc, estado, x, y) => {
  const tamano = 8.5;
  doc.font(NEGRITA).fontSize(tamano);
  const anchoTexto = Math.min(CONTENIDO - 31, doc.widthOfString(estado) + 2);
  doc.roundedRect(x, y, anchoTexto + 31, ALTO_ESTADO, ALTO_ESTADO / 2).fill(COLOR.acentoSuave);
  doc.circle(x + 11, y + ALTO_ESTADO / 2, 2.6).fill(COLOR.acento);
  // Las mayúsculas, centradas en el alto de la píldora
  renglon(doc, estado, x + 19, y + (ALTO_ESTADO - ASCENDENTE * tamano) / 2, { ancho: anchoTexto, tamano, fuente: NEGRITA, color: COLOR.acento });
};

// Etiqueta, título (hasta 3 líneas; 2 si falta lugar) e indicador de estado
const prepararCabecera = (doc, hoja, nivel) => {
  const titulo = ajustar(doc, hoja.titulo, {
    ancho: CONTENIDO, lineas: nivel < 2 ? 3 : 2, max: 20, min: 14, fuente: NEGRITA, opciones: { lineGap: -1.5 }
  });
  const yTitulo = 14;
  const yEstado = yTitulo + titulo.alto + 8;
  return {
    alto: yEstado + ALTO_ESTADO,
    dibujar: (y) => {
      renglon(doc, hoja.etiqueta, IZQUIERDA, y, { ancho: CONTENIDO, tamano: 7, fuente: NEGRITA, color: COLOR.acento, espaciado: 1.2 });
      escribir(doc, titulo, IZQUIERDA, y + yTitulo, COLOR.tinta);
      dibujarEstado(doc, hoja.estado, IZQUIERDA, y + yEstado);
    }
  };
};

// Línea de tiempo: barra desde la última actualización hasta el vencimiento, con lo transcurrido en el acento y la
// marca de hoy (con su fecha arriba). Sin última actualización, la barra es punteada y arranca en "Sin registro".
const dibujarLineaDeTiempo = (doc, { inicio, fin, hoy }, y) => {
  const yBarra = y + 15;
  const x0 = IZQUIERDA + 7;
  const x1 = DERECHA - 7;
  doc.save();
  if (inicio) {
    const avance = Math.min(1, Math.max(0, diasEntre(inicio, hoy) / Math.max(1, diasEntre(inicio, fin))));
    let xHoy = x0 + (x1 - x0) * avance;
    // Una marca de hoy que tocaría la del vencimiento se dibuja sobre ella, como un blanco (hoy en el vencimiento);
    // una que taparía en parte el punto de inicio lo tapa del todo
    const enVencimiento = x1 - xHoy < 11;
    if (enVencimiento) xHoy = x1;
    doc.lineCap('round').lineWidth(4);
    doc.strokeColor(COLOR.linea).moveTo(x0, yBarra).lineTo(x1, yBarra).stroke();
    if (xHoy > x0) doc.strokeColor(COLOR.acento).moveTo(x0, yBarra).lineTo(xHoy, yBarra).stroke();
    if (xHoy - x0 >= 10) doc.circle(x0, yBarra, 3.5).fill(COLOR.acento);
    if (enVencimiento) {
      doc.circle(x1, yBarra, 6.5).lineWidth(1.5).fillAndStroke(COLOR.blanco, COLOR.tinta);
      doc.circle(x1, yBarra, 3.5).fill(COLOR.tinta);
    } else {
      doc.circle(x1, yBarra, 4).lineWidth(1.5).fillAndStroke(COLOR.blanco, COLOR.tinta);
      doc.circle(xHoy, yBarra, 6).fill(COLOR.blanco);
      doc.circle(xHoy, yBarra, 4.5).fill(COLOR.tinta);
    }
    const textoHoy = `Hoy ${formatoCorto(hoy)}`;
    doc.font(NEGRITA).fontSize(7);
    const anchoHoy = doc.widthOfString(textoHoy) + 2;
    const xTexto = Math.min(Math.max(xHoy - anchoHoy / 2, IZQUIERDA), DERECHA - anchoHoy);
    renglon(doc, textoHoy, xTexto, y, { ancho: anchoHoy, tamano: 7, fuente: NEGRITA, align: 'center' });
  } else {
    // Puntos: trazos casi nulos con extremos redondos
    doc.lineCap('round').lineWidth(2.5).dash(0.01, { space: 4.5 });
    doc.strokeColor(COLOR.grisClaro).moveTo(x0, yBarra).lineTo(x1, yBarra).stroke();
    doc.undash();
    doc.circle(x0, yBarra, 3.5).lineWidth(1.5).fillAndStroke(COLOR.blanco, COLOR.grisClaro);
    doc.circle(x1, yBarra, 4).lineWidth(1.5).fillAndStroke(COLOR.blanco, COLOR.tinta);
  }
  doc.restore();
  const mitad = CONTENIDO / 2;
  rotulo(doc, 'Última actualización', IZQUIERDA, yBarra + 11, mitad);
  rotulo(doc, 'Vencimiento', IZQUIERDA + mitad, yBarra + 11, mitad, COLOR.rotulo, 'right');
  renglon(doc, inicio ? formatoCorto(inicio) : 'Sin registro', IZQUIERDA, yBarra + 20,
    { ancho: mitad, tamano: 9.5, fuente: NEGRITA, color: inicio ? COLOR.tinta : COLOR.gris });
  renglon(doc, formatoCorto(fin), IZQUIERDA + mitad, yBarra + 20, { ancho: mitad, tamano: 9.5, fuente: NEGRITA, align: 'right' });
};

// Grilla de pares rótulo/valor: el rótulo arriba y el valor debajo, en columnas. Una celda "completa" ocupa toda
// la fila. Con "divisorias", una línea fina separa las filas (y cierra arriba y abajo).
// Los valores de una misma fila van en el mismo tamaño: el del que más se tuvo que achicar.
const prepararGrilla = (doc, celdas, { ancho, columnas, lineas, divisorias, valor = { max: 9.5, min: 8 } }) => {
  const separacion = SEPARACION_COLUMNAS;
  const anchoColumna = anchoDeColumna(ancho, columnas);
  const arriba = divisorias ? 7 : 0;
  const abajo = divisorias ? 4 : 5;
  const filas = [];
  for (const celda of celdas) {
    const ultima = filas.at(-1);
    if (!celda.completa && ultima && !ultima.completa && ultima.celdas.length < columnas) ultima.celdas.push(celda);
    else filas.push({ completa: Boolean(celda.completa), celdas: [celda] });
  }
  for (const fila of filas) {
    const ajustarCelda = (celda, tamanos) => ajustar(doc, celda.valor, {
      ancho: fila.completa ? ancho : anchoColumna, lineas: celda.lineas ?? lineas, ...tamanos
    });
    for (const celda of fila.celdas) celda.ajuste = ajustarCelda(celda, celda.tamanos ?? valor);
    // Más chico, un valor que ya entraba sigue entrando (en las mismas líneas o menos)
    const tamano = Math.min(...fila.celdas.map(c => c.ajuste.tamano));
    for (const celda of fila.celdas) {
      if (celda.ajuste.tamano > tamano) celda.ajuste = ajustarCelda(celda, { max: tamano, min: tamano });
    }
    fila.alto = arriba + ALTO_ROTULO + Math.max(...fila.celdas.map(c => c.ajuste.alto)) + abajo;
  }
  return {
    alto: filas.reduce((total, fila) => total + fila.alto, 0) - (divisorias ? 0 : abajo),
    dibujar: (x, y) => {
      let yFila = y;
      for (const fila of filas) {
        if (divisorias) filete(doc, x, yFila, ancho);
        fila.celdas.forEach((celda, k) => {
          const xCelda = x + k * (anchoColumna + separacion);
          const anchoCelda = fila.completa ? ancho : anchoColumna;
          rotulo(doc, celda.etiqueta, xCelda, yFila + arriba, anchoCelda);
          escribir(doc, celda.ajuste, xCelda, yFila + arriba + ALTO_ROTULO, celda.color ?? COLOR.tinta, celda.link ? { link: celda.link } : {});
        });
        yFila += fila.alto;
      }
      if (divisorias) filete(doc, x, yFila, ancho);
    }
  };
};

// QR como vectores, con 2 módulos de margen dentro del lado: un rectángulo por tramo horizontal de módulos oscuros
// y otro por tramo vertical. Con los dos, todo borde entre dos módulos oscuros queda dentro de un rectángulo: los
// visores que suavizan cada rectángulo por separado no dejan rayas claras entre filas, y nada invade los claros.
const dibujarQr = (doc, url, x, y, lado) => {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const modulo = lado / (n + 4);
  for (const vertical of [false, true]) {
    for (let linea = 0; linea < n; linea++) {
      let inicio = null;
      for (let k = 0; k <= n; k++) {
        const oscuro = k < n && (vertical ? modules.get(k, linea) : modules.get(linea, k));
        if (oscuro && inicio === null) inicio = k;
        if (!oscuro && inicio !== null) {
          const largo = (k - inicio) * modulo;
          if (vertical) doc.rect(x + (linea + 2) * modulo, y + (inicio + 2) * modulo, modulo, largo);
          else doc.rect(x + (inicio + 2) * modulo, y + (linea + 2) * modulo, largo, modulo);
          inicio = null;
        }
      }
    }
  }
  doc.fill(COLOR.tinta);
};

// Tarjeta del QR: borde fino, el código y "Abrir en el portal"; toda la tarjeta es un link al dataset
const dibujarTarjetaQr = (doc, url, x, y) => {
  doc.roundedRect(x, y, ANCHO_TARJETA_QR, ALTO_TARJETA_QR, 6).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
  dibujarQr(doc, url, x + RELLENO_QR, y + RELLENO_QR, LADO_QR);
  renglon(doc, 'Abrir en el portal', x, y + RELLENO_QR + LADO_QR + 4, { ancho: ANCHO_TARJETA_QR, tamano: 7, color: COLOR.gris, align: 'center' });
  doc.link(x, y, ANCHO_TARJETA_QR, ALTO_TARJETA_QR, url);
};

// Ficha: los campos en dos columnas y el link al portal, con el QR a la derecha (sin link válido no hay QR).
// Los valores ocupan hasta 2 líneas; 1 si falta lugar.
const prepararFicha = (doc, hoja, nivel) => {
  const ancho = hoja.url ? CONTENIDO - ANCHO_TARJETA_QR - SEPARACION_QR : CONTENIDO;
  const celdas = hoja.campos.map(([etiqueta, valor]) => ({ etiqueta, valor }));
  if (hoja.url) {
    celdas.push({
      etiqueta: 'Link al portal', valor: hoja.url, completa: true, link: hoja.url, color: COLOR.acento, lineas: 2, tamanos: { max: 8.5, min: 7 }
    });
  }
  const grilla = prepararGrilla(doc, celdas, { ancho, columnas: 2, lineas: nivel === 0 ? 2 : 1, divisorias: true });
  return {
    alto: Math.max(grilla.alto, hoja.url ? ALTO_TARJETA_QR : 0),
    dibujar: (y) => {
      grilla.dibujar(IZQUIERDA, y);
      if (hoja.url) dibujarTarjetaQr(doc, hoja.url, DERECHA - ANCHO_TARJETA_QR, y);
    }
  };
};

// Contacto del área responsable: recuadro con el nombre del área y sus datos en dos columnas ("Etiqueta: valor"
// pasa a rótulo y valor). Un dato que no entra en una línea de media columna (un email largo) ocupa toda la fila,
// así no se corta (en el nivel 2, el último recurso, no: todo va en dos columnas). Sin datos, la única línea va
// como texto.
const prepararContacto = (doc, hoja, nivel) => {
  const valor = { max: 9, min: 8 };
  const mitad = anchoDeColumna(ANCHO_INTERIOR, 2);
  // El nombre del área, en una línea (de 10 a 9 puntos); si no entra, en dos (salvo que falte lugar)
  const ajustarNombre = (lineas, max) => ajustar(doc, hoja.contacto.nombre, { ancho: ANCHO_INTERIOR, lineas, max, min: 9, fuente: NEGRITA });
  let nombre = hoja.contacto.nombre ? ajustarNombre(1, 10) : null;
  if (nombre?.cortado && nivel === 0) nombre = ajustarNombre(2, 9);
  const celdas = hoja.contacto.lineas.map((linea) => {
    const partes = /^([^:\n]{1,40}): ([\s\S]+)$/.exec(linea);
    if (!partes) return null;
    const largo = doc.font(NORMAL).fontSize(valor.min).heightOfString(partes[2], { width: mitad })
      > doc.currentLineHeight(true) + 0.01;
    return { etiqueta: partes[1], valor: partes[2], completa: largo && nivel < 2 };
  });
  const contenido = celdas.every(Boolean)
    ? prepararGrilla(doc, celdas, { ancho: ANCHO_INTERIOR, columnas: 2, lineas: nivel === 0 ? 2 : 1, divisorias: false, valor })
    : (() => {
      const texto = ajustar(doc, hoja.contacto.lineas.join('\n'), { ancho: ANCHO_INTERIOR, lineas: 3, max: 9, min: 8 });
      return { alto: texto.alto, dibujar: (x, y) => escribir(doc, texto, x, y, COLOR.gris) };
    })();
  const yNombre = 21;
  const yContenido = yNombre + (nombre ? nombre.alto + 6 : 0);
  return {
    alto: yContenido + contenido.alto + 8,
    dibujar: (y, alto) => {
      doc.roundedRect(IZQUIERDA, y, CONTENIDO, alto, 6).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
      rotulo(doc, 'Contacto del área responsable', IZQUIERDA + RELLENO, y + 9, ANCHO_INTERIOR, COLOR.gris);
      if (nombre) escribir(doc, nombre, IZQUIERDA + RELLENO, y + yNombre, COLOR.tinta);
      contenido.dibujar(IZQUIERDA + RELLENO, y + yContenido);
    }
  };
};

// Alto mínimo de un bloque de texto: su rótulo, el relleno y las líneas mínimas en la letra más chica
const altoMinimoBloque = (doc, lineas) => SOBRE_TEXTO + BAJO_TEXTO
  + lineas * (doc.font(NORMAL).fontSize(TEXTO_MINIMO).currentLineHeight(true) + INTERLINEA_TEXTO);

const bloquesDeTexto = (hoja) => [
  { titulo: 'Descripción', texto: hoja.descripcion, minimo: MINIMO_LINEAS.descripcion },
  ...(hoja.observaciones ? [{ titulo: 'Observaciones', texto: hoja.observaciones, minimo: MINIMO_LINEAS.observaciones }] : [])
];

const altoMinimoTextos = (doc, hoja) => bloquesDeTexto(hoja)
  .reduce((total, bloque, i) => total + (i ? ENTRE_BLOQUES : 0) + altoMinimoBloque(doc, bloque.minimo), 0);

// Descripción y observaciones en el espacio que queda: si entran con la letra más grande van así; si no, se reparte
// el espacio (las observaciones, hasta un 35 %, salvo que la descripción necesite menos) y cada una se achica hasta
// 8 puntos y, si aun así no entra, se corta con CORTE.
const prepararTextos = (doc, hoja, espacio) => {
  const bloques = bloquesDeTexto(hoja);
  const opciones = { align: 'justify', lineGap: INTERLINEA_TEXTO };
  const medida = { ancho: ANCHO_INTERIOR, max: TEXTO_MAXIMO, min: TEXTO_MINIMO, opciones };
  const libre = espacio - bloques.length * (SOBRE_TEXTO + BAJO_TEXTO) - (bloques.length - 1) * ENTRE_BLOQUES;
  const naturales = bloques.map(b => ajustar(doc, b.texto, { ...medida, min: TEXTO_MAXIMO, alto: Infinity }).alto);
  let asignados = naturales;
  if (naturales.reduce((a, b) => a + b, 0) > libre) {
    const minimos = bloques.map(b => altoMinimoBloque(doc, b.minimo) - SOBRE_TEXTO - BAJO_TEXTO);
    if (bloques.length === 1) {
      asignados = [Math.max(libre, minimos[0])];
    } else {
      const observaciones = Math.max(minimos[1], Math.min(naturales[1], Math.max(libre * 0.35, libre - naturales[0]), libre - minimos[0]));
      asignados = [Math.max(minimos[0], libre - observaciones), observaciones];
    }
  }
  const ajustes = bloques.map((b, i) => ajustar(doc, b.texto, { ...medida, alto: asignados[i] }));
  const altos = ajustes.map(a => SOBRE_TEXTO + a.alto + BAJO_TEXTO);
  return {
    alto: altos.reduce((a, b) => a + b, 0) + (bloques.length - 1) * ENTRE_BLOQUES,
    dibujar: (y) => {
      let yBloque = y;
      bloques.forEach((bloque, i) => {
        doc.roundedRect(IZQUIERDA, yBloque, CONTENIDO, altos[i], 6).fill(COLOR.fondo);
        rotulo(doc, bloque.titulo, IZQUIERDA + RELLENO, yBloque + 9, ANCHO_INTERIOR, COLOR.gris);
        escribir(doc, ajustes[i], IZQUIERDA + RELLENO, yBloque + SOBRE_TEXTO, COLOR.tinta);
        yBloque += altos[i] + ENTRE_BLOQUES;
      });
    }
  };
};

// Una hoja: de arriba abajo, encabezado, cabecera, línea de tiempo, ficha, descripción y observaciones, contacto y
// pie. La diagramación es fija; si la descripción y las observaciones no tendrían su lugar mínimo, se compacta la
// hoja por niveles: 1, valores de la ficha y del contacto (y el nombre del área) en una línea; 2, además, el título
// en dos líneas y los datos de contacto siempre en dos columnas. Todo tiene un tope de líneas (el título, cada
// valor, el link, el contacto), así que con el nivel 2 aun el peor caso deja ese lugar mínimo (unos 26 puntos de
// sobra con 9 campos, link y 7 datos de contacto larguísimos).
const dibujarHoja = (doc, anexo, hoja, i, total) => {
  const yCabecera = dibujarEncabezado(doc, anexo) + DESPUES_ENCABEZADO;
  const limite = dibujarPie(doc, anexo, i, total) - SOBRE_PIE;
  const minimo = altoMinimoTextos(doc, hoja);
  let plan;
  for (const nivel of [0, 1, 2]) {
    const cabecera = prepararCabecera(doc, hoja, nivel);
    const ficha = prepararFicha(doc, hoja, nivel);
    const contacto = prepararContacto(doc, hoja, nivel);
    const yLinea = yCabecera + cabecera.alto + ANTES_LINEA_DE_TIEMPO;
    const yFicha = yLinea + ALTO_LINEA_DE_TIEMPO + ANTES_FICHA;
    const yTextos = yFicha + ficha.alto + ANTES_TEXTOS;
    plan = { cabecera, ficha, contacto, yLinea, yFicha, yTextos, espacio: limite - contacto.alto - ENTRE_BLOQUES - yTextos };
    if (plan.espacio >= minimo) break;
  }
  const textos = prepararTextos(doc, hoja, plan.espacio);
  plan.cabecera.dibujar(yCabecera);
  dibujarLineaDeTiempo(doc, hoja.linea, plan.yLinea);
  plan.ficha.dibujar(plan.yFicha);
  textos.dibujar(plan.yTextos);
  plan.contacto.dibujar(plan.yTextos + textos.alto + ENTRE_BLOQUES, plan.contacto.alto);
};

export const renderAnexo = (anexo) => new Promise((resolve, reject) => {
  try {
    // Márgenes de PDFKit en 0: la diagramación es fija y nada se escribe donde PDFKit agregaría una hoja
    const doc = new DocumentoNota({
      size: 'A4', autoFirstPage: false, margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: { Title: `Anexo – Nota Digital ${anexo.numeroTexto}`, Author: 'Dirección de Datos Públicos y Comunicación' }
    });
    const partes = [];
    doc.on('data', parte => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    anexo.hojas.forEach((hoja, i) => {
      doc.addPage();
      dibujarHoja(doc, anexo, hoja, i, anexo.hojas.length);
    });
    doc.end();
  } catch (error) {
    reject(error);
  }
});
