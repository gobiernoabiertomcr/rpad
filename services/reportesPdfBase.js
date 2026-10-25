// La base de los reportes PDF (spec 2026-10-24-metricas-y-reportes, 5.1), con el lenguaje de los anexos de las Notas Digitales y de
// la hoja del Seguimiento (services/notasDigitalesAnexo.js y services/seguimientoPdf.js): A4, Helvetica, márgenes de 15 mm, su
// paleta monocromática con el acento azul, DocumentoNota (todo texto pasa por textoParaPdf) y el mismo pie que el Seguimiento.
// Un reporte se arma así:
//   const doc = nuevoReporte({ titulo });
//   let y = agregarHoja(doc, { derecha: 'Estado general de los datasets', fecha: hoy });
//   y = dibujarTitulo(doc, { rotulo, titulo }, y);
//   y = dibujarPildora(doc, texto, y);
//   y = dibujarTarjetas(doc, [{ valor, rotulo }], y);
//   y = prepararTabla(doc, { columnas, filas, estados }).dibujar(y);   // corta de hoja y repite su encabezado
//   return cerrarReporte(doc, { generado, pieDe: (k, n) => `Estado general · Hoja ${k} de ${n}` });
// Cada dibujante recibe la y donde empieza (desde el borde superior, en puntos) y devuelve la y donde puede empezar lo que sigue, con
// el aire de la base (ENTRE) debajo. Nada pasa de LIMITE, el aire sobre la línea del pie: el pie se dibuja al cerrar, cuando ya se
// sabe cuántas hojas hay.
import { DocumentoNota } from './notasDigitalesPdf.js';
import { esFechaIso, formatoCorto, formatoLargo } from './notasDigitalesCalendario.js';
import {
  COLOR, MARGEN, IZQUIERDA, ABAJO, CONTENIDO, NORMAL, NEGRITA, ASCENDENTE, DESCENDENTE,
  desdeBase, ajustar, escribir, renglon, filete, etiquetaDeCabecera
} from './notasDigitalesAnexo.js';
import { dibujarPie } from './seguimientoPdf.js';

// Letras (en puntos): las del encabezado, la etiqueta, el título y el pie son las del Seguimiento
const LETRA = {
  encabezado: 7.5, reporte: 9.5, etiqueta: 7.5, titulo: 20, pildora: 8.4, valor: 16, rotuloTarjeta: 7,
  columna: 7, celda: 8, insignia: 7, pie: 7.5
};

// El aire entre un elemento y el que sigue
export const ENTRE = 10;
// Del filete del encabezado a lo primero de la hoja, y de la etiqueta al título (los del Seguimiento)
const BAJO_ENCABEZADO = 12;
const SOBRE_TITULO = 15;
// La línea del pie, donde la dibuja dibujarPie (seguimientoPdf.js), y el aire que queda libre arriba de ella
const LINEA_DEL_PIE = desdeBase(ABAJO - DESCENDENTE * LETRA.pie, LETRA.pie) - 8;
const SOBRE_PIE = 6;
// Lo más abajo que llega lo que se dibuja en una hoja
export const LIMITE = LINEA_DEL_PIE - SOBRE_PIE;

// La píldora: el acento suave con el texto en el acento (como el estado del anexo) o el sol de la pantalla (un aviso)
const TONOS = {
  azul: { fondo: COLOR.acentoSuave, texto: COLOR.acento },
  sol: { fondo: '#FDF1CC', texto: '#7A5200' }
};

