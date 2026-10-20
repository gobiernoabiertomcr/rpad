// PDF del Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset-design, "El PDF"): una sola hoja A4 con el lenguaje del
// ANEXO de los avisos (services/notasDigitalesAnexo.js): su paleta, Helvetica, los márgenes de 15 mm, el encabezado y el pie,
// DocumentoNota y el QR vectorial. Dibuja lo que calcula seguimientoDe (services/seguimientoReglas.js) con las opciones de la
// cinta del PDF (separación 12 y letra 8,4): no recalcula ninguna regla.
// Las secciones tienen lugar fijo y se completan solas: el título reserva dos líneas, cada valor de la ficha va en una línea, los
// nodos del circuito tienen alto fijo, la leyenda reserva dos renglones, la tabla de movimientos tiene FILAS_PDF renglones y la
// aclaración va siempre arriba del pie. Así la hoja nunca pasa a una segunda, con cualquier largo de título, área o movimientos.
import { DocumentoNota } from './notasDigitalesPdf.js';
import { formatoCorto, formatoLargo } from './notasDigitalesCalendario.js';
import { ventanaDe } from './seguimientoCinta.js';
import { textoRequiereNota } from './requiereNotaReglas.js';
import {
  COLOR, MM, MARGEN, IZQUIERDA, DERECHA, CONTENIDO, ABAJO, NORMAL, NEGRITA, ASCENDENTE, DESCENDENTE,
  desdeBase, ajustar, escribir, renglon, rotulo, filete, etiquetaDeCabecera, prepararGrilla, cargarQrcode, dibujarTarjetaQr
} from './notasDigitalesAnexo.js';

// Los movimientos que muestra la tabla (los más nuevos); el resto se cuenta debajo
export const FILAS_PDF = 8;

// Colores que el ANEXO no tiene: el vencido (rojo), las actualizaciones (verde), el texto del rayado (ámbar) y el rayado
const COLORES = { rojo: '#9B3B36', verde: '#2E6B4C', ambar: '#7A5200', rayaFondo: '#FCEFC7', raya: '#F2CF5B' };

const SIN_DATO = 'Sin dato';
const OJO = ASCENDENTE + DESCENDENTE;

// La tarjeta del QR de dibujarTarjetaQr (notasDigitalesAnexo.js): el QR de 30 mm con 6 puntos de relleno y el renglón de abajo
const ANCHO_TARJETA_QR = 30 * MM + 2 * 6;
const ALTO_TARJETA_QR = 30 * MM + 6 + 18;
const SEPARACION_QR = 5 * MM;

// Letras (en puntos)
const LETRA = {
  etiqueta: 7.5, titulo: 20, rotulo: 6.6, valor: 9.2, link: 8.4, cabeza: 7.6,
  nodo: 8.2, nodoTexto: 6.8, nodoEstado: 7.4, tramo: 9.4, alArea: 7.8,
  leyenda: 6.6, columna: 6.4, fecha: 7.8, movimiento: 8, detalle: 7, quien: 7, nota: 7, pie: 7.5
};

// Separaciones verticales (en puntos), de arriba abajo
const AIRE = {
  etiqueta: 12,        // del filete del encabezado a la etiqueta
  titulo: 15,          // de la etiqueta al título
  ficha: 4,            // de las dos líneas reservadas del título a la ficha
  seccion: 13,         // antes del rótulo de cada sección
  cabeza: 11,          // del rótulo de la sección a lo que sigue
  alArea: 5,           // de los nodos a la línea del email al área
  leyenda: 3,          // de la cinta a la leyenda
  movimientos: 10,     // de los dos renglones reservados de la leyenda al rótulo de los movimientos
  sobrePie: 6          // de la aclaración al filete del pie
};

const diasTexto = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
const fecha = (dia) => (dia ? formatoCorto(dia) : SIN_DATO);
const anchoDe = (doc, texto, tamano, fuente = NORMAL) => doc.font(fuente).fontSize(tamano).widthOfString(String(texto));

// Un renglón centrado en cx (en puntos), sin salir de los márgenes. `base`: la línea de base.
const centrado = (doc, texto, cx, base, { tamano, fuente = NORMAL, color = COLOR.tinta }) => {
  const ancho = anchoDe(doc, texto, tamano, fuente) + 2;
  const x = Math.min(Math.max(cx - ancho / 2, IZQUIERDA), DERECHA - ancho);
  renglon(doc, texto, x, desdeBase(base, tamano), { ancho, tamano, fuente, color, align: 'center' });
};

// El rótulo de una sección (en el acento) y, a la derecha y en la misma línea de base, un texto en gris
const dibujarCabezaDeSeccion = (doc, titulo, derecha, y) => {
  const base = y + ASCENDENTE * LETRA.cabeza;
  const mitad = CONTENIDO / 2;
  rotulo(doc, titulo, IZQUIERDA, desdeBase(base, LETRA.rotulo), { ancho: mitad, tamano: LETRA.rotulo, color: COLOR.acento });
  if (derecha) {
    renglon(doc, derecha, IZQUIERDA + mitad, desdeBase(base, LETRA.cabeza), { ancho: mitad, tamano: LETRA.cabeza, color: COLOR.gris, align: 'right' });
  }
};

// =====================================================
// Encabezado y pie (los del ANEXO, con los textos del Seguimiento)
// =====================================================

