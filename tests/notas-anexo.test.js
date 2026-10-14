// Anexo de los avisos: una hoja A4 por dataset (spec 6.7)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirAnexo } from '../services/notasDigitalesContenido.js';
import { renderAnexo } from '../services/notasDigitalesAnexo.js';
import { DocumentoNota } from '../services/notasDigitalesPdf.js';
import { lineasPorHoja, contenidoPorHoja, textosPorHoja } from './pdf-lector.js';

const MM = 72 / 25.4;
const ficha = (cambios = {}) => ({
  id: 1, titulo: 'Áreas específicas de género', descripcion: 'Listado de áreas municipales con funciones específicas de género.',
  observaciones: null, url_dataset: 'https://datos.comodoro.gov.ar/dataset/areas-genero', tipo_gestion: 'externa',
  frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-16', vencimiento: '2026-11-30',
  tema_principal: 'Género', tema_secundario: null, formatos: 'CSV, XLSX',
  area_nombre: 'Secretaría de la Mujer, Género y Diversidad', area_superior: 'Intendencia',
  email_principal: 'area@ejemplo.gov.ar', email_secundario: null, telefono_area: '297 400-0000', celular_area: null,
  nombre_contacto: null, telefono_contacto: null, email_contacto: null, ...cambios
});
const anexo = (fichas, extra = {}) => construirAnexo({ numero: 3, anio: 2026, fecha: '2026-11-02', fichas, ...extra });
// Cantidad de rectángulos dibujados en una hoja: el QR se dibuja con decenas de ellos
const rectangulos = (contenido) => (contenido.match(/ re\b/g) ?? []).length;

describe('construirAnexo', () => {
  it('arma una hoja por ficha, con estado, línea de tiempo y campos', () => {
    const a = anexo([ficha(), ficha({ id: 2, titulo: 'Otro', vencimiento: '2026-11-02' })]);
    assert.equal(a.numeroTexto, '3/26');
    assert.equal(a.hojas.length, 2);
    assert.equal(a.hojas[0].estado, 'Vence el 30/11/2026 · faltan 28 días');
    assert.equal(a.hojas[1].estado, 'Vence hoy');
    assert.equal(a.hojas[0].etiqueta, 'CONJUNTO DE DATOS · GESTIÓN EXTERNA');
    assert.deepEqual(a.hojas[0].linea, { inicio: '2025-12-16', fin: '2026-11-30', hoy: '2026-11-02' });
    assert.ok(a.hojas[0].campos.some(([e, v]) => e === 'Formatos' && v === 'CSV, XLSX'));
    assert.deepEqual(a.hojas[0].contacto.lineas, ['Email: area@ejemplo.gov.ar', 'Teléfono: 297 400-0000']);
  });

  it('sin link válido no hay url; sin datos de contacto lo dice', () => {
    const h = anexo([ficha({ url_dataset: 'javascript:alert(1)', email_principal: null, telefono_area: null })]).hojas[0];
    assert.equal(h.url, null);
    assert.deepEqual(h.contacto.lineas, ['Sin datos de contacto registrados']);
  });

  it('las pruebas y la vista previa numeran PRUEBA y XX', () => {
    assert.equal(anexo([ficha()], { esPrueba: true }).numeroTexto, 'PRUEBA');
    assert.equal(anexo([ficha()], { numero: null, anio: null }).numeroTexto, 'XX');
  });

  it('un día de plazo va en singular; un vencimiento pasado (datos de ejemplo) no dice "faltan" días negativos', () => {
    assert.equal(anexo([ficha({ vencimiento: '2026-11-03' })]).hojas[0].estado, 'Vence el 03/11/2026 · falta 1 día');
    assert.equal(anexo([ficha({ vencimiento: '2026-10-30' })]).hojas[0].estado, 'Venció el 30/10/2026 · hace 3 días');
  });
});

// Diagramación de cada hoja del anexo, tomada de las llamadas a DocumentoNota mientras se dibuja:
// - textos: el rectángulo de cada texto, con la fuente, el tamaño y las opciones vigentes. El alto es el del ojo de
//   la letra (de la línea de ascendentes a la de descendentes), sin el interlineado de la última línea.
// - bloques: los rectángulos redondeados (estado, tarjeta del QR, descripción, observaciones, contacto).
// - lineas: las líneas finas (rectángulos de hasta 1 punto de alto y 50 o más de ancho: encabezado, ficha, pie).
// Cada uno: { hoja, texto, x0, y0, x1, y1 }, con y desde el borde superior.
const diagramacion = async (datos) => {
  const textos = [];
  const bloques = [];
  const lineas = [];
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
      hoja: indice(this.page), texto: String(texto), x0, y0: y, x1: x0 + ancho,
      y1: y + (lineas - 1) * conInterlineado + this.currentLineHeight(false)
    });
    return original.call(this, texto, x, y, opciones);
  };
  try {
    await renderAnexo(datos);
  } finally {
    DocumentoNota.prototype.text = original;
    delete DocumentoNota.prototype.roundedRect;
    delete DocumentoNota.prototype.rect;
  }
  return { textos, bloques, lineas };
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

