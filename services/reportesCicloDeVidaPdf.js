// El PDF «Ciclo de vida del dato» (spec 2026-10-25-ciclo-de-vida-del-dato, 2): cuánto tarda el dato en cada etapa del circuito. Son
// siempre dos hojas A4: la 1, la gestión externa, y la 2, la interna. Cada hoja, de arriba abajo:
// - el encabezado de los reportes («Ciclo de vida del dato» y la fecha larga de hoy);
// - el título, con el rótulo «Ciclo de vida del dato · 2026, en curso» (en un año cerrado, sin «en curso»);
// - la píldora del período y, en un año cerrado que todavía no tiene foto, otra en el sol con el aviso de la foto;
// - el circuito en chico: la sigla de cada nodo y, en cada flecha, el número de la etapa y su mediana en días hábiles;
// - un bloque por etapa: a la izquierda el número, el nombre y la insignia, el tramo (los dos nodos y la flecha) y la descripción
//   seguida de cómo se mide (TEXTOS_DEL_CICLO); a la derecha las estadísticas: el mosaico de la mediana, el promedio y los extremos (o el
//   vacío) y los renglones de notas;
// - la aclaración de la hoja (en la externa, los datasets que no requieren nota DGMIT) y «Cómo se cuenta».
// El pie: «Ciclo de vida del dato · 2026 · Hoja k de 2». La diagramación es fija, como la hoja del Seguimiento: los bloques se reparten
// todo el alto que queda hasta LIMITE y cada uno acomoda lo suyo en el alto que le toca (lo que no entra se corta con «…»).
// Dibuja lo que manda el servidor (Ruling 19): los datos de cicloDeVidaDe (controllers/metricasController.js), con las etapas de etapasDe
// y el año anterior de conAnterior (services/metricasReglas.js). No recalcula ni arma ninguna cifra: los únicos textos de acá son los
// fijos. Puro: sin pool. Las formas que van adentro de otra (los nodos, el mosaico, las insignias) se dibujan con contorno
// (services/reportesMetricasPdf.js): un roundedRect sería, para el test de diagramación, un bloque encimado con el suyo.
import { COLOR, IZQUIERDA, CONTENIDO, NORMAL, NEGRITA, ASCENDENTE, DESCENDENTE, ajustar, escribir, renglon } from './notasDigitalesAnexo.js';
import { esFechaIso } from './notasDigitalesCalendario.js';
import { VIOLETA, COLORES } from './seguimientoPdf.js';
import { VENTANA_DE_LA_REGLA, PRIMER_ANIO } from './metricasReglas.js';
import { contorno, NODOS } from './reportesMetricasPdf.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, prepararTitulo, prepararPildora, LIMITE, ENTRE, fechaCorta, esObjeto, objeto, lista, texto
} from './reportesPdfBase.js';

// =====================================================
// Los textos fijos (spec 2.3 y 2.4)
// =====================================================

const SE_MIDE_EL_AVISO = 'Se mide del aviso al vencimiento: cuanto más grande, más anticipación.';
const SE_MIDE_LA_CARGA = 'Se mide del «Recibido el» al día de la carga en el portal.';
const COMO_SE_CUENTA = 'Días hábiles: de lunes a viernes, sin los feriados nacionales fijos; entre paréntesis, los corridos. La mediana es el '
  + 'valor del medio: la mitad de los ciclos tardó eso o menos. El caso más largo y el más corto (en el aviso, el de más y el de menos '
  + 'anticipación) son los ciclos de los extremos de cada etapa. Cada ciclo cuenta en el año en que terminó la etapa; el aviso, en el año '
  + 'de su vencimiento, aunque todavía no haya llegado. Los que todavía no terminaron la respuesta o el relevamiento van aparte, como '
  + '«en curso».';

// Lo que se hace en cada etapa y cómo se mide, por gestión y por la clave de su tramo (las redactó el usuario: spec 2.4; las ventanas
// de 40 y 60 días son las de la regla, VENTANA_DE_LA_REGLA), y «Cómo se cuenta» (spec 2.3), sin su título («Cómo se cuenta.», que va
// en negrita): en el primer año con métricas (PRIMER_ANIO) termina diciendo que la comparación con el año anterior empieza el siguiente
export const TEXTOS_DEL_CICLO = Object.freeze({
  descripciones: Object.freeze({
    externa: Object.freeze({
      aviso: `El RPAD avisa a la DGMIT y a la Dirección Administrativa qué conjuntos de datos vencen en los próximos ${VENTANA_DE_LA_REGLA.externa} días y qué datos hay que pedir de cada uno, por Nota Digital (hasta el 12/10/2026, por email).`,
      tramite: 'La DGMIT y la Dirección Administrativa preparan la nota formal que le pide los datos al área y se la hacen llegar.',
      respuesta: 'El área reúne y prepara los datos pedidos y se los entrega a Datos Públicos.',
      carga: 'Los datos llegan en PDF, en papel o desordenados: Datos Públicos los transcribe, los ordena y los normaliza (que «Palazzo», «P. Palazzo» y «Próspero Palazzo» queden como un solo nombre) y los publica en el portal en formato abierto.'
    }),
    interna: Object.freeze({
      aviso: `El RPAD avisa a la DGMIT y a la Dirección de Investigación Territorial qué conjuntos de datos vencen en los próximos ${VENTANA_DE_LA_REGLA.interna} días y qué hay que relevar.`,
      produccion: 'La DGMIT y la Dirección de Investigación Territorial hacen el relevamiento y le entregan los datos a Datos Públicos.',
      carga: 'El relevamiento ya llega ordenado: Datos Públicos lo revisa para comprobar que cumpla con los estándares de datos abiertos (estructura, normalización y formatos) y lo publica en el portal en formato abierto.'
    })
  }),
  seMide: Object.freeze({
    externa: Object.freeze({
      aviso: SE_MIDE_EL_AVISO,
      tramite: 'Se mide del aviso del RPAD al día en que el área recibió la nota, con las notas DGMIT cargadas en el Seguimiento.',
      respuesta: 'Se mide del día en que el área recibió la nota al «Recibido el». Con datos de una fuente pública, no se cuenta.',
      carga: SE_MIDE_LA_CARGA
    }),
    interna: Object.freeze({ aviso: SE_MIDE_EL_AVISO, produccion: 'Se mide del aviso del RPAD al «Recibido el».', carga: SE_MIDE_LA_CARGA })
  }),
  comoSeCuenta: (anio) => (anio === PRIMER_ANIO
    ? `${COMO_SE_CUENTA} La comparación con el año anterior empieza en ${PRIMER_ANIO + 1}.` : COMO_SE_CUENTA)
});

