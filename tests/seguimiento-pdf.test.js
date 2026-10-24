// PDF del Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset-design, "El PDF"): una sola hoja A4 con el lenguaje del
// ANEXO, que dibuja lo que calcula seguimientoDe. Puro: los casos reales de tests/seguimiento-casos.js, sin base de datos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seguimientoDe } from '../services/seguimientoReglas.js';
import { renderSeguimiento, renderAnexoDeSeguimiento, FILAS_PDF, OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { DocumentoNota } from '../services/notasDigitalesPdf.js';
import { lineasPorHoja, contenidoPorHoja, textosPorHoja, tamanosPorHoja } from './pdf-lector.js';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';

const MM = 72 / 25.4;
// El Seguimiento y el anexo de la reiteración siguen en A4 (595,28 × 841,89 puntos) aunque la nota pase a la hoja oficio
const A4 = { ancho: 595.28, alto: 841.89 };
const enA4 = (tamano) => Math.abs(tamano.ancho - A4.ancho) < 0.01 && Math.abs(tamano.alto - A4.alto) < 0.01;
// Las opciones de la cinta del PDF: marcas a menos de 12 se juntan y las letras miden 8,4 (las mismas del anexo y de la descarga)
const OPCIONES_CINTA = OPCIONES_CINTA_PDF;
const GENERADO = { momento: '2026-10-20 11:30:05', por: 'Usuario Uno' };
// El Seguimiento de un caso real; `dataset` cambia campos del dataset antes de calcularlo
const seguimiento = (id, dataset = {}) => seguimientoDe(
  { ...CASOS[id], dataset: { ...CASOS[id].dataset, ...dataset }, catalogos: CATALOGOS }, HOY, OPCIONES_CINTA
);
const render = (s, generado = GENERADO) => renderSeguimiento(s, { hoy: HOY, generado });
// Cantidad de rectángulos dibujados en una hoja: el QR se dibuja con decenas de ellos
const rectangulos = (contenido) => (contenido.match(/ re\b/g) ?? []).length;
const NEUTRO = /sin entregar|sin respuesta|atrasad/i;

// Review Focus 3: título de 250 caracteres y área de 200 (también el "Depende de" largo)
const TITULO_LARGO = 'Título larguísimo de un conjunto de datos de prueba '.repeat(6).slice(0, 250);
const AREA_LARGA = 'Dirección General de un área con un nombre larguísimo de prueba '.repeat(4).slice(0, 200);
const largo = () => seguimiento(52, { titulo: TITULO_LARGO, area: AREA_LARGA, area_superior: AREA_LARGA });

// Diagramación de la hoja, tomada de las llamadas a DocumentoNota mientras se dibuja (copiada de notas-anexo.test.js, con
// `render`, una función async que dibuja, en lugar de los datos del anexo):
// - textos: el rectángulo de cada texto, con la fuente, el tamaño y las opciones vigentes. El alto es el del ojo de
//   la letra (de la línea de ascendentes a la de descendentes), sin el interlineado de la última línea. Cada uno lleva
//   también el nombre de su fuente y su tamaño.
// - bloques: los rectángulos redondeados (tarjeta del QR, nodos del circuito, línea del email al área).
// - lineas: las líneas finas (rectángulos de hasta 1 punto de alto y 50 o más de ancho: encabezado, ficha, tabla, pie).
// - acentos: filetes verticales del acento en el borde izquierdo (el Seguimiento no tiene).
// Cada uno: { hoja, texto, x0, y0, x1, y1 }, con y desde el borde superior.
const diagramacion = async (render) => {
  const textos = [];
  const bloques = [];
  const lineas = [];
  const acentos = [];
  const hojas = [];
  const indice = (hoja) => {
    if (!hojas.includes(hoja)) hojas.push(hoja);
    return hojas.indexOf(hoja);
  };
  const original = DocumentoNota.prototype.text;
  // rect y roundedRect son de PDFKit (DocumentoNota no los redefine): se tapan en DocumentoNota y después se quitan
  const { rect, roundedRect } = DocumentoNota.prototype;
  DocumentoNota.prototype.roundedRect = function (x, y, ancho, alto, radio) {
    bloques.push({ hoja: indice(this.page), texto: `bloque ${bloques.length}`, x0: x, y0: y, x1: x + ancho, y1: y + alto });
    return roundedRect.call(this, x, y, ancho, alto, radio);
  };
  DocumentoNota.prototype.rect = function (x, y, ancho, alto) {
    if (alto <= 1 && ancho >= 50) lineas.push({ hoja: indice(this.page), texto: `línea ${lineas.length}`, x0: x, y0: y, x1: x + ancho, y1: y + alto });
    // Filete vertical del acento, en el borde izquierdo del recuadro destacado
    if (ancho <= 5 && alto >= 20 && Math.abs(x - 15 * MM) < 0.1) acentos.push({ hoja: indice(this.page), texto: 'acento', x0: x, y0: y, x1: x + ancho, y1: y + alto });
    return rect.call(this, x, y, ancho, alto);
  };
  DocumentoNota.prototype.text = function (texto, x, y, opciones = {}) {
    const conInterlineado = this.currentLineHeight(true) + (opciones.lineGap ?? 0);
    let lineas = 1;
    let ancho = this.widthOfString(String(texto), opciones);
    let x0 = x;
    if (opciones.width) {
      lineas = Math.round(this.heightOfString(String(texto), opciones) / conInterlineado);
      // Con alto máximo, PDFKit escribe las líneas que entran (al menos una)
      if (opciones.height != null) lineas = Math.min(lineas, Math.max(1, Math.floor(opciones.height / conInterlineado + 1e-6)));
      if (lineas > 1) ancho = opciones.width;
      else if (opciones.align === 'right') x0 = x + opciones.width - ancho;
      else if (opciones.align === 'center') x0 = x + (opciones.width - ancho) / 2;
    }
    textos.push({
      hoja: indice(this.page), texto: String(texto), fuente: this._font.name, tamano: this._fontSize, x0, y0: y, x1: x0 + ancho,
      y1: y + (lineas - 1) * conInterlineado + this.currentLineHeight(false)
    });
    return original.call(this, texto, x, y, opciones);
  };
  try {
    await render();
  } finally {
    DocumentoNota.prototype.text = original;
    delete DocumentoNota.prototype.roundedRect;
    delete DocumentoNota.prototype.rect;
  }
  return { textos, bloques, lineas, acentos };
};

const seCruzan = (a, b) => a.x0 < b.x1 - 0.1 && b.x0 < a.x1 - 0.1 && a.y0 < b.y1 - 0.1 && b.y0 < a.y1 - 0.1;
const contiene = (a, b) => b.x0 >= a.x0 - 0.01 && b.x1 <= a.x1 + 0.01 && b.y0 >= a.y0 - 0.01 && b.y1 <= a.y1 + 0.01;
const nombre = (c) => `"${c.texto.slice(0, 40)}" (${[c.x0, c.y0, c.x1, c.y1].map(v => v.toFixed(1)).join(', ')})`;

// Textos, bloques y líneas dentro de los márgenes de 15 mm; ningún texto encima de otro ni bloques encimados; cada
// texto, dentro de un bloque o fuera de él (ninguno cruza un borde); y ninguna línea fina cruza un texto o un bloque
const verificarDiagramacion = ({ textos, bloques, lineas }) => {
  for (const c of [...textos, ...bloques, ...lineas]) {
    assert.ok(c.x0 >= 15 * MM - 0.01 && c.x1 <= 195 * MM + 0.01, `${nombre(c)} sale de los márgenes laterales`);
    assert.ok(c.y0 >= 15 * MM - 0.01 && c.y1 <= 282 * MM + 0.01, `${nombre(c)} sale de los márgenes superior o inferior`);
  }
  const deLaMismaHoja = (lista, otra = lista) => lista.flatMap((a, i) => otra.slice(otra === lista ? i + 1 : 0)
    .filter(b => a.hoja === b.hoja).map(b => [a, b]));
  for (const [a, b] of deLaMismaHoja(textos)) assert.ok(!seCruzan(a, b), `se superponen ${nombre(a)} y ${nombre(b)}`);
  for (const [a, b] of deLaMismaHoja(bloques)) assert.ok(!seCruzan(a, b), `se superponen ${nombre(a)} y ${nombre(b)}`);
  for (const [bloque, texto] of deLaMismaHoja(bloques, textos)) {
    assert.ok(contiene(bloque, texto) || !seCruzan(bloque, texto), `${nombre(texto)} cruza el borde de ${nombre(bloque)}`);
  }
  for (const [linea, otro] of deLaMismaHoja(lineas, [...textos, ...bloques])) assert.ok(!seCruzan(linea, otro), `${nombre(linea)} cruza ${nombre(otro)}`);
};

describe('renderSeguimiento: una sola hoja, sin nada encimado', () => {
  it('FILAS_PDF es 8', () => {
    assert.equal(FILAS_PDF, 8);
  });

  it('renderSeguimiento: la hoja es A4 (595,28 × 841,89), no la hoja oficio de la nota', async () => {
    const tamanos = tamanosPorHoja(await render(seguimiento(52)));
    assert.equal(tamanos.length, 1);
    assert.ok(enA4(tamanos[0]), JSON.stringify(tamanos));
  });

  // Los casos de la spec (52, 10, 81 y 66), el resto de los casos reales y el 52 con título y área larguísimos (Review Focus 3)
  const casos = [
    ...[52, 10, 81, 66].map(id => [`caso ${id}`, () => seguimiento(id)]),
    ...Object.keys(CASOS).map(Number).filter(id => ![52, 10, 81, 66].includes(id)).map(id => [`caso ${id}`, () => seguimiento(id)]),
    ['52 con título de 250 caracteres y área de 200', largo],
    ['52 dado de baja', () => seguimiento(52, { activo: false })],
    ['52 sin link al portal', () => ({ ...seguimiento(52), ficha: { ...seguimiento(52).ficha, url_dataset: null } })]
  ];
  for (const [titulo, armar] of casos) {
    it(`${titulo}: una hoja A4 y nada sale de los márgenes ni se superpone`, async () => {
      const s = armar();
      const pdf = await render(s);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.equal(lineasPorHoja(pdf).length, 1);
      verificarDiagramacion(await diagramacion(() => render(s)));
    });
  }

  it('el título larguísimo va en dos líneas cortado con "…"; el área, en su nodo, también se corta', async () => {
    const { textos } = await diagramacion(() => render(largo()));
    const titulo = textos.find(t => t.texto.startsWith('Título larguísimo'));
    assert.ok(titulo && titulo.texto.endsWith('…'), titulo?.texto);
    assert.equal(titulo.tamano, 20);
    assert.ok(textos.some(t => t.texto.startsWith('Dirección General de un área') && t.texto.endsWith('…')), 'el área no se cortó');
  });
});

describe('renderSeguimiento: los textos del 52', () => {
  it('lleva los avisos, el vencido, el vencimiento, los movimientos anteriores y el pie', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(52)))[0];
    for (const t of ['6 avisos', 'Vencido hace 81 días', 'Desde la actualización del 04/02/2026 · Vencimiento del 31/07/2026',
      'Hay 8 movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).',
      'Seguimiento del dataset · Hoja 1 de 1']) {
      assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
  });

  it('el encabezado de los avisos dice desde cuándo se cuentan, entero (58, y 42, el más largo: una reprogramación)', async () => {
    const del58 = lineasPorHoja(await render(seguimiento(58)))[0];
    assert.ok(del58.includes('Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026'), del58.join(' | '));
    assert.ok(del58.includes('1 aviso'), del58.join(' | '));
    const del42 = lineasPorHoja(await render(seguimiento(42)))[0];
    assert.ok(del42.includes('Desde la reprogramación del 06/04/2026 · Vencimiento del 30/04/2027'), del42.join(' | '));
  });

  it('lenguaje neutro: ni "sin entregar", ni "sin respuesta", ni "atrasado" (en ninguno de los casos)', async () => {
    for (const id of Object.keys(CASOS)) {
      const lineas = lineasPorHoja(await render(seguimiento(id)))[0];
      assert.deepEqual(lineas.filter(l => NEUTRO.test(l)), [], `caso ${id}`);
    }
  });

  it('la tabla de movimientos tiene 8 renglones: 8 fechas debajo del rótulo', async () => {
    const textos = textosPorHoja(await render(seguimiento(52)))[0];
    const rotulo = textos.find(t => t.texto === 'ÚLTIMOS MOVIMIENTOS');
    assert.ok(rotulo, textos.map(t => t.texto).join(' | '));
    const fechas = textos.filter(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t.texto) && t.base < rotulo.base);
    assert.equal(fechas.length, 8);
    // Los 8 más nuevos, del más nuevo al más viejo
    assert.deepEqual(fechas.map(t => t.texto), seguimiento(52).movimientos.slice(0, 8).map(m => `${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)}/${m.fecha.slice(0, 4)}`));
  });

  it('de arriba abajo: encabezado, etiqueta, título, ficha, circuito, email al área, cinta, movimientos, aclaración y pie', async () => {
    const textos = textosPorHoja(await render(seguimiento(52)))[0];
    const buscar = (buscado) => {
      const encontrado = textos.find(t => t.texto === buscado);
      assert.ok(encontrado, `falta "${buscado}" en ${textos.map(t => t.texto).join(' | ')}`);
      return encontrado.base;
    };
    // base: altura de la línea de base desde el borde inferior; cuanto más abajo en la hoja, menor
    const orden = ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'CONJUNTO DE DATOS · GESTIÓN EXTERNA',
      'Directores Generales de Planta Permanente', 'ÁREA RESPONSABLE', 'VENCIÓ EL', 'DATOS QUE SE PIDEN', 'LINK AL PORTAL',
      'AVISOS DEL CICLO ABIERTO', '6 avisos', 'Al área: el 21/06/2026 el RPAD le anticipó por email que iba a recibir una nota formal.',
      'LOS ÚLTIMOS 12 MESES', 'vence 31/07', 'ÚLTIMOS MOVIMIENTOS', 'FECHA', 'Nota Digital N° 2/26 a DGMIT',
      'Hay 8 movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).',
      'Los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026.',
      'Generado el 20/10/2026 a las 11:30 por Usuario Uno'].map(buscar);
    orden.slice(1).forEach((valor, i) => assert.ok(valor < orden[i], `fuera de orden en la posición ${i + 1}: ${orden.join(', ')}`));
  });

  it('la ficha: "Venció el" en rojo con los días, el pedido y el link; el encabezado lleva la fecha larga', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(52)))[0];
    for (const t of ['Seguimiento del dataset', '20 de octubre de 2026', 'Dirección General de Relaciones Laborales', 'Cada medio año',
      '31/07/2026, hace 81 días', '31/12/2025', '04/02/2026', 'Vigente al 30/06/2026',
      'https://datos.comodoro.gov.ar/dataset/directores-generales-de-planta-permanente', 'Abrir en el portal', 'Seguimiento del dataset · Hoja 1 de 1']) {
      assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
    // Cada valor va en una línea: un "Depende de" largo se corta con "…"
    assert.ok(lineas.some(l => l.startsWith('Subsec. de Recursos Humanos.') && l.endsWith('…')), lineas.join(' | '));
    // "Venció el" en negrita y en #9B3B36 (0.608 0.231 0.212 en el PDF)
    const { textos } = await diagramacion(() => render(seguimiento(52)));
    assert.equal(textos.find(t => t.texto === '31/07/2026, hace 81 días').fuente, 'Helvetica-Bold');
    assert.match(contenidoPorHoja(await render(seguimiento(52)))[0], /0\.60784\d* 0\.23137\d* 0\.21176\d* (rg|scn)/);
  });

  it('el circuito de gestión externa y la leyenda solo con los tipos que aparecen', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(52)))[0];
    for (const t of ['RPAD', '5 emails y la Nota Digital N° 2/26', 'Mandan la nota formal al área', 'Nota formal', 'Vencido hace 81 días',
      'Nota 2/26', 'De noviembre de 2025 a octubre de 2026', 'Nota Digital a DGMIT', 'Email a DGMIT', 'Email al área', 'Actualización',
      'Propuesta rechazada', 'Alta', 'Vencido']) {
      assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
    // Los textos de los nodos y del tramo de afuera van en dos líneas
    for (const t of ['DGMIT y Dirección Administrativa', 'Pendiente de carga', 'Dirección General de Relaciones Laborales']) {
      assert.ok(lineas.join(' ').includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
    // En el 52 no hay cambios en la ficha ni pendientes
    for (const t of ['Cambio en la ficha', 'Cambio pendiente', 'Actualización pendiente']) assert.ok(!lineas.includes(t), `sobra "${t}"`);
  });
});