// Las insignias de estado, con los colores de la pantalla del Seguimiento (seguimiento.html): los estados de estadoDelDataset y los del
// Seguimiento (vencido, que junta a atrasado y sin respuesta, y dado de baja)
const VENCIDO = Object.freeze({ fondo: '#F8E1E1', texto: '#8A3434' });
export const INSIGNIAS = Object.freeze({
  actualizado: Object.freeze({ fondo: '#DDF1E6', texto: '#2E6B4C' }),
  proximo: Object.freeze({ fondo: '#FCE8A8', texto: '#7A5200' }),
  atrasado: VENCIDO,
  'sin-respuesta': VENCIDO,
  vencido: VENCIDO,
  eventual: Object.freeze({ fondo: '#DCEAF7', texto: '#24507A' }),
  'sin-fecha': Object.freeze({ fondo: '#F4F7FA', texto: '#56677F' }),
  baja: Object.freeze({ fondo: '#DAE3ED', texto: '#22324A' })
});

// Las tarjetas: el valor arriba del rótulo (en hasta dos líneas), con un borde fino
const TARJETA = { separacion: 6, relleno: 7, entre: 4, abajo: 5.5, radio: 6 };
// La tabla: relleno a los costados de cada celda y arriba y abajo de cada fila; el encabezado va en hasta 2 líneas y cada celda en
// hasta LINEAS_POR_CELDA (si no entra, se corta con "…"), así ninguna fila es más alta que una hoja
const TABLA = { relleno: 3, arriba: 5, abajo: 4.5 };
const LINEAS_DEL_ENCABEZADO = 2;
const LINEAS_POR_CELDA = 4;
const INSIGNIA = { relleno: 4.5, alto: 12 };

const OJO = ASCENDENTE + DESCENDENTE;
const suma = (valores) => valores.reduce((a, b) => a + b, 0);

// Una fecha 'AAAA-MM-DD' como dd/mm/aaaa, cortada del texto (sin zona horaria); "—" si falta o no es una fecha
export const fechaCorta = (iso) => (esFechaIso(iso) ? formatoCorto(iso) : '—');

// =====================================================
// El documento y sus hojas
// =====================================================

// Lo que la base recuerda de cada documento: el PDF que se va juntando, el encabezado de la última hoja (la tabla lo repite cuando
// corta de hoja) y las hojas que agregó agregarHoja (las que llevan el pie al cerrar)
const REPORTES = new WeakMap();