// Ficha con todos los textos al máximo: título, campos, descripción, observaciones y todos los contactos
const fichaLarguisima = (cambios = {}) => ficha({
  titulo: 'Título larguísimo '.repeat(18), descripcion: 'Texto muy largo de la descripción del dataset. '.repeat(120),
  observaciones: 'Observación larga. '.repeat(80),
  formatos: Array.from({ length: 20 }, (_, i) => `FORMATO${i}`).join(', '),
  area_nombre: 'Secretaría de Ambiente, Desarrollo Sustentable, Cambio Climático y Gestión Integral de Residuos Urbanos y Rurales del Municipio',
  area_superior: 'Subsecretaría de Coordinación General de Políticas Públicas Territoriales y Planificación Estratégica Municipal',
  tema_principal: 'Medio ambiente, recursos naturales, energía y gestión de residuos sólidos urbanos',
  tema_secundario: 'Gobierno abierto, transparencia activa, participación ciudadana y rendición de cuentas',
  frecuencia_nombre: 'Trimestralmente o cuando haya cambios relevantes en la normativa',
  url_dataset: `https://datos.comodoro.gov.ar/dataset/${'conjunto-de-datos-con-nombre-muy-largo-'.repeat(4)}`,
  email_principal: 'direccion.general.de.ambiente.y.desarrollo.sustentable@comodoro.gov.ar',
  email_secundario: 'mesa.de.entradas.de.la.secretaria.de.ambiente@comodoro.gov.ar', celular_area: '297 400-0001',
  nombre_contacto: 'María de los Ángeles Fernández Rodríguez de la Fuente', telefono_contacto: '297 400-0002 / 297 400-0003 interno 1234',
  email_contacto: 'maria.de.los.angeles.fernandez.rodriguez@comodoro.gov.ar', ...cambios
});

