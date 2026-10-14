// PDF de las Notas Digitales
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import { construirNota } from '../services/notasDigitalesContenido.js';
import { renderPdf, validarImagenFirma, validarImagenMembrete } from '../services/notasDigitalesPdf.js';
import { pngRgba, pngRgb, pngsDanados, jpegMinimo } from './firma-fixtures.js';
import { lineasPorHoja, textosPorHoja, imagenesPorHoja, imagenesGuardadas } from './pdf-lector.js';

// PNG válido de 1x1 píxel
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const MM = 72 / 25.4;
const ANCHO_HOJA = 216 * MM;
const ALTO_HOJA = 330 * MM;
// Banner con las proporciones del real (1241 × 178 píxeles), generado acá: la imagen institucional no se versiona
const BANNER = pngRgb({ ancho: 1241, alto: 178 });
// El banner real es RGBA: PDFKit lo decodifica con png-js (asíncrono) y le separa la máscara de transparencia
const BANNER_RGBA = pngRgba({ ancho: 1241, alto: 178 });
const ALTO_BANNER = ANCHO_HOJA * 178 / 1241;
// Un banner que llega al tope de 45 mm: margen superior de 54 mm, el peor caso de espacio útil en la hoja
const BANNER_TOPE = pngRgba({ ancho: 400, alto: 300 });
const PIE = 'www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.';
// Helvetica: ascendente y descendente, en fracción del tamaño de la letra
const ASCENDENTE = 0.718;
const DESCENDENTE = 0.207;
const cerca = (a, b, tolerancia = 0.01) => Math.abs(a - b) <= tolerancia;
// Borde superior de una línea de texto medido desde arriba de la hoja (donde la ubicó PDFKit)
const tope = (t) => ALTO_HOJA - t.base - ASCENDENTE * t.tamano;
const anchoDe = (texto, tamano) => new PDFDocument({ autoFirstPage: false }).font('Helvetica').fontSize(tamano).widthOfString(texto);
const esPaginacion = (linea) => /Página \d+ de \d+/.test(linea);
const esDelMembrete = (error) => error instanceof Error && /^La imagen del membrete no es válida: /.test(error.message);

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

  it('el aviso lleva la línea del anexo antes de "Justificación:"; la reiteración no', async () => {
    for (const [cantidad, linea] of [[1, 'Anexo: reporte de los conjuntos de datos (1 hoja).'], [2, 'Anexo: reporte de los conjuntos de datos (2 hojas).']]) {
      const lineas = lineasPorHoja(await renderPdf(nota(cantidad))).flat();
      assert.equal(lineas.filter(l => l === linea).length, 1, lineas.join(' | '));
      assert.ok(lineas.indexOf(linea) < lineas.indexOf('Justificación:'), lineas.join(' | '));
    }
    const reiteracion = lineasPorHoja(await renderPdf(nota(2, { tipo: 'reiteracion' }))).flat();
    assert.ok(!reiteracion.some(l => l.startsWith('Anexo:')), reiteracion.join(' | '));
  });

  it('la línea del anexo es un párrafo propio: tiene más aire arriba que el que separa dos contactos, y no menos que abajo', async () => {
    const areas = [1, 2].map(k => ({ id: k, nombre: `Área ${k}`, email_principal: `area${k}@rpad.test`, telefono_area: '297 400-0000' }));
    const textos = textosPorHoja(await renderPdf(nota(2, { areas }))).flat();
    // Borde superior e inferior del texto de una línea, desde el borde inferior de la hoja
    const arriba = (t) => t.base + ASCENDENTE * t.tamano;
    const abajo = (t) => t.base - DESCENDENTE * t.tamano;
    const indice = (texto) => textos.findIndex(t => t.texto === texto);
    const anexo = indice('Anexo: reporte de los conjuntos de datos (2 hojas).');
    const segundo = indice('Área 2');
    assert.ok(anexo > 0 && segundo > 0, textos.map(t => t.texto).join(' | '));
    const entreContactos = abajo(textos[segundo - 1]) - arriba(textos[segundo]);
    const antes = abajo(textos[anexo - 1]) - arriba(textos[anexo]);
    const despues = abajo(textos[anexo]) - arriba(textos[indice('Justificación:')]);
    assert.equal(textos[anexo - 1].texto, 'Teléfono: 297 400-0000');
    assert.ok(antes > entreContactos + 3, `arriba del anexo ${antes.toFixed(1)} pt; entre dos contactos ${entreContactos.toFixed(1)} pt`);
    assert.ok(antes >= despues, `arriba del anexo ${antes.toFixed(1)} pt; abajo ${despues.toFixed(1)} pt`);
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

// Reiteración externa con los valores reales del 02/11/2026 (títulos, áreas y frecuencias del portal, públicos):
// la tabla de 7 columnas es la más angosta, y las áreas y frecuencias traen palabras largas
const REITERACION_REAL = [
  ['Parque Automotor (Patentamiento)', 'Dirección de Información Tributaria. Dirección General de Análisis y Administración Tributaria', 'Anualmente', '2022-12-31', '2024-01-31'],
  ['Siniestros viales por categoría', 'Agencia Provincial de Seguridad Vial', 'Anualmente', '2023-12-31', '2025-01-31'],
  ['Ejecución presupuestaria', 'Subsecretaria de Coordinación Económica y Control de Gestión', 'Cada medio año', '2025-06-30', '2025-07-31'],
  ['Presupuesto Municipal', 'Secretaría de Economía, Finanzas y Control de Gestión', 'Anualmente', '2025-01-31', '2026-01-31'],
  ['Obra Pública', 'Secretaría de Infraestructura, Obras y Servicios Públicos', 'Cada medio año', '2025-07-31', '2026-01-31'],
  ['Listado de Proveedores', 'Dirección General de Servicios Administrativos', 'Anualmente', '2025-09-29', '2026-07-31'],
  ['Directores Generales de Planta Permanente', 'Dirección General de Relaciones Laborales', 'Cada medio año', '2026-02-04', '2026-07-31'],
  ['Pedidos de Acceso a la Información Pública', 'Agencia de Acceso a la Información Pública', 'Cuatrimestralmente', '2026-06-30', '2026-11-30']
].map(([titulo, area, frecuencia, ultima, vencimiento], i) => ({
  id: i + 1, titulo, url_dataset: `https://datos.comodoro.gov.ar/dataset/${i + 1}`, area_id: i + 1, area_nombre: area,
  frecuencia_nombre: frecuencia, ultima_actualizacion: ultima, vencimiento, informado: { numero: 2, anio: 2026, fecha: '2026-10-13' },
  reiteraciones: 0, antecedente: null
}));
const reiteracionReal = (cambios = {}) => nota(0, { tipo: 'reiteracion', datasets: REITERACION_REAL, areas: [], ...cambios });
// Palabras de un texto como las separa PDFKit para partir líneas (en los espacios)
const palabras = (texto) => String(texto).split(/\s+/).filter(Boolean);

describe('renderPdf: tabla de 7 columnas de la reiteración con valores reales', () => {
  it('no parte ninguna palabra de las columnas que no son el título: "Secretaría de Infraestructura, …" entera', async () => {
    const n = reiteracionReal();
    const lineas = lineasPorHoja(await renderPdf(n)).flat();
    const enteras = new Set(lineas.flatMap(palabras));
    // Ninguna línea termina en una letra suelta ni empieza con el resto de "Infraestructura,"
    assert.ok(!lineas.some(l => / I$/.test(l) || l.startsWith('nfraestructura')), lineas.join(' | '));
    const partidas = [];
    for (const seccion of n.secciones) {
      for (const texto of [...seccion.columnas.slice(1), ...seccion.filas.flatMap(f => f.valores.slice(1))]) {
        for (const palabra of palabras(texto)) if (!enteras.has(palabra)) partidas.push(`"${palabra}" (de "${texto}")`);
      }
    }
    assert.deepEqual(partidas, [], lineas.join(' | '));
  });

  it('si los mínimos de las columnas no entran, cede primero el título y las demás palabras siguen enteras', async () => {
    // En la sección de próximos a vencer (una fila, con "Cuatrimestralmente"), un área con una palabra de 91 puntos:
    // con el título en su mínimo de siempre la tabla no entra
    const datasets = REITERACION_REAL.map(d => (d.frecuencia_nombre === 'Cuatrimestralmente' ? { ...d, area_nombre: 'Dirección de Interjurisdiccionalidades' } : d));
    const n = reiteracionReal({ datasets });
    const textos = textosPorHoja(await renderPdf(n)).flat();
    const enteras = new Set(textos.flatMap(t => palabras(t.texto)));
    const partidas = n.secciones.flatMap(s => [...s.columnas.slice(1), ...s.filas.flatMap(f => f.valores.slice(1))])
      .flatMap(palabras).filter(palabra => !enteras.has(palabra));
    assert.deepEqual(partidas, [], textos.map(t => t.texto).join(' | '));
    // Y la tabla sigue dentro de los márgenes
    for (const t of textos) assert.ok(t.x + anchoDe(t.texto, t.tamano) <= ANCHO_HOJA - 30 * MM + 0.5, `"${t.texto}" sale del margen derecho`);
  });
});

describe('renderPdf: membrete', () => {
  const conMembrete = (cambios = {}) => ({ membreteImagen: BANNER, membretePie: PIE, ...cambios });
  const enElBorde = (imagen) => cerca(imagen.y, 0);

  it('dibuja el banner arriba de todas las hojas, a lo ancho de la hoja con su alto proporcional, y lo guarda una sola vez', async () => {
    // RGB, y RGBA como el real (PDFKit lo decodifica aparte y le agrega su máscara de transparencia)
    for (const [banner, guardadas] of [[BANNER, 1], [BANNER_RGBA, 2]]) {
      const pdf = await renderPdf(nota(60), { firmaImagen: PNG, ...conMembrete({ membreteImagen: banner }) });
      const hojas = imagenesPorHoja(pdf);
      assert.ok(hojas.length >= 3, `hojas: ${hojas.length}`);
      hojas.forEach((imagenes, i) => {
        const banners = imagenes.filter(enElBorde);
        assert.equal(banners.length, 1, `hoja ${i + 1}: ${JSON.stringify(imagenes)}`);
        const [dibujado] = banners;
        assert.ok(cerca(dibujado.x, 0) && cerca(dibujado.ancho, ANCHO_HOJA) && cerca(dibujado.alto, ALTO_BANNER), `hoja ${i + 1}: ${JSON.stringify(dibujado)}`);
      });
      // Todas las hojas dibujan el mismo objeto: el archivo guarda el banner una sola vez (y su máscara, si es RGBA)
      assert.equal(new Set(hojas.flat().filter(enElBorde).map(imagen => imagen.nombre)).size, 1);
      assert.deepEqual(imagenesGuardadas(pdf).filter(imagen => imagen.ancho === 1241), Array(guardadas).fill({ ancho: 1241, alto: 178 }));
    }
  });

  it('el contenido de cada hoja empieza debajo del banner: margen superior del alto del banner más 9 mm (40 mm con el real)', async () => {
    const margen = ALTO_BANNER + 9 * MM;
    assert.ok(cerca(margen / MM, 40, 0.1), `margen: ${margen / MM} mm`);
    const hojas = textosPorHoja(await renderPdf(nota(60), conMembrete()));
    assert.ok(hojas.length >= 3);
    assert.ok(hojas[0][0].texto.startsWith('REF.:'), hojas[0][0].texto);
    assert.ok(cerca(tope(hojas[0][0]), margen), `REF.: a ${tope(hojas[0][0]) / MM} mm del borde`);
    hojas.forEach((lineas, i) => {
      // La primera línea de cada hoja va en el margen (o 3 puntos abajo, dentro de la celda del encabezado de la tabla)
      const arriba = Math.min(...lineas.map(tope));
      assert.ok(arriba >= margen - 0.01 && arriba <= margen + 3.01, `hoja ${i + 1}: la primera línea está a ${arriba / MM} mm del borde`);
    });
  });

  it('un banner alto se achica para entrar en 45 mm, centrado, y el margen superior queda en 54 mm', async () => {
    const pdf = await renderPdf(nota(1), conMembrete({ membreteImagen: pngRgb({ ancho: 200, alto: 100 }) }));
    const [banner] = imagenesPorHoja(pdf)[0];
    assert.ok(cerca(banner.alto, 45 * MM) && cerca(banner.ancho, 90 * MM), JSON.stringify(banner));
    assert.ok(cerca(banner.x, (ANCHO_HOJA - 90 * MM) / 2) && cerca(banner.y, 0), JSON.stringify(banner));
    assert.ok(cerca(tope(textosPorHoja(pdf)[0][0]), 54 * MM));
  });

  it('un banner JPEG guardado girado (orientación EXIF 5 a 8) se dibuja derecho, a lo ancho, con el margen de su alto a la vista', async () => {
    // Guardado vertical (40 × 200 píxeles); con la orientación EXIF se ve apaisado, 200 × 40, como en la pantalla
    const alto = ANCHO_HOJA * 40 / 200;
    for (const orientacion of [5, 6, 7, 8]) {
      const pdf = await renderPdf(nota(1), { membreteImagen: jpegMinimo({ ancho: 40, alto: 200, orientacion }) });
      const [banner] = imagenesPorHoja(pdf)[0];
      assert.ok(cerca(banner.x, 0) && cerca(banner.y, 0) && cerca(banner.ancho, ANCHO_HOJA) && cerca(banner.alto, alto),
        `orientación ${orientacion}: ${JSON.stringify(banner)}`);
      assert.ok(cerca(tope(textosPorHoja(pdf)[0][0]), alto + 9 * MM), `orientación ${orientacion}`);
    }
    // Sin giro (o girado 180°) el tamaño guardado es el que se ve: un JPEG apaisado de 200 × 40
    for (const orientacion of [null, 1, 3]) {
      const [banner] = imagenesPorHoja(await renderPdf(nota(1), { membreteImagen: jpegMinimo({ ancho: 200, alto: 40, orientacion }) }))[0];
      assert.ok(cerca(banner.ancho, ANCHO_HOJA) && cerca(banner.alto, alto), `orientación ${orientacion}: ${JSON.stringify(banner)}`);
    }
  });

  it('con un banner muy bajo el margen superior no baja de 25 mm', async () => {
    const pdf = await renderPdf(nota(1), conMembrete({ membreteImagen: pngRgb({ ancho: 1000, alto: 20 }) }));
    const [banner] = imagenesPorHoja(pdf)[0];
    assert.ok(cerca(banner.ancho, ANCHO_HOJA) && cerca(banner.alto, ANCHO_HOJA * 20 / 1000), JSON.stringify(banner));
    assert.ok(cerca(tope(textosPorHoja(pdf)[0][0]), 25 * MM));
  });

  it('el pie del membrete va en todas las hojas: Helvetica 10, centrado, con la línea de base a 12,5 mm del borde inferior', async () => {
    const hojas = textosPorHoja(await renderPdf(nota(60), conMembrete()));
    assert.ok(hojas.length >= 3);
    hojas.forEach((lineas, i) => {
      const pies = lineas.filter(t => t.texto === PIE);
      assert.equal(pies.length, 1, `hoja ${i + 1}`);
      const [pie] = pies;
      assert.equal(pie.tamano, 10);
      assert.ok(cerca(pie.base, 12.5 * MM), `hoja ${i + 1}: línea de base a ${pie.base / MM} mm`);
      assert.ok(cerca(pie.x + anchoDe(PIE, 10) / 2, ANCHO_HOJA / 2), `hoja ${i + 1}: no está centrado`);
    });
  });

  it('"Página p de t" va arriba del pie del membrete sin tocarlo, y los dos quedan debajo del contenido', async () => {
    for (const [caso, opciones] of [['banner y pie', conMembrete()], ['solo el pie', { membretePie: PIE }]]) {
      const hojas = textosPorHoja(await renderPdf(nota(60), opciones));
      assert.ok(hojas.length >= 3, caso);
      hojas.forEach((lineas, i) => {
        const etiqueta = `${caso}, hoja ${i + 1}`;
        const pagina = lineas.find(t => esPaginacion(t.texto));
        const pie = lineas.find(t => t.texto === PIE);
        assert.ok(pagina && pie, etiqueta);
        const separacion = (pagina.base - DESCENDENTE * pagina.tamano) - (pie.base + ASCENDENTE * pie.tamano);
        assert.ok(separacion >= 2, `${etiqueta}: "Página" y el pie del membrete están a ${separacion} puntos`);
        // El contenido termina en el margen inferior de 25 mm; "Página" queda más abajo, con aire
        assert.ok(pagina.base + ASCENDENTE * pagina.tamano <= 25 * MM - 2, `${etiqueta}: "Página" invade el margen inferior`);
        for (const t of lineas.filter(l => l !== pagina && l !== pie)) {
          assert.ok(t.base - DESCENDENTE * t.tamano >= 25 * MM - 0.01, `${etiqueta}: "${t.texto}" baja del margen inferior`);
        }
      });
    }
  });

  it('sin pie del membrete, "Página p de t" queda donde estaba, a 12,5 mm del borde inferior', async () => {
    for (const opciones of [{}, { membreteImagen: BANNER }, { membreteImagen: BANNER, membretePie: '   ' }, { membretePie: null }]) {
      const hojas = textosPorHoja(await renderPdf(nota(60), opciones));
      assert.ok(hojas.length >= 3);
      hojas.forEach((lineas, i) => {
        const etiqueta = `${JSON.stringify(Object.keys(opciones))}, hoja ${i + 1}`;
        assert.ok(!lineas.some(t => t.texto.includes('comodoroweb')), etiqueta);
        const pagina = lineas.find(t => esPaginacion(t.texto));
        assert.ok(cerca(tope(pagina), ALTO_HOJA - 12.5 * MM), `${etiqueta}: "Página" a ${(ALTO_HOJA - tope(pagina)) / MM} mm del borde`);
      });
    }
  });

  it('sin banner ni pie el PDF queda como antes: margen superior de 25 mm, sin imágenes ni membrete', async () => {
    for (const opciones of [{}, { membreteImagen: null, membretePie: null }, { membretePie: '' }]) {
      const pdf = await renderPdf(nota(60), opciones);
      const hojas = textosPorHoja(pdf);
      assert.ok(cerca(tope(hojas[0][0]), 25 * MM));
      assert.deepEqual(imagenesGuardadas(pdf), []);
      hojas.forEach(lineas => assert.ok(!lineas.some(t => t.texto.includes('comodoroweb'))));
    }
  });

  it('un pie largo o con saltos de línea se escribe en una sola línea, achicado para entrar entre los márgenes', async () => {
    const largo = 'Texto institucional del pie '.repeat(4).trim();
    for (const [pie, esperado] of [[largo, largo], ['Primera línea\nSegunda  línea ', 'Primera línea Segunda línea']]) {
      const hojas = textosPorHoja(await renderPdf(nota(60), { membretePie: pie }));
      hojas.forEach((lineas, i) => {
        const pies = lineas.filter(t => t.texto === esperado);
        assert.equal(pies.length, 1, `hoja ${i + 1}: ${lineas.slice(-3).map(t => t.texto).join(' | ')}`);
        const [linea] = pies;
        const ancho = anchoDe(esperado, linea.tamano);
        assert.ok(linea.tamano <= 10 && linea.tamano >= 7, `tamaño ${linea.tamano}`);
        assert.ok(linea.x >= 30 * MM - 0.01 && linea.x + ancho <= ANCHO_HOJA - 30 * MM + 0.01, `x: ${linea.x}, ancho: ${ancho}`);
        assert.ok(cerca(linea.base, 12.5 * MM));
      });
    }
    assert.ok(anchoDe(largo, 10) > ANCHO_HOJA - 60 * MM, 'el pie de prueba entraba sin achicarlo');
  });

  it('el pie nunca baja de 7 puntos: uno que no entra ni así sale en 7 puntos, centrado (la configuración no lo deja guardar)', async () => {
    const larguisimo = `${'Texto institucional del pie '.repeat(10)}fin`.slice(0, 300);
    assert.ok(anchoDe(larguisimo, 7) > ANCHO_HOJA - 60 * MM, 'el pie de prueba entraba en 7 puntos');
    const hojas = textosPorHoja(await renderPdf(nota(60), { membretePie: larguisimo }));
    hojas.forEach((lineas, i) => {
      const [linea] = lineas.filter(t => t.texto === larguisimo);
      assert.ok(linea, `hoja ${i + 1}`);
      assert.equal(linea.tamano, 7);
      assert.ok(cerca(linea.x + anchoDe(larguisimo, 7) / 2, ANCHO_HOJA / 2), `hoja ${i + 1}: no está centrado`);
    });
  });

  it('un banner con los datos dañados rechaza la promesa con un mensaje del membrete, sin tumbar el proceso', async () => {
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      await assert.rejects(renderPdf(nota(1), { membreteImagen: imagen }), esDelMembrete, caso);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  });
});

// Helvetica escribe un byte por carácter (WinAnsi, CP1252): cualquier otro carácter salía como basura y desordenaba
// el resto de la línea. Todo texto pasa por NFC y lo que no se puede escribir sale como "?".
describe('renderPdf: texto que Helvetica puede escribir', () => {
  const NFD = (cadena) => cadena.normalize('NFD');
  // Una línea limpia solo tiene caracteres de CP1252 imprimibles (la basura traía controles y desplazamientos)
  const limpia = (linea) => /^[\x20-\x7e\xa0-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/.test(linea);

  it('un pie y un título de dataset con los acentos descompuestos (NFD) se escriben bien', async () => {
    const titulo = 'Información pública de Gestión';
    const pie = 'Gestión Comodoro Rivadavia – Atención al vecino';
    assert.notEqual(NFD(titulo), titulo);
    const n = nota(2, { datasets: [{ ...dataset(1), titulo: NFD(titulo) }, dataset(2)] });
    const lineas = lineasPorHoja(await renderPdf(n, { membretePie: NFD(pie) })).flat();
    assert.ok(lineas.includes(pie), lineas.slice(-3).join(' | '));
    assert.ok(lineas.join(' ').includes(titulo), lineas.join(' | '));
    assert.ok(lineas.every(limpia), lineas.filter(l => !limpia(l)).join(' | '));
  });

  it('un carácter que Helvetica no tiene (☎, →, emojis, uso privado) sale como "?" y el resto de la fila queda en su lugar', async () => {
    const n = nota(2, { datasets: [{ ...dataset(1), titulo: 'Dataset 1 ☎ Teléfono → Sí 😀 fin' }, dataset(2)] });
    const hojas = lineasPorHoja(await renderPdf(n));
    const lineas = hojas.flat();
    assert.ok(lineas.join(' ').includes('Dataset 1 ? Teléfono ? Sí ? fin?'), lineas.join(' | '));
    assert.ok(lineas.every(limpia), lineas.filter(l => !limpia(l)).join(' | '));
    // Las demás celdas de la fila siguen enteras
    for (const celda of ['Área de prueba', 'Anualmente', '31/12/2025', '31/12/2026']) assert.ok(lineas.includes(celda), celda);
  });

  it('todo texto de la nota pasa por el resguardo: área, contactos, firma, línea CC y pie del membrete', async () => {
    const n = nota(1, {
      datasets: [{ ...dataset(1), area_nombre: NFD('Área ☎ Norte') }],
      areas: [{ id: 1, nombre: NFD('Área ☎ Norte'), email_principal: 'area@rpad.test', telefono_area: '☎ 297 400-0000\t(int. 12)' }],
      config: { ...config, firma_nombre: NFD('José Pérez'), firma_cargo: 'Director → Datos', linea_cc_externa: NFD('CC. Dirección ✉ Administrativa') }
    });
    const lineas = lineasPorHoja(await renderPdf(n, { firmaImagen: PNG, membretePie: 'Pie ✉ correo' })).flat();
    const todo = lineas.join(' ');
    for (const esperado of ['Área ? Norte', '? 297 400-0000 (int. 12)', 'José Pérez', 'Director ? Datos', 'CC. Dirección ? Administrativa', 'Pie ? correo']) {
      assert.ok(todo.includes(esperado), `falta "${esperado}": ${lineas.join(' | ')}`);
    }
    assert.ok(lineas.every(limpia), lineas.filter(l => !limpia(l)).join(' | '));
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

describe('validarImagenMembrete', () => {
  it('acepta un banner PNG o JPEG sano y rechaza los dañados con un mensaje que dice "membrete"', () => {
    for (const [imagen, mime] of [[BANNER, 'image/png'], [pngRgba(), 'image/png'], [jpegMinimo(), 'image/jpeg']]) {
      assert.doesNotThrow(() => validarImagenMembrete(imagen, mime));
      assert.doesNotThrow(() => validarImagenMembrete(imagen));
    }
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      assert.throws(() => validarImagenMembrete(imagen, 'image/png'), esDelMembrete, caso);
    }
    assert.throws(() => validarImagenMembrete(Buffer.alloc(0)), (error) => error.message === 'La imagen del membrete no es válida: el archivo está vacío');
    assert.throws(() => validarImagenMembrete(PNG, 'image/gif'), (error) => error.message === 'La imagen del membrete no es válida: debe ser PNG o JPEG');
  });
});

// Maquetación: se renderizan notas de 1 a 30 datasets (avisos y reiteraciones, 6 y 7 columnas)
// y se revisan las reglas de la hoja oficio en cada una, sin membrete y con el banner y el pie del membrete
// (el banner corre hacia abajo el margen superior de todas las hojas): con un banner RGBA de las proporciones del
// real (margen de unos 40 mm) y con uno en el tope de 45 mm (margen de 54 mm).
const VARIANTES = [
  { nombre: 'sin membrete', opciones: {} },
  {
    nombre: 'con el banner real (RGBA) y el pie del membrete', margen: ALTO_BANNER + 9 * MM,
    opciones: { membreteImagen: BANNER_RGBA, membretePie: PIE }
  },
  {
    nombre: 'con un banner en el tope de 45 mm y el pie del membrete', margen: 54 * MM,
    opciones: { membreteImagen: BANNER_TOPE, membretePie: PIE }
  }
];

for (const variante of VARIANTES) {
  describe(`renderPdf: maquetación ${variante.nombre}`, () => {
    const render = (n, opciones = {}) => renderPdf(n, { ...variante.opciones, ...opciones });
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
          const textos = textosPorHoja(await render(n));
          renderizadas.push({
            etiqueta: `${caso.tipo}/${caso.gestion}/${caso.titulo} con ${cantidad} datasets`, nota: n, textos,
            hojas: textos.map(lineas => lineas.map(t => t.texto))
          });
        }
      }
    });

    const juntas = (lineas) => lineas.join(' ');
    // Los pies de cada hoja: "Página p de t" y el del membrete
    const esPie = (linea) => esPaginacion(linea) || linea === PIE;
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
      // (con el banner en el tope de 45 mm, hasta una nota de un dataset pasa a una segunda hoja)
      const { hojas } = renderizadas[0];
      assert.ok(hojas.length >= 1 && hojas.length <= 2, `hojas: ${hojas.length}`);
      assert.ok(hojas[0].includes('Conjunto de datos'), hojas[0].join(' | '));
      assert.ok(hojas[0][0].startsWith('REF.:'), hojas[0][0]);
      assert.ok(hojas.at(-1).includes(renderizadas[0].nota.lineaCc), hojas.at(-1).join(' | '));
    });

    it('las notas de varias hojas llevan un solo pie "Página p de t" por hoja y las de una hoja ninguno', () => {
      for (const { etiqueta, nota: n, hojas } of renderizadas) {
        hojas.forEach((lineas, i) => {
          const esperado = hojas.length === 1 ? [] : [`Nota Digital N° ${n.numeroTexto} – Página ${i + 1} de ${hojas.length}`];
          assert.deepEqual(lineas.filter(esPaginacion), esperado, `${etiqueta}, hoja ${i + 1}`);
        });
      }
      assert.ok(renderizadas.some(r => r.hojas.length >= 3), 'ningún caso llegó a 3 hojas');
    });

    it('una nota de 60 datasets numera todas sus hojas', async () => {
      const hojas = lineasPorHoja(await render(nota(60), { firmaImagen: PNG }));
      assert.ok(hojas.length >= 3);
      hojas.forEach((lineas, i) => assert.deepEqual(lineas.filter(esPaginacion), [`Nota Digital N° 12/26 – Página ${i + 1} de ${hojas.length}`]));
    });

    if (variante.opciones.membretePie) {
      it('el pie del membrete va una vez en cada hoja y ninguna línea invade el banner, el margen inferior ni los pies', () => {
        const { margen } = variante;
        for (const { etiqueta, textos } of renderizadas) {
          textos.forEach((lineas, i) => {
            const donde = `${etiqueta}, hoja ${i + 1}`;
            assert.equal(lineas.filter(t => t.texto === PIE).length, 1, donde);
            const pagina = lineas.find(t => esPaginacion(t.texto));
            const pie = lineas.find(t => t.texto === PIE);
            if (pagina) assert.ok(pagina.base - DESCENDENTE * pagina.tamano >= pie.base + ASCENDENTE * pie.tamano + 2, `${donde}: "Página" toca el pie`);
            const contenido = lineas.filter(l => !esPie(l.texto));
            for (const t of contenido) {
              assert.ok(tope(t) >= margen - 0.01, `${donde}: "${t.texto}" invade el banner`);
              assert.ok(t.base - DESCENDENTE * t.tamano >= 25 * MM - 0.01, `${donde}: "${t.texto}" baja del margen inferior`);
            }
            // La hoja empieza en el margen (o 3 puntos abajo, dentro de la celda del encabezado de la tabla)
            const arriba = Math.min(...contenido.map(tope));
            assert.ok(arriba <= margen + 3.01, `${donde}: la primera línea está a ${arriba / MM} mm del borde`);
          });
        }
      });
    }

    it('"Justificación:" y su párrafo están siempre en la misma hoja', () => {
      for (const { etiqueta, nota: n, hojas } of renderizadas) {
        const inicio = n.justificacion[0].slice(0, 25);
        const conTitulo = hojas.filter(lineas => lineas.includes('Justificación:'));
        assert.equal(conTitulo.length, 1, etiqueta);
        assert.ok(juntas(conTitulo[0]).includes(inicio), `${etiqueta}: el título quedó sin su párrafo`);
      }
    });

    it('la línea del anexo (solo avisos) está en la misma hoja que "Justificación:", justo antes', () => {
      let avisos = 0;
      for (const { etiqueta, nota: n, hojas } of renderizadas) {
        const conAnexo = hojas.filter(lineas => lineas.some(l => l.startsWith('Anexo:')));
        if (n.tipo === 'reiteracion') {
          assert.equal(conAnexo.length, 0, etiqueta);
          continue;
        }
        avisos++;
        assert.equal(conAnexo.length, 1, etiqueta);
        const lineas = conAnexo[0].filter(l => !esPie(l));
        assert.equal(lineas[lineas.indexOf(n.anexo) + 1], 'Justificación:', `${etiqueta}: el anexo no quedó junto al título de la justificación`);
      }
      assert.ok(avisos > 0);
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
        const hojas = lineasPorHoja(await render(n));
        cortes += hojas.length - 1;
        const titulos = n.secciones.map(seccion => seccion.titulo);
        hojas.forEach((lineas, i) => assert.deepEqual(problemasDeTabla(lineas, titulos), [], `títulos de ${palabras} palabras, hoja ${i + 1}`));
      }
      assert.ok(cortes > 10, `el barrido apenas cortó hojas (${cortes})`);
    });

    it('el título de los contactos nunca queda solo al pie de una hoja y cada área va entera', async () => {
      const TITULO = 'Datos de contacto de las áreas responsables';
      // Áreas con los 8 campos de contacto cargados: el bloque más alto que puede tener un contacto
      const areaCompleta = (k) => ({
        id: k, nombre: `Área completa ${k}`, area_superior: `Secretaría de prueba ${k}`, email_principal: `area${k}@rpad.test`,
        email_secundario: `alternativa${k}@rpad.test`, telefono_area: '297 400-0000', celular_area: '297 15 400-0000',
        nombre_contacto: `Persona de contacto ${k}`, telefono_contacto: '297 400-0001', email_contacto: `contacto${k}@rpad.test`
      });
      let cortes = 0;
      for (const estilo of ['largo', 'corto', 'variado']) {
        for (let cantidad = 1; cantidad <= 40; cantidad++) {
          const n = nota(cantidad, {
            datasets: Array.from({ length: cantidad }, (_, i) => ({ ...dataset(i + 1), titulo: titulos[estilo](i + 1) })),
            areas: [1, 2, 3].map(areaCompleta)
          });
          const etiqueta = `${estilo} con ${cantidad} datasets`;
          const hojas = lineasPorHoja(await render(n));
          const conTitulo = hojas.filter(lineas => lineas.includes(TITULO));
          assert.equal(conTitulo.length, 1, etiqueta);
          const siguientes = conTitulo[0].slice(conTitulo[0].indexOf(TITULO) + 1).filter(linea => !esPie(linea));
          assert.equal(siguientes[0], n.contactos[0].nombre, `${etiqueta}: el título quedó solo al pie de la hoja`);
          for (const contacto of n.contactos) {
            assert.equal(contacto.lineas.length, 8);
            const hoja = hojas.find(lineas => lineas.includes(contacto.nombre));
            assert.ok(contacto.lineas.every(linea => hoja.includes(linea)), `${etiqueta}: ${contacto.nombre} quedó partida entre hojas`);
          }
          if (hojas.indexOf(conTitulo[0]) > 0 && hojas[hojas.indexOf(conTitulo[0]) - 1].some(esFila)) cortes++;
        }
      }
      assert.ok(cortes > 10, `el barrido apenas cortó hojas antes de los contactos (${cortes})`);
    });

    it('las notas de reiteración (7 columnas) no cortan fechas ni palabras de la tabla', () => {
      const { hojas } = renderizadas.find(r => r.etiqueta === 'reiteracion/externa/largo con 5 datasets');
      const lineas = hojas.flat();
      for (const palabra of ['Anualmente', '31/12/2026', 'Frecuencia', 'actualización']) {
        assert.ok(lineas.some(l => l.includes(palabra)), `no se encontró "${palabra}" entera`);
      }
    });
  });
}