const TITULO = 'Ciclo de vida del dato';
const TITULO_DE_COMO_SE_CUENTA = 'Cómo se cuenta.';
const TITULO_DE_LA_HOJA = Object.freeze({ externa: 'Gestión externa', interna: 'Gestión interna' });
const ROTULO_DEL_INDICE = 'EL CIRCUITO · MEDIANA EN DÍAS HÁBILES';
const ROTULO_DE_LAS_ESTADISTICAS = 'ESTADÍSTICAS DE LA ETAPA';

// =====================================================
// Letras, colores y medidas (spec 2.5; las medidas finas, las del PDF de prueba)
// =====================================================

const AMBAR = COLORES.ambar;
// El fondo suave de lo de la DGMIT (el del acento es COLOR.acentoSuave)
const VIOLETA_SUAVE = '#ECE8F5';
const OJO = ASCENDENTE + DESCENDENTE;

// Letras (en puntos): ninguna baja de 6,2
const LETRA = {
  rotulo: 6.6, sigla: 7.6, siglaMin: 6.4, indice: 10, indiceMin: 6.4, numero: 6.6, nombre: 9.6, nombreMin: 8.4, insignia: 6.6,
  desdeHasta: 6.2, descripcion: 7.2, descripcionMin: 6.4, rotuloMediana: 6.8, mediana: 24, medianaEnElDia: 16, medianaMin: 12,
  unidadMediana: 7.6, corridosMediana: 6.4, ciclos: 6.6, rotuloPromedio: 6.6, anterior: 6.4, promedio: 15, promedioEnElDia: 13,
  unidadPromedio: 7.4, corridosPromedio: 6.6, rotuloExtremo: 6.4, extremo: 12, unidadExtremo: 7, dataset: 6.2, nota: 6.6,
  vacioTitulo: 10.5, vacioTexto: 8, vacioPie: 7, hoja: 6.8
};

// Cada renglón de notas con su letra y su color (spec 2.2): el orientativo en ámbar, el en curso en ámbar y negrita, los pendientes en
// violeta (y negrita, como en Métricas), la aclaración y el año anterior en gris
const LETRA_DE_LA_NOTA = Object.freeze({
  orientativo: [NORMAL, AMBAR], en_curso: [NEGRITA, AMBAR], pendientes: [NEGRITA, VIOLETA], aclaracion: [NORMAL, COLOR.gris],
  anterior: [NORMAL, COLOR.gris]
});

// El circuito de arriba: el alto del recuadro, el relleno, dónde empiezan los nodos, su ancho y su alto, y el aire de debajo
const INDICE = { alto: 52, relleno: 9, nodos: 17, nodo: 56, altoNodo: 24, debajo: 6 };
// El largo de una flecha de la externa (cinco nodos, las más cortas): la mediana de cada flecha se ajusta a él en las dos hojas, así
// «En el día» va igual en la externa y en la interna
const ANCHO_DE_LA_FLECHA_EXTERNA = (CONTENIDO - 2 * INDICE.relleno - 5 * INDICE.nodo) / 4 - 8;
// El bloque de una etapa: el ancho de la columna izquierda, el relleno, el radio y la separación entre dos bloques
const BLOQUE = { izquierda: 205, relleno: 9, radio: 5, separacion: 6 };
// El tramo de la columna izquierda (desde arriba del bloque): los nodos, su ancho y su alto, y dónde empieza la descripción
const TRAMO = { arriba: 25, nodo: 56, altoNodo: 22, descripcion: 52, abajo: 7 };
// La columna derecha: el aire a los costados, dónde empieza el mosaico, el aire entre sus recuadros, el alto del promedio, el aire
// debajo de todo y sobre las notas, y el renglón de las notas
const DERECHA = { aire: 11, mosaico: 17, entre: 4, promedio: 26, abajo: 4.5, sobreNotas: 3, renglon: 8 };
// Un extremo: el aire de arriba, el de abajo, el del número y el de cada renglón chico
const EXTREMO = { arriba: 4, abajo: 3, sobreValor: 2.6, entre: 1.6 };
// Lo menos que mide un extremo (su rótulo, su número y un renglón chico) y el mosaico: las notas no le quitan más que eso
const EXTREMO_MINIMO = EXTREMO.arriba + OJO * LETRA.rotuloExtremo + EXTREMO.sobreValor + OJO * LETRA.extremo + EXTREMO.entre
  + OJO * LETRA.dataset + EXTREMO.abajo;
const MOSAICO_MINIMO = DERECHA.promedio + DERECHA.entre + EXTREMO_MINIMO;
// Entre las dos píldoras (la del período y la del aviso de la foto)
const ENTRE_PILDORAS = 4;

// =====================================================
// Ayudantes
// =====================================================