// A la izquierda la Dirección y la Municipalidad; a la derecha "Seguimiento del dataset" y la fecha larga de hoy, sobre una línea
// fina con un tramo del acento. Devuelve la y donde termina.
const dibujarEncabezado = (doc, hoy) => {
  const mitad = CONTENIDO / 2;
  const base1 = MARGEN + ASCENDENTE * 9.5;
  const base2 = base1 + 11.5;
  renglon(doc, 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', IZQUIERDA, desdeBase(base1, 7.5),
    { ancho: mitad, tamano: 7.5, fuente: NEGRITA, color: COLOR.tinta, espaciado: 0.6 });
  renglon(doc, 'Municipalidad de Comodoro Rivadavia', IZQUIERDA, desdeBase(base2, 7.5), { ancho: mitad, tamano: 7.5, color: COLOR.gris });
  renglon(doc, 'Seguimiento del dataset', IZQUIERDA + mitad, desdeBase(base1, 9.5), { ancho: mitad, tamano: 9.5, fuente: NEGRITA, align: 'right' });
  renglon(doc, formatoLargo(hoy), IZQUIERDA + mitad, desdeBase(base2, 7.5), { ancho: mitad, tamano: 7.5, color: COLOR.gris, align: 'right' });
  const yLinea = base2 + 9;
  filete(doc, IZQUIERDA, yLinea, CONTENIDO);
  doc.rect(IZQUIERDA, yLinea - 1, 28, 2).fill(COLOR.acento);
  return yLinea + 1;
};

// "Generado el dd/mm/aaaa a las hh:mm por <por>" (sin "por" si no hay nombre). `momento`: 'AAAA-MM-DD HH:MM:SS'.
const textoDeGenerado = (momento, por) => {
  const partes = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(momento ?? ''));
  const cuando = partes ? `el ${formatoCorto(partes[1])} a las ${partes[2]}` : '';
  return ['Generado', cuando, por ? `por ${por}` : ''].filter(Boolean).join(' ');
};

// Pie: línea fina, quién y cuándo lo generó a la izquierda y "Seguimiento del dataset · Hoja 1 de 1" a la derecha, con los
// descendentes sobre el margen inferior. Devuelve la y de la línea, el límite de todo lo que va arriba.
const dibujarPie = (doc, generado) => {
  const y = desdeBase(ABAJO - DESCENDENTE * LETRA.pie, LETRA.pie);
  const yLinea = y - 8;
  const izquierda = CONTENIDO * 0.6;
  filete(doc, IZQUIERDA, yLinea, CONTENIDO);
  renglon(doc, textoDeGenerado(generado?.momento, generado?.por), IZQUIERDA, y, { ancho: izquierda, tamano: LETRA.pie, color: COLOR.gris });
  renglon(doc, 'Seguimiento del dataset · Hoja 1 de 1', IZQUIERDA + izquierda, y,
    { ancho: CONTENIDO - izquierda, tamano: LETRA.pie, color: COLOR.gris, align: 'right' });
  return yLinea;
};

// =====================================================
// Etiqueta, título y ficha
// =====================================================

// La etiqueta y el título en 20 puntos, con dos líneas reservadas (si no entra, se corta con "…"). Devuelve el alto reservado.
const dibujarCabecera = (doc, ficha, y) => {
  const gestion = ficha.tipo_gestion === 'interna' ? 'INTERNA' : 'EXTERNA';
  etiquetaDeCabecera(doc, `CONJUNTO DE DATOS · GESTIÓN ${gestion}`, IZQUIERDA, y, { ancho: CONTENIDO, tamano: LETRA.etiqueta });
  const opciones = (t) => ({ lineGap: -0.075 * t });
  const titulo = ajustar(doc, ficha.titulo ?? '', { ancho: CONTENIDO, lineas: 2, max: LETRA.titulo, min: LETRA.titulo, fuente: NEGRITA, opciones });
  escribir(doc, titulo, IZQUIERDA, y + AIRE.titulo, COLOR.tinta);
  const interlinea = doc.font(NEGRITA).fontSize(LETRA.titulo).currentLineHeight(true) + opciones(LETRA.titulo).lineGap;
  return AIRE.titulo + 2 * interlinea;
};

// "Venció el" (en rojo, con los días), "Próximo vencimiento" o, si se dio de baja, "Dado de baja el"
const celdaDelVencimiento = (ficha) => {
  if (ficha.activo === false) {
    return ficha.baja ? { etiqueta: 'Dado de baja el', valor: formatoCorto(ficha.baja) } : { etiqueta: 'Dado de baja', valor: 'Sin fecha registrada' };
  }
  const { estado, dias } = ficha.estado ?? {};
  if (estado === 'vencido' && ficha.proxima) {
    const hace = Number.isFinite(dias) && dias < 0 ? `, hace ${diasTexto(-dias)}` : '';
    // La fuente viaja con los tamaños: prepararGrilla los pasa tal cual a ajustar
    return { etiqueta: 'Venció el', valor: `${formatoCorto(ficha.proxima)}${hace}`, color: COLORES.rojo,
      tamanos: { max: LETRA.valor, min: LETRA.valor, fuente: NEGRITA } };
  }
  if (ficha.proxima) return { etiqueta: 'Próximo vencimiento', valor: formatoCorto(ficha.proxima) };
  return { etiqueta: 'Próximo vencimiento', valor: estado === 'eventual' ? 'Sin vencimiento (eventual)' : 'Sin fecha' };
};

// «Datos que se piden»: de ancho entero en la gestión interna; en un externo comparte el renglón con «Requiere nota DGMIT» (spec
// 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7) y le queda media columna. El pedido más largo que arma pedido() ("Presupuestos
// de los ejercicios 2021 a 2026", 178 puntos a 9,2) entra en la media columna más angosta (192 puntos, la de la ficha con el QR).
const celdasDelPedido = (ficha) => {
  const pedido = ficha.pedido ?? (ficha.estado?.estado === 'eventual' ? 'Sin pedido (eventual)' : 'Sin pedido');
  if (ficha.tipo_gestion === 'interna') return [{ etiqueta: 'Datos que se piden', valor: pedido, completa: true }];
  return [
    { etiqueta: 'Datos que se piden', valor: pedido },
    { etiqueta: 'Requiere nota DGMIT', valor: textoRequiereNota(ficha.requiere_nota, SIN_DATO) }
  ];
};

