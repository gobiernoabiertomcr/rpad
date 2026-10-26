// La base de los reportes PDF (spec 2026-10-24-metricas-y-reportes, 5.1), con el lenguaje de los anexos de las Notas Digitales y de
// la hoja del Seguimiento (services/notasDigitalesAnexo.js y services/seguimientoPdf.js): A4, Helvetica, márgenes de 15 mm, su
// paleta monocromática con el acento azul, DocumentoNota (todo texto pasa por textoParaPdf) y el encabezado y el pie del Seguimiento
// (dibujarEncabezado y dibujarPie, con su LINEA_DEL_PIE: la base no los copia).
// Un reporte se arma así:
//   const doc = nuevoReporte({ titulo });
//   let y = agregarHoja(doc, { derecha: 'Estado general de los datasets', fecha: hoy });
//   y = dibujarTitulo(doc, { rotulo, titulo }, y);
//   y = dibujarPildora(doc, texto, y);
//   y = dibujarTarjetas(doc, [{ valor, rotulo }], y);
//   y = prepararTabla(doc, { columnas, filas, estados }).dibujar(y);   // corta de hoja y repite su encabezado (y su cabeza, si la tiene)
//   return cerrarReporte(doc, { generado, pieDe: (k, n) => `Estado general · Hoja ${k} de ${n}` });
// Cada dibujante recibe la y donde empieza (desde el borde superior, en puntos) y devuelve la y donde puede empezar lo que sigue, con
// el aire de la base (ENTRE) debajo. Nada pasa de LIMITE, el aire sobre la línea del pie: el pie se dibuja al cerrar, cuando ya se
// sabe cuántas hojas hay. Un reporte puede sumar hojas que dibuja otro, con su propio pie (el Por área, las del Seguimiento): las
// numera con hojasDe, que cuenta las hojas del documento hasta ahora.
// Lo que no es una tabla se mide antes de dibujarlo (Ruling 22: que nada pise el pie ni deje un título solo al final de una hoja):
// cada prepararX devuelve { alto, dibujar(y) → y }, con el alto que va a ocupar (sin el aire de abajo), y
//   y = lugarPara(doc, y, alto);                       // si no entra antes de LIMITE, una hoja nueva con el mismo encabezado
//   y = dibujarJuntos(doc, y, [seccion, recuadro]);    // un título viaja con lo primero que le sigue
// Los elementos: prepararTitulo, prepararPildora, prepararTarjetas, prepararSeccion (la cabeza de una sección del Seguimiento),
// prepararParrafo y prepararRecuadro (gris, o con el borde azul a la izquierda: spec 5.1), que lleva adentro cualquier otro elemento
// preparado con el ancho ANCHO_DEL_RECUADRO (su dibujar recibe además la x: dibujar(y, x)). La tabla mide en `alto` lo que tiene que
// entrar con lo de antes: su encabezado y su primera fila (después corta de hoja sola); su aclaración, si la tiene, viaja con la última
// fila.
// Los dibujantes leen lo que manda el servidor con los ayudantes de la base (esObjeto, objeto, lista, esNumero y texto).
import { DocumentoNota } from './notasDigitalesPdf.js';
import { esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';
import {
  COLOR, IZQUIERDA, CONTENIDO, NORMAL, NEGRITA, ASCENDENTE, DESCENDENTE, ajustar, escribir, renglon, rotulo, filete, etiquetaDeCabecera
} from './notasDigitalesAnexo.js';
import { dibujarEncabezado, dibujarPie, dibujarCabezaDeSeccion, ALTO_DE_LA_CABEZA_DE_SECCION, LINEA_DEL_PIE } from './seguimientoPdf.js';

// Letras (en puntos): la etiqueta y el título son las del Seguimiento
const LETRA = {
  etiqueta: 7.5, titulo: 20, pildora: 8.4, valor: 16, rotuloTarjeta: 7, columna: 7, celda: 8, insignia: 7, parrafo: 8,
  rotuloRecuadro: 6.6
};

// El aire entre un elemento y el que sigue
export const ENTRE = 10;
// Del filete del encabezado a lo primero de la hoja, y de la etiqueta al título (los del Seguimiento)
const BAJO_ENCABEZADO = 12;
const SOBRE_TITULO = 15;
// El aire que queda libre arriba de la línea del pie (LINEA_DEL_PIE, la de dibujarPie del Seguimiento)
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
// El recuadro (como el «Datos solicitados» y la descripción del anexo): el fondo gris o, con el borde azul, el acento suave con el
// filete del acento a la izquierda (`filete` de ancho); el rótulo arriba y el contenido debajo, con estos aires (en puntos)
const RECUADRO = { izquierda: 14, derecha: 12, arriba: 8, abajo: 8, bajoRotulo: 5, radio: 6, filete: 4 };
// El ancho de lo que va adentro de un recuadro
export const ANCHO_DEL_RECUADRO = CONTENIDO - RECUADRO.izquierda - RECUADRO.derecha;
// Un párrafo va en hasta tantas líneas (si no entra, se corta con "…"): ninguno es más alto que una hoja
const LINEAS_DEL_PARRAFO = 40;

const OJO = ASCENDENTE + DESCENDENTE;
const suma = (valores) => valores.reduce((a, b) => a + b, 0);

// Para leer lo que manda el servidor sin que un dato raro rompa el dibujo (los usan los dibujantes de los reportes): si es un objeto (no
// una lista), el objeto o {}, la lista o [], si es un número finito y un texto (lo que no es un texto ni un número, vacío: nunca «null»
// ni «undefined»)
export const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
export const objeto = (valor) => (esObjeto(valor) ? valor : {});
export const lista = (valor) => (Array.isArray(valor) ? valor : []);
export const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);
export const texto = (valor) => (typeof valor === 'string' ? valor : esNumero(valor) ? String(valor) : '');