const anchoDe = (doc, valor, tamano, fuente = NORMAL) => doc.font(fuente).fontSize(tamano).widthOfString(valor);
// El paso entre dos renglones de una letra
const pasoDe = (doc, tamano) => doc.font(NORMAL).fontSize(tamano).currentLineHeight(true);
// Lo que ocupan `n` renglones de una letra, del borde superior del primero al inferior del último (como los mide el test de diagramación)
const altoDeRenglones = (doc, n, tamano, paso = pasoDe(doc, tamano)) => (n > 0 ? OJO * tamano + paso * (n - 1) : 0);
const renglonesDe = (doc, ajuste, paso = pasoDe(doc, ajuste.tamano)) => Math.max(1, Math.round(ajuste.alto / paso));

// Un texto en `lineas` renglones de `ancho`, con su borde superior en y: se achica hasta `min` y, si no entra, se corta con «…» (ajustar
// del anexo: lo que se escribe ya va cortado). Sin texto, nada. Devuelve el ajuste, o null
const linea = (doc, valor, x, y, { ancho, tamano, min = tamano, fuente = NORMAL, color = COLOR.tinta, align = 'left', espaciado = 0, lineas = 1 }) => {
  const t = texto(valor);
  if (!t || ancho <= 0) return null;
  const ajuste = ajustar(doc, t, { ancho, lineas, max: tamano, min, fuente, opciones: espaciado ? { characterSpacing: espaciado } : {} });
  escribir(doc, ajuste, x, y, color, align === 'left' ? {} : { align });
  return ajuste;
};

// Piezas en un mismo renglón, sobre la misma línea de base (el número grande y su unidad, y los corridos): cada una a continuación de
// la anterior; la que no entra se corta con «…» y las que siguen no van. Devuelve la y del borde inferior del renglón
const enLinea = (doc, piezas, x, y, ancho) => {
  const hay = piezas.filter((p) => texto(p.texto));
  if (hay.length === 0) return y;
  const grande = Math.max(...hay.map((p) => p.tamano));
  const base = y + ASCENDENTE * grande;
  let xPieza = x;
  for (const p of hay) {
    const resto = x + ancho - xPieza;
    if (resto < 2 * p.tamano) break;
    const ajuste = ajustar(doc, texto(p.texto), { ancho: resto, lineas: 1, max: p.tamano, min: p.tamano, fuente: p.fuente });
    escribir(doc, ajuste, xPieza, base - ASCENDENTE * p.tamano, p.color);
    xPieza += anchoDe(doc, ajuste.texto, p.tamano, p.fuente) + 3;
  }
  return y + OJO * grande;
};

// Un lugar vertical, de y0 a y1, que se va llenando desde arriba y desde abajo: arriba(alto, aire) y abajo(alto, aire) dan la y de algo
// de ese alto (o null si ya no entra), así nada se pisa aunque falte lugar
const lugar = (y0, y1) => {
  let tope = y0;
  let piso = y1;
  return {
    arriba: (alto, aire = 0) => {
      if (tope + aire + alto > piso + 0.01) return null;
      tope += aire + alto;
      return tope - alto;
    },
    abajo: (alto, aire = 0) => {
      if (piso - aire - alto < tope - 0.01) return null;
      piso -= aire + alto;
      return piso;
    },
    libre: () => piso - tope
  };
};

// Un párrafo con partes en distinta letra seguidas en los mismos renglones (la descripción en gris y cómo se mide en negrita; «Cómo se
// cuenta.» y su texto). Las palabras se acomodan acá, renglón por renglón, y cada tramo de una misma letra se escribe aparte con su x
// (con `continued`, PDFKit no dice dónde cae cada parte). `partes`: [{ texto, fuente, color }]. Va en la letra más grande, de `tamano` a
// `min` (de a 0,2), con la que todo entra en `alto`; si ni con `min` entra, el último renglón se corta con «…». { alto, dibujar(x, y) }
const prepararParrafo = (doc, partes, { ancho, tamano, min = tamano, interlineado = 0, alto = Infinity }) => {
  const palabras = partes.flatMap((p) => texto(p.texto).split(/\s+/).filter(Boolean).map((palabra) => ({ ...p, palabra })));
  const espacio = (p, letra) => anchoDe(doc, ' ', letra, p.fuente);
  const largo = (renglon, letra) => renglon.reduce((total, p, i) => total + (i ? espacio(renglon[i - 1], letra) : 0) + anchoDe(doc, p.palabra, letra, p.fuente), 0);
  // (un punto de tolerancia: el interletrado de PDFKit entre las palabras de un tramo)
  const acomodar = (letra) => palabras.reduce((renglones, p) => {
    const ultimo = renglones.at(-1);
    if (ultimo && largo([...ultimo, p], letra) <= ancho - 1) ultimo.push(p);
    else renglones.push([p]);
    return renglones;
  }, []);
  const paso = (letra) => pasoDe(doc, letra) + interlineado;
  let letra = tamano;
  let renglones = acomodar(letra);
  while (altoDeRenglones(doc, renglones.length, letra, paso(letra)) > alto + 0.01 && letra - 0.2 >= min - 1e-9) {
    letra = Math.round((letra - 0.2) * 10) / 10;
    renglones = acomodar(letra);
  }
  const entran = Math.max(1, Math.floor((alto - OJO * letra) / paso(letra) + 1e-6) + 1);
  if (renglones.length > entran) {
    renglones = renglones.slice(0, entran);
    const ultimo = renglones.at(-1);
    const cortar = (p) => ({ ...p, palabra: `${p.palabra.replace(/[\s.,;:–-]+$/u, '')}…` });
    ultimo.push(cortar(ultimo.pop()));
    while (ultimo.length > 1 && largo(ultimo, letra) > ancho - 1) {
      ultimo.pop();
      ultimo.push(cortar(ultimo.pop()));
    }
  }
  return {
    alto: altoDeRenglones(doc, renglones.length, letra, paso(letra)),
    dibujar: (x, y) => renglones.forEach((r, i) => {
      // Los tramos de una misma letra y un mismo color
      const tramos = r.reduce((lista, p) => {
        const ultimo = lista.at(-1);
        if (ultimo && ultimo.fuente === p.fuente && ultimo.color === p.color) ultimo.palabras.push(p.palabra);
        else lista.push({ fuente: p.fuente, color: p.color, palabras: [p.palabra] });
        return lista;
      }, []);
      let xTramo = x;
      for (const tramo of tramos) {
        const t = tramo.palabras.join(' ');
        const w = anchoDe(doc, t, letra, tramo.fuente);
        renglon(doc, t, xTramo, y + i * paso(letra), { ancho: w + 1, tamano: letra, fuente: tramo.fuente, color: tramo.color });
        xTramo += w + espacio(tramo, letra);
      }
    })
  };
};