// La grilla de dos columnas con filetes (cada valor en una línea, cortado con "…" si no entra) y, a la derecha, la tarjeta del QR
// hacia el portal. Sin link al portal no hay QR y la grilla ocupa todo el ancho.
const prepararFicha = (doc, ficha) => {
  const url = ficha.url_dataset || null;
  const ancho = url ? CONTENIDO - ANCHO_TARJETA_QR - SEPARACION_QR : CONTENIDO;
  const celdas = [
    { etiqueta: 'Área responsable', valor: ficha.area ?? SIN_DATO },
    { etiqueta: 'Depende de', valor: ficha.area_superior ?? SIN_DATO },
    { etiqueta: 'Frecuencia', valor: ficha.frecuencia ?? SIN_DATO },
    celdaDelVencimiento(ficha),
    { etiqueta: 'Datos al', valor: fecha(ficha.datos_al) },
    { etiqueta: 'Cargado en el portal', valor: fecha(ficha.ultima) },
    ...celdasDelPedido(ficha),
    url
      ? { etiqueta: 'Link al portal', valor: url, completa: true, link: url, color: COLOR.acento, tamanos: { max: LETRA.link, min: 7 } }
      : { etiqueta: 'Link al portal', valor: SIN_DATO, completa: true }
  ];
  const grilla = prepararGrilla(doc, celdas, {
    ancho, columnas: 2, lineas: 1, tamanos: { max: LETRA.valor, min: LETRA.valor }, tamanoRotulo: LETRA.rotulo, divisorias: true, aire: 0.8
  });
  return {
    alto: Math.max(grilla.alto, url ? ALTO_TARJETA_QR : 0),
    dibujar: (y) => {
      grilla.dibujar(IZQUIERDA, y);
      if (url) dibujarTarjetaQr(doc, url, DERECHA - ANCHO_TARJETA_QR, y);
    }
  };
};

// =====================================================
// El circuito del ciclo abierto
// =====================================================

// Anchos de nodo, tramo, nodo, tramo y nodo: en una línea entran "11 emails y la Nota Digital N° 2/26" (el tramo de los avisos) y
// "Mandan la nota formal al área" (el nodo del medio); en dos, "DGMIT y Dirección de Investigación Territorial"
const ANCHOS_CIRCUITO = [88, 118, 106, CONTENIDO - 414, 102];
const ALTO_NODO = 50;
const RELLENO_NODO = 6.5;
const ALTO_AL_AREA = 16;

// Un nodo: el recuadro redondeado y sus textos, uno debajo del otro y centrados en el alto. `piezas`: [{ texto, tamano, fuente,
// color, lineas }]; cada una se achica hasta un punto menos y, si aun así no entra en sus líneas, se corta con "…".
const dibujarNodo = (doc, x, y, ancho, piezas, { borde = COLOR.tinta } = {}) => {
  doc.roundedRect(x, y, ancho, ALTO_NODO, 5).lineWidth(0.9).fillAndStroke(COLOR.blanco, borde);
  const anchoTexto = ancho - 2 * RELLENO_NODO;
  const ajustes = piezas.filter((p) => p.texto).map((p) => {
    const opciones = (t) => ({ lineGap: -0.075 * t });
    const ajuste = ajustar(doc, p.texto, { ancho: anchoTexto, lineas: p.lineas, max: p.tamano, min: p.tamano - 1, fuente: p.fuente ?? NORMAL, opciones });
    // El alto que se ve: el de las líneas, sin el interlineado de la última (de sus ascendentes a sus descendentes)
    const interlinea = doc.font(ajuste.fuente).fontSize(ajuste.tamano).currentLineHeight(true) + opciones(ajuste.tamano).lineGap;
    const visible = ajuste.alto - interlinea + OJO * ajuste.tamano;
    return { ajuste, visible, color: p.color ?? COLOR.tinta };
  });
  const entre = 2.5;
  const total = ajustes.reduce((suma, a) => suma + a.visible, 0) + entre * Math.max(0, ajustes.length - 1);
  let yTexto = y + Math.max(RELLENO_NODO / 2, (ALTO_NODO - total) / 2);
  for (const { ajuste, visible, color } of ajustes) {
    escribir(doc, ajuste, x + RELLENO_NODO, yTexto, color);
    yTexto += visible + entre;
  }
};

// Un tramo entre dos nodos: el título arriba, la flecha (llena o punteada) y el texto debajo
const dibujarTramo = (doc, x, y, ancho, { titulo, texto, color, punteado }) => {
  const margen = 6;
  const anchoTexto = ancho - 2 * margen;
  renglon(doc, titulo ?? '', x + margen, y + 7, { ancho: anchoTexto, tamano: LETRA.tramo, fuente: NEGRITA, color });
  const yFlecha = y + 23;
  const x0 = x + margen;
  const x1 = x + ancho - margen;
  doc.save();
  doc.lineWidth(1.6);
  if (punteado) doc.dash(3.5, { space: 2.5 });
  doc.moveTo(x0, yFlecha).lineTo(x1 - 6, yFlecha).stroke(color);
  doc.restore();
  doc.polygon([x1, yFlecha], [x1 - 6.5, yFlecha - 3.4], [x1 - 6.5, yFlecha + 3.4]).fill(color);
  const opciones = (t) => ({ lineGap: -0.075 * t });
  const ajuste = ajustar(doc, texto ?? '', { ancho: anchoTexto, lineas: 2, max: LETRA.nodoTexto, min: LETRA.nodoTexto, opciones });
  escribir(doc, ajuste, x0, y + 28, COLOR.gris);
};