// Una fecha 'AAAA-MM-DD' como dd/mm/aaaa, cortada del texto (sin zona horaria); "—" si falta o no es una fecha
export const fechaCorta = (iso) => (esFechaIso(iso) ? formatoCorto(iso) : '—');

// Los sin fecha tienen frecuencia pero no próxima: no tienen tarjeta, una línea los aclara debajo de las tarjetas (en el Estado general
// y en el Por área)
export const textoSinFecha = (n) => (n === 1
  ? '1 dataset todavía no tiene fecha de próxima actualización'
  : `${n} datasets todavía no tienen fecha de próxima actualización`);

// =====================================================
// El documento y sus hojas
// =====================================================

// Lo que la base recuerda de cada documento: el PDF que se va juntando, el encabezado de la última hoja (la tabla y lugarPara lo
// repiten cuando pasan a otra hoja), la y donde empieza lo de esa hoja (`tope`) y las hojas que agregó agregarHoja (las que llevan el
// pie al cerrar)
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
  REPORTES.set(doc, { terminado, hoja: null, tope: null, hojas: [] });
  return doc;
};

// Una hoja nueva con el encabezado del Seguimiento (dibujarEncabezado): `derecha`, el nombre del reporte; `fecha`, 'AAAA-MM-DD' (va
// como fecha larga). Devuelve la y donde empieza lo que va en la hoja.
export const agregarHoja = (doc, { derecha, fecha }) => {
  const reporte = REPORTES.get(doc);
  doc.addPage();
  const { start, count } = doc.bufferedPageRange();
  reporte.hoja = { derecha, fecha };
  reporte.hojas.push(start + count - 1);
  reporte.tope = dibujarEncabezado(doc, fecha, derecha) + BAJO_ENCABEZADO;
  return reporte.tope;
};

// Cuántas hojas tiene el documento hasta ahora: las que agregó agregarHoja (o lugarPara, o una tabla que corta de hoja) y las que dibujó
// otro en él (las del Seguimiento en el reporte por área, que traen su propio pie). Con ella, quien dibuja esas otras hojas las numera
// como cerrarReporte numera las suyas: la hoja k sobre todas las del documento.
export const hojasDe = (doc) => doc.bufferedPageRange().count;

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

// La y donde va algo de `alto` puntos que empezaría en y: y, si entra antes de LIMITE; si no, la de una hoja nueva con el encabezado de
// la última (agregarHoja). En una hoja en la que todavía no se dibujó nada (y es su tope) no agrega otra: algo más alto que una hoja no
// deja hojas en blanco.
export const lugarPara = (doc, y, alto) => {
  const reporte = REPORTES.get(doc);
  if (y + alto <= LIMITE || y <= reporte.tope) return y;
  return agregarHoja(doc, reporte.hoja);
};

// El alto de `elementos` (preparados) dibujados uno debajo del otro, con el aire de la base entre cada dos
export const altoJuntos = (elementos) => suma(elementos.map(e => e.alto)) + ENTRE * Math.max(0, elementos.length - 1);