// El nombre del dataset de un extremo: `dataset_texto`; si no entra en `lineas`, el título (sin el sufijo del empate, `mas_texto`) se
// corta con «…» y el sufijo va entero después («Castraciones de… y 14 más»)
const ajusteDelNombre = (doc, extremo, { ancho, lineas }) => {
  const completo = texto(extremo.dataset_texto);
  const sufijo = texto(extremo.mas_texto);
  const titulo = sufijo && completo.endsWith(sufijo) ? completo.slice(0, -sufijo.length) : completo;
  const opciones = { ancho, lineas, max: LETRA.dataset, min: LETRA.dataset };
  const entero = ajustar(doc, completo, opciones);
  if (!entero.cortado || !sufijo) return entero;
  return ajustar(doc, titulo, { ...opciones, corte: `…${sufijo}` });
};

// =====================================================
// Las piezas
// =====================================================

const colorDeLaEtapa = (etapa) => (etapa.dgmit === true ? VIOLETA : COLOR.tinta);
// Si la etapa tiene cifra (algún ciclo terminado en el año): la flecha va llena; si no, punteada y en gris
const conCifra = (etapa) => Number.isFinite(etapa.n) && etapa.n > 0;

// El número de una etapa en un círculo de 11 puntos, con su borde superior izquierdo en (x, y)
const dibujarNumero = (doc, valor, x, y, color) => {
  doc.circle(x + 5.5, y + 5.5, 5.5).fill(color);
  linea(doc, valor, x, y + 5.5 - (ASCENDENTE * LETRA.numero) / 2, { ancho: 11, tamano: LETRA.numero, fuente: NEGRITA, color: COLOR.blanco, align: 'center' });
};

// Un nodo del circuito: su sigla en su color (NODOS de Métricas: lo de la DGMIT en violeta y el Portal en verde), en un recuadro blanco
const dibujarNodo = (doc, clave, x, y, ancho, alto) => {
  const nodo = typeof clave === 'string' && Object.hasOwn(NODOS, clave) ? NODOS[clave] : null;
  const color = nodo?.color ?? COLOR.grisClaro;
  doc.save();
  contorno(doc, x, y, ancho, alto, 5).lineWidth(1).fillAndStroke(COLOR.blanco, color);
  doc.restore();
  if (nodo) linea(doc, nodo.nombre, x + 4, y + (alto - OJO * LETRA.sigla) / 2, { ancho: ancho - 8, tamano: LETRA.sigla, min: LETRA.siglaMin, fuente: NEGRITA, color });
};

// Una flecha de x0 a x1 (la punta en x1), llena o punteada
const dibujarFlecha = (doc, x0, x1, y, color, punteada) => {
  doc.save();
  doc.lineWidth(1.3).strokeColor(color);
  if (punteada) doc.dash(3, { space: 2.5 });
  doc.moveTo(x0, y).lineTo(x1 - 5, y).stroke();
  doc.restore();
  doc.polygon([x1 - 6, y - 3.3], [x1, y], [x1 - 6, y + 3.3]).fill(color);
};

// Los nodos de una gestión, en orden, con los de las etapas (la etapa k va del nodo k al k + 1)
const nodosDe = (etapas) => (etapas.length === 0 ? [] : [lista(etapas[0].nodos)[0], ...etapas.map((e) => lista(e.nodos)[1])]);

// El circuito entero, en chico (spec 2.1, 4), en un recuadro: los nodos con su sigla y, en cada flecha, el número de la etapa (violeta
// si es de la DGMIT) y su mediana en días hábiles (`textos.indice`: «27», «En el día» o «—»). Devuelve la y de lo que sigue
const dibujarIndice = (doc, etapas, y) => {
  doc.save();
  doc.lineWidth(0.8).strokeColor(COLOR.linea).roundedRect(IZQUIERDA, y, CONTENIDO, INDICE.alto, 5).stroke();
  doc.restore();
  const { relleno, nodo: anchoNodo, altoNodo } = INDICE;
  linea(doc, ROTULO_DEL_INDICE, IZQUIERDA + relleno, y + 8, { ancho: CONTENIDO - 2 * relleno, tamano: LETRA.rotulo, fuente: NEGRITA, color: COLOR.rotulo, espaciado: 0.6 });
  const nodos = nodosDe(etapas);
  const anchoFlecha = nodos.length > 1 ? (CONTENIDO - 2 * relleno - nodos.length * anchoNodo) / (nodos.length - 1) : 0;
  const yNodo = y + INDICE.nodos;
  let x = IZQUIERDA + relleno;
  nodos.forEach((clave, i) => {
    dibujarNodo(doc, clave, x, yNodo, anchoNodo, altoNodo);
    x += anchoNodo;
    const etapa = etapas[i];
    if (!etapa) return;
    const x0 = x + 4;
    const x1 = x + anchoFlecha - 4;
    const color = conCifra(etapa) ? colorDeLaEtapa(etapa) : COLOR.grisClaro;
    dibujarNumero(doc, texto(etapa.numero), x0, yNodo + 1, colorDeLaEtapa(etapa));
    const indice = ajustar(doc, texto(objeto(etapa.textos).indice), {
      ancho: Math.min(x1 - x0, ANCHO_DE_LA_FLECHA_EXTERNA) - 14, lineas: 1, max: LETRA.indice, min: LETRA.indiceMin, fuente: NEGRITA
    });
    if (indice.texto) escribir(doc, indice, x0 + 14, yNodo + 6.5 - (OJO * indice.tamano) / 2, conCifra(etapa) ? COLOR.tinta : COLOR.grisClaro);
    dibujarFlecha(doc, x0, x1, yNodo + 17, color, !conCifra(etapa));
    x += anchoFlecha;
  });
  return y + INDICE.alto + INDICE.debajo;
};

