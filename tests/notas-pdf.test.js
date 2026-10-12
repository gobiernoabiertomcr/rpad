// PDF de las Notas Digitales
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { construirNota } from '../services/notasDigitalesContenido.js';
import { renderPdf, validarImagenFirma } from '../services/notasDigitalesPdf.js';
import { pngRgba, pngsDanados, jpegMinimo } from './firma-fixtures.js';

// PNG válido de 1x1 píxel
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const config = { linea_cc_interna: 'CC. Dir. de Investigación Territorial', linea_cc_externa: 'CC. Dir. Administrativa', firma_nombre: 'Nombre', firma_cargo: 'Cargo' };

const dataset = (i) => ({
  id: i, titulo: `Dataset ${i} con un título bastante largo para que ocupe más de una línea en la tabla del PDF`,
  url_dataset: 'https://datos.comodoro.gov.ar/dataset/x', area_id: 1, area_nombre: 'Área de prueba',
  frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-31', vencimiento: i % 2 ? '2026-12-31' : '2026-10-31',
  informado: null, reiteraciones: 0, antecedente: i % 3 ? null : { cantidad: 4, primera: '2026-01-01', ultima: '2026-10-01' }
});

const nota = (cantidad, cambios = {}) => construirNota({
  tipo: 'aviso', gestion: 'externa', numero: 12, anio: 2026, esPrueba: false, fecha: '2026-11-02',
  datasets: Array.from({ length: cantidad }, (_, i) => dataset(i + 1)),
  areas: [{ id: 1, nombre: 'Área de prueba', email_principal: 'area@rpad.test' }], config, ...cambios
});

const texto = (pdf) => pdf.toString('latin1');
const paginas = (pdf) => (texto(pdf).match(/\/Type \/Page[^s]/g) || []).length;

// Texto de cada hoja del PDF: las líneas (operadores TJ) en el orden en que se dibujaron.
// Los flujos de contenido de PDFKit vienen comprimidos (Flate) y el texto en hexadecimal (WinAnsi).
// (el TextDecoder de Node trata windows-1252 como latin1: se completa a mano el rango 0x80-0x9f)
const CP1252 = '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178';
const winAnsi = (bytes) => bytes.toString('latin1').replace(/[\x80-\x9f]/g, c => CP1252[c.charCodeAt(0) - 0x80]);
const lineasPorHoja = (pdf) => {
  const objetos = new Map();
  for (const m of texto(pdf).matchAll(/(\d+) 0 obj\r?\n([\s\S]*?)endobj/g)) objetos.set(Number(m[1]), m[2]);
  const raiz = [...objetos.values()].find(cuerpo => /\/Type \/Pages/.test(cuerpo));
  const hojas = [...raiz.match(/\/Kids \[([^\]]*)\]/)[1].matchAll(/(\d+) 0 R/g)].map(m => Number(m[1]));
  return hojas.map(id => {
    const flujo = objetos.get(Number(objetos.get(id).match(/\/Contents (\d+) 0 R/)[1]));
    const inicio = flujo.match(/stream\r?\n/);
    const datos = flujo.substr(inicio.index + inicio[0].length, Number(flujo.match(/\/Length (\d+)/)[1]));
    const contenido = zlib.inflateSync(Buffer.from(datos, 'latin1')).toString('latin1');
    // En el texto justificado PDFKit no escribe los espacios: los reemplaza por ajustes negativos grandes del TJ
    // (más de 250 milésimas de em). El interletrado normal (kerning) es de unas pocas decenas.
    return [...contenido.matchAll(/\[([^\]]*)\]\s*TJ/g)].map(tj =>
      [...tj[1].matchAll(/<([0-9a-f]*)>|(-?\d+(?:\.\d+)?)/gi)]
        .map(([, hex, ajuste]) => hex !== undefined ? winAnsi(Buffer.from(hex, 'hex')) : (Number(ajuste) < -150 ? ' ' : ''))
        .join('').replace(/\s+/g, ' ').trim());
  });
};