// RPAD → avisos → DGMIT y la otra dirección → la nota formal o el relevamiento (por fuera del RPAD) → el área. Los textos son
// los del servidor (circuitoDe). El estado del área va en rojo si está vencido, en gris si no tiene vencimiento o se dio de baja
// (`activo` false) y si no, en el acento. Devuelve el alto de los nodos.
const dibujarCircuito = (doc, circuito, y, { activo = true } = {}) => {
  const xs = ANCHOS_CIRCUITO.reduce((lista, ancho) => [...lista, lista.at(-1) + ancho], [IZQUIERDA]);
  dibujarNodo(doc, xs[0], y, ANCHOS_CIRCUITO[0], [
    { texto: 'RPAD', tamano: LETRA.nodo, fuente: NEGRITA, lineas: 1 },
    { texto: 'Dir. de Datos Públicos y Comunicación', tamano: LETRA.nodoTexto, color: COLOR.gris, lineas: 2 }
  ]);
  dibujarTramo(doc, xs[1], y, ANCHOS_CIRCUITO[1], { titulo: circuito.avisos?.titulo, texto: circuito.avisos?.texto, color: COLOR.acento });
  dibujarNodo(doc, xs[2], y, ANCHOS_CIRCUITO[2], [
    { texto: circuito.nodoMedio?.nombre, tamano: LETRA.nodo, fuente: NEGRITA, lineas: 3 },
    { texto: circuito.nodoMedio?.rol, tamano: LETRA.nodoTexto, color: COLOR.gris, lineas: 2 }
  ]);
  dibujarTramo(doc, xs[3], y, ANCHOS_CIRCUITO[3], { titulo: circuito.tramoFuera?.titulo, texto: circuito.tramoFuera?.texto, color: COLOR.grisClaro, punteado: true });
  const vencido = Boolean(circuito.area?.vencido);
  const colorEstado = vencido ? COLORES.rojo : circuito.vencimiento && activo ? COLOR.acento : COLOR.gris;
  dibujarNodo(doc, xs[4], y, ANCHOS_CIRCUITO[4], [
    { texto: circuito.area?.nombre ?? SIN_DATO, tamano: LETRA.nodo, fuente: NEGRITA, lineas: 3 },
    { texto: circuito.area?.texto, tamano: LETRA.nodoEstado, fuente: NEGRITA, color: colorEstado, lineas: 1 }
  ], { borde: vencido ? COLORES.rojo : COLOR.tinta });
  return ALTO_NODO;
};

// La línea del email al área (solo en gestión externa y con un ciclo abierto: sin vencimiento no hay nada que anticipar)
const dibujarAlArea = (doc, circuito, y) => {
  if (!circuito.alArea?.textoPdf || !circuito.vencimiento) return;
  doc.roundedRect(IZQUIERDA, y, CONTENIDO, ALTO_AL_AREA, 4).fill(COLOR.fondo);
  renglon(doc, circuito.alArea.textoPdf, IZQUIERDA + 7.5, y + (ALTO_AL_AREA - ASCENDENTE * LETRA.alArea) / 2,
    { ancho: CONTENIDO - 15, tamano: LETRA.alArea, color: COLOR.gris });
};

// =====================================================
// Marcas (la cinta, la leyenda y la tabla)
// =====================================================

// Una marca en el tamaño del prototipo de la cinta (cinta.js) por `s` (puntos por unidad); los trazos, por s / 1,15 (el prototipo
// agranda las marcas del PDF 1,15 veces y no sus trazos). Todo con polígonos, círculos y líneas: nunca con roundedRect, que el
// test de diagramación tomaría como un bloque, ni como texto (Helvetica no tiene ◆ ● ✕).
const dibujarMarca = (doc, tipo, cx, cy, s) => {
  const g = s / 1.15;
  const rombo = (d) => doc.polygon([cx, cy - d], [cx + d, cy], [cx, cy + d], [cx - d, cy]);
  const punteado = () => doc.dash(3.5 * g, { space: 2.5 * g });
  doc.save();
  switch (tipo) {
    case 'nota': rombo(6.5 * Math.SQRT2 * s).fill(COLOR.tinta); break;
    case 'email': rombo(5 * Math.SQRT2 * s).lineWidth(2.6 * g).fillAndStroke(COLOR.blanco, COLOR.tinta); break;
    case 'auditoria': rombo(5 * Math.SQRT2 * s).fill(COLOR.grisClaro); break;
    case 'area': punteado(); doc.circle(cx, cy, 5.5 * s).lineWidth(2.2 * g).fillAndStroke(COLOR.blanco, COLOR.gris); break;
    case 'act': doc.circle(cx, cy, 7 * s).lineWidth(2.4 * g).fillAndStroke(COLORES.verde, COLOR.blanco); break;
    case 'actp': punteado(); doc.circle(cx, cy, 6 * s).lineWidth(2.8 * g).fillAndStroke(COLOR.blanco, COLORES.verde); break;
    case 'cambio': doc.rect(cx - 5.5 * s, cy - 5.5 * s, 11 * s, 11 * s).lineWidth(1.8 * g).fillAndStroke(COLOR.acento, COLOR.blanco); break;
    case 'cambiop': punteado(); doc.rect(cx - 5 * s, cy - 5 * s, 10 * s, 10 * s).lineWidth(2.4 * g).fillAndStroke(COLOR.blanco, COLOR.acento); break;
    case 'alta': doc.circle(cx, cy, 6 * s).lineWidth(2.8 * g).fillAndStroke(COLOR.blanco, COLOR.tinta); break;
    case 'baja': doc.circle(cx, cy, 6 * s).fill(COLOR.tinta); break;
    case 'rech': {
      const d = 5 * s;
      doc.lineCap('round').lineWidth(2.8 * g).moveTo(cx - d, cy - d).lineTo(cx + d, cy + d).moveTo(cx + d, cy - d).lineTo(cx - d, cy + d).stroke(COLORES.rojo);
      break;
    }
    default: break;
  }
  doc.restore();
};