// La columna izquierda de un bloque (spec 2.2): el número, el nombre y la insignia del responsable; el tramo, del nodo de origen al de
// destino, con el «desde → hasta» debajo de la flecha; y la descripción seguida de cómo se mide (en negrita)
const dibujarIzquierda = (doc, etapa, gestion, x, y, alto) => {
  const dgmit = etapa.dgmit === true;
  const xi = x + BLOQUE.relleno;
  const fin = x + BLOQUE.izquierda - BLOQUE.relleno;
  dibujarNumero(doc, texto(etapa.numero), xi, y + 8, colorDeLaEtapa(etapa));
  // La insignia se mide primero: el nombre se achica (y si no, se corta) para que entren los dos antes de la línea del medio
  const responsable = texto(etapa.responsable);
  const anchoInsignia = responsable ? Math.min(80, anchoDe(doc, responsable, LETRA.insignia, NEGRITA) + 10) : 0;
  const xNombre = xi + 15;
  const nombre = linea(doc, etapa.nombre, xNombre, y + 13.5 - (OJO * LETRA.nombre) / 2, {
    ancho: x + BLOQUE.izquierda - 5 - xNombre - (anchoInsignia ? anchoInsignia + 5 : 0), tamano: LETRA.nombre, min: LETRA.nombreMin, fuente: NEGRITA
  });
  if (responsable) {
    const xInsignia = xNombre + (nombre ? anchoDe(doc, nombre.texto, nombre.tamano, NEGRITA) + 5 : 0);
    contorno(doc, xInsignia, y + 8, anchoInsignia, 11, 5.5).fill(dgmit ? VIOLETA_SUAVE : COLOR.acentoSuave);
    // (un punto más que el texto: medido justo, el redondeo lo cortaría)
    linea(doc, responsable, xInsignia + 5, y + 8 + (11 - OJO * LETRA.insignia) / 2, { ancho: anchoInsignia - 9, tamano: LETRA.insignia, fuente: NEGRITA, color: dgmit ? VIOLETA : COLOR.acento });
  }
  // El tramo: con el «desde → hasta» en dos renglones, la flecha va más arriba (los dos entran en el alto de los nodos)
  const [desde, hasta] = lista(etapa.nodos);
  const yTramo = y + TRAMO.arriba;
  dibujarNodo(doc, desde, xi, yTramo, TRAMO.nodo, TRAMO.altoNodo);
  dibujarNodo(doc, hasta, fin - TRAMO.nodo, yTramo, TRAMO.nodo, TRAMO.altoNodo);
  const x0 = xi + TRAMO.nodo + 4;
  const x1 = fin - TRAMO.nodo - 4;
  const desdeHasta = ajustar(doc, texto(etapa.desde_hasta), { ancho: x1 - x0, lineas: 2, max: LETRA.desdeHasta, min: LETRA.desdeHasta });
  const enDos = renglonesDe(doc, desdeHasta) > 1;
  dibujarFlecha(doc, x0, x1, yTramo + (enDos ? 4.5 : 7), conCifra(etapa) ? colorDeLaEtapa(etapa) : COLOR.grisClaro, !conCifra(etapa));
  if (desdeHasta.texto) escribir(doc, desdeHasta, x0, yTramo + (enDos ? 8.5 : 11.5), COLOR.gris, { align: 'center' });
  // Qué se hace y cómo se mide
  const clave = texto(etapa.clave);
  const deLaGestion = (textos) => (Object.hasOwn(textos[gestion], clave) ? textos[gestion][clave] : '');
  const yDescripcion = y + TRAMO.descripcion;
  prepararParrafo(doc, [
    { texto: deLaGestion(TEXTOS_DEL_CICLO.descripciones), fuente: NORMAL, color: COLOR.gris },
    { texto: deLaGestion(TEXTOS_DEL_CICLO.seMide), fuente: NEGRITA, color: COLOR.tinta }
  ], { ancho: fin - xi, tamano: LETRA.descripcion, min: LETRA.descripcionMin, interlineado: 0.6, alto: y + alto - TRAMO.abajo - yDescripcion })
    .dibujar(xi, yDescripcion);
};