describe('renderPdf', () => {
  it('genera un PDF oficio con el número en el título', async () => {
    const pdf = await renderPdf(nota(2));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.match(texto(pdf), /\/MediaBox \[0 0 612\.28\d* 935\.43\d*\]/);
    assert.ok(texto(pdf).includes('(Nota Digital 12/26)'));
  });

  it('incluye la imagen de la firma solo si está cargada', async () => {
    assert.ok(texto(await renderPdf(nota(1), { firmaImagen: PNG })).includes('/Subtype /Image'));
    assert.ok(!texto(await renderPdf(nota(1))).includes('/Subtype /Image'));
  });

  it('una nota con 60 datasets ocupa varias hojas sin errores', async () => {
    const pdf = await renderPdf(nota(60), { firmaImagen: PNG });
    assert.ok(paginas(pdf) >= 2, `páginas: ${paginas(pdf)}`);
  });

  it('una nota corta ocupa una sola hoja', async () => {
    assert.equal(paginas(await renderPdf(nota(1))), 1);
  });

  it('una firma PNG RGBA sana (también entrelazada) sale en el PDF con su transparencia', async () => {
    for (const imagen of [pngRgba(), pngRgba({ ancho: 37, alto: 23, entrelazado: true })]) {
      const pdf = texto(await renderPdf(nota(1), { firmaImagen: imagen }));
      assert.ok(pdf.includes('/Subtype /Image'));
      assert.ok(pdf.includes('/SMask'));
    }
  });

  it('una firma PNG con los datos dañados rechaza la promesa sin tumbar el proceso', async () => {
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      await assert.rejects(renderPdf(nota(1), { firmaImagen: imagen }), /firma/, caso);
    }
    // La descompresión de png-js es asíncrona: si alguna imagen llegara a PDFKit, su error aparecería después
    await new Promise(resolve => setTimeout(resolve, 300));
  });
});

describe('validarImagenFirma', () => {
  it('acepta PNG (también RGBA) y JPEG sanos, con el mime o deduciéndolo de los bytes', () => {
    const sanas = [[PNG, 'image/png'], [pngRgba(), 'image/png'], [pngRgba({ ancho: 300, alto: 120 }), 'image/png'],
      [pngRgba({ ancho: 37, alto: 23, entrelazado: true }), 'image/png'], [jpegMinimo(), 'image/jpeg']];
    for (const [imagen, mime] of sanas) {
      assert.doesNotThrow(() => validarImagenFirma(imagen, mime));
      assert.doesNotThrow(() => validarImagenFirma(imagen));
    }
  });

  it('rechaza los PNG con la cabecera válida y los datos dañados, con un mensaje claro', () => {
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      assert.throws(() => validarImagenFirma(imagen, 'image/png'), (error) => {
        assert.ok(error instanceof Error, caso);
        assert.match(error.message, /^La imagen de la firma no es válida: /, caso);
        return true;
      });
    }
  });

  it('rechaza un PNG demasiado grande para decodificarlo', () => {
    assert.throws(() => validarImagenFirma(pngRgba({ ancho: 4001, alto: 1 }), 'image/png'), /4001 × 1 píxeles/);
  });

  it('rechaza JPEG incompletos o sin cabecera de imagen, y un mime que no corresponde', () => {
    const jpeg = jpegMinimo();
    assert.throws(() => validarImagenFirma(jpeg.subarray(0, jpeg.length - 2), 'image/jpeg'), /falta el final del JPEG/);
    const sinCuadro = Buffer.concat([jpeg.subarray(0, 89), jpeg.subarray(102)]); // sin el segmento SOF0
    assert.throws(() => validarImagenFirma(sinCuadro, 'image/jpeg'), /firma no es válida/);
    assert.throws(() => validarImagenFirma(jpeg, 'image/png'), /no es un PNG/);
    assert.throws(() => validarImagenFirma(PNG, 'image/gif'), /PNG o JPEG/);
    assert.throws(() => validarImagenFirma(Buffer.alloc(0)), /vacío/);
  });
});