// Dibuja `elementos` (preparados) uno debajo del otro desde y, en la misma hoja: si juntos no entran, pasan juntos a una hoja nueva
// (lugarPara). Así un título (o la cabeza de una sección) nunca queda solo al final de una hoja: va con lo primero que le sigue.
// Devuelve la y de lo que sigue.
export const dibujarJuntos = (doc, y, elementos) => {
  let yElemento = lugarPara(doc, y, altoJuntos(elementos));
  for (const elemento of elementos) yElemento = elemento.dibujar(yElemento);
  return yElemento;
};

// =====================================================
// Elementos
// =====================================================

// El rótulo chico en mayúsculas espaciadas, en el acento (como la etiqueta del anexo: «ESTADO GENERAL · AL 24/10/2026»; sin rótulo,
// no va) y el título grande en negrita, en hasta dos líneas (si no entra, se corta con "…").
export const prepararTitulo = (doc, { rotulo: textoDelRotulo, titulo }) => {
  const sobre = textoDelRotulo ? SOBRE_TITULO : 0;
  const opciones = (t) => ({ lineGap: -0.075 * t });
  const ajuste = ajustar(doc, titulo ?? '', { ancho: CONTENIDO, lineas: 2, max: LETRA.titulo, min: LETRA.titulo, fuente: NEGRITA, opciones });
  const alto = sobre + ajuste.alto;
  return {
    alto,
    dibujar: (y) => {
      if (textoDelRotulo) etiquetaDeCabecera(doc, String(textoDelRotulo).toUpperCase(), IZQUIERDA, y, { ancho: CONTENIDO, tamano: LETRA.etiqueta });
      escribir(doc, ajuste, IZQUIERDA, y + sobre, COLOR.tinta);
      return y + alto + ENTRE;
    }
  };
};
export const dibujarTitulo = (doc, datos, y) => prepararTitulo(doc, datos).dibujar(y);

// La píldora (el indicador de estado del anexo): un punto y el texto en negrita, en una línea (si no entra, se corta con "…").
// `tono`: 'azul' (el acento) o 'sol' (un aviso). `ancho`: lo que ocupa a lo ancho; dibujar(y, x) la pone con su borde izquierdo en x
// (de entrada, el margen: así dos píldoras pueden ir una al lado de la otra)
export const prepararPildora = (doc, texto, { tono = 'azul' } = {}) => {
  const { fondo, texto: color } = TONOS[tono] ?? TONOS.azul;
  const tamano = LETRA.pildora;
  const alto = Math.round(tamano * 2.35);
  const relleno = alto * 0.55;
  doc.font(NEGRITA).fontSize(tamano);
  const anchoTexto = Math.min(CONTENIDO - 3 * relleno, doc.widthOfString(String(texto)) + 2);
  return {
    alto,
    ancho: anchoTexto + 2.6 * relleno,
    dibujar: (y, x = IZQUIERDA) => {
      doc.roundedRect(x, y, anchoTexto + 2.6 * relleno, alto, alto / 2).fill(fondo);
      doc.circle(x + relleno, y + alto / 2, tamano * 0.3).fill(color);
      // Las mayúsculas, centradas en el alto de la píldora
      renglon(doc, String(texto), x + 1.75 * relleno, y + (alto - ASCENDENTE * tamano) / 2,
        { ancho: anchoTexto, tamano, fuente: NEGRITA, color });
      return y + alto + ENTRE;
    }
  };
};
export const dibujarPildora = (doc, texto, y, opciones) => prepararPildora(doc, texto, opciones).dibujar(y);

// Una fila de tarjetas que ocupa el ancho útil: en cada una, el valor grande en negrita y debajo su rótulo en gris (el valor se
// dibuja antes que el rótulo). `tarjetas`: [{ valor, rotulo }]. Sin tarjetas, nada (alto 0).
export const prepararTarjetas = (doc, tarjetas) => {
  const todas = lista(tarjetas);
  if (todas.length === 0) return { alto: 0, dibujar: (y) => y };
  const { separacion, relleno, entre, abajo, radio } = TARJETA;
  const ancho = (CONTENIDO - separacion * (todas.length - 1)) / todas.length;
  const anchoTexto = ancho - 2 * relleno;
  const rotulos = todas.map(t => ajustar(doc, String(t.rotulo ?? ''), {
    ancho: anchoTexto, lineas: 2, max: LETRA.rotuloTarjeta, min: LETRA.rotuloTarjeta
  }));
  const yRotulo = relleno + OJO * LETRA.valor + entre;
  const alto = yRotulo + Math.max(...rotulos.map(r => r.alto)) + abajo;
  return {
    alto,
    dibujar: (y) => {
      todas.forEach((tarjeta, i) => {
        const x = IZQUIERDA + i * (ancho + separacion);
        doc.save();
        doc.lineWidth(0.8).strokeColor(COLOR.linea);
        doc.roundedRect(x, y, ancho, alto, radio).stroke();
        doc.restore();
        renglon(doc, String(tarjeta.valor ?? ''), x + relleno, y + relleno, { ancho: anchoTexto, tamano: LETRA.valor, fuente: NEGRITA });
        escribir(doc, rotulos[i], x + relleno, y + yRotulo, COLOR.gris);
      });
      return y + alto + ENTRE;
    }
  };
};
export const dibujarTarjetas = (doc, tarjetas, y) => prepararTarjetas(doc, tarjetas).dibujar(y);

