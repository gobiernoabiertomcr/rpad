/**
 * La Nota Digital en Word (spec 2026-10-24-generador-de-notas, sección 6): los bloques de `services/notasGeneradorContenido.js`
 * (ver su JSDoc) armados desde el HTML guardado de la nota (`notas_digitales.html`), tal como se envió. No se recalcula nada. El
 * Word lo dibuja `renderDocx` (`services/notasWord.js`), en la hoja membretada.
 *
 * Sin la primera línea del email ("SE ADJUNTAN NOTA Y ANEXO EN PDF" o "SE ADJUNTA NOTA EN PDF": es del email, no de la nota) y
 * sin la firma: de la firma solo queda el espacio en blanco (o los dos, con la leyenda que cita la autorización). Lo demás queda.
 *
 * Como no hay una librería de HTML, el análisis es un recorrido chico por etiquetas: el HTML siempre sale de `renderHtml`
 * (`services/notasDigitalesContenido.js`), con un conjunto conocido de etiquetas (p, b, u, br, span, a, table, tr, th, td, ul y
 * li), que cambió con las entregas (columnas, anexo, firmas). Se probó con las notas de cada época. Puro: sin pool ni Express.
 */
import { AVISO_ADJUNTO, PROPORCIONES_EXTERNA } from './notasDigitalesContenido.js';
import { PROPORCIONES, PROPORCIONES_CON_SEGUNDA } from './notasDigitalesPdf.js';

// El remitente de las notas (REMITENTE de notasDigitalesContenido.js): marca dónde termina el cuerpo y empieza la firma
const REMITENTE = 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN';
const SIN_REMITENTE = 'No se encontró el remitente de la nota.';
const SIN_FIRMA = 'No se encontró la firma de la nota.';

/**
 * Un HTML que no se reconoce como una Nota Digital: sin el remitente o sin la firma justo después. La API responde 422 con su
 * mensaje (nunca un Word con una firma inventada); cualquier otro error del conversor es un error del sistema.
 */
export class NotaNoReconocida extends Error {}

// Las letras del HTML, en px, y las del Word, en medios puntos: el cuerpo (15 px) en 12 pt, la tabla (13) en 10, el antecedente
// (12) en 9 y la segunda parte de "Informado en" (11) en 8
const LETRAS = { 15: 24, 13: 20, 12: 18, 11: 16 };
// Todas las tablas de la nota van en la letra de las tablas del PDF, 8,5 pt, con su relleno, 3 pt (TAMANO_TABLA y RELLENO de
// notasDigitalesPdf.js): una sola letra de tabla en toda la nota. Las letras de adentro se achican en la misma proporción que la
// de la tabla, de 13 px (10 pt) a 8,5 pt: el antecedente (12 px) queda en 7,5 pt y la segunda parte de "Informado en" (11 px), en
// 7, como en el PDF. Con 10 pt y el margen de siempre, las palabras de las tablas de 6 y 7 columnas no entran (en la nota 2/26, de
// 6 columnas, el título cedía hasta partir "Presupuesto")
const LETRA_DE_TABLA = 17;
const MARGEN_DE_TABLA = 60;
const ESCALA_DE_TABLA = LETRA_DE_TABLA / LETRAS[13];
// Desde 4 columnas (las de los datasets y las de la nota de auditoría), ninguna palabra se parte (sinPartirPalabras), como en el
// PDF; las tablas del detalle de un cambio (2 y 3 columnas) parten una URL larga, también como en el PDF (partirPalabras)
const COLUMNAS_SIN_PARTIR = 4;
// El encabezado de la tabla externa de 7 columnas (columnasDe de notasDigitalesContenido.js)
const ENCABEZADO_EXTERNA = 'Requiere nota DGMIT';

const ALINEAR = { left: 'izquierda', right: 'derecha', center: 'centro', justify: 'justificado' };
const ETIQUETAS_VACIAS = new Set(['br', 'meta', 'img', 'hr', 'link', 'input']);
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

// ---------------------------------------------------------------------------------------------------------------------------
// El HTML, en un árbol: { etiqueta, estilo, atributos, hijos } o { texto }
// ---------------------------------------------------------------------------------------------------------------------------