// El rayado de lo vencido: el fondo y las diagonales, recortados al rectángulo
const dibujarRayado = (doc, x, y, ancho, alto, paso, grosor) => {
  doc.save();
  doc.rect(x, y, ancho, alto).clip();
  doc.rect(x, y, ancho, alto).fill(COLORES.rayaFondo);
  for (let k = x - alto; k < x + ancho; k += paso) doc.moveTo(k, y + alto).lineTo(k + alto, y);
  doc.lineWidth(grosor).stroke(COLORES.raya);
  doc.restore();
};

// =====================================================
// La cinta
// =====================================================

// Puntos por unidad de la cinta (que va de 0 a 1000, con la línea útil de 30 a 970)
const U = CONTENIDO / 1000;
const xDeCinta = (x) => IZQUIERDA + x * U;
// Las marcas del PDF, 1,15 veces las del prototipo
const ESCALA_CINTA = 1.15 * U;
// Las filas, en puntos desde el tope del bloque: las de las marcas son su centro y las de los textos, su línea de base
const FILA = { etiqueta: 7.7, arriba: 16.8, bandaY: 25.5, bandaH: 10.2, abajo: 42.8, vence: 53, vence2: 59.7, mes: 67.8, anio: 75 };
const ALTO_CINTA = 77;
// Las líneas finas de los meses (22 y 94 en las unidades del prototipo)
const LINEA_MES = { tope: 22 * U, pie: 94 * U };
// Letras de la cinta: 14 unidades las etiquetas, 14,5 los textos de la banda, 15,5 los meses, 12,5 el año y 12 las cantidades
const LETRA_CINTA = { etiqueta: 14 * U, banda: 14.5 * U, mes: 15.5 * U, anio: 12.5 * U, cantidad: 12 * U };
// Un ciclo que empieza donde termina otro se dibuja este hueco más adentro (en unidades)
const HUECO_ENTRE_CICLOS = 1.5;
// El prototipo recorta las etiquetas: "vence dd/mm" hasta 970 − 30 y "hoy" hasta 970 − 14 (en unidades)
const TOPE_VENCE = 940;
const TOPE_HOY = 956;
// Aire entre dos etiquetas de una misma fila (en puntos)
const AIRE_ETIQUETAS = 3;

const yBanda = (y) => y + FILA.bandaY + FILA.bandaH / 2;

// Los tramos de la banda, con el hueco de 1,5 antes de un ciclo que empieza donde termina el anterior
const dibujarTramos = (doc, tramos, y) => {
  const yb = y + FILA.bandaY;
  let anterior = null;
  for (const tramo of tramos) {
    const separa = tramo.tipo === 'ciclo' && anterior && (anterior.tipo === 'ciclo' || anterior.tipo === 'vencido') && Math.abs(anterior.x1 - tramo.x0) < 0.01;
    const x0 = xDeCinta(tramo.x0 + (separa ? HUECO_ENTRE_CICLOS : 0));
    const x1 = xDeCinta(tramo.x1);
    anterior = tramo;
    if (x1 - x0 <= 0) continue;
    if (tramo.tipo === 'antes') {
      // Una línea de puntos hasta el aro del alta
      const fin = Math.max(x0, x1 - 6 * U);
      doc.save();
      doc.lineCap('round').lineWidth(2.5 * U).dash(0.01, { space: 5 * U });
      doc.moveTo(x0, yBanda(y)).lineTo(fin, yBanda(y)).stroke(COLOR.grisClaro);
      doc.restore();
    } else if (tramo.tipo === 'ciclo') {
      doc.rect(x0, yb, x1 - x0, FILA.bandaH).fill(COLOR.acentoSuave);
    } else if (tramo.tipo === 'vencido') {
      dibujarRayado(doc, x0, yb, x1 - x0, FILA.bandaH, 7 * U * Math.SQRT2, 3 * U);
    } else if (tramo.tipo === 'futuro') {
      doc.rect(x0, yb, x1 - x0, FILA.bandaH).lineWidth(1.2 * U).fillAndStroke(COLOR.fondo, COLOR.acentoSuave);
    } else if (tramo.tipo === 'eventual') {
      doc.rect(x0, yb, x1 - x0, FILA.bandaH).fill(COLOR.fondo);
    }
  }
};

// Etiquetas de una fila sin que se pisen: `colocadas` lleva los intervalos ya ocupados; devuelve si entra
const entraEnLaFila = (colocadas, x0, x1) => !colocadas.some(([a, b]) => x0 < b + AIRE_ETIQUETAS && a < x1 + AIRE_ETIQUETAS);
const intervaloCentrado = (doc, texto, cx, tamano, fuente) => {
  const ancho = anchoDe(doc, texto, tamano, fuente) + 2;
  const x0 = Math.min(Math.max(cx - ancho / 2, IZQUIERDA), DERECHA - ancho);
  return [x0, x0 + ancho];
};

