// PDF del Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset-design, "El PDF"): una sola hoja A4 con el lenguaje del
// ANEXO, que dibuja lo que calcula seguimientoDe. Puro: los casos reales de tests/seguimiento-casos.js, sin base de datos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seguimientoDe } from '../services/seguimientoReglas.js';
import { renderSeguimiento, FILAS_PDF } from '../services/seguimientoPdf.js';
import { DocumentoNota } from '../services/notasDigitalesPdf.js';
import { lineasPorHoja, contenidoPorHoja, textosPorHoja } from './pdf-lector.js';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';

const MM = 72 / 25.4;
// Las opciones de la cinta del PDF (Task 4): marcas a menos de 12 se juntan y las letras miden 8,4
const OPCIONES_CINTA = { separacion: 12, letra: 8.4 };
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
    for (const t of ['6 avisos', 'Vencido hace 81 días', 'Vencimiento del 31/07/2026',
      'Hay 8 movimientos anteriores: el seguimiento completo está en el RPAD (Herramientas, Seguimiento).',
      'Seguimiento del dataset · Hoja 1 de 1']) {
      assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
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
    for (const t of ['DGMIT y Dirección Administrativa', 'Por fuera del RPAD: no queda registrada', 'Dirección General de Relaciones Laborales']) {
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
    const tipos = ['nota', 'email', 'area', 'act', 'actp', 'cambio', 'cambiop', 'rech', 'alta'];
    const filaDe = { nota: 'arriba', email: 'arriba', area: 'abajo', rech: 'abajo' };
    const cinta = { ...s.cinta, marcas: tipos.map((tipo, i) => ({ x: 100 + i * 90, fila: filaDe[tipo] ?? 'banda', tipo, cantidad: 1, etiqueta: null, detalle: [] })) };
    const con = { ...s, cinta };
    const { textos } = await diagramacion(() => render(con));
    const rotulos = ['Nota Digital a DGMIT', 'Email a DGMIT', 'Email al área', 'Actualización', 'Actualización pendiente', 'Cambio en la ficha',
      'Cambio pendiente', 'Propuesta rechazada', 'Alta', 'Vencido'];
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