// La mediana (spec 2.2), en la primera columna del mosaico y a todo su alto, con el fondo suave del color de la etapa: el rótulo, el
// número grande, la unidad y los corridos (lo que entre) y, abajo, «de 32 ciclos». «En el día» va sin unidad, en una letra más chica
const dibujarMediana = (doc, mediana, ciclos, x, y, ancho, alto, { fondo, color }) => {
  contorno(doc, x, y, ancho, alto, 5).fill(fondo);
  const xt = x + 7;
  const wt = ancho - 14;
  const sitio = lugar(y + 6, y + alto - 5);
  const yRotulo = sitio.arriba(OJO * LETRA.rotuloMediana);
  if (yRotulo !== null) linea(doc, 'Mediana', xt, yRotulo, { ancho: wt, tamano: LETRA.rotuloMediana, fuente: NEGRITA, color });
  const conUnidad = texto(mediana.unidad) !== '';
  const tamano = conUnidad ? LETRA.mediana : LETRA.medianaEnElDia;
  const yNumero = sitio.arriba(OJO * tamano, 0.7);
  if (yNumero !== null) linea(doc, mediana.numero, xt, yNumero, { ancho: wt, tamano, min: LETRA.medianaMin, fuente: NEGRITA, color });
  const yCiclos = ciclos ? sitio.abajo(OJO * LETRA.ciclos) : null;
  if (yCiclos !== null) linea(doc, ciclos, xt, yCiclos, { ancho: wt, tamano: LETRA.ciclos, fuente: NEGRITA });
  const yUnidad = conUnidad ? sitio.arriba(OJO * LETRA.unidadMediana, 0.8) : null;
  if (yUnidad !== null) linea(doc, mediana.unidad, xt, yUnidad, { ancho: wt, tamano: LETRA.unidadMediana, fuente: NEGRITA, color });
  const yCorridos = texto(mediana.corridos) ? sitio.arriba(OJO * LETRA.corridosMediana, 1.5) : null;
  if (yCorridos !== null) linea(doc, mediana.corridos, xt, yCorridos, { ancho: wt, tamano: LETRA.corridosMediana, color: COLOR.gris });
};

// El promedio (spec 2.2), arriba en las otras dos columnas, con el fondo gris: el rótulo y, a la derecha, el año anterior; debajo, el
// número, la unidad y «(41 días corridos)» en un renglón
const dibujarPromedio = (doc, promedio, anterior, x, y, ancho, alto) => {
  contorno(doc, x, y, ancho, alto, 5).fill(COLOR.fondo);
  const xt = x + 7;
  const wt = ancho - 14;
  const anchoRotulo = anchoDe(doc, 'Promedio', LETRA.rotuloPromedio, NEGRITA) + 1;
  linea(doc, 'Promedio', xt, y + 4.5, { ancho: anchoRotulo, tamano: LETRA.rotuloPromedio, fuente: NEGRITA, color: COLOR.gris });
  linea(doc, anterior, xt + anchoRotulo + 6, y + 4.7, { ancho: wt - anchoRotulo - 6, tamano: LETRA.anterior, color: COLOR.gris, align: 'right' });
  const conUnidad = texto(promedio.unidad) !== '';
  enLinea(doc, [
    { texto: promedio.numero, tamano: conUnidad ? LETRA.promedio : LETRA.promedioEnElDia, fuente: NEGRITA, color: COLOR.tinta },
    { texto: promedio.unidad, tamano: LETRA.unidadPromedio, fuente: NEGRITA, color: COLOR.tinta },
    { texto: promedio.corridos, tamano: LETRA.corridosPromedio, fuente: NORMAL, color: COLOR.gris }
  ], xt, y + 11.5, wt);
};

// Un extremo (spec 2.2), con un borde fino: el rótulo, el número con su unidad, los corridos y, abajo, el título del dataset en uno o
// dos renglones, según el alto que haya
const dibujarExtremo = (doc, extremo, x, y, ancho, alto) => {
  const e = objeto(extremo);
  doc.save();
  contorno(doc, x, y, ancho, alto, 5).lineWidth(0.8).stroke(COLOR.linea);
  doc.restore();
  const xt = x + 7;
  const wt = ancho - 14;
  const sitio = lugar(y + EXTREMO.arriba, y + alto - EXTREMO.abajo);
  const yRotulo = sitio.arriba(OJO * LETRA.rotuloExtremo);
  if (yRotulo !== null) linea(doc, e.rotulo, xt, yRotulo, { ancho: wt, tamano: LETRA.rotuloExtremo, fuente: NEGRITA, color: COLOR.gris });
  const yValor = sitio.arriba(OJO * LETRA.extremo, EXTREMO.sobreValor);
  if (yValor === null) return;
  enLinea(doc, [
    { texto: e.numero, tamano: LETRA.extremo, fuente: NEGRITA, color: COLOR.tinta },
    { texto: e.unidad, tamano: LETRA.unidadExtremo, fuente: NEGRITA, color: COLOR.tinta }
  ], xt, yValor, wt);
  // Debajo, los corridos y el dataset (en dos renglones si hay lugar); si no entran los dos, el dataset solo
  const renglones = (n) => EXTREMO.entre + altoDeRenglones(doc, n, LETRA.dataset);
  const corridos = texto(e.corridos_texto);
  if (corridos && sitio.libre() >= 2 * renglones(1) - 0.01) {
    linea(doc, corridos, xt, sitio.arriba(renglones(1) - EXTREMO.entre, EXTREMO.entre), { ancho: wt, tamano: LETRA.dataset, color: COLOR.gris });
  }
  if (!texto(e.dataset_texto) || sitio.libre() < renglones(1) - 0.01) return;
  const ajuste = ajusteDelNombre(doc, e, { ancho: wt, lineas: sitio.libre() >= renglones(2) - 0.01 ? 2 : 1 });
  escribir(doc, ajuste, xt, sitio.abajo(renglones(renglonesDe(doc, ajuste)) - EXTREMO.entre, EXTREMO.entre), COLOR.gris);
};

// El mosaico de tres columnas (spec 2.2): la mediana a todo el alto en la primera; el promedio arriba en las otras dos y, debajo, los
// dos extremos, uno en cada columna (con un solo ciclo, «El único caso», a lo ancho)
const dibujarMosaico = (doc, etapa, x, y, ancho, alto) => {
  const t = objeto(etapa.textos);
  const dgmit = etapa.dgmit === true;
  const { entre } = DERECHA;
  const columna = ((ancho - 2 * entre) * 0.95) / 2.95;
  const mitad = (ancho - 2 * entre - columna) / 2;
  dibujarMediana(doc, objeto(t.mediana), texto(t.ciclos), x, y, columna, alto,
    { fondo: dgmit ? VIOLETA_SUAVE : COLOR.acentoSuave, color: dgmit ? VIOLETA : COLOR.acento });
  const xResto = x + columna + entre;
  const anchoResto = ancho - columna - entre;
  dibujarPromedio(doc, objeto(t.promedio), texto(t.anterior), xResto, y, anchoResto, DERECHA.promedio);
  const yExtremos = y + DERECHA.promedio + entre;
  const altoExtremos = alto - DERECHA.promedio - entre;
  if (esObjeto(etapa.corto)) {
    dibujarExtremo(doc, etapa.largo, xResto, yExtremos, mitad, altoExtremos);
    dibujarExtremo(doc, etapa.corto, xResto + mitad + entre, yExtremos, mitad, altoExtremos);
  } else {
    dibujarExtremo(doc, etapa.largo, xResto, yExtremos, anchoResto, altoExtremos);
  }
};