// Las etiquetas de las notas ("Nota 2/26"): si dos se pisan, van juntas en una ("Nota 2/26 y Nota 3/26"), centrada entre las dos
const dibujarEtiquetasDeNotas = (doc, marcas, y) => {
  const tamano = LETRA_CINTA.etiqueta;
  const grupos = [];
  for (const marca of marcas.filter((m) => m.etiqueta).sort((a, b) => a.x - b.x)) {
    const cx = xDeCinta(Math.min(Math.max(marca.x, 60), 940));
    const ultimo = grupos.at(-1);
    const [x0] = intervaloCentrado(doc, marca.etiqueta, cx, tamano, NEGRITA);
    if (ultimo && x0 < ultimo.intervalo[1] + AIRE_ETIQUETAS) {
      ultimo.textos.push(marca.etiqueta);
      ultimo.cx = (ultimo.desde + cx) / 2;
      ultimo.intervalo = intervaloCentrado(doc, ultimo.textos.join(' y '), ultimo.cx, tamano, NEGRITA);
    } else {
      grupos.push({ textos: [marca.etiqueta], desde: cx, cx, intervalo: intervaloCentrado(doc, marca.etiqueta, cx, tamano, NEGRITA) });
    }
  }
  for (const grupo of grupos) {
    // Un fondo blanco detrás del texto: el circulito de la cantidad de una nota agrupada (arriba a la derecha de la marca) llega
    // hasta la línea de base de la etiqueta y, sin él, taparía el pie de las letras
    const [x0, x1] = grupo.intervalo;
    doc.rect(x0, y + FILA.etiqueta - ASCENDENTE * tamano - 0.5, x1 - x0, OJO * tamano + 1).fill(COLOR.blanco);
    centrado(doc, grupo.textos.join(' y '), grupo.cx, y + FILA.etiqueta, { tamano, fuente: NEGRITA });
  }
};

// "hoy" en su renglón (el que calculó la cinta) y cada "vence dd/mm" en el primer renglón libre; si los dos están ocupados (dos
// vencimientos muy juntos), la etiqueta no va: la línea punteada del vencimiento sigue en la cinta
const dibujarEtiquetasDeFechas = (doc, cinta, y) => {
  const tamano = LETRA_CINTA.etiqueta;
  const renglones = { vence: [], vence2: [] };
  const colocar = (texto, cx, preferidos) => {
    const intervalo = intervaloCentrado(doc, texto, cx, tamano, NEGRITA);
    const fila = preferidos.find((f) => entraEnLaFila(renglones[f], ...intervalo));
    if (!fila) return;
    renglones[fila].push(intervalo);
    centrado(doc, texto, cx, y + FILA[fila], { tamano, fuente: NEGRITA });
  };
  if (cinta.hoy) colocar('hoy', xDeCinta(Math.min(cinta.hoy.x, TOPE_HOY)), [cinta.hoy.renglon === 2 ? 'vence2' : 'vence']);
  for (const v of [...(cinta.vencimientos ?? [])].sort((a, b) => a.x - b.x)) {
    colocar(v.texto, xDeCinta(Math.min(v.x, TOPE_VENCE)), ['vence', 'vence2']);
  }
};

// La cantidad de marcas que se juntaron: un circulito oscuro arriba a la derecha de la marca, con el número en blanco
const dibujarCantidad = (doc, cantidad, cx, cy, s) => {
  const bx = cx + 9 * s;
  const by = cy - 9 * s;
  doc.circle(bx, by, 7 * s).fill(COLOR.tinta);
  centrado(doc, String(cantidad), bx, by + (ASCENDENTE * LETRA_CINTA.cantidad) / 2, { tamano: LETRA_CINTA.cantidad, fuente: NEGRITA, color: COLOR.blanco });
};

// La cinta de los últimos 12 meses (cintaDe, en el espacio de 1000), con su tope en y
const dibujarCinta = (doc, cinta, y) => {
  if (!cinta) return;
  // Los meses: una línea fina al comienzo de cada uno (y al final del último), el nombre centrado y el año en el primero y en enero
  doc.save();
  doc.lineWidth(1.2 * U).strokeColor(COLOR.linea);
  for (const x of [...cinta.meses.map((m) => m.x0), 970]) doc.moveTo(xDeCinta(x), y + LINEA_MES.tope).lineTo(xDeCinta(x), y + LINEA_MES.pie);
  doc.stroke();
  doc.restore();
  for (const mes of cinta.meses) {
    const cx = xDeCinta((mes.x0 + mes.x1) / 2);
    centrado(doc, mes.etiqueta, cx, y + FILA.mes, { tamano: LETRA_CINTA.mes, color: COLOR.rotulo });
    if (mes.anio !== null && mes.anio !== undefined) centrado(doc, String(mes.anio), cx, y + FILA.anio, { tamano: LETRA_CINTA.anio, color: COLOR.grisClaro });
  }

  dibujarTramos(doc, cinta.tramos ?? [], y);
  for (const t of cinta.textos ?? []) {
    if (t.tipo === 'antes') {
      centrado(doc, t.texto, xDeCinta(t.x), y + FILA.bandaY - 5 * U, { tamano: LETRA_CINTA.banda, color: COLOR.grisClaro });
    } else {
      centrado(doc, t.texto, xDeCinta(t.x), yBanda(y) + 4.5 * U, {
        tamano: LETRA_CINTA.banda, fuente: NEGRITA, color: t.tipo === 'vencido' ? COLORES.ambar : COLOR.gris
      });
    }
  }

  // Los vencimientos: una línea punteada que cruza la banda
  for (const v of cinta.vencimientos ?? []) {
    const x = xDeCinta(v.x);
    doc.save();
    doc.lineWidth(2 * U).dash(4 * U, { space: 3 * U });
    doc.moveTo(x, y + FILA.bandaY - 8 * U).lineTo(x, y + FILA.bandaY + FILA.bandaH + 8 * U).stroke(COLOR.tinta);
    doc.restore();
  }

  for (const marca of cinta.marcas ?? []) {
    const cx = xDeCinta(marca.x);
    const cy = marca.fila === 'banda' ? yBanda(y) : y + FILA[marca.fila];
    dibujarMarca(doc, marca.tipo, cx, cy, ESCALA_CINTA);
    if (marca.cantidad > 1) dibujarCantidad(doc, marca.cantidad, cx, cy, ESCALA_CINTA);
  }
  dibujarEtiquetasDeNotas(doc, cinta.marcas ?? [], y);

  // Hoy: una línea oscura
  if (cinta.hoy) {
    const x = xDeCinta(cinta.hoy.x);
    doc.save();
    doc.lineWidth(3 * U).moveTo(x, y + FILA.bandaY - 12 * U).lineTo(x, y + FILA.bandaY + FILA.bandaH + 12 * U).stroke(COLOR.tinta);
    doc.restore();
  }
  dibujarEtiquetasDeFechas(doc, cinta, y);
};