describe('renderSeguimiento: los otros casos', () => {
  it('81: dos movimientos y "No hay movimientos anteriores" con el día del alta', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(81)))[0];
    assert.ok(lineas.includes('No hay movimientos anteriores: el dataset está en el RPAD desde el 19/10/2026.'), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.startsWith('Hay ')), lineas.join(' | '));
    assert.ok(lineas.includes('Los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026.'));
    // El título de dos líneas, entero
    assert.ok(lineas.includes('Cantidad de empleados municipales (planta'), lineas.join(' | '));
    assert.ok(lineas.includes('permanente y transitoria)'), lineas.join(' | '));
  });

  it('gestión interna (38): el nodo del medio y el relevamiento, sin la línea del email al área', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(38)))[0];
    assert.ok(lineas.includes('CONJUNTO DE DATOS · GESTIÓN INTERNA'), lineas.join(' | '));
    assert.ok(lineas.includes('Relevamiento'), lineas.join(' | '));
    assert.ok(lineas.includes('Hacen el relevamiento'), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.startsWith('Al área')), lineas.join(' | '));
  });

  it('eventual de gestión interna (66): sin vencimiento y sin la línea del email al área', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(66)))[0];
    assert.ok(lineas.includes('PRÓXIMO VENCIMIENTO'), lineas.join(' | '));
    assert.ok(lineas.includes('Sin vencimiento (eventual)'), lineas.join(' | '));
    assert.ok(lineas.includes('Sin pedido (eventual)'), lineas.join(' | '));
    assert.ok(lineas.includes('Frecuencia eventual: sin vencimiento'), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.startsWith('Al área')), lineas.join(' | '));
  });

  it('eventual de gestión externa: sin la línea del email al área (no hay ciclo)', async () => {
    const s = seguimiento(66, { tipo_gestion: 'externa' });
    assert.equal(s.circuito.vencimiento, null);
    const lineas = lineasPorHoja(await render(s))[0];
    assert.ok(lineas.includes('CONJUNTO DE DATOS · GESTIÓN EXTERNA'), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.startsWith('Al área')), lineas.join(' | '));
  });

  it('dado de baja: la ficha lo dice, con el día de la baja si quedó registrada', async () => {
    // Sin el cambio de la baja (una baja por SQL): sin día
    const sinDia = lineasPorHoja(await render(seguimiento(52, { activo: false })))[0];
    assert.ok(sinDia.includes('DADO DE BAJA'), sinDia.join(' | '));
    assert.ok(sinDia.includes('Dado de baja'), sinDia.join(' | '));
    // Con la baja aprobada
    const baja = { id: 99, tipo: 'eliminar', estado: 'aprobado', creado: '2026-10-15 10:00:00', revisado: '2026-10-16 10:00:00',
      propuso: 'Ana Uno', reviso: 'Bruno Dos', motivo: null, nuevos: {}, anteriores: {}, dataset_id: 52 };
    const s = seguimientoDe({ ...CASOS[52], dataset: { ...CASOS[52].dataset, activo: false }, cambios: [...CASOS[52].cambios, baja],
      catalogos: CATALOGOS }, HOY, OPCIONES_CINTA);
    const pdf = await render(s);
    const conDia = lineasPorHoja(pdf)[0];
    assert.ok(conDia.includes('DADO DE BAJA EL'), conDia.join(' | '));
    assert.ok(conDia.includes('16/10/2026'), conDia.join(' | '));
    assert.ok(conDia.includes('Baja del RPAD'), conDia.join(' | '));
    verificarDiagramacion(await diagramacion(() => render(s)));
  });

  it('el 1 lleva la actualización pendiente en la cinta y en la leyenda', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(1)))[0];
    assert.ok(lineas.includes('Actualización pendiente'), lineas.join(' | '));
    assert.ok(lineas.includes('Actualización pendiente de aprobación'), lineas.join(' | '));
  });

  it('el pie sin nombre de quien lo genera dice solo la fecha y la hora', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(52), { momento: '2026-10-20 09:05:00', por: null }))[0];
    assert.ok(lineas.includes('Generado el 20/10/2026 a las 09:05'), lineas.join(' | '));
  });

  it('con exactamente 8 movimientos, "No hay movimientos anteriores" va debajo de la tabla; con 9, "Hay 1 movimiento anterior"', async () => {
    const s = seguimiento(52);
    // Los 8 más viejos (el último es el alta del 01/12/2025)
    const ocho = { ...s, movimientos: s.movimientos.slice(8) };
    const lineasOcho = lineasPorHoja(await render(ocho))[0];
    assert.ok(lineasOcho.includes('No hay movimientos anteriores: el dataset está en el RPAD desde el 01/12/2025.'), lineasOcho.join(' | '));
    verificarDiagramacion(await diagramacion(() => render(ocho)));
    const nueve = { ...s, movimientos: s.movimientos.slice(7) };
    const lineasNueve = lineasPorHoja(await render(nueve))[0];
    assert.ok(lineasNueve.includes('Hay 1 movimiento anterior: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).'), lineasNueve.join(' | '));
  });

  it('etiquetas que se pisarían: dos notas juntas van en una sola etiqueta y los "vence" muy juntos no se encima', async () => {
    const s = seguimiento(52);
    const cinta = {
      ...s.cinta,
      // Dos notas a 18 unidades (13/10 y 20/10) y una en el borde izquierdo
      marcas: [...s.cinta.marcas,
        { x: 940.4, fila: 'arriba', tipo: 'nota', cantidad: 1, etiqueta: 'Nota 3/26', detalle: [] },
        { x: 31, fila: 'arriba', tipo: 'nota', cantidad: 1, etiqueta: 'Nota 9/25', detalle: [] }],
      // Vencimientos mensuales (uno por mes) y uno pegado al borde izquierdo
      vencimientos: [{ x: 31, texto: 'vence 01/11' }, ...s.cinta.meses.slice(1).map((m, i) => ({ x: m.x0 - 1, texto: `vence ${String(i).padStart(2, '0')}/xx` }))],
      hoy: { x: s.cinta.hoy.x, renglon: 2 }
    };
    const con = { ...s, cinta };
    const lineas = lineasPorHoja(await render(con))[0];
    assert.ok(lineas.includes('Nota 2/26 y Nota 3/26'), lineas.join(' | '));
    assert.ok(lineas.includes('Nota 9/25'), lineas.join(' | '));
    assert.ok(lineas.includes('hoy'), lineas.join(' | '));
    verificarDiagramacion(await diagramacion(() => render(con)));
  });

  it('la leyenda con todos los tipos pasa a un segundo renglón sin encimarse', async () => {
    const s = seguimiento(52);
    // (con la nota DGMIT al área, spec 2026-10-24-notas-dgmit, 7)
    const tipos = ['nota', 'email', 'area', 'dgmit', 'act', 'actp', 'cambio', 'cambiop', 'rech', 'alta'];
    const filaDe = { nota: 'arriba', email: 'arriba', area: 'abajo', dgmit: 'abajo', rech: 'abajo' };
    const cinta = { ...s.cinta, marcas: tipos.map((tipo, i) => ({ x: 100 + i * 85, fila: filaDe[tipo] ?? 'banda', tipo, cantidad: 1, etiqueta: null, detalle: [] })) };
    const con = { ...s, cinta };
    const { textos } = await diagramacion(() => render(con));
    const rotulos = ['Nota Digital a DGMIT', 'Email a DGMIT', 'Email al área', 'Nota DGMIT al área', 'Actualización', 'Actualización pendiente',
      'Cambio en la ficha', 'Cambio pendiente', 'Propuesta rechazada', 'Alta', 'Vencido'];
    for (const t of rotulos) assert.ok(textos.some(c => c.texto === t), `falta "${t}" en la leyenda`);
    const renglones = new Set(rotulos.map(t => textos.find(c => c.texto === t).y0.toFixed(1)));
    assert.equal(renglones.size, 2);
    verificarDiagramacion(await diagramacion(() => render(con)));
  });

  it('el QR se dibuja solo con link al portal', async () => {
    const s = seguimiento(52);
    const con = contenidoPorHoja(await render(s))[0];
    const sin = contenidoPorHoja(await render({ ...s, ficha: { ...s.ficha, url_dataset: null } }))[0];
    assert.ok(rectangulos(con) > rectangulos(sin) + 50);
  });
});