// Los renglones chicos de abajo, en `ancho`, cada uno en su letra y su color y en hasta `lineas` renglones (las notas, en dos; el año
// anterior, en uno). Si no entran en `maximo`, las de dos renglones pasan a uno (de la última a la primera) y, si aun así no entran,
// las de más abajo no van. `renglones`: [{ tipo, texto, lineas }]. { alto, dibujar(x, y) }
const prepararNotas = (doc, renglones, ancho, maximo) => {
  const paso = DERECHA.renglon;
  const conLineas = (r, lineas) => {
    const [fuente, color] = LETRA_DE_LA_NOTA[r.tipo] ?? LETRA_DE_LA_NOTA.aclaracion;
    const lineGap = paso - pasoDe(doc, LETRA.nota);
    return { r, color, ajuste: ajustar(doc, texto(r.texto), { ancho, lineas, max: LETRA.nota, min: LETRA.nota, fuente, opciones: { lineGap } }) };
  };
  const lineasDe = (lista2) => lista2.reduce((total, p) => total + renglonesDe(doc, p.ajuste, paso), 0);
  const altoDe = (lista2) => altoDeRenglones(doc, lineasDe(lista2), LETRA.nota, paso);
  const preparadas = renglones.filter((r) => texto(r.texto)).map((r) => conLineas(r, r.lineas));
  for (let i = preparadas.length - 1; i >= 0 && altoDe(preparadas) > maximo + 0.01; i -= 1) {
    if (renglonesDe(doc, preparadas[i].ajuste, paso) > 1) preparadas[i] = conLineas(preparadas[i].r, 1);
  }
  while (preparadas.length > 0 && altoDe(preparadas) > maximo + 0.01) preparadas.pop();
  return {
    alto: altoDe(preparadas),
    dibujar: (x, y) => preparadas.reduce((yNota, p) => {
      escribir(doc, p.ajuste, x, yNota, p.color);
      return yNota + renglonesDe(doc, p.ajuste, paso) * paso;
    }, y)
  };
};

// El vacío de una etapa sin ciclos (spec 1.4 y 2.2), centrado en su lugar: el título grande en gris claro, su texto (en violeta en lo
// de la DGMIT) y el renglón de debajo; si falta lugar, primero en un renglón cada uno y después sin el de debajo
const dibujarVacio = (doc, vacio, dgmit, x, y, ancho, alto) => {
  const piezas = (lineas) => [
    [vacio.titulo, LETRA.vacioTitulo, NEGRITA, COLOR.grisClaro, 1, 0],
    [vacio.texto, LETRA.vacioTexto, NEGRITA, dgmit ? VIOLETA : COLOR.gris, lineas, 4],
    [vacio.pie, LETRA.vacioPie, NORMAL, COLOR.gris, lineas, 3]
  ].filter(([valor]) => texto(valor)).map(([valor, tamano, fuente, color, n, aire]) => {
    const ajuste = ajustar(doc, texto(valor), { ancho, lineas: n, max: tamano, min: tamano, fuente });
    return { ajuste, color, aire, alto: altoDeRenglones(doc, renglonesDe(doc, ajuste), tamano) };
  });
  const altoDe = (lista2) => lista2.reduce((total, p, i) => total + p.alto + (i ? p.aire : 0), 0);
  let elegidas = piezas(2);
  if (altoDe(elegidas) > alto) elegidas = piezas(1);
  while (elegidas.length > 0 && altoDe(elegidas) > alto + 0.01) elegidas.pop();
  let yPieza = y + (alto - altoDe(elegidas)) / 2;
  elegidas.forEach((p, i) => {
    yPieza += i ? p.aire : 0;
    escribir(doc, p.ajuste, x, yPieza, p.color);
    yPieza += p.alto;
  });
};

// La columna derecha de un bloque: «Estadísticas de la etapa», el mosaico (o el vacío) y, abajo, los renglones de notas; en un bloque
// vacío, también «Año anterior: …» (con cifras, va en el promedio). Las notas no le quitan al mosaico más que su mínimo
const dibujarDerecha = (doc, etapa, x, y, ancho, alto) => {
  linea(doc, ROTULO_DE_LAS_ESTADISTICAS, x, y + 7, { ancho, tamano: LETRA.rotulo, fuente: NEGRITA, color: COLOR.rotulo, espaciado: 0.6 });
  const t = objeto(etapa.textos);
  const notas = lista(t.notas).filter(esObjeto).map((n) => ({ tipo: n.tipo, texto: n.texto, lineas: 2 }));
  const yArriba = y + DERECHA.mosaico;
  const fondo = y + alto - DERECHA.abajo;
  const conMosaico = conCifra(etapa) && esObjeto(etapa.largo);
  const renglones = conMosaico ? notas : [...notas, { tipo: 'anterior', texto: t.anterior, lineas: 1 }];
  const minimo = conMosaico ? MOSAICO_MINIMO : OJO * LETRA.vacioTitulo;
  const abajo = prepararNotas(doc, renglones, ancho, fondo - yArriba - minimo - DERECHA.sobreNotas);
  const finArriba = abajo.alto > 0 ? fondo - abajo.alto - DERECHA.sobreNotas : fondo;
  if (conMosaico) dibujarMosaico(doc, etapa, x, yArriba, ancho, finArriba - yArriba);
  else dibujarVacio(doc, objeto(etapa.vacio), etapa.dgmit === true, x, yArriba, ancho, finArriba - yArriba);
  abajo.dibujar(x, fondo - abajo.alto);
};