// La leyenda: solo los tipos de las marcas que aparecen y "Vencido" si hay rayado. En hasta dos renglones.
const LEYENDA = [
  ['nota', 'Nota Digital a DGMIT'], ['email', 'Email a DGMIT'], ['area', 'Email al área'], ['act', 'Actualización'],
  ['actp', 'Actualización pendiente'], ['cambio', 'Cambio en la ficha'], ['cambiop', 'Cambio pendiente'],
  ['rech', 'Propuesta rechazada'], ['alta', 'Alta']
];
const ESCALA_LEYENDA = 0.42;
const RENGLON_LEYENDA = 9.5;
const ALTO_LEYENDA = 2 * RENGLON_LEYENDA;

const dibujarLeyenda = (doc, cinta, y) => {
  if (!cinta) return;
  const tipos = new Set((cinta.marcas ?? []).map((m) => m.tipo));
  const items = LEYENDA.filter(([tipo]) => tipos.has(tipo));
  const conVencido = (cinta.tramos ?? []).some((t) => t.tipo === 'vencido');
  if (conVencido) items.push(['vencido', 'Vencido']);
  const anchoIcono = (tipo) => (tipo === 'vencido' ? 12 : 8);
  let x = IZQUIERDA;
  let renglonActual = 0;
  for (const [tipo, texto] of items) {
    const ancho = anchoIcono(tipo) + 3 + anchoDe(doc, texto, LETRA.leyenda) + 1;
    if (x + ancho > DERECHA && x > IZQUIERDA) {
      renglonActual += 1;
      x = IZQUIERDA;
    }
    if (renglonActual > 1) break;
    const base = y + renglonActual * RENGLON_LEYENDA + ASCENDENTE * LETRA.leyenda + 1;
    const centro = base - (ASCENDENTE * LETRA.leyenda) / 2;
    if (tipo === 'vencido') dibujarRayado(doc, x, centro - 3.5, 12, 7, 3.5, 1.4);
    else dibujarMarca(doc, tipo, x + 4, centro, ESCALA_LEYENDA);
    renglon(doc, texto, x + anchoIcono(tipo) + 3, desdeBase(base, LETRA.leyenda), { ancho: ancho - anchoIcono(tipo) - 3 + 1, tamano: LETRA.leyenda, color: COLOR.gris });
    x += ancho + 10;
  }
};

// =====================================================
// Los últimos movimientos
// =====================================================

const ALTO_FILA = 26.5;
const ESCALA_TABLA = 0.46;
const COLUMNA = { fecha: 0, marca: 55, movimiento: 64, quien: 100 };
const ANCHO_MOVIMIENTO = CONTENIDO - COLUMNA.movimiento - COLUMNA.quien - 10;

// "8 de 16, del más nuevo al más viejo" (o "2, …" si entran todos)
const resumenDeMovimientos = (total) => {
  if (total === 0) return '';
  return `${total > FILAS_PDF ? `${FILAS_PDF} de ${total}` : total}, del más nuevo al más viejo`;
};

// Lo que sigue al último renglón: los movimientos que no entraron o, si entraron todos, desde cuándo está el dataset en el RPAD
const textoDelFinal = (movimientos) => {
  const faltan = movimientos.length - FILAS_PDF;
  if (faltan > 0) {
    return `Hay ${faltan} ${faltan === 1 ? 'movimiento anterior' : 'movimientos anteriores'}: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).`;
  }
  const alta = movimientos.find((m) => m.tipo === 'alta')?.fecha;
  return alta ? `No hay movimientos anteriores: el dataset está en el RPAD desde el ${formatoCorto(alta)}.` : 'No hay movimientos anteriores.';
};

// Un renglón de la tabla: la fecha, la marca, el título y el detalle (una línea cada uno, con "…") y quién (hasta dos líneas)
const dibujarFila = (doc, m, y) => {
  const yTexto = y + 4.5;
  renglon(doc, formatoCorto(m.fecha), IZQUIERDA + COLUMNA.fecha, yTexto, { ancho: COLUMNA.marca - 6, tamano: LETRA.fecha, fuente: NEGRITA });
  dibujarMarca(doc, m.tipo, IZQUIERDA + COLUMNA.marca + 1, yTexto + (ASCENDENTE * LETRA.fecha) / 2, ESCALA_TABLA);
  const xMovimiento = IZQUIERDA + COLUMNA.movimiento;
  renglon(doc, m.titulo ?? '', xMovimiento, yTexto, { ancho: ANCHO_MOVIMIENTO, tamano: LETRA.movimiento, fuente: NEGRITA });
  if (m.detalle) {
    const detalle = ajustar(doc, m.detalle, { ancho: ANCHO_MOVIMIENTO, lineas: 1, max: LETRA.detalle, min: LETRA.detalle - 0.5 });
    escribir(doc, detalle, xMovimiento, yTexto + 9.3, COLOR.gris);
  }
  (m.quien ?? []).slice(0, 2).forEach((texto, k) => {
    renglon(doc, texto, DERECHA - COLUMNA.quien, yTexto + 0.4 + k * 8.4, { ancho: COLUMNA.quien, tamano: LETRA.quien, color: COLOR.gris, align: 'right' });
  });
  filete(doc, IZQUIERDA, y + ALTO_FILA, CONTENIDO);
};