// «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7): en la ficha de un externo, «Datos que se piden»
// comparte el renglón con este dato (mockup 6); la gestión interna no lo lleva. Con «No», el circuito dice que no hace falta nota formal.
describe('renderSeguimiento: requiere nota DGMIT', () => {
  const conDato = (id, requiere_nota, dataset = {}) => seguimiento(id, { requiere_nota, ...dataset });
  // El texto de una celda de la grilla (el valor que está justo debajo de su rótulo) y su posición
  const celda = (textos, rotulo) => {
    const r = textos.find(t => t.texto === rotulo);
    assert.ok(r, `falta "${rotulo}" en ${textos.map(t => t.texto).join(' | ')}`);
    // El valor va debajo del rótulo, en la misma columna: el de base más alta entre los que quedan por debajo
    const valor = textos.filter(t => Math.abs(t.x - r.x) < 0.5 && t.base < r.base).sort((a, b) => b.base - a.base)[0];
    return { rotulo: r, valor };
  };

  for (const [dato, texto] of [[0, 'No'], [1, 'Sí'], [null, 'Sin dato']]) {
    it(`la hoja de un externo con ${texto === 'Sin dato' ? 'dato sin cargar' : texto} dice REQUIERE NOTA DGMIT / ${texto} junto a DATOS QUE SE PIDEN`, async () => {
      const s = conDato(81, dato);
      assert.equal(s.ficha.requiere_nota, dato);
      const textos = textosPorHoja(await render(s))[0];
      const pide = celda(textos, 'DATOS QUE SE PIDEN');
      const requiere = celda(textos, 'REQUIERE NOTA DGMIT');
      // En el mismo renglón: el mismo alto el rótulo y el valor; el dato a la derecha del pedido
      assert.ok(Math.abs(pide.rotulo.base - requiere.rotulo.base) < 0.5, 'rótulos en renglones distintos');
      assert.ok(Math.abs(pide.valor.base - requiere.valor.base) < 0.5, 'valores en renglones distintos');
      assert.ok(requiere.rotulo.x > pide.rotulo.x + 100, 'el dato no está a la derecha del pedido');
      assert.equal(pide.valor.texto, s.ficha.pedido);
      assert.equal(requiere.valor.texto, texto);
      assert.equal(requiere.valor.tamano, pide.valor.tamano, 'mismo tamaño en la misma fila');
      // El link al portal sigue abajo, en su renglón entero
      assert.ok(celda(textos, 'LINK AL PORTAL').rotulo.base < pide.rotulo.base);
    });
  }

  it('el dato va después de «Cargado en el portal» y antes del link al portal, y la ficha no crece', async () => {
    const con = textosPorHoja(await render(conDato(81, 0)))[0];
    const base = (textos, t) => textos.find(x => x.texto === t).base;
    const orden = ['CARGADO EN EL PORTAL', 'REQUIERE NOTA DGMIT', 'LINK AL PORTAL', 'AVISOS DEL CICLO ABIERTO'].map(t => base(con, t));
    orden.slice(1).forEach((valor, i) => assert.ok(valor < orden[i], `fuera de orden en la posición ${i + 1}: ${orden.join(', ')}`));
    // Misma altura de todo lo de abajo que con la interna de siempre: el renglón que comparte no suma uno
    const sin = textosPorHoja(await render(seguimiento(81)))[0];
    for (const t of ['LINK AL PORTAL', 'AVISOS DEL CICLO ABIERTO', 'LOS ÚLTIMOS 12 MESES', 'ÚLTIMOS MOVIMIENTOS']) {
      assert.ok(Math.abs(base(con, t) - base(sin, t)) < 0.5, `${t} se corrió`);
    }
  });

  it('la hoja de una interna no lleva el dato, ni siquiera con un valor en el dataset', async () => {
    for (const valor of [null, 0, 1]) {
      const textos = textosPorHoja(await render(conDato(38, valor)))[0];
      assert.ok(!textos.some(t => /REQUIERE NOTA/i.test(t.texto)), `valor ${valor}`);
    }
    // «Datos que se piden» sigue de ancho entero: nada a su derecha en su renglón
    const textos = textosPorHoja(await render(seguimiento(38)))[0];
    const pide = celda(textos, 'DATOS QUE SE PIDEN');
    assert.ok(!textos.some(t => Math.abs(t.base - pide.rotulo.base) < 0.5 && t.x > pide.rotulo.x + 100), 'algo a la derecha del pedido');
  });

  it('el pedido más largo no se corta: «Presupuestos de los ejercicios 2021 a 2026» entra junto al dato', async () => {
    const s = conDato(1, 0, { datos_al: '2020-12-31', proxima: '2026-01-31' });
    assert.match(s.ficha.pedido, /^Presupuestos de los ejercicios \d{4} a \d{4}$/);
    for (const url of ['https://datos.comodoro.gov.ar/dataset/presupuesto-municipal', null]) {
      const con = { ...s, ficha: { ...s.ficha, url_dataset: url } };
      const textos = textosPorHoja(await render(con))[0];
      assert.equal(celda(textos, 'DATOS QUE SE PIDEN').valor.texto, s.ficha.pedido, `url ${url}`);
      assert.ok(!celda(textos, 'DATOS QUE SE PIDEN').valor.texto.endsWith('…'));
      verificarDiagramacion(await diagramacion(() => render(con)));
    }
  });

  it('una hoja, nada encimado ni fuera de los márgenes: externos con Sí, No y sin dato, con título y áreas larguísimos y sin link', async () => {
    const largos = { titulo: TITULO_LARGO, area: AREA_LARGA, area_superior: AREA_LARGA };
    for (const dato of [1, 0, null]) {
      for (const s of [conDato(52, dato), conDato(81, dato), conDato(52, dato, largos), conDato(66, dato, { tipo_gestion: 'externa' })]) {
        const pdf = await render(s);
        assert.equal(lineasPorHoja(pdf).length, 1);
        verificarDiagramacion(await diagramacion(() => render(s)));
        verificarDiagramacion(await diagramacion(() => render({ ...s, ficha: { ...s.ficha, url_dataset: null } })));
      }
    }
  });

  it('el circuito con No: «No hace falta nota formal», «Sin nota formal» y «Los datos se obtienen de la fuente»', async () => {
    const lineas = lineasPorHoja(await render(conDato(81, 0)))[0];
    for (const t of ['No hace falta nota formal', 'Sin nota formal']) assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    assert.ok(lineas.join(' ').includes('Los datos se obtienen de la fuente'), lineas.join(' | '));
    assert.ok(lineas.join(' ').includes('DGMIT y Dirección Administrativa'), lineas.join(' | '));
    assert.ok(!lineas.includes('Mandan la nota formal al área') && !lineas.includes('Nota formal'), lineas.join(' | '));
    // Sin email al área en el ciclo: la línea «Al área» no se dibuja, ni la que dice que todavía no se le envió
    assert.ok(!lineas.some(l => l.startsWith('Al área')), lineas.join(' | '));
    assert.ok(!lineas.some(l => /todavía no se le envió/.test(l)), lineas.join(' | '));
  });

  it('el circuito con No y un email al área en el ciclo (caso 52): la línea «Al área» sigue con sus fechas', async () => {
    const lineas = lineasPorHoja(await render(conDato(52, 0)))[0];
    assert.ok(lineas.includes('Al área: el 21/06/2026 el RPAD le anticipó por email que iba a recibir una nota formal.'), lineas.join(' | '));
    assert.ok(lineas.includes('No hace falta nota formal'));
  });

  it('el circuito con Sí o sin dato es el de siempre, con la línea «Al área»', async () => {
    for (const dato of [1, null]) {
      const lineas = lineasPorHoja(await render(conDato(81, dato)))[0];
      assert.ok(lineas.includes('Mandan la nota formal al área'), lineas.join(' | '));
      assert.ok(lineas.includes('Nota formal'));
      assert.ok(lineas.includes('Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.'), lineas.join(' | '));
    }
  });

  it('lenguaje neutro con No: ni «sin entregar», ni «sin respuesta», ni «atrasado» (en ninguno de los casos)', async () => {
    for (const id of Object.keys(CASOS)) {
      const lineas = lineasPorHoja(await render(conDato(Number(id), 0)))[0];
      assert.deepEqual(lineas.filter(l => NEUTRO.test(l)), [], `caso ${id}`);
    }
  });
});