// Maquetación: se renderizan notas de 1 a 30 datasets (avisos y reiteraciones, 6 y 7 columnas)
// y se revisan las reglas de la hoja oficio en cada una.
describe('renderPdf: maquetación', () => {
  // Distintos largos de título dan alturas de fila distintas y, con ellas, cortes de hoja en lugares distintos
  const titulos = {
    largo: (i) => `Dataset ${i} con un título bastante largo para que ocupe más de una línea en la tabla del PDF`,
    corto: (i) => `Dataset ${i}`,
    variado: (i) => `Dataset ${i} ${'palabra '.repeat((i * 7) % 23)}`.trim()
  };
  const CASOS = [
    { tipo: 'aviso', gestion: 'externa', titulo: 'largo' },
    { tipo: 'aviso', gestion: 'externa', titulo: 'corto' },
    { tipo: 'aviso', gestion: 'interna', titulo: 'variado' },
    { tipo: 'reiteracion', gestion: 'externa', titulo: 'largo' },
    { tipo: 'reiteracion', gestion: 'interna', titulo: 'variado' }
  ];
  const informado = { numero: 9, anio: 2026, fecha: '2026-10-01' };
  const notaDe = ({ tipo, gestion, titulo }, cantidad) => nota(cantidad, {
    tipo, gestion,
    datasets: Array.from({ length: cantidad }, (_, i) => ({
      ...dataset(i + 1), titulo: titulos[titulo](i + 1),
      ...(tipo === 'aviso' ? {} : { antecedente: null, informado, reiteraciones: 1 })
    }))
  });

  const renderizadas = [];
  before(async () => {
    for (const caso of CASOS) {
      for (let cantidad = 1; cantidad <= 30; cantidad++) {
        const n = notaDe(caso, cantidad);
        renderizadas.push({ etiqueta: `${caso.tipo}/${caso.gestion}/${caso.titulo} con ${cantidad} datasets`, nota: n, hojas: lineasPorHoja(await renderPdf(n)) });
      }
    }
  });

  const juntas = (lineas) => lineas.join(' ');
  const esPie = (linea) => /Página \d+ de \d+/.test(linea);
  const esFila = (linea) => /^Dataset \d+\b/.test(linea);

  // Tablas mal cortadas en una hoja: título de sección sin su encabezado, o encabezado sin su primera fila
  const problemasDeTabla = (lineas, titulos) => {
    const problemas = [];
    lineas.forEach((linea, i) => {
      const fila = lineas.findIndex((l, j) => j > i && esFila(l));
      if (titulos.includes(linea)) {
        const encabezado = lineas.indexOf('Conjunto de datos', i);
        if (encabezado === -1 || (fila !== -1 && fila < encabezado)) problemas.push(`el título "${linea}" quedó sin su tabla`);
      }
      if (linea === 'Conjunto de datos') {
        const corte = lineas.findIndex((l, j) => j > i && (l === 'Conjunto de datos' || titulos.includes(l) || l === 'Justificación:' || l.startsWith('Datos de contacto')));
        if (fila === -1 || (corte !== -1 && corte < fila)) problemas.push('encabezado de tabla sin su primera fila');
      }
    });
    return problemas;
  };

  it('el extractor de texto lee las hojas del PDF', () => {
    const { hojas } = renderizadas[0];
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Conjunto de datos'), hojas[0].join(' | '));
    assert.ok(hojas[0].some(l => l.startsWith('REF.:')));
  });

  it('las notas de varias hojas llevan un solo pie "Página p de t" por hoja y las de una hoja ninguno', () => {
    for (const { etiqueta, nota: n, hojas } of renderizadas) {
      hojas.forEach((lineas, i) => {
        const esperado = hojas.length === 1 ? [] : [`Nota Digital N° ${n.numeroTexto} – Página ${i + 1} de ${hojas.length}`];
        assert.deepEqual(lineas.filter(esPie), esperado, `${etiqueta}, hoja ${i + 1}`);
      });
    }
    assert.ok(renderizadas.some(r => r.hojas.length >= 3), 'ningún caso llegó a 3 hojas');
  });

  it('una nota de 60 datasets numera todas sus hojas', async () => {
    const hojas = lineasPorHoja(await renderPdf(nota(60), { firmaImagen: PNG }));
    assert.ok(hojas.length >= 3);
    hojas.forEach((lineas, i) => assert.deepEqual(lineas.filter(esPie), [`Nota Digital N° 12/26 – Página ${i + 1} de ${hojas.length}`]));
  });

  it('"Justificación:" y su párrafo están siempre en la misma hoja', () => {
    for (const { etiqueta, nota: n, hojas } of renderizadas) {
      const inicio = n.justificacion[0].slice(0, 25);
      const conTitulo = hojas.filter(lineas => lineas.includes('Justificación:'));
      assert.equal(conTitulo.length, 1, etiqueta);
      assert.ok(juntas(conTitulo[0]).includes(inicio), `${etiqueta}: el título quedó sin su párrafo`);
    }
  });

  it('el último párrafo, el remitente, la firma y la línea CC cierran la última hoja', () => {
    for (const { etiqueta, nota: n, hojas } of renderizadas) {
      const ultima = hojas.at(-1);
      assert.ok(juntas(ultima).includes(n.justificacion.at(-1).slice(0, 25)), `${etiqueta}: falta el último párrafo`);
      assert.ok(juntas(ultima).includes(n.remitente), `${etiqueta}: falta el remitente`);
      assert.ok(ultima.includes(n.firma.nombre) && ultima.includes(n.firma.cargo), `${etiqueta}: falta la firma`);
      assert.ok(juntas(ultima).includes(n.lineaCc), `${etiqueta}: falta la línea CC`);
      for (const anterior of hojas.slice(0, -1)) {
        assert.ok(!juntas(anterior).includes(n.remitente) && !anterior.includes(n.firma.nombre), `${etiqueta}: el cierre se partió entre hojas`);
      }
    }
  });

  it('cada antecedente está en la misma hoja que su dataset', () => {
    let total = 0;
    for (const { etiqueta, hojas } of renderizadas.filter(r => r.nota.tipo === 'aviso')) {
      for (const lineas of hojas) {
        let ultimo = null;
        for (const linea of lineas) {
          const fila = linea.match(/^Dataset (\d+)\b/);
          if (fila) ultimo = Number(fila[1]);
          if (linea.startsWith('Antecedente:')) {
            total++;
            assert.ok(ultimo !== null && ultimo % 3 === 0, `${etiqueta}: antecedente sin su dataset en la hoja (último: ${ultimo})`);
          }
        }
      }
    }
    // Tienen antecedente los múltiplos de 3: una nota de n datasets muestra floor(n / 3)
    const porCaso = Array.from({ length: 30 }, (_, i) => Math.floor((i + 1) / 3)).reduce((a, b) => a + b, 0);
    assert.equal(total, porCaso * CASOS.filter(c => c.tipo === 'aviso').length);
  });

  it('el encabezado de la tabla se repite en cada hoja que tiene filas y nunca queda solo', () => {
    for (const { etiqueta, nota: n, hojas } of renderizadas) {
      const titulos = n.secciones.map(seccion => seccion.titulo);
      hojas.forEach((lineas, i) => {
        assert.equal(lineas.includes('Conjunto de datos'), lineas.some(esFila), `${etiqueta}, hoja ${i + 1}: filas sin encabezado`);
        assert.deepEqual(problemasDeTabla(lineas, titulos), [], `${etiqueta}, hoja ${i + 1}`);
      });
    }
  });

  it('el título de cada sección, su encabezado y su primera fila no se separan aunque la fila sea alta', async () => {
    let cortes = 0;
    for (let palabras = 0; palabras <= 150; palabras += 3) {
      const n = nota(3, { datasets: [1, 2, 3].map(i => ({ ...dataset(i), titulo: `Dataset ${i} ${'palabra '.repeat(palabras)}`.trim() })) });
      const hojas = lineasPorHoja(await renderPdf(n));
      cortes += hojas.length - 1;
      const titulos = n.secciones.map(seccion => seccion.titulo);
      hojas.forEach((lineas, i) => assert.deepEqual(problemasDeTabla(lineas, titulos), [], `títulos de ${palabras} palabras, hoja ${i + 1}`));
    }
    assert.ok(cortes > 10, `el barrido apenas cortó hojas (${cortes})`);
  });

  it('las notas de reiteración (7 columnas) no cortan fechas ni palabras de la tabla', () => {
    const { hojas } = renderizadas.find(r => r.etiqueta === 'reiteracion/externa/largo con 5 datasets');
    const lineas = hojas.flat();
    for (const palabra of ['Anualmente', '31/12/2026', 'Frecuencia', 'actualización']) {
      assert.ok(lineas.some(l => l.includes(palabra)), `no se encontró "${palabra}" entera`);
    }
  });
});