// La tabla: el encabezado de las columnas, FILAS_PDF renglones (los que sobran quedan en blanco) y lo que sigue al último.
// Devuelve la y donde termina el lugar de los renglones.
const dibujarMovimientos = (doc, movimientos, y) => {
  const rotulos = { tamano: LETRA.columna };
  rotulo(doc, 'Fecha', IZQUIERDA + COLUMNA.fecha, y, { ancho: COLUMNA.marca, ...rotulos });
  rotulo(doc, 'Movimiento', IZQUIERDA + COLUMNA.movimiento, y, { ancho: ANCHO_MOVIMIENTO, ...rotulos });
  rotulo(doc, 'Quién', DERECHA - COLUMNA.quien, y, { ancho: COLUMNA.quien, ...rotulos, align: 'right' });
  const yRegla = y + 9.5;
  doc.rect(IZQUIERDA, yRegla - 0.45, CONTENIDO, 0.9).fill(COLOR.tinta);
  const yFilas = yRegla + 0.5;
  const visibles = movimientos.slice(0, FILAS_PDF);
  visibles.forEach((m, i) => dibujarFila(doc, m, yFilas + i * ALTO_FILA));
  const fin = yFilas + FILAS_PDF * ALTO_FILA;
  // Con menos de FILAS_PDF movimientos, el texto va en el renglón siguiente al último; si no, debajo de la tabla
  const yFinal = visibles.length < FILAS_PDF ? yFilas + visibles.length * ALTO_FILA + 5 : fin + 5;
  renglon(doc, textoDelFinal(movimientos), IZQUIERDA, yFinal, { ancho: CONTENIDO, tamano: LETRA.nota, color: COLOR.gris });
  return fin;
};

// =====================================================
// La hoja
// =====================================================

const dibujarHoja = (doc, seguimiento, { hoy, generado }) => {
  const { ficha, circuito, cinta } = seguimiento;
  const movimientos = Array.isArray(seguimiento.movimientos) ? seguimiento.movimientos : [];
  const registro = seguimiento.registro ?? {};
  let y = dibujarEncabezado(doc, hoy);
  const limite = dibujarPie(doc, generado);

  y += AIRE.etiqueta;
  y += dibujarCabecera(doc, ficha, y) + AIRE.ficha;

  const datos = prepararFicha(doc, ficha);
  datos.dibujar(y);
  y += datos.alto + AIRE.seccion;

  dibujarCabezaDeSeccion(doc, 'Avisos del ciclo abierto', circuito?.vencimiento?.texto ?? '', y);
  y += AIRE.cabeza;
  if (circuito) y += dibujarCircuito(doc, circuito, y, { activo: ficha.activo !== false });
  else y += ALTO_NODO;
  y += AIRE.alArea;
  if (circuito && ficha.tipo_gestion !== 'interna') dibujarAlArea(doc, circuito, y);
  y += ALTO_AL_AREA + AIRE.seccion;

  const ventana = ventanaDe(hoy);
  const mesLargo = (dia) => formatoLargo(dia).replace(/^\d+ de /, '');
  dibujarCabezaDeSeccion(doc, 'Los últimos 12 meses', ventana ? `De ${mesLargo(ventana.desde)} a ${mesLargo(`${hoy.slice(0, 7)}-01`)}` : '', y);
  y += AIRE.cabeza;
  dibujarCinta(doc, cinta, y);
  y += ALTO_CINTA + AIRE.leyenda;
  dibujarLeyenda(doc, cinta, y);
  y += ALTO_LEYENDA + AIRE.movimientos;

  dibujarCabezaDeSeccion(doc, 'Últimos movimientos', resumenDeMovimientos(movimientos.length), y);
  y += AIRE.cabeza;
  dibujarMovimientos(doc, movimientos, y);

  // La aclaración, siempre arriba del pie
  const aclaracion = `Los envíos quedan registrados desde el ${formatoCorto(registro.envios)} y los cambios desde el ${formatoCorto(registro.cambios)}.`;
  renglon(doc, aclaracion, IZQUIERDA, limite - AIRE.sobrePie - OJO * LETRA.nota, { ancho: CONTENIDO, tamano: LETRA.nota, color: COLOR.gris });
};

// El PDF de una hoja del Seguimiento de un dataset. `seguimiento`: el de seguimientoDe(fuentes, hoy, { separacion: 12, letra: 8.4 });
// `hoy`: 'AAAA-MM-DD'; `generado`: { momento: 'AAAA-MM-DD HH:MM:SS', por: nombre corto o null }.
export const renderSeguimiento = async (seguimiento, { hoy, generado }) => {
  await cargarQrcode();
  return dibujarSeguimiento(seguimiento, { hoy, generado });
};

const dibujarSeguimiento = (seguimiento, opciones) => new Promise((resolve, reject) => {
  try {
    // Márgenes de PDFKit en 0: la diagramación es fija y nada se escribe donde PDFKit agregaría una hoja
    const doc = new DocumentoNota({
      size: 'A4', autoFirstPage: false, margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: { Title: 'Seguimiento del dataset', Author: 'Dirección de Datos Públicos y Comunicación' }
    });
    const partes = [];
    doc.on('data', parte => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    doc.addPage();
    dibujarHoja(doc, seguimiento, opciones);
    doc.end();
  } catch (error) {
    reject(error);
  }
});