// Un reporte nuevo, sin hojas: A4 explícito (DocumentoNota no tiene tamaño, y sin él saldría en carta), márgenes de PDFKit en 0 (la
// diagramación es de la base y nada se escribe donde PDFKit agregaría una hoja) y las hojas en memoria hasta cerrarlo (el pie dice
// cuántas son). `titulo`: el título del PDF.
export const nuevoReporte = ({ titulo }) => {
  const doc = new DocumentoNota({
    size: 'A4', autoFirstPage: false, bufferPages: true, margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: { Title: titulo, Author: 'Dirección de Datos Públicos y Comunicación' }
  });
  const partes = [];
  const terminado = new Promise((resolve, reject) => {
    doc.on('data', parte => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  // (si el reporte falla antes de cerrarse, nadie espera el PDF: el error ya lo recibe quien lo dibuja)
  terminado.catch(() => {});
  REPORTES.set(doc, { terminado, hoja: null, hojas: [] });
  return doc;
};

// El encabezado del anexo: a la izquierda la Dirección y la Municipalidad; a la derecha `derecha` (el nombre del reporte) y la fecha
// larga, sobre una línea fina con un tramo del acento. Devuelve la y donde termina.
const dibujarEncabezado = (doc, derecha, fecha) => {
  const mitad = CONTENIDO / 2;
  const base1 = MARGEN + ASCENDENTE * LETRA.reporte;
  const base2 = base1 + 11.5;
  renglon(doc, 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', IZQUIERDA, desdeBase(base1, LETRA.encabezado),
    { ancho: mitad, tamano: LETRA.encabezado, fuente: NEGRITA, color: COLOR.tinta, espaciado: 0.6 });
  renglon(doc, 'Municipalidad de Comodoro Rivadavia', IZQUIERDA, desdeBase(base2, LETRA.encabezado),
    { ancho: mitad, tamano: LETRA.encabezado, color: COLOR.gris });
  renglon(doc, derecha, IZQUIERDA + mitad, desdeBase(base1, LETRA.reporte), { ancho: mitad, tamano: LETRA.reporte, fuente: NEGRITA, align: 'right' });
  renglon(doc, esFechaIso(fecha) ? formatoLargo(fecha) : '', IZQUIERDA + mitad, desdeBase(base2, LETRA.encabezado),
    { ancho: mitad, tamano: LETRA.encabezado, color: COLOR.gris, align: 'right' });
  const yLinea = base2 + 9;
  filete(doc, IZQUIERDA, yLinea, CONTENIDO);
  doc.rect(IZQUIERDA, yLinea - 1, 28, 2).fill(COLOR.acento);
  return yLinea + 1;
};

// Una hoja nueva con el encabezado: `derecha`, el nombre del reporte; `fecha`, 'AAAA-MM-DD' (va como fecha larga). Devuelve la y donde
// empieza lo que va en la hoja.
export const agregarHoja = (doc, { derecha, fecha }) => {
  const reporte = REPORTES.get(doc);
  doc.addPage();
  const { start, count } = doc.bufferedPageRange();
  reporte.hoja = { derecha, fecha };
  reporte.hojas.push(start + count - 1);
  return dibujarEncabezado(doc, derecha, fecha) + BAJO_ENCABEZADO;
};

// Cierra el reporte: el pie en cada hoja que agregó agregarHoja (el del Seguimiento: «Generado el dd/mm/aaaa a las hh:mm por <por>» a
// la izquierda y `pieDe(k, n)` a la derecha, con k la hoja, de 1 a n, y n las hojas del documento) y el PDF.
// `generado`: { momento: 'AAAA-MM-DD HH:MM:SS' (hora argentina), por: nombre corto o null }. Un reporte sin hojas tira error.
export const cerrarReporte = async (doc, { generado, pieDe }) => {
  const reporte = REPORTES.get(doc);
  if (!reporte || reporte.hojas.length === 0) throw new Error('El reporte no tiene hojas');
  const { start, count } = doc.bufferedPageRange();
  for (const hoja of reporte.hojas) {
    doc.switchToPage(hoja);
    dibujarPie(doc, generado, pieDe(hoja - start + 1, count));
  }
  doc.end();
  return reporte.terminado;
};

// =====================================================
// Elementos
// =====================================================

// El rótulo chico en mayúsculas espaciadas, en el acento (como la etiqueta del anexo: «ESTADO GENERAL · AL 24/10/2026»; sin rótulo,
// no va) y el título grande en negrita, en hasta dos líneas (si no entra, se corta con "…").
export const dibujarTitulo = (doc, { rotulo, titulo }, y) => {
  let yTitulo = y;
  if (rotulo) {
    etiquetaDeCabecera(doc, String(rotulo).toUpperCase(), IZQUIERDA, y, { ancho: CONTENIDO, tamano: LETRA.etiqueta });
    yTitulo += SOBRE_TITULO;
  }
  const opciones = (t) => ({ lineGap: -0.075 * t });
  const ajuste = ajustar(doc, titulo ?? '', { ancho: CONTENIDO, lineas: 2, max: LETRA.titulo, min: LETRA.titulo, fuente: NEGRITA, opciones });
  escribir(doc, ajuste, IZQUIERDA, yTitulo, COLOR.tinta);
  return yTitulo + ajuste.alto + ENTRE;
};

// La píldora (el indicador de estado del anexo): un punto y el texto en negrita, en una línea (si no entra, se corta con "…").
// `tono`: 'azul' (el acento) o 'sol' (un aviso).
export const dibujarPildora = (doc, texto, y, { tono = 'azul' } = {}) => {
  const { fondo, texto: color } = TONOS[tono] ?? TONOS.azul;
  const tamano = LETRA.pildora;
  const alto = Math.round(tamano * 2.35);
  const relleno = alto * 0.55;
  doc.font(NEGRITA).fontSize(tamano);
  const anchoTexto = Math.min(CONTENIDO - 3 * relleno, doc.widthOfString(String(texto)) + 2);
  doc.roundedRect(IZQUIERDA, y, anchoTexto + 2.6 * relleno, alto, alto / 2).fill(fondo);
  doc.circle(IZQUIERDA + relleno, y + alto / 2, tamano * 0.3).fill(color);
  // Las mayúsculas, centradas en el alto de la píldora
  renglon(doc, String(texto), IZQUIERDA + 1.75 * relleno, y + (alto - ASCENDENTE * tamano) / 2,
    { ancho: anchoTexto, tamano, fuente: NEGRITA, color });
  return y + alto + ENTRE;
};

// Una fila de tarjetas que ocupa el ancho útil: en cada una, el valor grande en negrita y debajo su rótulo en gris (el valor se
// dibuja antes que el rótulo). `tarjetas`: [{ valor, rotulo }].
export const dibujarTarjetas = (doc, tarjetas, y) => {
  const lista = Array.isArray(tarjetas) ? tarjetas : [];
  if (lista.length === 0) return y;
  const { separacion, relleno, entre, abajo, radio } = TARJETA;
  const ancho = (CONTENIDO - separacion * (lista.length - 1)) / lista.length;
  const anchoTexto = ancho - 2 * relleno;
  const rotulos = lista.map(t => ajustar(doc, String(t.rotulo ?? ''), {
    ancho: anchoTexto, lineas: 2, max: LETRA.rotuloTarjeta, min: LETRA.rotuloTarjeta
  }));
  const yRotulo = relleno + OJO * LETRA.valor + entre;
  const alto = yRotulo + Math.max(...rotulos.map(r => r.alto)) + abajo;
  lista.forEach((tarjeta, i) => {
    const x = IZQUIERDA + i * (ancho + separacion);
    doc.save();
    doc.lineWidth(0.8).strokeColor(COLOR.linea);
    doc.roundedRect(x, y, ancho, alto, radio).stroke();
    doc.restore();
    renglon(doc, String(tarjeta.valor ?? ''), x + relleno, y + relleno, { ancho: anchoTexto, tamano: LETRA.valor, fuente: NEGRITA });
    escribir(doc, rotulos[i], x + relleno, y + yRotulo, COLOR.gris);
  });
  return y + alto + ENTRE;
};

// La insignia de un estado dentro de su celda: el texto en negrita sobre el fondo del estado, en una línea (si no entra, se corta
// con "…"), centrada en la primera línea de las demás celdas. `colores`: { fondo, texto } (INSIGNIAS).
const prepararInsignia = (doc, texto, colores, ancho) => {
  doc.font(NEGRITA).fontSize(LETRA.insignia);
  const anchoTexto = Math.min(ancho - 2 * INSIGNIA.relleno, doc.widthOfString(texto) + 1);
  // De la y del texto de la fila (el borde superior de su primera línea) a la de la insignia
  const desdeElTexto = (ASCENDENTE * LETRA.celda) / 2 - INSIGNIA.alto / 2;
  return {
    alto: desdeElTexto + INSIGNIA.alto,
    dibujar: (x, y) => {
      const yInsignia = y + desdeElTexto;
      doc.roundedRect(x, yInsignia, anchoTexto + 2 * INSIGNIA.relleno, INSIGNIA.alto, INSIGNIA.alto / 2).fill(colores.fondo);
      renglon(doc, texto, x + INSIGNIA.relleno, yInsignia + (INSIGNIA.alto - ASCENDENTE * LETRA.insignia) / 2,
        { ancho: anchoTexto, tamano: LETRA.insignia, fuente: NEGRITA, color: colores.texto });
    }
  };
};

// Una tabla de grilla fina (el encabezado en negrita en el acento y una línea fina debajo de cada fila) que ocupa el ancho útil.
// - columnas: [{ titulo, ancho }]: el ancho es la parte del ancho útil que le toca (se reparte en proporción).
// - filas: [[texto de cada celda]]; cada celda va en hasta LINEAS_POR_CELDA líneas (si no entra, se corta con "…").
// - estados (opcional): uno por fila, la clave de INSIGNIAS de esa fila; con una, la última celda se dibuja como la insignia de ese
//   estado (sin estado, o con uno que no está en INSIGNIAS, como texto).
// Devuelve { dibujar(y) → y }. El encabezado y la primera fila nunca se separan; si una fila no entra en la hoja, sigue en una hoja
// nueva (con el encabezado de la última que agregó agregarHoja) y repite el encabezado de la tabla. Sin filas no dibuja nada.
export const prepararTabla = (doc, { columnas, filas, estados = [] }) => {
  const pesos = columnas.map(c => (Number(c.ancho) > 0 ? Number(c.ancho) : 1));
  const anchos = pesos.map(p => (CONTENIDO * p) / suma(pesos));
  const xs = anchos.map((_, i) => IZQUIERDA + suma(anchos.slice(0, i)));
  const ultima = columnas.length - 1;
  const anchoTexto = (i) => anchos[i] - 2 * TABLA.relleno;
  const texto = (valor, i, { fuente, tamano, lineas, color }) => {
    const ajuste = ajustar(doc, String(valor ?? ''), { ancho: anchoTexto(i), lineas, max: tamano, min: tamano, fuente });
    return { alto: ajuste.alto, dibujar: (x, y) => escribir(doc, ajuste, x, y, color) };
  };
  const altoDe = (celdas) => TABLA.arriba + Math.max(...celdas.map(c => c.alto)) + TABLA.abajo;

  const encabezado = columnas.map((c, i) => texto(c.titulo, i, {
    fuente: NEGRITA, tamano: LETRA.columna, lineas: LINEAS_DEL_ENCABEZADO, color: COLOR.acento
  }));
  const altoEncabezado = altoDe(encabezado);
  const preparadas = (Array.isArray(filas) ? filas : []).map((fila, f) => {
    const clave = estados?.[f];
    const colores = typeof clave === 'string' && Object.hasOwn(INSIGNIAS, clave) ? INSIGNIAS[clave] : null;
    const celdas = columnas.map((_, i) => (i === ultima && colores
      ? prepararInsignia(doc, String(fila[i] ?? ''), colores, anchoTexto(i))
      : texto(fila[i], i, { fuente: NORMAL, tamano: LETRA.celda, lineas: LINEAS_POR_CELDA, color: COLOR.tinta })));
    return { celdas, alto: altoDe(celdas) };
  });

  // Las celdas de una fila (o del encabezado) desde y, con la línea fina debajo
  const dibujarFila = (celdas, y, alto, linea) => {
    celdas.forEach((celda, i) => celda.dibujar(xs[i] + TABLA.relleno, y + TABLA.arriba));
    filete(doc, IZQUIERDA, y + alto, CONTENIDO, linea);
  };

  return {
    dibujar: (y) => {
      if (preparadas.length === 0) return y;
      const { hoja } = REPORTES.get(doc);
      let yFila = y;
      const ponerEncabezado = () => {
        dibujarFila(encabezado, yFila, altoEncabezado, COLOR.grisClaro);
        yFila += altoEncabezado;
      };
      if (yFila + altoEncabezado + preparadas[0].alto > LIMITE) yFila = agregarHoja(doc, hoja);
      ponerEncabezado();
      for (const fila of preparadas) {
        if (yFila + fila.alto > LIMITE) {
          yFila = agregarHoja(doc, hoja);
          ponerEncabezado();
        }
        dibujarFila(fila.celdas, yFila, fila.alto, COLOR.linea);
        yFila += fila.alto;
      }
      return yFila + ENTRE;
    }
  };
};