// Las cinco entidades de escapeHtml, de una pasada ("&amp;lt;" es "&lt;")
const decodificar = (texto) => texto.replace(/&(amp|lt|gt|quot|#39);/g, (_, entidad) => ENTIDADES[entidad]);

const atributosDe = (texto) => Object.fromEntries([...texto.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
  .map(([, nombre, doble, simple]) => [nombre.toLowerCase(), decodificar(doble ?? simple)]));

// El style de una etiqueta: { propiedad: valor }, las dos en minúscula
const estiloDe = (atributos) => Object.fromEntries(String(atributos.style ?? '').split(';')
  .map(declaracion => declaracion.split(':'))
  .filter(([propiedad, ...valor]) => propiedad.trim() && valor.length)
  .map(([propiedad, ...valor]) => [propiedad.trim().toLowerCase(), valor.join(':').trim().toLowerCase()]));

// Comentarios y <!DOCTYPE> no cuentan; una etiqueta que cierra cierra también las que quedaron abiertas adentro
const PIEZAS = /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
const arbolDe = (html) => {
  const raiz = { etiqueta: '#raiz', estilo: {}, atributos: {}, hijos: [] };
  const abiertas = [raiz];
  for (const [, cierra, nombre, resto, texto] of html.matchAll(PIEZAS)) {
    const actual = abiertas.at(-1);
    if (texto !== undefined) {
      actual.hijos.push({ texto: decodificar(texto) });
    } else if (nombre !== undefined) {
      const etiqueta = nombre.toLowerCase();
      if (cierra) {
        const abierta = abiertas.findLastIndex(n => n.etiqueta === etiqueta);
        if (abierta > 0) abiertas.length = abierta;
      } else {
        const atributos = atributosDe(resto);
        const nodo = { etiqueta, estilo: estiloDe(atributos), atributos, hijos: [] };
        actual.hijos.push(nodo);
        if (!ETIQUETAS_VACIAS.has(etiqueta) && !resto.trimEnd().endsWith('/')) abiertas.push(nodo);
      }
    }
  }
  return raiz;
};

const hijosDe = (nodo, ...etiquetas) => nodo.hijos.filter(h => etiquetas.includes(h.etiqueta));
const buscar = (nodo, etiqueta) => (nodo.etiqueta === etiqueta ? nodo : (nodo.hijos ?? []).reduce((hallado, h) => hallado ?? buscar(h, etiqueta), null));
// El texto de una etiqueta, con un salto por cada <br>
const textoDe = (nodo) => (nodo.texto ?? (nodo.etiqueta === 'br' ? '\n' : nodo.hijos.map(textoDe).join('')));

// ---------------------------------------------------------------------------------------------------------------------------
// El formato y las partes
// ---------------------------------------------------------------------------------------------------------------------------

// Los px de un margen o de una letra ("12px" o "0"); otra unidad, null
const pxDe = (valor) => {
  const px = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(String(valor ?? '').trim());
  return px && (px[2] || Number(px[1]) === 0) ? Math.max(0, Number(px[1])) : null;
};

// La letra de un font-size, en medios puntos, achicada en la proporción de la tabla (escala); una que no está en LETRAS, null
const letraDe = (fontSize, escala) => {
  const letra = LETRAS[pxDe(fontSize)];
  return letra ? Math.round(letra * escala) : null;
};

// El arriba y el abajo de un margin, en px: "0 0 12px" es arriba 0 y abajo 12 (uno, dos, tres o cuatro valores, como en CSS)
const margenDe = (margin) => {
  const valores = String(margin ?? '').trim().split(/\s+/).filter(Boolean).map(pxDe);
  if (!valores.length) return { arriba: 0, abajo: 0 };
  const [arriba, , abajo = arriba] = valores.length === 2 ? [valores[0], null, valores[0]] : valores;
  return { arriba: arriba ?? 0, abajo: abajo ?? 0 };
};

// El formato de una etiqueta: el que hereda más el suyo. <b> y font-weight:bold (los títulos de la tabla y el vencimiento que
// abre un grupo) son negrita; <u>, subrayado; font-style:italic, cursiva; font-size, la letra
const formatoDe = (nodo, heredado, escala) => {
  const formato = { ...heredado };
  if (nodo.etiqueta === 'b' || nodo.etiqueta === 'th' || /^(bold|bolder|[6-9]00)$/.test(nodo.estilo['font-weight'] ?? '')) formato.negrita = true;
  if (nodo.etiqueta === 'u') formato.subrayado = true;
  if (nodo.estilo['font-style'] === 'italic') formato.cursiva = true;
  const letra = letraDe(nodo.estilo['font-size'], escala);
  if (letra) formato.letra = letra;
  return formato;
};

// Una parte, con solo lo que tiene
const parteDe = (texto, formato, salto) => ({
  texto,
  ...(formato.negrita ? { negrita: true } : {}),
  ...(formato.subrayado ? { subrayado: true } : {}),
  ...(formato.cursiva ? { cursiva: true } : {}),
  ...(salto ? { salto: true } : {}),
  ...(formato.letra ? { letra: formato.letra } : {})
});

// Las partes de una etiqueta: cada texto con su formato y un salto por cada <br> (en la parte que sigue). Los espacios se juntan
// como en el HTML: uno solo, ninguno al principio de un renglón ni al final del párrafo. Un <a> es su texto
const partesDe = (nodo, formato, escala) => {
  const partes = [];
  let salto = false;
  const recorrer = (hijo, heredado) => {
    if (hijo.texto !== undefined) {
      let texto = hijo.texto.replace(/[ \t\r\n\f]+/g, ' ');
      if (salto || !partes.length || partes.at(-1).texto.endsWith(' ')) texto = texto.replace(/^ /, '');
      if (!texto) return;
      partes.push(parteDe(texto, heredado, salto));
      salto = false;
    } else if (hijo.etiqueta === 'br') {
      if (salto) partes.push(parteDe('', heredado, true));
      salto = true;
    } else {
      const propio = formatoDe(hijo, heredado, escala);
      hijo.hijos.forEach(nieto => recorrer(nieto, propio));
    }
  };
  nodo.hijos.forEach(hijo => recorrer(hijo, formato));
  if (salto) partes.push(parteDe('', formato, true));
  const ultima = partes.at(-1);
  if (ultima && !ultima.salto && ultima.texto.endsWith(' ')) {
    ultima.texto = ultima.texto.replace(/ $/, '');
    if (!ultima.texto) partes.pop();
  }
  return partes;
};

const conTexto = (partes) => partes.some(p => p.texto.trim());

// ---------------------------------------------------------------------------------------------------------------------------
// Los bloques
// ---------------------------------------------------------------------------------------------------------------------------

// Un <p> (y cualquier etiqueta que no sea una tabla ni una lista): la alineación de text-align y los espacios del margin, en twips
const parrafoDe = (nodo) => {
  const { arriba, abajo } = margenDe(nodo.estilo.margin);
  return {
    tipo: 'parrafo',
    alinear: ALINEAR[nodo.estilo['text-align']] ?? 'izquierda',
    antes: Math.round(arriba * 15),
    despues: Math.round(abajo * 15),
    partes: partesDe(nodo, formatoDe(nodo, {}, 1), 1)
  };
};

const listaDe = (nodo) => ({ tipo: 'lista', items: hijosDe(nodo, 'li').map(li => partesDe(li, formatoDe(li, {}, 1), 1)) });

// Las filas de una tabla: las <tr> (también dentro de un <tbody>), sin entrar en otra tabla
const filasHtmlDe = (tabla) => tabla.hijos.flatMap(h => {
  if (h.etiqueta === 'tr') return [h];
  return ['tbody', 'thead', 'tfoot'].includes(h.etiqueta) ? hijosDe(h, 'tr') : [];
});
const abarcaDe = (celda) => Math.max(1, Number.parseInt(celda.atributos.colspan, 10) || 1);

// Los anchos, como los del PDF (calcularAnchos y seccion.proporciones de notasDigitalesPdf.js): la externa de 7 columnas, las suyas;
// las demás de 7, las de siempre, con o sin la segunda parte de "Informado en" (el <span> de 11 px); 4, 5 y 6, las de siempre;
// otra cantidad, parejos
const anchosDe = (columnas, encabezado, conSegunda) => {
  if (columnas === 7 && encabezado.includes(ENCABEZADO_EXTERNA)) return [...PROPORCIONES_EXTERNA[conSegunda ? 'conSegunda' : 'sinSegunda']];
  if (columnas === 7) return [...(conSegunda ? PROPORCIONES_CON_SEGUNDA : PROPORCIONES)[7]];
  if (PROPORCIONES[columnas]) return [...PROPORCIONES[columnas]];
  return Array.from({ length: columnas }, () => 100 / columnas);
};

// En las celdas, salvo la del título, "Del" y "al" no se separan de la fecha que los sigue, ni "N°" de su número: se unen con un
// espacio duro, como en el PDF (conFechasJuntas de notasDigitalesPdf.js). Así un pedido pasa a dos renglones, "Del 01/01/2026" y
// "al 30/09/2026", nunca con un "Del" solo arriba, y "Nota Digital N°" no queda arriba con "1/26" abajo
const PREPOSICION_Y_FECHA = /\b(del|al) (?=\d{2}\/\d{2}\/\d{4})/gi;
const NUMERAL_Y_NUMERO = /N\u00b0 (?=\d)/g;
const conFechasJuntas = (partes) => partes.map(parte => ({
  ...parte, texto: parte.texto.replace(PREPOSICION_Y_FECHA, '$1\u00a0').replace(NUMERAL_Y_NUMERO, 'N\u00b0\u00a0')
}));

const tieneSegundaParte = (nodo) => (nodo.etiqueta === 'span' && pxDe(nodo.estilo['font-size']) === 11)
  || (nodo.hijos ?? []).some(tieneSegundaParte);

// Una <table>: la primera fila de <th>, el encabezado (se repite arriba de cada hoja); colspan, abarca. La fila que abre un
// vencimiento (una celda a todo el ancho en negrita) va con la fila que sigue, y la de un dataset, con su antecedente (una celda
// a todo el ancho en cursiva), como en el PDF
const tablaDe = (nodo) => {
  const filasHtml = filasHtmlDe(nodo).map(tr => hijosDe(tr, 'td', 'th')).filter(celdas => celdas.length);
  const columnas = Math.max(0, ...filasHtml.map(celdas => celdas.reduce((suma, c) => suma + abarcaDe(c), 0)));
  if (!columnas) return null;
  const escala = ESCALA_DE_TABLA;
  const aTodoElAncho = (celdas, estilo) => celdas.length === 1 && columnas > 1 && abarcaDe(celdas[0]) === columnas
    && Boolean(formatoDe(celdas[0], {}, escala)[estilo]);
  const filas = filasHtml.map((celdas, i) => {
    let columna = 0;
    const fila = {
      ...(i === 0 && celdas.every(c => c.etiqueta === 'th') ? { encabezado: true } : {}),
      celdas: celdas.map((celda) => {
        const { letra, ...formato } = formatoDe(celda, {}, escala);
        const abarca = abarcaDe(celda);
        const partes = partesDe(celda, formato, escala);
        columna += abarca;
        return {
          partes: abarca === 1 && columna > 1 ? conFechasJuntas(partes) : partes,
          ...(abarca > 1 ? { abarca } : {}),
          ...(letra ? { letra } : {})
        };
      })
    };
    const siguiente = filasHtml[i + 1];
    if (aTodoElAncho(celdas, 'negrita') || (siguiente && aTodoElAncho(siguiente, 'cursiva'))) fila.conLaSiguiente = true;
    return fila;
  });
  const encabezado = filas[0].encabezado ? filas[0].celdas.map(c => c.partes.map(p => p.texto).join('')) : [];
  // La letra de la tabla: la de su font-size o, sin él, la del cuerpo (15 px)
  const letra = letraDe(nodo.estilo['font-size'] ?? '15px', escala);
  return {
    tipo: 'tabla',
    anchos: anchosDe(columnas, encabezado, tieneSegundaParte(nodo)),
    ...(letra ? { letra } : {}),
    margen: MARGEN_DE_TABLA,
    ...(columnas >= COLUMNAS_SIN_PARTIR ? { sinPartirPalabras: true } : {}),
    filas
  };
};

const bloqueDe = (nodo) => {
  if (nodo.etiqueta === 'table') return tablaDe(nodo);
  if (nodo.etiqueta === 'ul') return listaDe(nodo);
  return parrafoDe(nodo);
};

// La primera línea del email: el primer <p>, en bordó o con el texto de AVISO_ADJUNTO (las notas viejas no la tienen)
const esPrimeraLinea = (nodo) => nodo?.etiqueta === 'p'
  && (nodo.estilo.color === '#800000' || Object.values(AVISO_ADJUNTO).includes(textoDe(nodo).trim()));
// La firma: el bloque con margin:32px 0 0, un <p> (una firma) o una <table> (dos, lado a lado)
const esFirma = (nodo) => ['p', 'table'].includes(nodo.etiqueta) && (() => {
  const { arriba, abajo } = margenDe(nodo.estilo.margin);
  return arriba === 32 && abajo === 0;
})();
// La leyenda de las dos firmas: el <p> en cursiva que sigue a la firma
const esLeyenda = (nodo) => nodo?.etiqueta === 'p' && nodo.estilo['font-style'] === 'italic';

/**
 * Los bloques del Word de una Nota Digital, desde su HTML guardado.
 * 1. Toma los hijos del <div> del <body> y quita el primero si es la primera línea del email.
 * 2. El remitente es el último <p> que empieza con "DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN": se conserva, y lo anterior se
 *    convierte (<p> → parrafo, <table> → tabla, <ul> → lista).
 * 3. Justo después del remitente va la firma (el bloque con margin:32px 0 0; su contenido no se lee), que pasa a ser el espacio
 *    en blanco, de una o dos columnas; la leyenda (el <p> en cursiva que la sigue) y el CC (el último <p> después de ellas) se
 *    conservan si tienen texto. Lo demás no se lee.
 * @param {string} html
 * @returns {import('./notasGeneradorContenido.js').Bloque[]}
 * @throws {NotaNoReconocida} 'No se encontró el remitente de la nota.' si el HTML no lo tiene, o 'No se encontró la firma de la
 *   nota.' si no la tiene justo después del remitente: nunca sale un Word con una firma inventada ni un CC que no lo es.
 */
export const bloquesDeNotaDigital = (html) => {
  const body = buscar(arbolDe(String(html ?? '')), 'body');
  const div = body ? hijosDe(body, 'div')[0] : null;
  const elementos = (div?.hijos ?? []).filter(hijo => hijo.etiqueta);
  if (esPrimeraLinea(elementos[0])) elementos.shift();
  const remitente = elementos.findLastIndex(e => e.etiqueta === 'p' && textoDe(e).trimStart().startsWith(REMITENTE));
  if (remitente < 0) throw new NotaNoReconocida(SIN_REMITENTE);
  const [firma, ...despues] = elementos.slice(remitente + 1);
  if (!firma || !esFirma(firma)) throw new NotaNoReconocida(SIN_FIRMA);

  const cuerpo = elementos.slice(0, remitente + 1).map(bloqueDe).filter(Boolean);
  const leyenda = esLeyenda(despues[0]) ? despues[0] : null;
  const cc = despues.slice(leyenda ? 1 : 0).findLast(e => e.etiqueta === 'p') ?? null;
  const siTieneTexto = (nodo) => {
    const parrafo = nodo ? parrafoDe(nodo) : null;
    return parrafo && conTexto(parrafo.partes) ? [parrafo] : [];
  };
  return [
    ...cuerpo,
    { tipo: 'firma', columnas: firma.etiqueta === 'table' ? 2 : 1 },
    ...siTieneTexto(leyenda),
    ...siTieneTexto(cc)
  ];
};
