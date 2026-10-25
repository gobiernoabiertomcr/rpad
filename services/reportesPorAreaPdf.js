// El PDF «Reporte por área» (spec 2026-10-24-metricas-y-reportes, 5, Para trabajar; maqueta 6-reportes-datos-reales.html): una portada
// con el área y sus contactos, las cinco tarjetas (Total, Actualizados, Próximos, Vencidos y Eventuales: con los sin fecha, que una
// línea aclara debajo, suman el total) y la lista de sus datasets por grupo (Vencidos, Próximos a vencer, Actualizados, Eventuales y
// Sin fecha), un renglón por dataset; y detrás, una hoja del Seguimiento por cada dataset activo, en el orden de la lista: la misma
// hoja que se descarga del Seguimiento (dibujarHoja, services/seguimientoPdf.js). Uno dado de baja va en la lista, si figura, pero no
// tiene hoja. El pie de todas las hojas dice «Reporte por área · Hoja k de N», con N todas las del documento: las de la portada (con
// una lista larga, más de una) y las del Seguimiento (Ruling 22).
// Dibuja con la base de los reportes (reportesPdfBase.js) lo que arma el controlador (controllers/reportesController.js): el estado de
// cada dataset (estadoDelDataset) y su Seguimiento (seguimientoDe con la cinta del PDF) ya vienen calculados. Puro: sin pool (los
// tests lo llaman sin base).
import { COLOR, IZQUIERDA, CONTENIDO, NEGRITA, ASCENDENTE, renglon, filete, prepararGrilla, cargarQrcode } from './notasDigitalesAnexo.js';
import { formatoCorto } from './notasDigitalesCalendario.js';
import { CAMPOS_CONTACTO } from './notasDigitalesContenido.js';
import { dibujarHoja } from './seguimientoPdf.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, hojasDe, lugarPara, prepararTitulo, prepararTarjetas, prepararParrafo, prepararRecuadro,
  prepararSeccion, fechaCorta, textoSinFecha, INSIGNIAS, ENTRE, ANCHO_DEL_RECUADRO
} from './reportesPdfBase.js';

const TITULO = 'Reporte por área';
const pieDe = (k, n) => `${TITULO} · Hoja ${k} de ${n}`;

// Letras (en puntos)
const LETRA = { contacto: 9, contactoMin: 8, rotuloContacto: 6.6, grupo: 8, renglon: 8 };

// Los grupos de la lista, en su orden, cada uno con la insignia de su estado (los colores del Seguimiento: INSIGNIAS). Un dataset va
// en el grupo de su estado; el que no es actualizado, próximo, eventual ni sin fecha es un vencido (atrasado o sin respuesta), como
// en el reporte de antes.
const GRUPOS = [
  { clave: 'vencidos', titulo: 'Vencidos', insignia: INSIGNIAS.vencido },
  { clave: 'proximos', titulo: 'Próximos a vencer', insignia: INSIGNIAS.proximo },
  { clave: 'actualizados', titulo: 'Actualizados', insignia: INSIGNIAS.actualizado },
  { clave: 'eventuales', titulo: 'Eventuales', insignia: INSIGNIAS.eventual },
  { clave: 'sinFecha', titulo: 'Sin fecha', insignia: INSIGNIAS['sin-fecha'] }
];
const GRUPO_DEL_ESTADO = { actualizado: 'actualizados', proximo: 'proximos', eventual: 'eventuales', 'sin-fecha': 'sinFecha' };
const grupoDe = (estado) => (typeof estado === 'string' && Object.hasOwn(GRUPO_DEL_ESTADO, estado) ? GRUPO_DEL_ESTADO[estado] : 'vencidos');

// Los datasets de cada grupo, en el orden en que llegan: { vencidos: [...], proximos: [...], ... }
const gruposDe = (datasets) => {
  const grupos = Object.fromEntries(GRUPOS.map(g => [g.clave, []]));
  for (const d of datasets) grupos[grupoDe(d.estado)].push(d);
  return grupos;
};

