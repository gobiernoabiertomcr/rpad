// Anexo de los avisos de Notas Digitales: una hoja A4 por dataset, con un diseño de ficha monocromático.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 6.7) y
// docs/superpowers/specs/2026-10-17-fechas-datasets-design.md (sección 9: el recuadro "Datos solicitados" y la línea de
// tiempo desde los datos publicados hasta el vencimiento; sección 18: el final de la línea dice "Vence")
import { DocumentoNota } from './notasDigitalesPdf.js';
import { formatoCorto, diasEntre } from './notasDigitalesCalendario.js';

// qrcode se carga recién al dibujar el primer anexo, y queda cargado. Si faltara la dependencia (por ejemplo, si no se
// corrió "npm install" después de subir el código), falla solo la nota con anexo (un aviso o una reiteración: el anexo de la
// reiteración, seguimientoPdf.js, también lo usa), que queda registrada con su alerta, y no el arranque de toda la app (este
// módulo llega a app.js por las rutas).
let QRCode = null;
export const cargarQrcode = async () => {
  if (!QRCode) {
    try {
      QRCode = (await import('qrcode')).default;
    } catch (error) {
      throw new Error(`No se pudo cargar la librería qrcode, que dibuja el código QR del anexo (¿falta correr "npm install"?): ${error.message}`);
    }
  }
};

export const MM = 72 / 25.4;
const ANCHO = 210 * MM;
const ALTO = 297 * MM;
// Todo se dibuja dentro de los márgenes de 15 mm, también el encabezado y el pie
export const MARGEN = 15 * MM;
export const IZQUIERDA = MARGEN;
export const DERECHA = ANCHO - MARGEN;
export const ABAJO = ALTO - MARGEN;
export const CONTENIDO = ANCHO - 2 * MARGEN;
export const NORMAL = 'Helvetica';
export const NEGRITA = 'Helvetica-Bold';
// Monocromático: gris oscuro para el texto, grises claros para fondos y líneas y un único acento azul suave.
// Impreso en blanco y negro, el acento queda como un gris medio.
export const COLOR = {
  tinta: '#1F2933', gris: '#52606D', rotulo: '#7B8794', grisClaro: '#9AA5B1', linea: '#D9DEE3', fondo: '#F3F5F8',
  acento: '#3E6A99', acentoSuave: '#E4ECF5', blanco: '#FFFFFF'
};
// Cortes: los textos largos (título, qué se solicita, descripción, observaciones) remiten al portal; los valores
// cortos (ficha y contacto) terminan en "…"
const CORTE = '… (continúa en el portal)';
const PUNTOS = '…';
// Letra mínima legible (spec 6.7)
const MINIMO = 8;
// Helvetica (regular y negrita): la línea de ascendentes (y de mayúsculas) está a 0,718 em sobre la línea de base
// y la de descendentes, a 0,207 em debajo. PDFKit ubica el texto por el borde superior de la línea.
export const ASCENDENTE = 0.718;
export const DESCENDENTE = 0.207;

// Perfiles tipográficos, del más generoso al más compacto. La hoja usa el primero con el que todo entra en su
// tamaño (sin achicar ni cortar nada); el último es también la base de los niveles de compactación (dibujarHoja).
// "aire" multiplica las separaciones entre las partes de la hoja. "destacado" es la letra de la descripción (el
// recuadro destacado, la más grande después del título) y "texto", la de qué se solicita y las observaciones.
// "pedido" es la del texto del recuadro "Datos solicitados", en negrita: lo que se le pide al área, a la vista.
const PERFILES = [
  { titulo: 24, etiqueta: 7.5, estado: 9.5, pedido: 13, fecha: 10.5, rotulo: 7, destacado: 12.5, texto: 11, valor: 10.5, link: 9, contacto: 10, nombre: 11.5, aire: 1.25 },
  { titulo: 22, etiqueta: 7.5, estado: 9, pedido: 12.5, fecha: 10, rotulo: 7, destacado: 12, texto: 10.5, valor: 10, link: 9, contacto: 9.5, nombre: 11, aire: 1.1 },
  { titulo: 20, etiqueta: 7, estado: 8.5, pedido: 12, fecha: 9.5, rotulo: 6.5, destacado: 11, texto: 10, valor: 9.5, link: 8.5, contacto: 9, nombre: 10, aire: 1 }
];
// Separaciones entre las partes, de arriba abajo (multiplicadas por el "aire" del perfil): encabezado → etiqueta,
// estado (o el recuadro "Datos solicitados", si lo hay) → línea de tiempo, línea de tiempo → descripción, descripción →
// ficha, ficha → qué se solicita
const SEPARACIONES = [18, 18, 16, 16, 14];
// Lo que puede crecer cada separación para que la hoja quede llena; lo que sobre aún va arriba del contacto
const EXTRA_MAXIMO = 16;
// Entre qué se solicita y observaciones, y como mínimo arriba del contacto (que va abajo, cerca del pie)
const ENTRE_BLOQUES = 10;
const SOBRE_PIE = 10;
// Líneas que conservan los textos largos, como mínimo y en la letra más chica, cuando falta lugar
const MINIMO_LINEAS = { descripcion: 3, solicita: 2, observaciones: 2 };