// La cabeza de una sección, la del Seguimiento (dibujarCabezaDeSeccion): el título en mayúsculas en el acento y, a la derecha y en la
// misma línea, `derecha` en gris (si no entra en su media hoja, se corta con "…"), con su alto.
export const prepararSeccion = (doc, { titulo, derecha = '' }) => {
  const alto = ALTO_DE_LA_CABEZA_DE_SECCION;
  return {
    alto,
    dibujar: (y) => {
      dibujarCabezaDeSeccion(doc, String(titulo ?? ''), derecha ? String(derecha) : '', y);
      return y + alto + ENTRE;
    }
  };
};

// Un párrafo: `texto` en `ancho` (el útil, o ANCHO_DEL_RECUADRO adentro de un recuadro), con su letra, en hasta `lineas` líneas (si no
// entra, se corta con "…"). `dibujar(y, x)`: x, por defecto, el margen izquierdo.
export const prepararParrafo = (doc, texto, { ancho = CONTENIDO, tamano = LETRA.parrafo, fuente = NORMAL, color = COLOR.gris, lineas = LINEAS_DEL_PARRAFO } = {}) => {
  const ajuste = ajustar(doc, String(texto ?? ''), { ancho, lineas, max: tamano, min: tamano, fuente });
  return {
    alto: ajuste.alto,
    dibujar: (y, x = IZQUIERDA) => {
      escribir(doc, ajuste, x, y, color);
      return y + ajuste.alto + ENTRE;
    }
  };
};