// La cabeza de un grupo («Vencidos (3)»): el texto en negrita en la insignia de su estado. `alto`: lo que ocupa antes del primer
// renglón (la insignia y el aire de abajo).
const CABEZA = { alto: 15, relleno: 6, bajo: 4 };
const prepararCabezaDeGrupo = (doc, texto, colores) => {
  doc.font(NEGRITA).fontSize(LETRA.grupo);
  const anchoTexto = Math.min(CONTENIDO - 2 * CABEZA.relleno, doc.widthOfString(texto) + 1);
  return {
    alto: CABEZA.alto + CABEZA.bajo,
    dibujar: (y) => {
      doc.roundedRect(IZQUIERDA, y, anchoTexto + 2 * CABEZA.relleno, CABEZA.alto, CABEZA.alto / 2).fill(colores.fondo);
      // Las mayúsculas, centradas en el alto de la insignia
      renglon(doc, texto, IZQUIERDA + CABEZA.relleno, y + (CABEZA.alto - ASCENDENTE * LETRA.grupo) / 2,
        { ancho: anchoTexto, tamano: LETRA.grupo, fuente: NEGRITA, color: colores.texto });
      return y + CABEZA.alto + CABEZA.bajo;
    }
  };
};

// El renglón de un dataset: «Título · Datos al: dd/mm/aaaa · Próxima: dd/mm/aaaa» (sin la fecha, "—"), en hasta tres líneas (si no
// entra, se corta con "…"), con una línea fina debajo
const RENGLON = { arriba: 4.5, abajo: 4, lineas: 3 };
const textoDelRenglon = (d) => `${d.titulo || '—'} · Datos al: ${fechaCorta(d.datos_al)} · Próxima: ${fechaCorta(d.proxima)}`;
const prepararRenglon = (doc, d) => {
  const parrafo = prepararParrafo(doc, textoDelRenglon(d), { tamano: LETRA.renglon, color: COLOR.tinta, lineas: RENGLON.lineas });
  const alto = RENGLON.arriba + parrafo.alto + RENGLON.abajo;
  return {
    alto,
    dibujar: (y) => {
      parrafo.dibujar(y + RENGLON.arriba);
      filete(doc, IZQUIERDA, y + alto, CONTENIDO);
      return y + alto;
    }
  };
};

// Un grupo de la lista desde y: la cabeza y sus renglones. La cabeza nunca queda sola al pie de una hoja (va con el primer renglón) y,
// si el grupo sigue en otra hoja, se repite arriba (lugarPara pasa a una hoja nueva lo que no entra). Devuelve la y de lo que sigue.
const dibujarGrupo = (doc, grupo, datasets, y) => {
  const cabeza = prepararCabezaDeGrupo(doc, `${grupo.titulo} (${datasets.length})`, grupo.insignia);
  let yRenglon = y;
  datasets.map(d => prepararRenglon(doc, d)).forEach((r, i) => {
    const lugar = lugarPara(doc, yRenglon, (i === 0 ? cabeza.alto : 0) + r.alto);
    yRenglon = r.dibujar(i === 0 || lugar !== yRenglon ? cabeza.dibujar(lugar) : lugar);
  });
  return yRenglon + ENTRE;
};

// Los contactos del área en un recuadro gris: los datos de contacto de la nota y del anexo (CAMPOS_CONTACTO, con sus rótulos; acá,
// sin ficha, también «Depende de»), los cargados y en su orden, como el contacto del anexo: en dos columnas, el rótulo arriba y el
// valor debajo; un valor que no entra en una línea de media columna (un email largo) ocupa la fila entera, en hasta dos líneas (si no
// entra, se corta con "…"). Sin ninguno cargado, null: el recuadro no va.
const prepararContactos = (doc, area) => {
  const celdas = CAMPOS_CONTACTO.map(([campo, etiqueta]) => ({ etiqueta, valor: String(area?.[campo] ?? '').trim() }))
    .filter(c => c.valor);
  if (celdas.length === 0) return null;
  const grilla = prepararGrilla(doc, celdas, {
    ancho: ANCHO_DEL_RECUADRO, columnas: 2, lineas: 2, tamanos: { max: LETRA.contacto, min: LETRA.contactoMin },
    tamanoRotulo: LETRA.rotuloContacto, divisorias: false, filaEntera: { lineas: 1, tamano: LETRA.contacto }
  });
  // (la grilla se dibuja en (x, y); lo de adentro de un recuadro, en (y, x))
  const contenido = { alto: grilla.alto, dibujar: (y, x) => grilla.dibujar(x, y) };
  return prepararRecuadro(doc, { rotulo: 'Contactos del área', contenido }, { tono: 'gris' });
};