const SEPARACION_COLUMNAS = 5 * MM;
const anchoDeColumna = (ancho, columnas) => (ancho - SEPARACION_COLUMNAS * (columnas - 1)) / columnas;
const altoRotulo = (tamano) => tamano * 1.45;
const LADO_QR = 30 * MM;
const RELLENO_QR = 6;
const ANCHO_TARJETA_QR = LADO_QR + 2 * RELLENO_QR;
const ALTO_TARJETA_QR = LADO_QR + RELLENO_QR + 18;
const SEPARACION_QR = 7 * MM;

// y del borde superior de un texto para que su línea de base quede en "base"
export const desdeBase = (base, tamano) => base - ASCENDENTE * tamano;
const suma = (valores) => valores.reduce((a, b) => a + b, 0);

// Texto de la base listo para medir: espacios seguidos como uno, sin espacios en los extremos de cada línea ni más
// de una línea en blanco seguida
const limpiar = (texto) => String(texto ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ')
  .split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

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

// Medidas de un texto en una fuente, un ancho y unas opciones (que pueden depender del tamaño: el interlineado)
const medidor = (doc, { ancho, fuente = NORMAL, opciones = {} }) => {
  const opcionesDe = typeof opciones === 'function' ? opciones : () => opciones;
  const medidas = (tamano) => ({ width: ancho, ...opcionesDe(tamano) });
  const interlinea = (tamano) => doc.font(fuente).fontSize(tamano).currentLineHeight(true) + (opcionesDe(tamano).lineGap ?? 0);
  return {
    medidas,
    interlinea,
    alto: (texto, tamano) => doc.font(fuente).fontSize(tamano).heightOfString(texto, medidas(tamano)),
    // Acota un texto antes de medirlo: lo que entra en n líneas de un ancho no puede ocupar más que n veces ese
    // ancho (más un espacio por línea, el que se pierde en cada corte). Un texto más largo se recorta a la cota y
    // un carácter más, así sigue sin entrar. Sin esto, PDFKit tarda segundos con una palabra de decenas de miles
    // de letras (parte las palabras que no entran en una línea letra por letra).
    acotar: (texto, lineas, tamano) => {
      doc.font(fuente).fontSize(tamano);
      const capacidad = (lineas + 1) * (ancho + tamano);
      // Ningún carácter de Helvetica (con su interletrado) mide menos de 0,1 em: más que esos no pueden entrar
      const previo = texto.slice(0, Math.ceil(capacidad / (0.1 * tamano)) + 1);
      if (doc.widthOfString(previo) <= capacidad) return previo;
      return previo.slice(0, mayorQueCumple(previo.length, n => doc.widthOfString(previo.slice(0, n)) <= capacidad) + 1);
    }
  };
};

// Ajusta un texto a un ancho y a un alto (o a una cantidad de líneas): achica la letra de max a min, de a medio
// punto, y si aun así no entra lo corta en el último fin de palabra que entra, seguido de "corte" (si no entra ni
// una palabra, corta entre letras). Mide con las mismas opciones con las que lo escribe "escribir".
// Devuelve { texto, tamano, alto, fuente, opciones, cortado }, con el alto que ocupa.
export const ajustar = (doc, texto, { ancho, alto = null, lineas = null, max, min = max, fuente = NORMAL, opciones = {}, corte = PUNTOS }) => {
  const medida = medidor(doc, { ancho, fuente, opciones });
  const tope = (tamano) => (alto ?? lineas * medida.interlinea(tamano)) + 0.01;
  const limpio = medida.acotar(limpiar(texto), Math.floor(tope(min) / medida.interlinea(min)) + 1, min);
  for (let tamano = max; tamano >= min; tamano -= 0.5) {
    const ocupa = medida.alto(limpio, tamano);
    if (ocupa <= tope(tamano)) return { texto: limpio, tamano, alto: ocupa, fuente, opciones: medida.medidas(tamano), cortado: false };
  }
  const entra = (t) => medida.alto(t, min) <= tope(min);
  const conCorte = (hasta) => `${limpio.slice(0, hasta).replace(/[\s.,;:–-]+$/u, '')}${corte}`;
  const finesDePalabra = [...limpio.matchAll(/\S(?=\s)/gu)].map(m => m.index + m[0].length);
  const palabras = mayorQueCumple(finesDePalabra.length, k => entra(conCorte(finesDePalabra[k - 1])));
  const hasta = palabras > 0 ? finesDePalabra[palabras - 1] : mayorQueCumple(limpio.length, k => entra(conCorte(k)));
  const cortado = conCorte(hasta);
  return { texto: cortado, tamano: min, alto: medida.alto(cortado, min), fuente, opciones: medida.medidas(min), cortado: true };
};

// Si un texto entra, sin achicarlo, en una cantidad de líneas de un ancho
const entraEn = (doc, texto, { ancho, lineas, tamano, fuente = NORMAL }) =>
  !ajustar(doc, texto, { ancho, lineas, max: tamano, fuente }).cortado;

// Escribe un texto ajustado con su borde superior en y. La holgura en el alto evita que un redondeo deje afuera la
// última línea y no alcanza para una línea más. Con interlineado negativo suma ese interlineado: PDFKit decide si
// sigue otra línea con el alto de línea sin él.
export const escribir = (doc, ajuste, x, y, color, extra = {}) => {
  const holgura = 1 + Math.max(0, -(ajuste.opciones.lineGap ?? 0));
  doc.font(ajuste.fuente).fontSize(ajuste.tamano).fillColor(color)
    .text(ajuste.texto, x, y, { ...ajuste.opciones, height: ajuste.alto + holgura, ...extra });
};

// Una sola línea de texto en un ancho: si no entrara, PDFKit la termina con "…" en lugar de pasar a otra línea
export const renglon = (doc, texto, x, y, { ancho, tamano, fuente = NORMAL, color = COLOR.tinta, align = 'left', espaciado = 0 }) => {
  doc.font(fuente).fontSize(tamano).fillColor(color);
  doc.text(texto, x, y, {
    width: ancho, align, characterSpacing: espaciado, height: doc.currentLineHeight(true) + 1, ellipsis: true
  });
};

// Rótulo: mayúsculas chicas en negrita, con interletrado
export const rotulo = (doc, texto, x, y, { ancho, tamano, color = COLOR.rotulo, align = 'left' }) =>
  renglon(doc, String(texto).toUpperCase(), x, y, { ancho, tamano, fuente: NEGRITA, color, align, espaciado: 0.5 });

// Línea fina horizontal (un rectángulo lleno: más nítido que un trazo de medio punto)
export const filete = (doc, x, y, ancho, color = COLOR.linea) => doc.rect(x, y - 0.3, ancho, 0.6).fill(color);

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
const dibujarEstado = (doc, estado, x, y, tamano, alto) => {
  doc.font(NEGRITA).fontSize(tamano);
  const relleno = alto * 0.55;
  const anchoTexto = Math.min(CONTENIDO - 3 * relleno, doc.widthOfString(estado) + 2);
  doc.roundedRect(x, y, anchoTexto + 2.6 * relleno, alto, alto / 2).fill(COLOR.acentoSuave);
  doc.circle(x + relleno, y + alto / 2, tamano * 0.3).fill(COLOR.acento);
  // Las mayúsculas, centradas en el alto de la píldora
  renglon(doc, estado, x + 1.75 * relleno, y + (alto - ASCENDENTE * tamano) / 2, { ancho: anchoTexto, tamano, fuente: NEGRITA, color: COLOR.acento });
};

// Etiqueta de la cabecera: mayúsculas chicas en negrita, en el acento y con interletrado amplio ("CONJUNTO DE DATOS ·
// GESTIÓN EXTERNA" y el rótulo del recuadro "Datos solicitados")
export const etiquetaDeCabecera = (doc, texto, x, y, { ancho, tamano }) =>
  renglon(doc, texto, x, y, { ancho, tamano, fuente: NEGRITA, color: COLOR.acento, espaciado: 1.2 });

// Recuadro "Datos solicitados" (spec 2026-10-17-fechas-datasets, 9): fondo gris claro y filete del acento a la izquierda,
// con el rótulo como la etiqueta de la cabecera y, debajo, el pedido en negrita. El pedido va en hasta 2 líneas,
// achicándose hasta 2 puntos; si aun así no entra, se corta con "…" (los que arma pedido() entran en una línea).
// Compacto, porque la hoja de un dataset real ya va justa: "arriba" es el aire sobre las mayúsculas del rótulo, "entre"
// va de la base del rótulo a las mayúsculas del pedido y "abajo" se suma al interlineado de la última línea del pedido
// (así quedan unos 7 puntos debajo de su línea de base, como arriba).
const RECUADRO_PEDIDO = { izquierda: 14, derecha: 12, arriba: 7, entre: 5, abajo: 2 };
const prepararPedido = (doc, texto, p) => {
  const { izquierda, derecha, arriba, entre, abajo } = RECUADRO_PEDIDO;
  const ancho = CONTENIDO - izquierda - derecha;
  const pedido = ajustar(doc, texto, { ancho, lineas: 2, max: p.pedido, min: p.pedido - 2, fuente: NEGRITA });
  const yPedido = arriba + ASCENDENTE * p.etiqueta + entre;
  const alto = yPedido + pedido.alto + abajo;
  return {
    alto,
    dibujar: (y) => {
      doc.save();
      doc.roundedRect(IZQUIERDA, y, CONTENIDO, alto, 6).clip();
      doc.rect(IZQUIERDA, y, CONTENIDO, alto).fill(COLOR.fondo);
      doc.rect(IZQUIERDA, y, 4, alto).fill(COLOR.acento);
      doc.restore();
      etiquetaDeCabecera(doc, 'DATOS SOLICITADOS', IZQUIERDA + izquierda, y + arriba, { ancho, tamano: p.etiqueta });
      escribir(doc, pedido, IZQUIERDA + izquierda, y + yPedido, COLOR.tinta);
    }
  };
};

// Etiqueta, título, indicador de estado y, si la hoja tiene pedido, el recuadro "Datos solicitados" debajo del estado.
// El título va en hasta 2 líneas achicándose hasta 4 puntos; si no entra, en 3 (2 en el nivel 2) y hasta 14 puntos.
const prepararCabecera = (doc, hoja, p, nivel) => {
  const opciones = (tamano) => ({ lineGap: -0.075 * tamano });
  const ajustarTitulo = (lineas, max, min) => ajustar(doc, hoja.titulo, { ancho: CONTENIDO, lineas, max, min, fuente: NEGRITA, opciones, corte: CORTE });
  let titulo = ajustarTitulo(2, p.titulo, p.titulo - 4);
  if (titulo.cortado && nivel < 2) titulo = ajustarTitulo(3, p.titulo - 4, 14);
  else if (titulo.cortado) titulo = ajustarTitulo(2, p.titulo - 4, 14);
  const altoEstado = Math.round(p.estado * 2.35);
  const yTitulo = p.etiqueta * 2;
  const yEstado = yTitulo + titulo.alto + 8 * p.aire;
  const pedido = hoja.pedido ? prepararPedido(doc, hoja.pedido, p) : null;
  const yPedido = yEstado + altoEstado + 6 * p.aire;
  return {
    alto: pedido ? yPedido + pedido.alto : yEstado + altoEstado,
    dibujar: (y) => {
      etiquetaDeCabecera(doc, hoja.etiqueta, IZQUIERDA, y, { ancho: CONTENIDO, tamano: p.etiqueta });
      escribir(doc, titulo, IZQUIERDA, y + yTitulo, COLOR.tinta);
      dibujarEstado(doc, hoja.estado, IZQUIERDA, y + yEstado, p.estado, altoEstado);
      pedido?.dibujar(y + yPedido);
    }
  };
};

// Línea de tiempo (spec 2026-10-17-fechas-datasets, 9): barra desde los datos publicados (Datos al) o, sin ellos, desde la
// carga en el portal (rotuloInicio dice cuál) hasta el vencimiento ("Vence"), con lo transcurrido en el acento y la
// marca de hoy (con su fecha arriba). Sin fecha de inicio, la barra es punteada y arranca en "Sin registro".
const altoLineaDeTiempo = (p) => 15 + 11 + altoRotulo(p.rotulo) + (ASCENDENTE + DESCENDENTE) * p.fecha;

const dibujarLineaDeTiempo = (doc, { inicio, rotuloInicio, fin, hoy }, y, p) => {
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
  const yFecha = yBarra + 11 + altoRotulo(p.rotulo);
  rotulo(doc, rotuloInicio, IZQUIERDA, yBarra + 11, { ancho: mitad, tamano: p.rotulo });
  rotulo(doc, 'Vence', IZQUIERDA + mitad, yBarra + 11, { ancho: mitad, tamano: p.rotulo, align: 'right' });
  renglon(doc, inicio ? formatoCorto(inicio) : 'Sin registro', IZQUIERDA, yFecha,
    { ancho: mitad, tamano: p.fecha, fuente: NEGRITA, color: inicio ? COLOR.tinta : COLOR.gris });
  renglon(doc, formatoCorto(fin), IZQUIERDA + mitad, yFecha, { ancho: mitad, tamano: p.fecha, fuente: NEGRITA, align: 'right' });
};

// Grilla de pares rótulo/valor: el rótulo arriba y el valor debajo, en columnas. Con "filaEntera", un valor que no
// entra en esas líneas de media columna (en su tamaño) ocupa la fila entera, y también la ocupa una celda que queda
// sola en su fila. Los valores de una misma fila van en el mismo tamaño: el del que más se tuvo que achicar.
// Con "divisorias", una línea fina separa las filas (y cierra arriba y abajo).
export const prepararGrilla = (doc, celdas, { ancho, columnas, lineas, tamanos, tamanoRotulo, divisorias, filaEntera = null, aire = 1 }) => {
  const anchoColumna = anchoDeColumna(ancho, columnas);
  const arriba = divisorias ? 7 * aire : 0;
  const abajo = divisorias ? 4 * aire : 5 * aire;
  for (const celda of celdas) {
    if (!celda.completa && filaEntera && !entraEn(doc, celda.valor, { ancho: anchoColumna, lineas: filaEntera.lineas, tamano: filaEntera.tamano })) {
      celda.completa = true;
    }
  }
  const filas = [];
  for (const celda of celdas) {
    const ultima = filas.at(-1);
    if (!celda.completa && ultima && !ultima.completa && ultima.celdas.length < columnas) ultima.celdas.push(celda);
    else filas.push({ completa: Boolean(celda.completa), celdas: [celda] });
  }
  for (const fila of filas) {
    if (fila.celdas.length < columnas) fila.completa = true;
    const ajustarCelda = (celda, medidas) => ajustar(doc, celda.valor, {
      ancho: fila.completa ? ancho : anchoColumna, lineas: celda.lineas ?? lineas, ...medidas
    });
    for (const celda of fila.celdas) celda.ajuste = ajustarCelda(celda, celda.tamanos ?? tamanos);
    // Más chico, un valor que ya entraba sigue entrando (en las mismas líneas o menos)
    const tamano = Math.min(...fila.celdas.map(c => c.ajuste.tamano));
    for (const celda of fila.celdas) {
      if (celda.ajuste.tamano > tamano) celda.ajuste = ajustarCelda(celda, { max: tamano, min: tamano });
    }
    fila.alto = arriba + altoRotulo(tamanoRotulo) + Math.max(...fila.celdas.map(c => c.ajuste.alto)) + abajo;
  }
  return {
    alto: suma(filas.map(f => f.alto)) - (divisorias ? 0 : abajo),
    dibujar: (x, y) => {
      let yFila = y;
      for (const fila of filas) {
        if (divisorias) filete(doc, x, yFila, ancho);
        fila.celdas.forEach((celda, k) => {
          const xCelda = x + k * (anchoColumna + SEPARACION_COLUMNAS);
          const anchoCelda = fila.completa ? ancho : anchoColumna;
          rotulo(doc, celda.etiqueta, xCelda, yFila + arriba, { ancho: anchoCelda, tamano: tamanoRotulo });
          escribir(doc, celda.ajuste, xCelda, yFila + arriba + altoRotulo(tamanoRotulo), celda.color ?? COLOR.tinta,
            celda.link ? { link: celda.link } : {});
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
export const dibujarTarjetaQr = (doc, url, x, y) => {
  doc.roundedRect(x, y, ANCHO_TARJETA_QR, ALTO_TARJETA_QR, 6).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
  dibujarQr(doc, url, x + RELLENO_QR, y + RELLENO_QR, LADO_QR);
  renglon(doc, 'Abrir en el portal', x, y + RELLENO_QR + LADO_QR + 4, { ancho: ANCHO_TARJETA_QR, tamano: 7, color: COLOR.gris, align: 'center' });
  doc.link(x, y, ANCHO_TARJETA_QR, ALTO_TARJETA_QR, url);
};

// Ficha: los campos en dos columnas y el link al portal, con el QR a la derecha (sin link válido no hay QR).
// Los valores ocupan hasta 2 líneas de media columna y, si no entran, la fila entera (nivel 0); en el nivel 1, una
// línea, también con la fila entera si hace falta; en el nivel 2, una línea de media columna.
const prepararFicha = (doc, hoja, p, nivel) => {
  const ancho = hoja.url ? CONTENIDO - ANCHO_TARJETA_QR - SEPARACION_QR : CONTENIDO;
  const lineas = nivel === 0 ? 2 : 1;
  const celdas = hoja.campos.map(([etiqueta, valor]) => ({ etiqueta, valor }));
  if (hoja.url) {
    celdas.push({
      etiqueta: 'Link al portal', valor: hoja.url, completa: true, link: hoja.url, color: COLOR.acento, lineas: 2,
      tamanos: { max: p.link, min: MINIMO }
    });
  }
  const grilla = prepararGrilla(doc, celdas, {
    ancho, columnas: 2, lineas, tamanos: { max: p.valor, min: MINIMO }, tamanoRotulo: p.rotulo, divisorias: true,
    filaEntera: nivel < 2 ? { lineas, tamano: p.valor } : null, aire: p.aire
  });
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
const prepararContacto = (doc, hoja, p, nivel) => {
  const relleno = 12;
  const ancho = CONTENIDO - 2 * relleno;
  // El nombre del área, en una línea (achicándose 1,5 puntos); si no entra, en dos (salvo que falte lugar)
  const ajustarNombre = (lineas, max) => ajustar(doc, hoja.contacto.nombre, { ancho, lineas, max, min: p.nombre - 1.5, fuente: NEGRITA });
  let nombre = hoja.contacto.nombre ? ajustarNombre(1, p.nombre) : null;
  if (nombre?.cortado && nivel === 0) nombre = ajustarNombre(2, p.nombre - 1.5);
  const celdas = hoja.contacto.lineas.map((linea) => {
    const partes = /^([^:\n]{1,40}): ([\s\S]+)$/.exec(linea);
    return partes ? { etiqueta: partes[1], valor: partes[2] } : null;
  });
  const contenido = celdas.every(Boolean)
    ? prepararGrilla(doc, celdas, {
      ancho, columnas: 2, lineas: nivel === 0 ? 2 : 1, tamanos: { max: p.contacto, min: MINIMO }, tamanoRotulo: p.rotulo,
      divisorias: false, filaEntera: nivel < 2 ? { lineas: 1, tamano: p.contacto } : null, aire: p.aire
    })
    : (() => {
      const texto = ajustar(doc, hoja.contacto.lineas.join('\n'), { ancho, lineas: 3, max: p.contacto, min: MINIMO });
      return { alto: texto.alto, dibujar: (x, y) => escribir(doc, texto, x, y, COLOR.gris) };
    })();
  const yNombre = 10 + altoRotulo(p.rotulo) + 3;
  const yContenido = yNombre + (nombre ? nombre.alto + 5 : 0);
  return {
    alto: yContenido + contenido.alto + 9,
    dibujar: (y) => {
      doc.roundedRect(IZQUIERDA, y, CONTENIDO, yContenido + contenido.alto + 9, 6).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
      rotulo(doc, 'Contacto del área responsable', IZQUIERDA + relleno, y + 10, { ancho, tamano: p.rotulo, color: COLOR.gris });
      if (nombre) escribir(doc, nombre, IZQUIERDA + relleno, y + yNombre, COLOR.tinta);
      contenido.dibujar(IZQUIERDA + relleno, y + yContenido);
    }
  };
};

// Textos largos: la descripción (destacada: fondo del acento suave, filete del acento a la izquierda, letra más
// grande; presenta el dataset) y, después de la ficha, qué se solicita y observaciones (fondo gris, contexto
// operativo). Cada uno, con su rótulo arriba. El primero es siempre el destacado (dibujarHoja).
const bloquesDeTexto = (hoja, p) => {
  const bloque = (clave, titulo, texto, tamano, destacado) => {
    const rotulo = destacado ? p.rotulo + 0.5 : p.rotulo;
    return {
      clave, titulo, texto, tamano, destacado, rotulo, minimo: MINIMO_LINEAS[clave],
      izquierda: destacado ? 20 : 12, derecha: destacado ? 16 : 12,
      arriba: destacado ? 12 : 10, sobre: (destacado ? 12 : 10) + altoRotulo(rotulo) + (destacado ? 5 : 3), bajo: destacado ? 9 : 7,
      // El destacado va sin justificar: con letra grande, el justificado abre huecos entre palabras
      opciones: (t) => (destacado ? { lineGap: t * 0.16 } : { align: 'justify', lineGap: t * 0.12 })
    };
  };
  return [
    bloque('descripcion', 'Descripción', hoja.descripcion, p.destacado, true),
    bloque('solicita', 'Qué se solicita', hoja.queSeSolicita, p.texto, false),
    ...(hoja.observaciones ? [bloque('observaciones', 'Observaciones', hoja.observaciones, p.texto, false)] : [])
  ].map(b => ({ ...b, ancho: CONTENIDO - b.izquierda - b.derecha }));
};

// Alto mínimo del texto de un bloque: sus líneas mínimas en la letra más chica
const minimoDe = (doc, bloque) => bloque.minimo * medidor(doc, { ancho: bloque.ancho, opciones: bloque.opciones }).interlinea(MINIMO);

// Lo que necesita el texto de un bloque en su tamaño (Infinity si no entra en "libre")
const necesarioDe = (doc, bloque, libre) => {
  const ajuste = ajustar(doc, bloque.texto, { ancho: bloque.ancho, alto: Math.max(0, libre), max: bloque.tamano, opciones: bloque.opciones });
  return ajuste.cortado ? Infinity : ajuste.alto;
};

// Reparte "libre" entre los textos: cada uno recibe lo que necesita hasta un nivel común (el que hace que la suma
// dé "libre"), nunca menos que su mínimo
const repartir = (necesarios, minimos, libre) => {
  if (suma(necesarios) <= libre) return necesarios;
  const total = (nivel) => suma(necesarios.map((n, k) => Math.max(minimos[k], Math.min(n, nivel))));
  let bajo = 0;
  let alto = Math.max(libre, 0);
  for (let i = 0; i < 50; i++) {
    const medio = (bajo + alto) / 2;
    if (total(medio) > libre) alto = medio;
    else bajo = medio;
  }
  return necesarios.map((n, k) => Math.max(minimos[k], Math.min(n, bajo)));
};

const dibujarBloque = (doc, bloque, ajuste, y) => {
  const alto = bloque.sobre + ajuste.alto + bloque.bajo;
  if (bloque.destacado) {
    doc.save();
    doc.roundedRect(IZQUIERDA, y, CONTENIDO, alto, 6).clip();
    doc.rect(IZQUIERDA, y, CONTENIDO, alto).fill(COLOR.acentoSuave);
    doc.rect(IZQUIERDA, y, 4, alto).fill(COLOR.acento);
    doc.restore();
  } else {
    doc.roundedRect(IZQUIERDA, y, CONTENIDO, alto, 6).fill(COLOR.fondo);
  }
  rotulo(doc, bloque.titulo, IZQUIERDA + bloque.izquierda, y + bloque.arriba, {
    ancho: bloque.ancho, tamano: bloque.rotulo, color: bloque.destacado ? COLOR.acento : COLOR.gris
  });
  escribir(doc, ajuste, IZQUIERDA + bloque.izquierda, y + bloque.sobre, COLOR.tinta);
  return alto;
};

// =====================================================
// La hoja
// =====================================================

// Intentos de diagramación, en orden: cada perfil con todo en su tamaño y, con el perfil compacto, los niveles de
// compactación. En ellos las separaciones se achican primero (hasta un 40 %) y después los textos largos se achican
// hasta 8 puntos y se cortan: 1, valores de la ficha y del contacto (y el nombre del área) en una línea; 2, además,
// el título en dos líneas y los datos de contacto siempre en dos columnas. Todo tiene un tope de líneas, así que
// con el nivel 2 aun el peor caso deja el lugar mínimo de los textos largos (lo comprueba el test de diagramación
// con todos los campos, link y 7 datos de contacto larguísimos).
const INTENTOS = [
  ...PERFILES.slice(0, -1).map(p => ({ p, nivel: 0, todoEnSuTamano: true })),
  ...[0, 1, 2].map(nivel => ({ p: PERFILES.at(-1), nivel, todoEnSuTamano: false }))
];
const SEPARACIONES_COMPRIMIBLES = 0.4;

const planificar = (doc, hoja, alto) => {
  for (const [i, { p, nivel, todoEnSuTamano }] of INTENTOS.entries()) {
    const cabecera = prepararCabecera(doc, hoja, p, nivel);
    const ficha = prepararFicha(doc, hoja, p, nivel);
    const contacto = prepararContacto(doc, hoja, p, nivel);
    const bloques = bloquesDeTexto(hoja, p);
    let separaciones = SEPARACIONES.map(s => s * p.aire);
    const fijo = suma(separaciones) + cabecera.alto + altoLineaDeTiempo(p) + ficha.alto + contacto.alto + ENTRE_BLOQUES
      + suma(bloques.map(b => b.sobre + b.bajo)) + (bloques.length - 2) * ENTRE_BLOQUES;
    const comprimible = todoEnSuTamano ? 0 : suma(separaciones) * SEPARACIONES_COMPRIMIBLES;
    let libre = alto - fijo;
    const minimos = bloques.map(b => minimoDe(doc, b));
    const necesarios = bloques.map(b => necesarioDe(doc, b, libre + comprimible));
    // Lo que falta para que todo vaya en su tamaño sale primero de las separaciones
    const quita = Math.min(comprimible, Math.max(0, suma(necesarios) - libre));
    if (quita > 0) {
      separaciones = separaciones.map(s => s * (1 - quita / suma(SEPARACIONES.map(b => b * p.aire))));
      libre += quita;
    }
    const ultimo = i === INTENTOS.length - 1;
    if (todoEnSuTamano ? suma(necesarios) <= libre : (suma(minimos) <= libre || ultimo)) {
      const asignados = repartir(necesarios, minimos, libre);
      const ajustarBloque = (k, max) => ajustar(doc, bloques[k].texto, {
        ancho: bloques[k].ancho, alto: asignados[k], max, min: MINIMO, opciones: bloques[k].opciones, corte: CORTE
      });
      const ajustes = bloques.map((b, k) => ajustarBloque(k, b.tamano));
      // Los textos que entraron sin cortarse pueden ocupar menos que lo asignado (achicados, o sin llegar al nivel común):
      // ese lugar es para los que se cortaron, que con él pueden entrar enteros o cortarse más adelante
      const cortados = ajustes.flatMap((a, k) => (a.cortado ? [k] : []));
      const extra = libre - suma(ajustes.map((a, k) => (a.cortado ? asignados[k] : a.alto)));
      if (cortados.length && extra > 0.5) {
        for (const k of cortados) {
          asignados[k] += extra / cortados.length;
          ajustes[k] = ajustarBloque(k, bloques[k].tamano);
        }
      }
      // La descripción (destacada) no queda más chica que los otros textos: si se achicó, ellos van medio punto
      // debajo (más chicos ocupan menos, así que siguen entrando en lo asignado)
      const tope = Math.max(MINIMO, ajustes[0].tamano - 0.5);
      ajustes.forEach((ajuste, k) => {
        if (k > 0 && ajuste.tamano > tope) ajustes[k] = ajustarBloque(k, tope);
      });
      return { p, cabecera, ficha, contacto, bloques, ajustes, separaciones, sobra: Math.max(0, libre - suma(ajustes.map(a => a.alto))) };
    }
  }
  return null;
};

// Una hoja: de arriba abajo, encabezado, cabecera, línea de tiempo, descripción (destacada), ficha, qué se solicita
// y observaciones, contacto (abajo, cerca del pie) y pie. El espacio que sobra agranda las separaciones (hasta
// EXTRA_MAXIMO cada una; la de arriba del título, la mitad) y el resto queda arriba del contacto.
const dibujarHoja = (doc, anexo, hoja, i, total) => {
  const arriba = dibujarEncabezado(doc, anexo);
  const limite = dibujarPie(doc, anexo, i, total) - SOBRE_PIE;
  const { p, cabecera, ficha, contacto, bloques, ajustes, separaciones, sobra } = planificar(doc, hoja, limite - arriba);
  const extra = Math.min(EXTRA_MAXIMO, sobra / (separaciones.length - 0.5));
  const [descripcion, ...textos] = bloques;
  const [ajusteDescripcion, ...ajustesTextos] = ajustes;
  let y = arriba + separaciones[0] + extra / 2;
  cabecera.dibujar(y);
  y += cabecera.alto + separaciones[1] + extra;
  dibujarLineaDeTiempo(doc, hoja.linea, y, p);
  y += altoLineaDeTiempo(p) + separaciones[2] + extra;
  y += dibujarBloque(doc, descripcion, ajusteDescripcion, y) + separaciones[3] + extra;
  ficha.dibujar(y);
  y += ficha.alto + separaciones[4] + extra;
  textos.forEach((bloque, k) => {
    y += dibujarBloque(doc, bloque, ajustesTextos[k], y) + ENTRE_BLOQUES;
  });
  contacto.dibujar(limite - contacto.alto);
};

export const renderAnexo = async (anexo) => {
  await cargarQrcode();
  return dibujarAnexo(anexo);
};

const dibujarAnexo = (anexo) => new Promise((resolve, reject) => {
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