describe('renderAnexo', () => {
  it('es un PDF A4 con una hoja por dataset, título y pie "Hoja i de t"', async () => {
    const pdf = await renderAnexo(anexo([ficha(), ficha({ id: 2, titulo: 'Segundo dataset' })]));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 2);
    assert.ok(hojas[0].includes('Áreas específicas de género'));
    assert.ok(hojas[0].some(l => l.includes('Hoja 1 de 2')));
    assert.ok(hojas[1].some(l => l.includes('Hoja 2 de 2')));
    assert.ok(hojas[0].some(l => l.includes('Anexo – Nota Digital N° 3/26')));
    const texto = pdf.toString('latin1');
    assert.ok(texto.includes(`/MediaBox [0 0 ${(210 * MM).toFixed(2).replace(/\.?0+$/, '')}`) || /\/MediaBox \[0 0 595\.2/.test(texto));
  });

  it('textos larguísimos: sigue siendo una sola hoja por dataset y corta con "(continúa en el portal)"', async () => {
    const larga = 'Texto muy largo de la descripción del dataset. '.repeat(120);
    const pdf = await renderAnexo(anexo([ficha({
      titulo: 'Título larguísimo '.repeat(18), descripcion: larga, observaciones: 'Observación larga. '.repeat(80),
      formatos: Array.from({ length: 20 }, (_, i) => `FORMATO${i}`).join(', '),
      email_secundario: 'otra@ejemplo.gov.ar', celular_area: '297 400-0001', nombre_contacto: 'Persona',
      telefono_contacto: '297 400-0002', email_contacto: 'persona@ejemplo.gov.ar'
    })]));
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].join(' ').includes('(continúa en el portal)'));
  });

  it('dibuja el QR solo cuando hay link válido', async () => {
    const con = contenidoPorHoja(await renderAnexo(anexo([ficha()])))[0];
    const sin = contenidoPorHoja(await renderAnexo(anexo([ficha({ url_dataset: '' })])))[0];
    assert.ok(rectangulos(con) > rectangulos(sin) + 50);
  });

  it('sin última actualización, la línea de tiempo dice "Sin registro"', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha({ ultima_actualizacion: null })])));
    assert.ok(hojas[0].some(l => l.includes('Sin registro')));
  });

  it('escribe solo texto que Helvetica puede escribir', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha({ titulo: 'Tel. ☎ Datos' })])));
    assert.ok(hojas[0].some(l => l.includes('Tel. ? Datos')));
  });

  it('el pie dice "Anexo – Nota Digital N° n/aa · Hoja i de t" y la ficha muestra el link al portal', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha(), ficha({ id: 2, url_dataset: null })])));
    assert.ok(hojas[0].includes('Anexo – Nota Digital N° 3/26 · Hoja 1 de 2'), hojas[0].join(' | '));
    assert.ok(hojas[1].includes('Anexo – Nota Digital N° 3/26 · Hoja 2 de 2'), hojas[1].join(' | '));
    assert.ok(hojas[0].includes('https://datos.comodoro.gov.ar/dataset/areas-genero'), hojas[0].join(' | '));
    assert.ok(!hojas[1].some(l => l.includes('https://')), hojas[1].join(' | '));
  });

  it('de arriba abajo: encabezado, título, estado, línea de tiempo, ficha, descripción, contacto y pie', async () => {
    const pdf = await renderAnexo(anexo([ficha({ observaciones: 'Se publica con cortes trimestrales.' })]));
    const textos = textosPorHoja(pdf)[0];
    // base: altura de la línea de base desde el borde inferior; cuanto más abajo en la hoja, menor
    const base = (buscado) => {
      const encontrado = textos.find(t => t.texto.includes(buscado));
      assert.ok(encontrado, `falta "${buscado}" en ${textos.map(t => t.texto).join(' | ')}`);
      return encontrado.base;
    };
    const orden = ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'Áreas específicas de género', 'Vence el 30/11/2026',
      'ÚLTIMA ACTUALIZACIÓN', 'ÁREA RESPONSABLE', 'DESCRIPCIÓN', 'Listado de áreas municipales', 'OBSERVACIONES',
      'Se publica con cortes', 'CONTACTO DEL ÁREA RESPONSABLE', 'area@ejemplo.gov.ar', 'Hoja 1 de 1'].map(base);
    orden.slice(1).forEach((valor, i) => assert.ok(valor < orden[i], `fuera de orden en la posición ${i + 1}: ${orden.join(', ')}`));
  });

  it('nada sale de los márgenes ni se superpone, tampoco con todos los textos al máximo', async () => {
    // El peor caso: además, los 7 datos de contacto más largos que una línea de la hoja
    const contactoLarguisimo = Object.fromEntries(['email_principal', 'email_secundario', 'telefono_area', 'celular_area',
      'nombre_contacto', 'telefono_contacto', 'email_contacto'].map(campo => [campo, `${campo} `.repeat(30)]));
    const casos = [
      [ficha()],
      [ficha({ url_dataset: null, ultima_actualizacion: null, observaciones: 'Sin cambios.', area_superior: null })],
      [ficha({ vencimiento: '2026-11-03' }), ficha({ ultima_actualizacion: '2026-11-01' }), ficha({ vencimiento: '2026-11-02' })],
      [fichaLarguisima()],
      [fichaLarguisima({ url_dataset: null, observaciones: null })],
      [fichaLarguisima({ descripcion: 'Breve.', observaciones: 'Breve.' })],
      [fichaLarguisima(contactoLarguisimo), ficha()]
    ];
    for (const fichas of casos) {
      const datos = anexo(fichas);
      verificarDiagramacion(await diagramacion(datos));
      // Y en el PDF escrito: una hoja por dataset, con todo el texto dentro de los márgenes
      const textos = textosPorHoja(await renderAnexo(datos));
      assert.equal(textos.length, fichas.length);
      for (const t of textos.flat()) {
        assert.ok(t.x >= 15 * MM - 0.01, `"${t.texto}" sale del margen izquierdo`);
        assert.ok(t.base - 0.207 * t.tamano >= 15 * MM - 0.01 && t.base + 0.718 * t.tamano <= 282 * MM + 0.01, `"${t.texto}" sale de los márgenes`);
      }
    }
  });

  it('con textos larguísimos corta descripción, observaciones y título con "… (continúa en el portal)"', async () => {
    const cajas = (await diagramacion(anexo([fichaLarguisima()]))).textos;
    const cortados = cajas.filter(c => c.texto.endsWith('… (continúa en el portal)'));
    assert.ok(cortados.some(c => c.texto.startsWith('Título larguísimo')), 'el título no se cortó');
    assert.ok(cortados.some(c => c.texto.startsWith('Texto muy largo')), 'la descripción no se cortó');
    assert.ok(cortados.some(c => c.texto.startsWith('Observación larga')), 'las observaciones no se cortaron');
  });
});