// La portada desde la primera hoja: el rótulo y el área, sus contactos, las tarjetas, la línea de los sin fecha y la lista. Lo de arriba
// de la lista tiene un alto acotado (el título en dos líneas, los ocho contactos en dos líneas cada uno, las tarjetas) y entra siempre
// en la primera hoja, con la cabeza de la lista y su primer grupo; la lista corta de hoja por renglón.
const dibujarPortada = (doc, { area, lista, grupos, hoy }) => {
  let y = agregarHoja(doc, { derecha: TITULO, fecha: hoy });
  y = prepararTitulo(doc, { rotulo: `${TITULO} · al ${formatoCorto(hoy)}`, titulo: area?.nombre || '—' }).dibujar(y);
  const contactos = prepararContactos(doc, area);
  if (contactos) y = contactos.dibujar(y);
  y = prepararTarjetas(doc, [
    { valor: lista.length, rotulo: 'Total Datasets' },
    { valor: grupos.actualizados.length, rotulo: 'Actualizados' },
    { valor: grupos.proximos.length, rotulo: 'Próximos' },
    { valor: grupos.vencidos.length, rotulo: 'Vencidos' },
    { valor: grupos.eventuales.length, rotulo: 'Eventuales' }
  ]).dibujar(y);
  if (grupos.sinFecha.length > 0) y = prepararParrafo(doc, `${textoSinFecha(grupos.sinFecha.length)}.`).dibujar(y);
  if (lista.length === 0) return;
  y = prepararSeccion(doc, {
    titulo: 'Conjuntos de datos del área', derecha: 'Detrás, una hoja del Seguimiento por cada dataset activo'
  }).dibujar(y);
  for (const grupo of GRUPOS) {
    if (grupos[grupo.clave].length > 0) y = dibujarGrupo(doc, grupo, grupos[grupo.clave], y);
  }
};

// El PDF. `area`: la fila del área (el nombre y las columnas de CAMPOS_CONTACTO). `datasets`: los del
// área, en el orden en que van dentro de cada grupo, cada uno { titulo, datos_al, proxima, estado, activo, seguimiento }, con las
// fechas 'AAAA-MM-DD' (o null), el estado de estadoDelDataset y, si está activo (activo !== false), el de seguimientoDe(fuentes, hoy,
// OPCIONES_CINTA_PDF). `hoy`: 'AAAA-MM-DD'; `generado`: { momento, por } (el pie).
// A un dataset activo sin Seguimiento, tira error: no sale un reporte con hojas de menos.
export const renderPorArea = async ({ area, datasets }, { hoy, generado }) => {
  const lista = Array.isArray(datasets) ? datasets : [];
  const grupos = gruposDe(lista);
  // Las hojas del Seguimiento, en el orden de la lista: la de cada activo
  const conHoja = GRUPOS.flatMap(g => grupos[g.clave]).filter(d => d.activo !== false);
  const sinSeguimiento = conHoja.find(d => !d.seguimiento);
  if (sinSeguimiento) {
    throw new Error(`El reporte por área necesita el Seguimiento de cada dataset activo: falta el de «${sinSeguimiento.titulo}»`);
  }
  await cargarQrcode();
  const doc = nuevoReporte({ titulo: TITULO });
  dibujarPortada(doc, { area, lista, grupos, hoy });
  // N: las hojas de la portada y una por cada activo. Cada hoja del Seguimiento trae su pie, con su número (contando la que se
  // agrega); las de la portada lo reciben al cerrar
  const total = hojasDe(doc) + conHoja.length;
  for (const d of conHoja) {
    const pie = pieDe(hojasDe(doc) + 1, total);
    doc.addPage();
    dibujarHoja(doc, d.seguimiento, { hoy, generado, pie });
  }
  return cerrarReporte(doc, { generado, pieDe });
};