// El bloque de una etapa (spec 2.2): un recuadro con un borde fino, partido en dos columnas
const dibujarBloque = (doc, etapa, gestion, y, alto) => {
  const x = IZQUIERDA;
  doc.save();
  doc.lineWidth(0.8).strokeColor(COLOR.linea).roundedRect(x, y, CONTENIDO, alto, BLOQUE.radio).stroke();
  doc.restore();
  doc.rect(x + BLOQUE.izquierda, y + 0.4, 0.8, alto - 0.8).fill(COLOR.linea);
  dibujarIzquierda(doc, etapa, gestion, x, y, alto);
  dibujarDerecha(doc, etapa, x + BLOQUE.izquierda + DERECHA.aire, y, CONTENIDO - BLOQUE.izquierda - 2 * DERECHA.aire, alto);
};

// =====================================================
// El PDF
// =====================================================

// Una hoja (spec 2.1): el encabezado, el título, las píldoras y el circuito arriba; abajo, la aclaración de la hoja y «Cómo se cuenta»; y
// los bloques se reparten todo el alto que queda entre los dos
const dibujarHoja = (doc, gestion, { etapas, aclaracion, rotulo, pildora, aviso, comoSeCuenta, hoy }) => {
  let y = agregarHoja(doc, { derecha: TITULO, fecha: hoy });
  y = prepararTitulo(doc, { rotulo, titulo: TITULO_DE_LA_HOJA[gestion] }).dibujar(y);
  y = prepararPildora(doc, pildora).dibujar(y);
  if (aviso) y = prepararPildora(doc, aviso, { tono: 'sol' }).dibujar(y - ENTRE + ENTRE_PILDORAS);
  y = dibujarIndice(doc, etapas, y);

  const como = prepararParrafo(doc, [
    { texto: TITULO_DE_COMO_SE_CUENTA, fuente: NEGRITA, color: COLOR.tinta }, { texto: comoSeCuenta, fuente: NORMAL, color: COLOR.gris }
  ], { ancho: CONTENIDO - 16, tamano: LETRA.hoja, interlineado: 0.8 });
  const altoComo = como.alto + 12;
  const yComo = LIMITE - altoComo;
  const ajusteAclaracion = aclaracion ? ajustar(doc, aclaracion, { ancho: CONTENIDO, lineas: 2, max: LETRA.hoja, min: LETRA.hoja }) : null;
  const altoAclaracion = ajusteAclaracion ? altoDeRenglones(doc, renglonesDe(doc, ajusteAclaracion), LETRA.hoja) + 6 : 0;
  const fin = yComo - altoAclaracion - BLOQUE.separacion;
  const altoBloque = (fin - y - BLOQUE.separacion * (etapas.length - 1)) / Math.max(1, etapas.length);
  etapas.forEach((etapa, i) => dibujarBloque(doc, etapa, gestion, y + i * (altoBloque + BLOQUE.separacion), altoBloque));
  if (ajusteAclaracion) escribir(doc, ajusteAclaracion, IZQUIERDA, fin + BLOQUE.separacion, COLOR.gris);
  doc.roundedRect(IZQUIERDA, yComo, CONTENIDO, altoComo, 5).fill(COLOR.fondo);
  como.dibujar(IZQUIERDA + 8, yComo + 6);
};

// El PDF «Ciclo de vida del dato». `datos`: lo de cicloDeVidaDe ({ anio, al, en_vivo, aviso_foto, etapas: { anio, al, externa: Etapa[4],
// interna: Etapa[3], aclaracion_de_la_hoja: { externa, interna } } }, con `textos.anterior` en cada etapa); `hoy`: 'AAAA-MM-DD' (la fecha
// larga del encabezado); `generado`: { momento: 'AAAA-MM-DD HH:MM:SS' (hora argentina), por: nombre corto o null } (el pie). Con datos
// raros no tira: dibuja lo que se puede leer, siempre en dos hojas.
export const renderCicloDeVida = async (datos, { hoy, generado }) => {
  const d = objeto(datos);
  const etapas = objeto(d.etapas);
  const anio = [d.anio, etapas.anio].find((valor) => Number.isInteger(valor)) ?? null;
  const al = [d.al, etapas.al].find((valor) => esFechaIso(valor)) ?? null;
  const enCurso = anio !== null && al !== null && al < `${anio}-12-31`;
  const comun = {
    rotulo: [TITULO, anio === null ? '' : `${anio}${enCurso ? ', en curso' : ''}`].filter(Boolean).join(' · '),
    pildora: `Del ${anio === null ? '—' : fechaCorta(`${anio}-01-01`)} al ${fechaCorta(al)}, con todos los ciclos`,
    aviso: texto(d.aviso_foto),
    comoSeCuenta: TEXTOS_DEL_CICLO.comoSeCuenta(anio),
    hoy
  };
  const doc = nuevoReporte({ titulo: [TITULO, anio === null ? '' : String(anio)].filter(Boolean).join(' ') });
  for (const gestion of ['externa', 'interna']) {
    dibujarHoja(doc, gestion, {
      ...comun, etapas: lista(etapas[gestion]).filter(esObjeto), aclaracion: texto(objeto(etapas.aclaracion_de_la_hoja)[gestion])
    });
  }
  return cerrarReporte(doc, {
    generado, pieDe: (k, n) => [TITULO, anio === null ? '' : String(anio), `Hoja ${k} de ${n}`].filter(Boolean).join(' · ')
  });
};