// El recuadro (spec 5.1), del ancho útil: `tono` 'azul' (el acento suave con el filete del acento a la izquierda, como la descripción
// del anexo) o 'gris' (el fondo gris, como «Qué se solicita»); adentro, el rótulo en mayúsculas (sin rótulo, no va) y `contenido`, un
// elemento preparado con el ancho ANCHO_DEL_RECUADRO ({ alto, dibujar(y, x) }). No corta de hoja: va entero (lugarPara).
export const prepararRecuadro = (doc, { rotulo: textoDelRotulo = '', contenido = null }, { tono = 'azul' } = {}) => {
  const azul = tono !== 'gris';
  const altoRotulo = textoDelRotulo ? OJO * LETRA.rotuloRecuadro + RECUADRO.bajoRotulo : 0;
  const alto = RECUADRO.arriba + altoRotulo + (contenido?.alto ?? 0) + RECUADRO.abajo;
  return {
    alto,
    dibujar: (y) => {
      doc.save();
      doc.roundedRect(IZQUIERDA, y, CONTENIDO, alto, RECUADRO.radio).clip();
      doc.rect(IZQUIERDA, y, CONTENIDO, alto).fill(azul ? COLOR.acentoSuave : COLOR.fondo);
      if (azul) doc.rect(IZQUIERDA, y, RECUADRO.filete, alto).fill(COLOR.acento);
      doc.restore();
      const x = IZQUIERDA + RECUADRO.izquierda;
      if (textoDelRotulo) {
        rotulo(doc, textoDelRotulo, x, y + RECUADRO.arriba, { ancho: ANCHO_DEL_RECUADRO, tamano: LETRA.rotuloRecuadro, color: azul ? COLOR.acento : COLOR.gris });
      }
      contenido?.dibujar(y + RECUADRO.arriba + altoRotulo, x);
      return y + alto + ENTRE;
    }
  };
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
// - cabeza (opcional): un elemento preparado ({ alto, dibujar(y) → y }: la cabeza de su sección o el título de su grupo) que la tabla
//   repite arriba de su encabezado en cada hoja nueva que agrega, como el grupo de la portada del Por área. La primera vez la dibuja
//   quien llama, junto con la tabla (dibujarJuntos).
// - aclaracion (opcional): un elemento preparado (un párrafo que explica la tabla) que va debajo, con el aire de la base, y viaja con
//   la última fila: si las dos no entran en la hoja, la última fila pasa a una hoja nueva (con la cabeza y el encabezado) y la
//   aclaración va debajo. Así nunca queda sola arriba de una hoja.
// Devuelve { alto, dibujar(y) → y }. El encabezado y la primera fila nunca se separan (`alto` es lo que ocupan, con la aclaración si la
// primera es también la última: lo que tiene que entrar junto con lo de antes, por ejemplo con dibujarJuntos); si una fila no entra en
// la hoja, sigue en una hoja nueva (con el encabezado de la última que agregó agregarHoja) y repite la cabeza, si la hay, y el
// encabezado de la tabla. Sin filas no dibuja nada, tampoco la aclaración (alto 0).
export const prepararTabla = (doc, { columnas, filas, estados = [], cabeza = null, aclaracion = null }) => {
  const pesos = columnas.map(c => (Number(c.ancho) > 0 ? Number(c.ancho) : 1));
  const anchos = pesos.map(p => (CONTENIDO * p) / suma(pesos));
  const xs = anchos.map((_, i) => IZQUIERDA + suma(anchos.slice(0, i)));
  const ultima = columnas.length - 1;
  const anchoTexto = (i) => anchos[i] - 2 * TABLA.relleno;
  const celdaDeTexto = (valor, i, { fuente, tamano, lineas, color }) => {
    const ajuste = ajustar(doc, String(valor ?? ''), { ancho: anchoTexto(i), lineas, max: tamano, min: tamano, fuente });
    return { alto: ajuste.alto, dibujar: (x, y) => escribir(doc, ajuste, x, y, color) };
  };
  const altoDe = (celdas) => TABLA.arriba + Math.max(...celdas.map(c => c.alto)) + TABLA.abajo;

  const encabezado = columnas.map((c, i) => celdaDeTexto(c.titulo, i, {
    fuente: NEGRITA, tamano: LETRA.columna, lineas: LINEAS_DEL_ENCABEZADO, color: COLOR.acento
  }));
  const altoEncabezado = altoDe(encabezado);
  const preparadas = (Array.isArray(filas) ? filas : []).map((fila, f) => {
    const clave = estados?.[f];
    const colores = typeof clave === 'string' && Object.hasOwn(INSIGNIAS, clave) ? INSIGNIAS[clave] : null;
    const celdas = columnas.map((_, i) => (i === ultima && colores
      ? prepararInsignia(doc, String(fila[i] ?? ''), colores, anchoTexto(i))
      : celdaDeTexto(fila[i], i, { fuente: NORMAL, tamano: LETRA.celda, lineas: LINEAS_POR_CELDA, color: COLOR.tinta })));
    return { celdas, alto: altoDe(celdas) };
  });

  // Las celdas de una fila (o del encabezado) desde y, con la línea fina debajo
  const dibujarFila = (celdas, y, alto, linea) => {
    celdas.forEach((celda, i) => celda.dibujar(xs[i] + TABLA.relleno, y + TABLA.arriba));
    filete(doc, IZQUIERDA, y + alto, CONTENIDO, linea);
  };

  // Lo que la aclaración le suma a la última fila: el aire y su alto
  const conAclaracion = aclaracion ? ENTRE + aclaracion.alto : 0;
  const ultimaFila = preparadas.length - 1;

  return {
    alto: preparadas.length === 0 ? 0 : altoEncabezado + preparadas[0].alto + (ultimaFila === 0 ? conAclaracion : 0),
    dibujar: (y) => {
      if (preparadas.length === 0) return y;
      const { hoja } = REPORTES.get(doc);
      let yFila = y;
      const ponerEncabezado = () => {
        dibujarFila(encabezado, yFila, altoEncabezado, COLOR.grisClaro);
        yFila += altoEncabezado;
      };
      // Una hoja nueva, con la cabeza arriba (si la hay)
      const otraHoja = () => {
        yFila = agregarHoja(doc, hoja);
        if (cabeza) yFila = cabeza.dibujar(yFila);
      };
      if (yFila + altoEncabezado + preparadas[0].alto + (ultimaFila === 0 ? conAclaracion : 0) > LIMITE) otraHoja();
      ponerEncabezado();
      preparadas.forEach((fila, f) => {
        if (yFila + fila.alto + (f === ultimaFila ? conAclaracion : 0) > LIMITE) {
          otraHoja();
          ponerEncabezado();
        }
        dibujarFila(fila.celdas, yFila, fila.alto, COLOR.linea);
        yFila += fila.alto;
      });
      return aclaracion ? aclaracion.dibujar(yFila + ENTRE) : yFila + ENTRE;
    }
  };
};