// El anexo de la reiteración (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.1 y 2.2): un solo PDF con la hoja del
// Seguimiento de cada dataset de la nota, en orden. Cada hoja es la de siempre, con la fecha larga de la nota arriba y, abajo, la
// hora en que se generó (sin «por») y «Anexo de la Nota Digital N° … · Hoja k de N».
describe('renderAnexoDeSeguimiento: una hoja por dataset, en un solo PDF', () => {
  // Una nota del 20/10/2026 generada a las 08:15 del 21/10/2026 (un envío automático: sin «por»)
  const GENERADO_AUTOMATICO = { momento: '2026-10-21 08:15:03', por: null };
  const anexo = (lista, numeroTexto = '9/26', generado = GENERADO_AUTOMATICO) =>
    renderAnexoDeSeguimiento(lista, { hoy: HOY, generado, numeroTexto });
  const tres = () => [seguimiento(52), seguimiento(81), seguimiento(38)];
  const FECHA = /^\d{2}\/\d{2}\/\d{4}$/;
  const fechasDeLaTabla = (textos) => {
    const rotulo = textos.find(t => t.texto === 'ÚLTIMOS MOVIMIENTOS');
    assert.ok(rotulo, textos.map(t => t.texto).join(' | '));
    return textos.filter(t => FECHA.test(t.texto) && t.base < rotulo.base).map(t => t.texto);
  };
  const ddmmaaaa = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

  it('OPCIONES_CINTA_PDF son las de la cinta del PDF: separación 12 y letra 8,4', () => {
    assert.deepEqual(OPCIONES_CINTA_PDF, { separacion: 12, letra: 8.4 });
  });

  it('con 3 casos: 3 hojas, en orden, cada una con su título y «Anexo de la Nota Digital N° 9/26 · Hoja k de 3»', async () => {
    const lista = tres();
    const pdf = await anexo(lista);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 3);
    lista.forEach((s, k) => {
      const lineas = hojas[k];
      assert.ok(lineas.join(' ').includes(s.ficha.titulo), `la hoja ${k + 1} no lleva "${s.ficha.titulo}": ${lineas.join(' | ')}`);
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° 9/26 · Hoja ${k + 1} de 3`), `pie de la hoja ${k + 1}: ${lineas.join(' | ')}`);
      assert.ok(!lineas.some(l => l.includes('Hoja 1 de 1')), lineas.join(' | '));
      assert.ok(lineas.includes('Seguimiento del dataset'), lineas.join(' | '));
    });
    // Cada hoja es de su dataset, en el orden dado: el 52 (externo), el 81 (recién dado de alta) y el 38 (interno)
    assert.ok(hojas[0].includes('CONJUNTO DE DATOS · GESTIÓN EXTERNA'));
    assert.ok(hojas[1].includes('No hay movimientos anteriores: el dataset está en el RPAD desde el 19/10/2026.'));
    assert.ok(hojas[2].includes('CONJUNTO DE DATOS · GESTIÓN INTERNA'));
  });

  it('renderAnexoDeSeguimiento: todas las hojas son A4, no la hoja oficio de la nota', async () => {
    const tamanos = tamanosPorHoja(await anexo(tres()));
    assert.equal(tamanos.length, 3);
    assert.ok(tamanos.every(enA4), JSON.stringify(tamanos));
  });

  it('arriba, la fecha larga de la nota (hoy); abajo, la hora de generación y sin «por»', async () => {
    for (const lineas of lineasPorHoja(await anexo(tres()))) {
      assert.ok(lineas.includes('20 de octubre de 2026'), lineas.join(' | '));
      assert.ok(lineas.includes('Generado el 21/10/2026 a las 08:15'), lineas.join(' | '));
      assert.ok(!lineas.some(l => /^Generado.* por /.test(l)), lineas.join(' | '));
    }
  });

  it('una sola hoja: «Hoja 1 de 1» y el número tal como viene', async () => {
    const lineas = lineasPorHoja(await anexo([seguimiento(52)], 'XX'))[0];
    assert.ok(lineas.includes('Anexo de la Nota Digital N° XX · Hoja 1 de 1'), lineas.join(' | '));
    assert.ok(!lineas.includes('Seguimiento del dataset · Hoja 1 de 1'), lineas.join(' | '));
  });

  it('diez hojas: cada pie dice su número, hasta «Hoja 10 de 10»', async () => {
    const lista = [52, 81, 38, 10, 1, 9, 11, 26, 33, 42].map(id => seguimiento(id));
    const hojas = lineasPorHoja(await anexo(lista));
    assert.equal(hojas.length, 10);
    hojas.forEach((lineas, k) => {
      assert.ok(lineas.includes(`Anexo de la Nota Digital N° 9/26 · Hoja ${k + 1} de 10`), `hoja ${k + 1}: ${lineas.join(' | ')}`);
    });
  });

  it('cada hoja del anexo pasa la diagramación de una hoja (nada se pisa, 8 renglones)', async () => {
    // Todos los casos reales y el 52 con título y áreas larguísimos
    const lista = [...Object.keys(CASOS).map(id => seguimiento(id)), largo()];
    const pdf = await anexo(lista);
    const hojas = textosPorHoja(pdf);
    assert.equal(hojas.length, lista.length);
    verificarDiagramacion(await diagramacion(() => anexo(lista)));
    // La tabla de movimientos de cada hoja: los 8 más nuevos de ese dataset (o todos, si son menos)
    hojas.forEach((textos, k) => {
      const esperadas = lista[k].movimientos.slice(0, FILAS_PDF).map(m => ddmmaaaa(m.fecha));
      assert.deepEqual(fechasDeLaTabla(textos), esperadas, `hoja ${k + 1}`);
    });
    // El 52 tiene más de 8 movimientos: su tabla se llena
    assert.equal(fechasDeLaTabla(hojas[Object.keys(CASOS).indexOf('52')]).length, FILAS_PDF);
  });

  it('un número de nota largo no se pisa con la izquierda del pie ni sale de los márgenes', async () => {
    for (const numeroTexto of ['XX', '99999/26', 'PRUEBA 123456789/2026 PRUEBA 123456789/2026']) {
      verificarDiagramacion(await diagramacion(() => anexo(tres(), numeroTexto)));
    }
  });

  it('cada hoja es la de la descarga, salvo la hora del pie y el pie mismo', async () => {
    const s = seguimiento(52);
    const sola = lineasPorHoja(await render(s))[0];
    const enAnexo = lineasPorHoja(await anexo([s]))[0];
    assert.deepEqual(sola.filter(l => !enAnexo.includes(l)),
      ['Generado el 20/10/2026 a las 11:30 por Usuario Uno', 'Seguimiento del dataset · Hoja 1 de 1']);
    assert.deepEqual(enAnexo.filter(l => !sola.includes(l)),
      ['Generado el 21/10/2026 a las 08:15', 'Anexo de la Nota Digital N° 9/26 · Hoja 1 de 1']);
  });

  it('una lista vacía tira error', async () => {
    await assert.rejects(anexo([]), /al menos un seguimiento/);
  });

  it('lo que no es una lista o un anexo sin número de nota también tira error', async () => {
    await assert.rejects(anexo(null), /al menos un seguimiento/);
    await assert.rejects(anexo(undefined), /al menos un seguimiento/);
    // (sin pasar por `anexo`, cuyo número por defecto es 9/26)
    for (const numeroTexto of [undefined, null, '', '  ']) {
      await assert.rejects(renderAnexoDeSeguimiento(tres(), { hoy: HOY, generado: GENERADO_AUTOMATICO, numeroTexto }), /número de la nota/);
    }
  });
});

// Notas DGMIT (spec 2026-10-24-notas-dgmit, 7): la nota formal que la DGMIT le manda al área, cargada a mano. Con una nota en el
// ciclo abierto, el tramo de afuera va en violeta y con línea llena («Nota DGMIT» / «Solicitud 156/26. Recibida el …», sin «hace N
// días»: el anexo queda guardado y se lee después) y el renglón «Al área» la nombra. Los movimientos de la hoja llevan las vigentes
// (las anuladas no van, ni en la cuenta) y la cinta, su marca violeta, con su renglón en la leyenda. En el anexo de la reiteración,
// sin nota, el tramo es neutral: «Nota formal» / «La manda la DGMIT al área».
describe('renderSeguimiento: notas DGMIT (spec 2026-10-24-notas-dgmit, 7)', () => {
  // El violeta de las notas DGMIT (#5B4691), como lo escribe PDFKit: cada canal sobre 255
  const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).join(' ');
  const VIOLETA = rgb('#5B4691');
  const GRIS_CLARO = rgb('#9AA5B1');
  // Cada trazo de un color (q … <color> SCN S Q), con lo que va antes en su bloque: ahí está la raya ("[3.5 2.5] 0 d") si es punteado
  const trazos = (contenido, color) => [...contenido.matchAll(new RegExp(`q\\n([^Q]*?)${color.replace(/\./g, '\\.')} SCN\\nS\\nQ`, 'g'))].map(m => m[1]);
  const PUNTEADO = /\] 0 d\n/;
  // Una nota DGMIT como la da fuentesDe (la del 58, recibida el 15/10/2026; hoy es el 20/10/2026)
  const notaDgmit = (datos = {}) => ({
    id: 1, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '2026-10-16 09:30:00',
    por: 'Diego Martín Cuatro', por_id: 7, datasets: [{ id: 58, titulo: 'Áreas específicas de género' }], historial: [], ...datos
  });
  // El Seguimiento de un caso real con sus notas DGMIT; `opciones`, las de circuitoDe ({ anexo: true } en el anexo)
  const conNotas = (id, notasDgmit, dataset = {}, opciones = {}) => seguimientoDe(
    { ...CASOS[id], dataset: { ...CASOS[id].dataset, ...dataset }, notasDgmit, catalogos: CATALOGOS }, HOY, OPCIONES_CINTA, opciones
  );
  const anulada = (datos = {}) => notaDgmit({
    id: 2, numero: '155/26', recibida: '2026-10-18', anulada: true,
    historial: [{ accion: 'anulacion', motivo: 'Se cargó dos veces', por: 'Elena Noelia Cuatro', momento: '2026-10-19 10:00:00' }], ...datos
  });
  const unidas = (lineas) => lineas.join(' ');
  // El texto del tramo de la nota formal: lo que se escribe después de su título (hasta dos líneas)
  const textoDelTramo = (lineas, titulo = 'Nota formal') => {
    const i = lineas.indexOf(titulo);
    assert.ok(i >= 0, `falta "${titulo}" en ${lineas.join(' | ')}`);
    return lineas.slice(i + 1, i + 3).join(' ');
  };

  it('con nota: el tramo dice Nota DGMIT / Solicitud 156/26. Recibida el …, en violeta y lleno', async () => {
    const s = conNotas(58, [notaDgmit()]);
    const pdf = await render(s);
    const lineas = lineasPorHoja(pdf)[0];
    assert.ok(lineas.includes('Nota DGMIT'), lineas.join(' | '));
    // El texto entra entero en las dos líneas del tramo (sin «…»), y sin «hace N días» (el de la pantalla)
    assert.ok(textoDelTramo(lineas, 'Nota DGMIT').includes('Solicitud 156/26. Recibida el 15/10/2026'), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.includes('…') && /Solicitud|Recibida/.test(l)), lineas.join(' | '));
    assert.ok(!unidas(lineas).includes('recibida por el área el 15/10/2026, hace'), lineas.join(' | '));
    for (const t of ['Nota formal', 'Pendiente de carga', 'Nota DGMIT N° 156/26']) assert.ok(!lineas.includes(t), `sobra "${t}": ${lineas.join(' | ')}`);
    // Una reiteración lo dice
    const reiteracion = lineasPorHoja(await render(conNotas(58, [notaDgmit({ numero: '160/26', tipo: 'reiteracion' })])))[0];
    assert.ok(textoDelTramo(reiteracion, 'Nota DGMIT').includes('Reiteración 160/26. Recibida el 15/10/2026'), reiteracion.join(' | '));
    // En violeta (el título y la punta, rellenos; la línea, trazada) y con línea llena
    const contenido = contenidoPorHoja(pdf)[0];
    const violetas = trazos(contenido, VIOLETA);
    assert.equal(violetas.length, 1, 'la línea del tramo, en violeta');
    assert.ok(!PUNTEADO.test(violetas[0]), 'la línea del tramo con nota es llena');
    assert.ok(contenido.includes(`${VIOLETA} scn`), 'el título y la punta, en violeta');
    // El título del tramo en negrita, como siempre
    const { textos } = await diagramacion(() => render(s));
    assert.equal(textos.find(t => t.texto === 'Nota DGMIT').fuente, 'Helvetica-Bold');
  });

  it('con nota: el renglón Al área nombra la nota', async () => {
    const lineas = lineasPorHoja(await render(conNotas(58, [notaDgmit()])))[0];
    assert.ok(lineas.includes('Al área: el 15/10/2026 recibió la nota DGMIT N° 156/26 (solicitud), que pide los datos de este dataset.'), lineas.join(' | '));
    assert.ok(!lineas.some(l => /todavía no se le envió|le anticipó por email/.test(l)), lineas.join(' | '));
    // Con el email de los 40 días en el ciclo (el 52), la nota reemplaza al email en el renglón
    const del52 = lineasPorHoja(await render(conNotas(52, [notaDgmit({ numero: '120/26', tipo: 'reiteracion', recibida: '2026-08-10' })])))[0];
    assert.ok(del52.includes('Al área: el 10/08/2026 recibió la nota DGMIT N° 120/26 (reiteración), que pide los datos de este dataset.'), del52.join(' | '));
    assert.ok(!del52.some(l => l.startsWith('Al área: el 21/06/2026')), del52.join(' | '));
    // Un externo sin vencimiento (eventual) con una nota: el renglón la nombra igual
    const eventual = lineasPorHoja(await render(conNotas(66, [notaDgmit({ recibida: '2026-09-01' })], { tipo_gestion: 'externa' })))[0];
    assert.ok(eventual.includes('Al área: el 01/09/2026 recibió la nota DGMIT N° 156/26 (solicitud), que pide los datos de este dataset.'), eventual.join(' | '));
  });

  it('sin nota: Nota formal / Pendiente de carga', async () => {
    const pdf = await render(conNotas(58, []));
    const lineas = lineasPorHoja(pdf)[0];
    assert.ok(textoDelTramo(lineas).includes('Pendiente de carga'), lineas.join(' | '));
    assert.ok(!lineas.includes('Nota DGMIT'), lineas.join(' | '));
    assert.ok(lineas.includes('Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.'), lineas.join(' | '));
    // Punteado y en gris claro; nada en violeta
    const contenido = contenidoPorHoja(pdf)[0];
    const grises = trazos(contenido, GRIS_CLARO);
    assert.ok(grises.some(t => PUNTEADO.test(t)), 'la línea del tramo sin nota es punteada');
    assert.ok(!contenido.includes(VIOLETA), 'sin nota no hay violeta');
    // Una anulada o una recibida después de hoy no cuentan: sigue sin nota
    const noCuentan = lineasPorHoja(await render(conNotas(58, [anulada(), notaDgmit({ id: 3, recibida: '2026-10-21' })])))[0];
    assert.ok(textoDelTramo(noCuentan).includes('Pendiente de carga'), noCuentan.join(' | '));
    // Los otros dos textos: todavía no hizo falta (el 25: sin avisos y sin vencer) y ya no se pide (dado de baja)
    assert.ok(textoDelTramo(lineasPorHoja(await render(conNotas(25, [])))[0]).includes('Todavía no hizo falta'));
    assert.ok(textoDelTramo(lineasPorHoja(await render(conNotas(52, [], { activo: false })))[0]).includes('Ya no se pide'));
  });

  it('la fila de la nota DGMIT en los movimientos, y la anulada no', async () => {
    // El 52 tiene 16 movimientos; con la nota, 17. La anulada, más nueva, no va en la tabla ni en las cuentas
    const s = conNotas(52, [notaDgmit({ datasets: [{ id: 52, titulo: CASOS[52].dataset.titulo }, { id: 1, titulo: 'Presupuesto Municipal' }] }), anulada()]);
    assert.equal(s.movimientos.length, 18);
    assert.equal(s.movimientos[0].extra.anulada, true, 'la anulada es la más nueva');
    const pdf = await render(s);
    const lineas = lineasPorHoja(pdf)[0];
    for (const t of ['Nota DGMIT N° 156/26 al área: solicitud', 'Recibida por el área el 15/10/2026. La misma nota pide también Presupuesto Municipal.',
      'Cargó Diego Cuatro', '8 de 17, del más nuevo al más viejo',
      'Hay 9 movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).']) {
      assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
    assert.ok(!lineas.some(l => l.includes('155/26') || /Anulada/.test(l)), lineas.join(' | '));
    // La tabla: los 8 más nuevos sin la anulada, el primero la nota del 15/10
    const textos = textosPorHoja(pdf)[0];
    const rotulo = textos.find(t => t.texto === 'ÚLTIMOS MOVIMIENTOS');
    const fechas = textos.filter(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t.texto) && t.base < rotulo.base).map(t => t.texto);
    const vigentes = s.movimientos.filter(m => !(m.tipo === 'dgmit' && m.extra.anulada));
    assert.deepEqual(fechas, vigentes.slice(0, FILAS_PDF).map(m => `${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)}/${m.fecha.slice(0, 4)}`));
    assert.equal(fechas[0], '15/10/2026');
    // Con 7 vigentes y una anulada: «7, …» y «No hay movimientos anteriores», como si la anulada no estuviera
    const del58 = lineasPorHoja(await render(conNotas(58, [notaDgmit(), notaDgmit({ id: 4, numero: '157/26', recibida: '2026-10-16' }), anulada()])))[0];
    assert.ok(del58.includes('7, del más nuevo al más viejo'), del58.join(' | '));
    assert.ok(del58.includes('No hay movimientos anteriores: el dataset está en el RPAD desde el 02/12/2025.'), del58.join(' | '));
    // Solo una anulada: la hoja es la de siempre
    const sinNota = lineasPorHoja(await render(conNotas(58, [])))[0];
    assert.deepEqual(lineasPorHoja(await render(conNotas(58, [anulada()])))[0], sinNota);
  });

  it('la leyenda dice Nota DGMIT al área solo si hay una marca', async () => {
    const con = lineasPorHoja(await render(conNotas(58, [notaDgmit()])))[0];
    assert.ok(con.includes('Nota DGMIT al área'), con.join(' | '));
    // La marca, un rectángulo violeta lleno: en la cinta, en la leyenda y en la fila de la tabla
    const contenido = contenidoPorHoja(await render(conNotas(58, [notaDgmit()])))[0];
    const rellenos = [...contenido.matchAll(new RegExp(`re\\n/DeviceRGB cs\\n${VIOLETA.replace(/\./g, '\\.')} scn\\nf`, 'g'))];
    assert.equal(rellenos.length, 3, 'la marca en la cinta, la leyenda y la tabla');
    // Sin notas, o solo con una anulada, no hay marca ni renglón en la leyenda
    for (const notas of [[], [anulada()]]) {
      const lineas = lineasPorHoja(await render(conNotas(58, notas)))[0];
      assert.ok(!lineas.includes('Nota DGMIT al área'), lineas.join(' | '));
    }
    // El renglón va después de «Email al área»: en el 52, que tiene emails al área
    const del52 = lineasPorHoja(await render(conNotas(52, [notaDgmit({ datasets: [] })])))[0];
    const posicion = (t) => del52.indexOf(t);
    assert.ok(posicion('Email al área') >= 0 && posicion('Email al área') < posicion('Nota DGMIT al área')
      && posicion('Nota DGMIT al área') < posicion('Actualización'), del52.join(' | '));
  });

  it('con nota sigue en una hoja, con 8 renglones y sin pisadas', async () => {
    const NUMERO_LARGO = '1234567890/2026-DGMIT-NOTA-MUY-LARGA-XYZ';
    assert.equal(NUMERO_LARGO.length, 40);
    const largos = { titulo: TITULO_LARGO, area: AREA_LARGA, area_superior: AREA_LARGA };
    const casos = [
      conNotas(58, [notaDgmit()]),
      conNotas(52, [notaDgmit(), anulada()]),
      conNotas(52, [notaDgmit({ numero: NUMERO_LARGO, tipo: 'reiteracion' })], largos),
      conNotas(81, [notaDgmit({ numero: NUMERO_LARGO, recibida: '2026-10-20' })], { requiere_nota: 0 }),
      conNotas(66, [notaDgmit()], { tipo_gestion: 'externa' }),
      conNotas(52, [notaDgmit()], {}, { anexo: true }),
      conNotas(52, [], {}, { anexo: true })
    ];
    for (const s of casos) {
      const pdf = await render(s);
      assert.equal(lineasPorHoja(pdf).length, 1);
      verificarDiagramacion(await diagramacion(() => render(s)));
      verificarDiagramacion(await diagramacion(() => render({ ...s, ficha: { ...s.ficha, url_dataset: null } })));
    }
    // El 52 con nota llena sus 8 renglones
    const textos = textosPorHoja(await render(casos[1]))[0];
    const rotulo = textos.find(t => t.texto === 'ÚLTIMOS MOVIMIENTOS');
    assert.equal(textos.filter(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t.texto) && t.base < rotulo.base).length, FILAS_PDF);
    // Un número de 40 caracteres se corta con «…» en el tramo, sin salir de sus dos líneas
    const { textos: delLargo } = await diagramacion(() => render(casos[2]));
    const tramo = delLargo.find(t => t.texto.startsWith('Reiteración'));
    assert.ok(tramo, delLargo.map(t => t.texto).join(' | '));
    assert.ok(tramo.y1 - tramo.y0 < 2 * tramo.tamano * 1.2, 'el texto del tramo ocupa hasta dos líneas');
  });

  it('el anexo: una hoja con nota y otra sin; la sin nota dice La manda la DGMIT al área y nunca Pendiente de carga', async () => {
    const conNota = conNotas(58, [notaDgmit()], {}, { anexo: true });
    // El 52 sin nota: vencido y con avisos, fuera del anexo diría «Pendiente de carga»
    assert.equal(conNotas(52, []).circuito.tramoFuera.texto, 'Pendiente de carga');
    const sinNota = conNotas(52, [], {}, { anexo: true });
    const lista = [conNota, sinNota];
    const pdf = await renderAnexoDeSeguimiento(lista, { hoy: HOY, generado: { momento: '2026-10-21 08:15:03', por: null }, numeroTexto: '9/26' });
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 2);
    // La hoja con nota, en violeta y con la nota, como el PDF de la descarga
    assert.ok(textoDelTramo(hojas[0], 'Nota DGMIT').includes('Solicitud 156/26. Recibida el 15/10/2026'), hojas[0].join(' | '));
    assert.ok(hojas[0].includes('Al área: el 15/10/2026 recibió la nota DGMIT N° 156/26 (solicitud), que pide los datos de este dataset.'), hojas[0].join(' | '));
    assert.ok(hojas[0].includes('Nota DGMIT al área'), hojas[0].join(' | '));
    assert.ok(!hojas[0].includes('Nota formal'), hojas[0].join(' | '));
    const [contenidoCon, contenidoSin] = contenidoPorHoja(pdf);
    assert.ok(trazos(contenidoCon, VIOLETA).length === 1 && !PUNTEADO.test(trazos(contenidoCon, VIOLETA)[0]), 'violeta y llena');
    // La hoja sin nota: neutral, punteada y en gris; el renglón «Al área», como hoy
    assert.ok(textoDelTramo(hojas[1]).includes('La manda la DGMIT al área'), hojas[1].join(' | '));
    assert.ok(hojas[1].includes('Al área: el 21/06/2026 el RPAD le anticipó por email que iba a recibir una nota formal.'), hojas[1].join(' | '));
    assert.ok(!contenidoSin.includes(VIOLETA), 'sin nota no hay violeta');
    assert.ok(trazos(contenidoSin, GRIS_CLARO).some(t => PUNTEADO.test(t)), 'punteada');
    // En ninguna hoja «Pendiente de carga» (ni los otros dos textos de la pantalla)
    for (const lineas of hojas) {
      for (const t of ['Pendiente de carga', 'Todavía no hizo falta', 'Ya no se pide']) assert.ok(!unidas(lineas).includes(t), `sobra "${t}": ${lineas.join(' | ')}`);
    }
    verificarDiagramacion(await diagramacion(() => renderAnexoDeSeguimiento(lista, { hoy: HOY, generado: { momento: '2026-10-21 08:15:03', por: null }, numeroTexto: '9/26' })));
  });
});

describe('renderSeguimiento: la descarga de una hoja no cambió', () => {
  it('la descarga de una hoja sigue con «Hoja 1 de 1» y quién la generó', async () => {
    const lineas = lineasPorHoja(await render(seguimiento(52)))[0];
    assert.ok(lineas.includes('Seguimiento del dataset · Hoja 1 de 1'), lineas.join(' | '));
    assert.ok(lineas.includes('Generado el 20/10/2026 a las 11:30 por Usuario Uno'), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.startsWith('Anexo de la Nota Digital')), lineas.join(' | '));
  });
});
