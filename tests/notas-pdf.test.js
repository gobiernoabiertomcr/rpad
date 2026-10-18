// PDF de las Notas Digitales
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import { construirNota, construirNotaDeAutorizacion, construirNotaDeAuditoria } from '../services/notasDigitalesContenido.js';
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

// El pedido de cada dataset (spec 2026-10-17-fechas-datasets, 9): un anual acumulado pide hasta el corte, el mes anterior al
// vencimiento; cada 5, el de un presupuesto (el texto más largo, que ocupa dos renglones) y cada 7, ninguno ("—")
const pedidoDe = (i, vencimiento) => {
  if (i % 7 === 0) return null;
  if (i % 5 === 0) return { desde: '2025-01-01', hasta: '2026-12-31', texto: 'Presupuestos de los ejercicios 2025 y 2026' };
  return vencimiento === '2026-12-31'
    ? { desde: '2026-01-01', hasta: '2026-11-30', texto: 'Del 01/01/2026 al 30/11/2026' }
    : { desde: '2026-01-01', hasta: '2026-09-30', texto: 'Del 01/01/2026 al 30/09/2026' };
};
const dataset = (i, vencimiento = i % 2 ? '2026-12-31' : '2026-10-31') => ({
  id: i, titulo: `Dataset ${i} con un título bastante largo para que ocupe más de una línea en la tabla del PDF`,
  url_dataset: 'https://datos.comodoro.gov.ar/dataset/x', area_id: 1, area_nombre: 'Área de prueba',
  frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-31', vencimiento, pedido: pedidoDe(i, vencimiento),
  informado: null, reiteraciones: 0, antecedente: i % 3 ? null : { cantidad: 4, primera: '2026-01-01', ultima: '2026-10-01' }
});

const nota = (cantidad, cambios = {}) => construirNota({
  tipo: 'aviso', gestion: 'externa', numero: 12, anio: 2026, esPrueba: false, fecha: '2026-11-02',
  datasets: Array.from({ length: cantidad }, (_, i) => dataset(i + 1)),
  areas: [{ id: 1, nombre: 'Área de prueba', email_principal: 'area@rpad.test' }], config, ...cambios
});

const texto = (pdf) => pdf.toString('latin1');
const paginas = (pdf) => (texto(pdf).match(/\/Type \/Page[^s]/g) || []).length;

describe('renderPdf: fecha del remitente', () => {
  it('no parte la fecha: "2 de noviembre de 2026." queda entera en un renglón', async () => {
    for (const fecha of ['2026-11-02', '2026-09-30', '2026-02-01']) {
      const ultima = lineasPorHoja(await renderPdf(nota(2, { fecha }))).at(-1).map(l => l.replace(/ /g, ' '));
      const larga = { '2026-11-02': '2 de noviembre de 2026.', '2026-09-30': '30 de septiembre de 2026.', '2026-02-01': '1 de febrero de 2026.' }[fecha];
      assert.ok(ultima.some(l => l.includes(larga)), `la fecha ${larga} se partió: ${JSON.stringify(ultima.filter(l => /20\d\d|de /.test(l)))}`);
    }
  });
});

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
// la tabla de 7 columnas es la más angosta, y las áreas y frecuencias traen palabras largas. "Datos solicitados" lleva el
// pedido de cada uno (spec 2026-10-17-fechas-datasets, 9): todo lo que falta, un presupuesto de dos ejercicios, una foto
const REITERACION_DEL_PORTAL = [
  ['Parque Automotor (Patentamiento)', 'Dirección de Información Tributaria. Dirección General de Análisis y Administración Tributaria', 'Anualmente', '2022-12-31', '2024-01-31', 'Del 01/01/2023 al 31/12/2025'],
  ['Siniestros viales por categoría', 'Agencia Provincial de Seguridad Vial', 'Anualmente', '2023-12-31', '2025-01-31', 'Del 01/01/2024 al 31/12/2025'],
  ['Ejecución presupuestaria', 'Subsecretaria de Coordinación Económica y Control de Gestión', 'Cada medio año', '2025-06-30', '2025-07-31', 'Del 01/07/2025 al 30/06/2026'],
  ['Presupuesto Municipal', 'Secretaría de Economía, Finanzas y Control de Gestión', 'Anualmente', '2025-01-31', '2026-01-31', 'Presupuestos de los ejercicios 2025 y 2026'],
  ['Obra Pública', 'Secretaría de Infraestructura, Obras y Servicios Públicos', 'Cada medio año', '2025-07-31', '2026-01-31', 'Vigente al 30/06/2026'],
  ['Listado de Proveedores', 'Dirección General de Servicios Administrativos', 'Anualmente', '2025-09-29', '2026-07-31', 'Del 01/01/2026 al 30/06/2026'],
  ['Directores Generales de Planta Permanente', 'Dirección General de Relaciones Laborales', 'Cada medio año', '2026-02-04', '2026-07-31', 'Vigente al 30/06/2026'],
  ['Pedidos de Acceso a la Información Pública', 'Agencia de Acceso a la Información Pública', 'Cuatrimestralmente', '2026-06-30', '2026-11-30', 'Del 01/01/2026 al 31/10/2026']
].map(([titulo, area, frecuencia, ultima, vencimiento, pedido], i) => ({
  id: i + 1, titulo, url_dataset: `https://datos.comodoro.gov.ar/dataset/${i + 1}`, area_id: i + 1, area_nombre: area,
  // El tipo de pedido efectivo y los meses de la frecuencia, como los deja conPedido (spec 18): "Cada medio año" y
  // "Cuatrimestralmente" con un pedido "Del … al …" dicen "(Acumulado)"
  frecuencia_nombre: frecuencia, meses: { Anualmente: 12, 'Cada medio año': 6, Cuatrimestralmente: 4 }[frecuencia],
  tipo_pedido: pedido.startsWith('Vigente') ? 'foto' : pedido.startsWith('Presupuesto') ? 'ejercicio' : 'acumulado',
  ultima_actualizacion: ultima, vencimiento, pedido: { desde: null, hasta: null, texto: pedido },
  informado: { numero: 2, anio: 2026, fecha: '2026-10-13' }, reiteraciones: 0, antecedente: null
}));
// Dos vencidos que ya tuvieron más de un aviso (el anticipado y el de su fecha, spec 2026-10-15, 7.6): "Informado en" nombra
// todos, el texto más largo de la tabla. (Los dos son de prueba: no están en el portal.) Van al final de los vencidos.
const CON_VARIOS_AVISOS = [
  { informado: { numero: 8, anio: 2026, fecha: '2026-09-15', tambien: [{ numero: 9, anio: 2026, fecha: '2026-09-29' }] }, titulo: 'Licencias de conducir otorgadas' },
  { informado: { numero: 8, anio: 2026, fecha: '2026-09-15', tambien: [{ numero: 9, anio: 2026, fecha: '2026-09-29' }, { numero: 10, anio: 2026, fecha: '2026-10-13' }] }, titulo: 'Reclamos de alumbrado público' }
].map(({ informado, titulo }, i) => ({
  ...REITERACION_DEL_PORTAL[0], id: REITERACION_DEL_PORTAL.length + i + 1, titulo,
  url_dataset: `https://datos.comodoro.gov.ar/dataset/${REITERACION_DEL_PORTAL.length + i + 1}`,
  vencimiento: '2026-10-31', pedido: { desde: null, hasta: null, texto: 'Del 01/01/2026 al 30/09/2026' }, informado, reiteraciones: 1
}));
const REITERACION_REAL = [...REITERACION_DEL_PORTAL, ...CON_VARIOS_AVISOS];
const reiteracionReal = (cambios = {}) => nota(0, { tipo: 'reiteracion', datasets: REITERACION_REAL, areas: [], ...cambios });
// Palabras de un texto como las separa PDFKit para partir líneas (en los espacios)
const palabras = (texto) => String(texto).split(/\s+/).filter(Boolean);
const TAMANO_TABLA = 8.5;
const TAMANO_SECUNDARIO = 7;
// Las palabras de las tablas de una nota: encabezados, celdas, antecedentes y la segunda parte de "Informado en"
const palabrasDeLasTablas = (n) => new Set(n.secciones
  .flatMap(s => [...s.columnas, ...s.filas.flatMap(f => [...f.valores, f.antecedente, f.informadoAnterior])])
  .filter(Boolean).flatMap(palabras));
// Lo escrito en las tablas (en 8,5 y 7 puntos) que no es una palabra entera de ellas: el pedazo de una palabra o de una
// fecha partida entre dos renglones. (Las palabras repetidas en otras celdas no lo esconden: se mira cada renglón.)
const fragmentos = (n, textos) => {
  const enteras = palabrasDeLasTablas(n);
  return textos.filter(t => t.tamano === TAMANO_TABLA || t.tamano === TAMANO_SECUNDARIO)
    .flatMap(t => palabras(t.texto)).filter(palabra => !enteras.has(palabra));
};
// La x donde empieza el texto de cada columna: la del primer renglón de su encabezado (lo primero que se dibuja de la tabla)
const xDeLasColumnas = (textos, encabezados) => encabezados.map((encabezado) => {
  const primera = encabezado.split(' ')[0];
  return textos.find(t => t.tamano === TAMANO_TABLA && (t.texto === primera || t.texto.startsWith(`${primera} `)))?.x;
});
// Un renglón que termina en "Del" o en "al", o que es solo uno de ellos: la preposición quedó separada de su fecha
const preposicionSuelta = (renglon) => /(^|\s)(Del|al)$/.test(renglon);
// Un renglón de una tabla que termina en "N°": el signo quedó separado de su número ("Nota Digital N°" / "10/26"). Son notas formales
const numeralSuelto = (renglon) => /N°\s*$/.test(renglon);
const renglonesDeTabla = (textos) => textos.filter(t => t.tamano === TAMANO_TABLA || t.tamano === TAMANO_SECUNDARIO).map(t => t.texto);
// Los renglones de una celda: los consecutivos de la tabla que empiezan en la x de su columna y juntos dan su texto
const renglonesDeLaCelda = (textos, texto, x) => {
  const enLaColumna = textos.filter(t => t.tamano === TAMANO_TABLA && cerca(t.x, x, 0.5));
  for (let i = 0; i < enLaColumna.length; i++) {
    for (let k = 1; k <= 4 && i + k <= enLaColumna.length; k++) {
      const renglones = enLaColumna.slice(i, i + k).map(t => t.texto);
      if (renglones.join(' ') === texto) return renglones;
    }
  }
  return [];
};

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

  // Spec 18: la reiteración también dice "(Acumulado)"; la tabla de 7 columnas no parte "Cuatrimestralmente" ni "(Acumulado)"
  it('la frecuencia dice "(Acumulado)" en los acumulados de menos de un año, con las palabras enteras', async () => {
    const n = reiteracionReal();
    const frecuencias = n.secciones.flatMap(s => s.filas.map(f => f.valores[2]));
    assert.deepEqual([...new Set(frecuencias)].sort(), ['Anualmente', 'Cada medio año', 'Cada medio año (Acumulado)', 'Cuatrimestralmente (Acumulado)']);
    const textos = textosPorHoja(await renderPdf(n)).flat();
    assert.deepEqual(fragmentos(n, textos), [], textos.map(t => t.texto).join(' | '));
    const enPdf = textos.map(t => t.texto);
    for (const palabra of ['Cuatrimestralmente', '(Acumulado)']) assert.ok(enPdf.includes(palabra), `no se encontró "${palabra}" entera`);
  });

  it('el antecedente va en la celda "Informado en", en letra más chica, y no hay fila a todo el ancho', async () => {
    const ANTECEDENTE = { cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' };
    const SEGUNDA = 'Anteriormente notificado DGMIT por e-mail en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026';
    // Las dos primeras filas de los vencidos (Parque Automotor y Siniestros viales) llevan antecedente
    const datasets = REITERACION_REAL.map((d, i) => (i < 2 ? { ...d, antecedente: ANTECEDENTE } : d));
    const n = reiteracionReal({ datasets });
    const [hoja] = textosPorHoja(await renderPdf(n));
    const lineas = hoja.map(t => t.texto);
    assert.ok(!lineas.some(l => l.startsWith('Antecedente:')), lineas.join(' | '));

    // La segunda oración, dos veces, en 7 puntos
    const chicas = hoja.filter(t => t.tamano === 7);
    assert.equal(chicas.map(t => t.texto).join(' '), `${SEGUNDA} ${SEGUNDA}`);
    // La columna se ensancha para ella (lo cede el título): la oración ocupa a lo sumo 5 líneas, no 7 u 8
    assert.ok(chicas.length / 2 <= 5, `la segunda oración ocupa ${chicas.length / 2} líneas`);
    // Ninguna de sus palabras se parte
    const enteras = new Set(lineas.flatMap(palabras));
    assert.deepEqual(palabras(SEGUNDA).filter(palabra => !enteras.has(palabra)), []);

    // Arriba, en la misma celda (la misma x), el texto de la nota con su punto, en la letra de la tabla
    const principal = hoja[hoja.indexOf(chicas[0]) - 1];
    assert.ok(principal.texto.endsWith('(13/10/2026).') && principal.tamano === 8.5, principal.texto);
    assert.ok(chicas.every(t => Math.abs(t.x - principal.x) < 0.01), JSON.stringify(chicas));
    assert.ok(chicas[0].base < principal.base);

    // El alto de la fila cuenta las dos partes: la fila siguiente empieza debajo de la segunda oración (las dos
    // oraciones son iguales y ocupan las mismas líneas)
    const finDeLaPrimera = chicas[chicas.length / 2 - 1];
    const siguiente = hoja.find(t => t.texto === 'Siniestros viales por' || t.texto.startsWith('Siniestros viales'));
    assert.ok(siguiente.base + ASCENDENTE * siguiente.tamano < finDeLaPrimera.base - DESCENDENTE * 7 - 2 * 3,
      `la fila siguiente (${siguiente.base}) se superpone con la segunda oración (${finDeLaPrimera.base})`);
  });

  it('la oración chica en la última fila no le quita aire a lo que sigue debajo de la tabla', async () => {
    const ANTECEDENTE = { cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' };
    // Dos vencidos; el primero con antecedente en los dos casos (las mismas proporciones de columnas) y el último con
    // un título tan largo que su celda es la más alta de la fila con o sin la oración chica: la tabla termina igual
    const largo = { ...REITERACION_REAL[1], titulo: 'Siniestros viales por categoría '.repeat(6).trim() };
    const justificacion = async (antecedente) => {
      const datasets = [{ ...REITERACION_REAL[0], antecedente: ANTECEDENTE }, { ...largo, antecedente }];
      const [hoja] = textosPorHoja(await renderPdf(reiteracionReal({ datasets })));
      assert.ok(hoja.some(t => t.tamano === 7 && t.texto.startsWith('Anteriormente')));
      return hoja.find(t => t.texto === 'Justificación:');
    };
    const sin = await justificacion(null);
    const con = await justificacion(ANTECEDENTE);
    assert.ok(cerca(con.base, sin.base), `"Justificación:" ${(con.base - sin.base).toFixed(2)} pt más cerca de la tabla`);
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

  // "Informado en" con dos y tres avisos (spec 2026-10-15, 7.6) pasa a varios renglones: nunca un "N°" solo al final de uno
  // ("Nota Digital N°" / "10/26" o "(09/12/2026) y N°" / "11/26 (22/12/2026)"), son notas formales
  for (const [caso, conAntecedente] of [['sin antecedente', false], ['con antecedente', true]]) {
    it(`"N°" va junto a su número en "Informado en" con dos y tres avisos (${caso})`, async () => {
      const ANTECEDENTE = { cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' };
      const n = reiteracionReal({ datasets: REITERACION_REAL.map(d => ({ ...d, antecedente: conAntecedente ? ANTECEDENTE : null })) });
      const textos = textosPorHoja(await renderPdf(n)).flat();
      assert.deepEqual(renglonesDeTabla(textos).filter(numeralSuelto), [], textos.map(t => t.texto).join(' | '));
      // Los tres avisos de "Reclamos de alumbrado público" siguen en el PDF, con cada "N°" junto a su número
      const unido = textos.map(t => t.texto).join(' ').replace(/\u00a0/g, ' ');
      for (const numero of ['8/26', '9/26', '10/26']) assert.ok(unido.includes(`N° ${numero}`), `falta "N° ${numero}": ${unido}`);
    });
  }

  // Con y sin la segunda parte de "Informado en" (las proporciones de la tabla cambian)
  for (const [caso, conAntecedente] of [['sin antecedente', false], ['con antecedente', true]]) {
    it(`"Datos solicitados" va en la cuarta columna, en dos renglones a lo sumo y con "Del" y "al" junto a su fecha (${caso})`, async () => {
      const ANTECEDENTE = { cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' };
      const n = reiteracionReal({ datasets: REITERACION_REAL.map(d => ({ ...d, antecedente: conAntecedente ? ANTECEDENTE : null })) });
      const textos = textosPorHoja(await renderPdf(n)).flat();
      assert.deepEqual(fragmentos(n, textos), [], textos.map(t => t.texto).join(' | '));
      // (la primera tabla es la de los próximos a vencer: "Vence")
      const xs = xDeLasColumnas(textos, ['Frecuencia', 'Datos solicitados', 'Vence']);
      assert.ok(xs[0] < xs[1] && xs[1] < xs[2], JSON.stringify(xs));
      // La columna empieza en otra x en cada tabla (cada una calcula sus anchos)
      const columnas = [...new Set(textos.filter(t => t.tamano === TAMANO_TABLA && /^Datos( |$)/.test(t.texto)).map(t => t.x))];
      for (const { pedido } of REITERACION_REAL) {
        const renglones = columnas.map(x => renglonesDeLaCelda(textos, pedido.texto, x)).find(r => r.length) ?? [];
        // (el presupuesto, el texto más largo, en la columna angosta de las 7)
        const maximo = pedido.texto.startsWith('Presupuestos') ? 4 : 2;
        assert.ok(renglones.length >= 1 && renglones.length <= maximo, `"${pedido.texto}" en ${renglones.length} renglones: ${JSON.stringify(renglones)}`);
        assert.ok(!renglones.some(preposicionSuelta), JSON.stringify(renglones));
      }
    });
  }
});

// Aviso externo con los valores reales del de vencimientos del 31/01/2027, el del mockup de la spec (títulos, áreas,
// frecuencias y pedidos del portal, públicos): la tabla de 4 columnas (spec 2026-10-17-fechas-datasets, 9 y 18). Cada
// dataset trae el tipo de pedido efectivo y los meses de su frecuencia, como los deja conPedido en las notas reales
const AVISO_REAL = [
  ['Castraciones de Animales', 'Dirección General de Veterinaria, Control de Fauna Urbana y Plagas', 'Anualmente', 12, 'acumulado', 'Del 01/01/2026 al 31/12/2026'],
  ['Comercios habilitados por rubro', 'Dirección General de Habilitaciones Comerciales', 'Anualmente', 12, 'acumulado', 'Del 01/07/2025 al 31/12/2026'],
  ['Listado de Proveedores', 'Dirección General de Servicios Administrativos', 'Anualmente', 12, 'foto', 'Vigente al 31/12/2026'],
  ['Manejo de residuos sólidos urbanos en Comodoro Rivadavia', 'Dirección General de Higiene Urbana y Estrategias Urbano Ambientales', 'Anualmente', 12, 'acumulado', 'Del 01/01/2026 al 31/12/2026'],
  ['Movimientos aéreos del Aeropuerto Internacional General Mosconi', 'Empresa Argentina de Navegación Aérea', 'Anualmente', 12, 'acumulado', 'Del 01/01/2026 al 31/12/2026'],
  ['Pauta Publicitaria', 'Subsecretaría de Comunicación', 'Trimestralmente', 3, 'acumulado', 'Del 01/01/2026 al 31/12/2026'],
  ['Pedidos de Acceso a la Información Pública', 'Agencia de Acceso a la Información Pública', 'Cuatrimestralmente', 4, 'acumulado', 'Del 01/01/2026 al 31/12/2026'],
  ['Presupuesto con perspectiva de género', 'Secretaría de la Mujer, Género y Diversidad', 'Anualmente', 12, 'ejercicio', 'Presupuestos de los ejercicios 2026 y 2027']
].map(([titulo, area, frecuencia, meses, tipo, pedido], i) => ({
  id: i + 1, titulo, url_dataset: `https://datos.comodoro.gov.ar/dataset/${i + 1}`, area_id: i + 1, area_nombre: area,
  frecuencia_nombre: frecuencia, meses, tipo_pedido: tipo, ultima_actualizacion: '2026-02-10', vencimiento: '2027-01-31',
  pedido: { desde: null, hasta: null, texto: pedido }, informado: null, reiteraciones: 0, antecedente: null
}));
const avisoReal = (cambios = {}) => nota(0, { fecha: '2026-12-22', datasets: AVISO_REAL, areas: [], ...cambios });

describe('renderPdf: tabla de 4 columnas del aviso con valores reales', () => {
  const COLUMNAS = ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Datos solicitados'];

  it('las columnas del mockup, en orden y dentro de los márgenes', async () => {
    const n = avisoReal();
    assert.deepEqual(n.secciones.map(s => s.columnas), [COLUMNAS]);
    const textos = textosPorHoja(await renderPdf(n)).flat();
    const orden = xDeLasColumnas(textos, COLUMNAS);
    assert.ok(orden.every(Number.isFinite), JSON.stringify(orden));
    assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
    for (const t of textos) assert.ok(t.x + anchoDe(t.texto, t.tamano) <= ANCHO_HOJA - 30 * MM + 0.5, `"${t.texto}" sale del margen derecho`);
    assert.ok(!textos.some(t => /Situación|Última actualización|Faltan|sugerida/.test(t.texto)), textos.map(t => t.texto).join(' | '));
  });

  it('no parte ninguna palabra ni fecha, y "Datos solicitados" es la columna más ancha después del título', async () => {
    const n = avisoReal();
    const textos = textosPorHoja(await renderPdf(n)).flat();
    assert.deepEqual(fragmentos(n, textos), [], textos.map(t => t.texto).join(' | '));
    const bordes = [...xDeLasColumnas(textos, COLUMNAS), ANCHO_HOJA - 30 * MM + 3];
    const anchos = bordes.slice(1).map((b, i) => b - bordes[i]);
    assert.ok(anchos[3] > anchos[1] && anchos[3] > anchos[2], `anchos: ${anchos.map(a => a.toFixed(1))}`);
    assert.ok(anchos[0] > anchos[3], `anchos: ${anchos.map(a => a.toFixed(1))}`);
  });

  // Spec 18: "Cuatrimestralmente (Acumulado)" es la frecuencia más larga de los avisos reales: va en dos renglones, con la palabra
  // más larga ("Cuatrimestralmente") entera y sin salir del margen derecho
  it('la frecuencia dice "(Acumulado)" en los acumulados de menos de un año y en ningún otro, sin partir palabras ni salir del margen', async () => {
    const n = avisoReal();
    assert.deepEqual(n.secciones[0].filas.map(f => f.valores[2]), [
      'Anualmente', 'Anualmente', 'Anualmente', 'Anualmente', 'Anualmente', 'Trimestralmente (Acumulado)', 'Cuatrimestralmente (Acumulado)', 'Anualmente'
    ]);
    const textos = textosPorHoja(await renderPdf(n)).flat();
    assert.deepEqual(fragmentos(n, textos), [], textos.map(t => t.texto).join(' | '));
    const [columna] = xDeLasColumnas(textos, ['Frecuencia']);
    for (const [frecuencia, esperado] of [['Trimestralmente (Acumulado)', ['Trimestralmente', '(Acumulado)']], ['Cuatrimestralmente (Acumulado)', ['Cuatrimestralmente', '(Acumulado)']]]) {
      const renglones = renglonesDeLaCelda(textos, frecuencia, columna);
      assert.deepEqual(renglones, esperado, `"${frecuencia}" en ${JSON.stringify(renglones)}`);
    }
    for (const t of textos) assert.ok(t.x + anchoDe(t.texto, t.tamano) <= ANCHO_HOJA - 30 * MM + 0.5, `"${t.texto}" sale del margen derecho`);
  });

  // Un pedido "Del … al …" que no entra en un renglón pasa a dos como "Del 01/01/2026" y "al 31/12/2026": nunca con un
  // "Del" o un "al" solo al final de un renglón
  it('cada pedido va en dos renglones a lo sumo, y "Del" y "al" siempre junto a su fecha', async () => {
    for (const datasets of [AVISO_REAL, AVISO_REAL.filter(d => !/Trimestralmente|Cuatrimestralmente/.test(d.frecuencia_nombre))]) {
      const textos = textosPorHoja(await renderPdf(avisoReal({ datasets }))).flat();
      const [columna] = xDeLasColumnas(textos, ['Datos solicitados']);
      for (const { pedido } of datasets) {
        const renglones = renglonesDeLaCelda(textos, pedido.texto, columna);
        assert.ok(renglones.length >= 1 && renglones.length <= 2, `"${pedido.texto}" en ${renglones.length} renglones: ${JSON.stringify(renglones)}`);
        assert.ok(!renglones.some(preposicionSuelta), JSON.stringify(renglones));
        if (renglones.length === 2 && pedido.texto.startsWith('Del ')) assert.match(renglones[1], /^al \d{2}\/\d{2}\/\d{4}$/);
      }
    }
  });

  it('con "Cuatrimestralmente" y un área con una palabra larguísima, cede el título y las demás palabras siguen enteras', async () => {
    const datasets = AVISO_REAL.map(d => (d.frecuencia_nombre === 'Cuatrimestralmente' ? { ...d, area_nombre: 'Dirección de Interjurisdiccionalidades' } : d));
    const n = avisoReal({ datasets });
    const textos = textosPorHoja(await renderPdf(n)).flat();
    assert.deepEqual(fragmentos(n, textos), [], textos.map(t => t.texto).join(' | '));
    for (const t of textos) assert.ok(t.x + anchoDe(t.texto, t.tamano) <= ANCHO_HOJA - 30 * MM + 0.5, `"${t.texto}" sale del margen derecho`);
  });

  it('el antecedente va en una fila a todo el ancho de las 4 columnas', async () => {
    const datasets = AVISO_REAL.map((d, i) => (i === 0 ? { ...d, antecedente: { cantidad: 2, primera: '2026-11-03', ultima: '2026-12-01' } } : d));
    const textos = textosPorHoja(await renderPdf(avisoReal({ datasets }))).flat();
    const antecedente = textos.find(t => t.texto.startsWith('Antecedente:'));
    assert.ok(antecedente, textos.map(t => t.texto).join(' | '));
    assert.ok(cerca(antecedente.x, 30 * MM + 3, 0.5), `x = ${antecedente.x}`);
    assert.equal(antecedente.texto, 'Antecedente: notificado a la DGMIT por correo electrónico en 2 oportunidades, entre el 03/11/2026 y el 01/12/2026.');
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
    for (const celda of ['Área de prueba', 'Anualmente']) assert.ok(lineas.includes(celda), celda);
    assert.ok(lineas.join(' ').includes('Del 01/01/2026 al 30/11/2026'), lineas.join(' | '));
  });

  it('todo texto de la nota pasa por el resguardo: área, contactos, firma, línea CC y pie del membrete', async () => {
    const n = nota(1, {
      datasets: [{ ...dataset(1), area_nombre: NFD('Área ☎ Norte') }],
      areas: [{ id: 1, nombre: NFD('Área ☎ Norte'), email_principal: 'area@rpad.test', telefono_area: '☎ 297 400-0000\t(int. 12)' }],
      config: { ...config, firma_nombre: NFD('Nombre de la Firma Pública'), firma_cargo: 'Director → Datos', linea_cc_externa: NFD('CC. Dirección ✉ Administrativa') }
    });
    const lineas = lineasPorHoja(await renderPdf(n, { firmaImagen: PNG, membretePie: 'Pie ✉ correo' })).flat();
    const todo = lineas.join(' ');
    for (const esperado of ['Área ? Norte', '? 297 400-0000 (int. 12)', 'Nombre de la Firma Pública', 'Director ? Datos', 'CC. Dirección ? Administrativa', 'Pie ? correo']) {
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

// Maquetación: se renderizan notas de 1 a 30 datasets (avisos y reiteraciones, 4 y 7 columnas; los avisos solo con
// próximos a vencer tienen una sola tabla, la de 4)
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
    // (vencimiento: todos los datasets vencen ese día; sin él, alternan entre próximos y vencidos)
    const CASOS = [
      { tipo: 'aviso', gestion: 'externa', titulo: 'largo' },
      { tipo: 'aviso', gestion: 'externa', titulo: 'corto' },
      { tipo: 'aviso', gestion: 'interna', titulo: 'variado' },
      { tipo: 'aviso', gestion: 'externa', titulo: 'largo', vencimiento: '2026-12-31' },
      { tipo: 'aviso', gestion: 'interna', titulo: 'variado', vencimiento: '2026-12-31' },
      { tipo: 'reiteracion', gestion: 'externa', titulo: 'largo' },
      { tipo: 'reiteracion', gestion: 'interna', titulo: 'variado' }
    ];
    const informado = { numero: 9, anio: 2026, fecha: '2026-10-01' };
    // En las reiteraciones, los múltiplos de 4 ya tuvieron dos avisos y los de 6, tres (spec 2026-10-15, 7.6): "Informado en"
    // los nombra a todos y la fila es más alta
    const informadoDe = (i) => {
      if (i % 6 === 0) return { ...informado, tambien: [{ numero: 10, anio: 2026, fecha: '2026-10-13' }, { numero: 11, anio: 2026, fecha: '2026-10-27' }] };
      if (i % 4 === 0) return { ...informado, tambien: [{ numero: 10, anio: 2026, fecha: '2026-10-13' }] };
      return informado;
    };
    const notaDe = ({ tipo, gestion, titulo, vencimiento }, cantidad) => nota(cantidad, {
      tipo, gestion,
      datasets: Array.from({ length: cantidad }, (_, i) => ({
        ...dataset(i + 1, vencimiento), titulo: titulos[titulo](i + 1),
        // En las reiteraciones, los múltiplos de 3 llevan su antecedente en "Informado en" (filas más altas)
        ...(tipo === 'aviso' ? {} : { informado: informadoDe(i + 1), reiteraciones: 1 })
      }))
    });

    const renderizadas = [];
    before(async () => {
      for (const caso of CASOS) {
        for (let cantidad = 1; cantidad <= 30; cantidad++) {
          const n = notaDe(caso, cantidad);
          const textos = textosPorHoja(await render(n));
          renderizadas.push({
            etiqueta: `${caso.tipo}/${caso.gestion}/${caso.titulo}${caso.vencimiento ? '/próximos' : ''} con ${cantidad} datasets`, nota: n, textos,
            hojas: textos.map(lineas => lineas.map(t => t.texto))
          });
        }
      }
    });

    const juntas = (lineas) => lineas.join(' ');
    // Los pies de cada hoja: "Página p de t" y el del membrete
    const esPie = (linea) => esPaginacion(linea) || linea === PIE;
    const esFila = (linea) => /^Dataset \d+\b/.test(linea);
    // Primera línea del encabezado de la tabla (con el título angosto de las reiteraciones con antecedente, sale en dos)
    const esEncabezado = (linea) => linea === 'Conjunto de datos' || linea === 'Conjunto de';

    // Tablas mal cortadas en una hoja: título de sección sin su encabezado, o encabezado sin su primera fila
    const problemasDeTabla = (lineas, titulos) => {
      const problemas = [];
      lineas.forEach((linea, i) => {
        const fila = lineas.findIndex((l, j) => j > i && esFila(l));
        if (titulos.includes(linea)) {
          const encabezado = lineas.findIndex((l, j) => j >= i && esEncabezado(l));
          if (encabezado === -1 || (fila !== -1 && fila < encabezado)) problemas.push(`el título "${linea}" quedó sin su tabla`);
        }
        if (esEncabezado(linea)) {
          const corte = lineas.findIndex((l, j) => j > i && (esEncabezado(l) || titulos.includes(l) || l === 'Justificación:' || l.startsWith('Datos de contacto')));
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
          assert.equal(lineas.some(esEncabezado), lineas.some(esFila), `${etiqueta}, hoja ${i + 1}: filas sin encabezado`);
          assert.deepEqual(problemasDeTabla(lineas, titulos), [], `${etiqueta}, hoja ${i + 1}`);
        });
      }
    });

    // Hasta títulos de 120 palabras (una fila de más de media hoja). Con más, la primera fila de los vencidos (la tabla de 7
    // columnas, con el título más angosto: spec 2026-10-17-fechas-datasets, 9) ya no entra en una hoja junto con el título de
    // la sección y el encabezado, y no hay manera de que vayan juntos (antes, con 6 columnas, el límite estaba más arriba)
    it('el título de cada sección, su encabezado y su primera fila no se separan aunque la fila sea alta', async () => {
      let cortes = 0;
      for (let palabras = 0; palabras <= 120; palabras += 3) {
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
      for (const palabra of ['Anualmente', '31/12/2026', 'Frecuencia', 'actualización', 'solicitados', '30/11/2026']) {
        assert.ok(lineas.some(l => l.includes(palabra)), `no se encontró "${palabra}" entera`);
      }
    });

    // Spec 2026-10-17-fechas-datasets, 9 y 18: el aviso con solo próximos a vencer tiene una tabla de 4 columnas
    it('las notas de aviso (4 columnas) no cortan fechas ni palabras de la tabla', () => {
      const { nota: n, hojas } = renderizadas.find(r => r.etiqueta === 'aviso/externa/largo/próximos con 5 datasets');
      assert.deepEqual(n.secciones.map(s => s.columnas.length), [4]);
      const lineas = hojas.flat();
      for (const palabra of ['Anualmente', 'Frecuencia', 'solicitados', '30/11/2026', 'Presupuestos']) {
        assert.ok(lineas.some(l => l.includes(palabra)), `no se encontró "${palabra}" entera`);
      }
      assert.ok(!lineas.some(l => l.includes('Situación') || l.includes('sugerida')), lineas.join(' | '));
    });

    it('ninguna tabla parte una palabra ni una fecha: 4 y 7 columnas, de 1 a 30 datasets', () => {
      let conCuatro = 0;
      for (const { etiqueta, nota: n, textos } of renderizadas) {
        if (n.secciones.some(s => s.columnas.length === 4)) conCuatro++;
        assert.deepEqual(fragmentos(n, textos.flat()), [], etiqueta);
        assert.deepEqual(renglonesDeTabla(textos.flat()).filter(numeralSuelto), [], `${etiqueta}: un N° quedó separado de su número`);
      }
      assert.ok(conCuatro >= 30 * 5, `${conCuatro} notas con la tabla de 4 columnas`);
    });
  });
}

describe('renderPdf: autorización (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.2)', () => {
  const firma = {
    titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' },
    presentante: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado' },
    leyenda: 'Nota presentada por Persona Autorizada, Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).'
  };
  const FIRMA_A = pngRgba({ ancho: 40, alto: 20 });
  const FIRMA_B = pngRgba({ ancho: 60, alto: 20 });
  const todo = (pdf) => lineasPorHoja(pdf).flat().join(' ');

  it('dibuja las dos imágenes, quien presenta a la izquierda del titular, y la leyenda', async () => {
    const pdf = await renderPdf(nota(1, { firma }), { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B });
    const textos = textosPorHoja(pdf).flat();
    const de = (texto) => textos.find(t => t.texto === texto);
    assert.ok(de('Persona Autorizada') && de('Persona Titular'));
    assert.ok(de('Persona Autorizada').x < de('Persona Titular').x, 'quien presenta va a la izquierda');
    assert.ok(todo(pdf).includes('conforme a la autorización conferida mediante Nota Digital N° 15/26'));
    assert.equal(imagenesPorHoja(pdf).flat().length, 2);
  });

  it('una imagen dañada de quien presenta rechaza la promesa, como la del titular', async () => {
    for (const [caso, imagen] of Object.entries(pngsDanados())) {
      await assert.rejects(renderPdf(nota(1, { firma }), { firmaImagen: FIRMA_A, presentanteImagen: imagen }), /firma/, caso);
    }
    // La descompresión de png-js es asíncrona: si alguna imagen llegara a PDFKit, su error aparecería después
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  it('con 1 a 30 datasets, el cierre (remitente, las dos firmas, la leyenda y la línea CC) queda entero en la última hoja', async () => {
    for (let cantidad = 1; cantidad <= 30; cantidad++) {
      const n = nota(cantidad, { firma });
      const hojas = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B }));
      const ultima = hojas.at(-1).join(' ');
      for (const parte of [n.remitente, 'Persona Autorizada', 'Persona Titular', 'conforme a la autorización', n.lineaCc]) {
        assert.ok(ultima.includes(parte), `${cantidad} datasets: falta "${parte}" en la última hoja`);
      }
      for (const anterior of hojas.slice(0, -1)) {
        assert.ok(!anterior.join(' ').includes('Persona Titular'), `${cantidad} datasets: la firma se partió entre hojas`);
      }
    }
  });

  it('el párrafo de autorización de un aviso va en el PDF justo después del primer párrafo, antes de la primera sección y del anexo', async () => {
    const n = nota(3, { autorizacion: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' } });
    const pdf = await renderPdf(n, { firmaImagen: FIRMA_A });
    const texto = todo(pdf);
    const asimismo = texto.indexOf('Asimismo, por medio de la presente');
    assert.ok(texto.indexOf('Informo a Ud.') >= 0 && texto.indexOf('Informo a Ud.') < asimismo);
    assert.ok(asimismo < texto.indexOf('Próximos a vencer'), 'antes del título de la primera sección');
    assert.ok(asimismo < texto.indexOf('Datos de contacto de las áreas responsables'));
    assert.ok(asimismo < texto.indexOf('Anexo: reporte'));
    // Sin nada en el medio: la línea anterior cierra el primer párrafo y la siguiente al de autorización es el título de la sección
    const lineas = lineasPorHoja(pdf).flat();
    const desde = lineas.findIndex(l => l.startsWith('Asimismo, por medio de la presente'));
    const hasta = lineas.findIndex(l => l === 'Próximos a vencer');
    assert.ok(desde > 0 && hasta > desde, lineas.join(' | '));
    // (el aviso externo termina pidiendo el período de cada caso: spec 2026-10-17-fechas-datasets, 9 y 18)
    assert.ok(lineas[desde - 1].endsWith('en cada caso.'), lineas[desde - 1]);
    assert.ok(lineas[hasta - 1].endsWith('flujo de trabajo.'), lineas[hasta - 1]);
  });

  it('el primer párrafo y el de autorización quedan juntos en la primera hoja, también con el banner más alto', async () => {
    const autorizacion = { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' };
    for (const [caso, opciones] of [['sin membrete', {}], ['con el banner más alto', { membreteImagen: BANNER_TOPE, membretePie: PIE }]]) {
      const primera = lineasPorHoja(await renderPdf(nota(60, { autorizacion }), { firmaImagen: FIRMA_A, ...opciones }))[0].join(' ');
      assert.ok(primera.includes('Informo a Ud.') && primera.includes('correcto flujo de trabajo.'), `${caso}: el primer párrafo y el de autorización no están en la misma hoja`);
    }
  });

  it('la nota de autorización: una hoja, el párrafo y la firma del titular, sin "Justificación:"', async () => {
    const n = construirNotaDeAutorizacion({
      numero: 15, anio: 2026, fecha: '2026-11-25', firma: { titular: firma.titular, presentante: null, leyenda: null },
      autorizacion: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' }
    });
    const hojas = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A }));
    assert.equal(hojas.length, 1);
    const texto = hojas[0].join(' ');
    assert.ok(texto.includes('autorizo expresamente a Persona Autorizada'));
    assert.ok(texto.includes('Persona Titular'));
    assert.ok(!texto.includes('Justificación'));
  });
});

// Párrafo del aviso en su fecha de un pedido que la nota de la víspera ya había adelantado (spec 7.6): se dibuja como el de
// autorización, enseguida del primer párrafo
describe('renderPdf: párrafo del adelanto (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.6)', () => {
  const NOTA_10 = { numero: 10, anio: 2026, fecha: '2026-12-09' };
  const FIRMA_A = pngRgba({ ancho: 40, alto: 20 });
  const AUTORIZADA = { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' };
  // Adelantados el primero y el tercero: el párrafo nombra sus títulos (largos), y ocupa varios renglones
  const adelantados = (cantidad) => Array.from({ length: cantidad }, (_, i) => ({ ...dataset(i + 1), ...(i === 1 ? {} : { adelantado: NOTA_10 }) }));

  it('va en el PDF justo después del primer párrafo, antes de la primera sección y del anexo', async () => {
    const n = nota(3, { datasets: adelantados(3) });
    assert.ok(n.adelanto.startsWith('Los conjuntos de datos "Dataset 1 con un título'), n.adelanto);
    const pdf = await renderPdf(n, { firmaImagen: FIRMA_A });
    const lineas = lineasPorHoja(pdf).flat();
    const desde = lineas.findIndex(l => l.startsWith('Los conjuntos de datos "Dataset 1'));
    const hasta = lineas.findIndex(l => l === 'Próximos a vencer');
    assert.ok(desde > 0 && hasta > desde, lineas.join(' | '));
    // Sin nada en el medio: la línea anterior cierra el primer párrafo, las del medio son el párrafo entero y la siguiente es
    // el título de la primera sección (el aviso externo termina pidiendo el período de cada caso)
    assert.ok(lineas[desde - 1].endsWith('en cada caso.'), lineas[desde - 1]);
    assert.ok(hasta - desde >= 3, 'el párrafo ocupa varios renglones');
    assert.equal(lineas.slice(desde, hasta).join(' '), n.adelanto);
    const completo = lineas.join(' ');
    assert.ok(completo.indexOf(n.adelanto) < completo.indexOf('Datos de contacto de las áreas responsables'));
    assert.ok(completo.indexOf(n.adelanto) < completo.indexOf('Anexo: reporte'));
    // Nada del párrafo se repite después: ni entre las filas de las tablas ni más abajo
    assert.ok(!lineas.slice(hasta).some(l => l.includes('adelantado')));
  });

  it('con el párrafo de autorización: ese primero y enseguida el del adelanto', async () => {
    const n = nota(3, { datasets: adelantados(3), autorizacion: AUTORIZADA });
    const lineas = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A })).flat();
    const autorizacion = lineas.findIndex(l => l.startsWith('Asimismo, por medio de la presente'));
    const adelanto = lineas.findIndex(l => l.startsWith('Los conjuntos de datos "Dataset 1'));
    const seccion = lineas.findIndex(l => l === 'Próximos a vencer');
    assert.ok(autorizacion > 0 && adelanto > autorizacion && seccion > adelanto, lineas.join(' | '));
    assert.ok(lineas[adelanto - 1].endsWith('flujo de trabajo.'), lineas[adelanto - 1]);
    assert.equal(lineas.slice(adelanto, seccion).join(' '), n.adelanto);
  });

  it('el primer párrafo y el del adelanto quedan juntos en la primera hoja, también con el banner más alto', async () => {
    const datasets = Array.from({ length: 60 }, (_, i) => ({ ...dataset(i + 1), adelantado: NOTA_10 }));
    for (const [caso, opciones] of [['sin membrete', {}], ['con el banner más alto', { membreteImagen: BANNER_TOPE, membretePie: PIE }]]) {
      const n = nota(60, { datasets });
      assert.equal(n.adelanto, 'Este pedido ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.');
      const primera = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A, ...opciones }))[0].join(' ');
      assert.ok(primera.includes('Informo a Ud.') && primera.includes(n.adelanto), `${caso}: el primer párrafo y el del adelanto no están en la misma hoja`);
    }
  });

  it('una reiteración no lo dibuja, aunque sus datasets hayan tenido adelantado', async () => {
    const n = nota(3, { tipo: 'reiteracion', datasets: adelantados(3) });
    assert.equal(n.adelanto, null);
    assert.ok(!lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A })).flat().join(' ').includes('adelantado'));
  });
});

describe('renderPdf: firmas a la misma altura y cierre con nombres o cargos largos', () => {
  const titular = { nombre: 'Persona Titular', cargo: 'Cargo Titular' };
  const presentante = { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado' };
  const leyenda = 'Nota presentada por Persona Autorizada, Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).';
  const FIRMA_A = pngRgba({ ancho: 40, alto: 20 });
  const FIRMA_B = pngRgba({ ancho: 60, alto: 20 });

  it('con una sola de las dos imágenes, los nombres y los cargos quedan a la misma altura', async () => {
    const firma = { titular, presentante, leyenda };
    const bases = {};
    for (const [caso, imagenes, cantidadImagenes] of [
      ['solo el titular', { firmaImagen: FIRMA_A }, 1],
      ['solo quien presenta', { presentanteImagen: FIRMA_B }, 1],
      ['las dos', { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B }, 2],
      ['ninguna', {}, 0]
    ]) {
      const pdf = await renderPdf(nota(1, { firma }), imagenes);
      const textos = textosPorHoja(pdf).flat();
      const de = (texto) => textos.find(t => t.texto === texto);
      assert.equal(imagenesPorHoja(pdf).flat().length, cantidadImagenes, caso);
      assert.equal(de('Persona Autorizada').base, de('Persona Titular').base, `${caso}: los nombres a distinta altura`);
      assert.equal(de('Cargo Autorizado').base, de('Cargo Titular').base, `${caso}: los cargos a distinta altura`);
      bases[caso] = de('Persona Titular').base;
    }
    // Con alguna imagen, el nombre baja lo mismo que cuando están las dos
    assert.equal(bases['solo el titular'], bases['las dos']);
    assert.equal(bases['solo quien presenta'], bases['las dos']);
  });

  // Textos del largo de los cargos reales de la oficina (hasta unos 68 caracteres): no entran en una línea de 200 pt
  const NOMBRE_LARGO = 'Persona Titular con Apellido Compuesto y Nombre Extenso';
  const CARGO_LARGO = 'Cargo Titular de la Dirección General de Prueba y de su Departamento Legal';
  const NOMBRE_LARGO_2 = 'Persona Autorizada con Apellido Compuesto y Nombre Extenso';
  const CARGO_LARGO_2 = 'Cargo Autorizado de la Dirección General de Prueba y de su Departamento Legal';

  // El cierre se reserva antes del último párrafo: hay que barrer también la cantidad de áreas (cada una suma líneas de contacto),
  // porque la falla solo aparece cuando el espacio que queda cae justo entre lo reservado y lo que ocupa el cierre
  it('con nombres y cargos largos, el cierre (remitente, firmas, leyenda y línea CC) queda entero en la última hoja, con 1 a 30 datasets y 1 a 5 áreas', async () => {
    assert.ok(NOMBRE_LARGO.length >= 52 && CARGO_LARGO.length >= 68, 'los textos de prueba tienen que ser largos');
    const largo = { nombre: NOMBRE_LARGO, cargo: CARGO_LARGO };
    const solo = { titular: largo, presentante: null, leyenda: null };
    const dos = { titular: largo, presentante: { nombre: NOMBRE_LARGO_2, cargo: CARGO_LARGO_2 }, leyenda };
    for (const [caso, firma, partes] of [
      ['una firma', solo, [NOMBRE_LARGO, CARGO_LARGO]],
      ['dos firmas', dos, [NOMBRE_LARGO, CARGO_LARGO, NOMBRE_LARGO_2, CARGO_LARGO_2, 'conforme a la autorización']]
    ]) {
      for (let cantidadAreas = 1; cantidadAreas <= 5; cantidadAreas++) {
        const areas = Array.from({ length: cantidadAreas }, (_, i) => ({
          id: i + 1, nombre: `Área de prueba ${i + 1}`, email_principal: 'area@rpad.test', telefono_area: '297 400-0000'
        }));
        for (let cantidad = 1; cantidad <= 30; cantidad++) {
          const n = nota(cantidad, { firma, areas });
          const hojas = lineasPorHoja(await renderPdf(n, { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B }));
          const ultima = hojas.at(-1).join(' ');
          const donde = `${caso}, ${cantidad} datasets, ${cantidadAreas} áreas`;
          for (const parte of [n.remitente, n.lineaCc, ...partes]) {
            assert.ok(ultima.includes(parte), `${donde}: falta "${parte}" en la última hoja`);
          }
          for (const anterior of hojas.slice(0, -1)) {
            assert.ok(!anterior.join(' ').includes('Persona Titular'), `${donde}: la firma se partió entre hojas`);
          }
        }
      }
    }
  });
});

// Personal contratado (pedido del usuario el 16/10/2026): en la firma, entre el nombre y el cargo, el renglón "Personal
// contratado, cumpliendo funciones de", más chico que el cargo
const RENGLON_CONTRATADO = 'Personal contratado, cumpliendo funciones de';
const LEYENDA_CONTRATADA = 'Nota presentada por Persona Autorizada, personal contratado, cumpliendo funciones de Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).';
const firmasContratadas = ({ titular = false, autorizada = false } = {}) => ({
  titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado: titular },
  presentante: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', contratado: autorizada },
  leyenda: LEYENDA_CONTRATADA
});

describe('renderPdf: personal contratado en la firma (pedido del usuario el 16/10/2026)', () => {
  const FIRMA_A = pngRgba({ ancho: 40, alto: 20 });
  const FIRMA_B = pngRgba({ ancho: 60, alto: 20 });
  const IMAGENES = { firmaImagen: FIRMA_A, presentanteImagen: FIRMA_B };
  const textosDe = async (n, opciones = IMAGENES) => textosPorHoja(await renderPdf(n, opciones)).flat();
  const unica = (textos, texto) => {
    const encontrados = textos.filter(t => t.texto === texto);
    assert.equal(encontrados.length, 1, `"${texto}": ${encontrados.length} veces`);
    return encontrados[0];
  };
  // Borde inferior e superior de una línea, desde el borde inferior de la hoja
  const abajo = (t) => t.base - DESCENDENTE * t.tamano;
  const arriba = (t) => t.base + ASCENDENTE * t.tamano;
  const centro = (t) => t.x + anchoDe(t.texto, t.tamano) / 2;

  it('el renglón va en la firma de la persona autorizada, entre su nombre y su cargo, centrado y en 9 pt (el nombre y el cargo, en 11)', async () => {
    const textos = await textosDe(nota(1, { firma: firmasContratadas({ autorizada: true }) }));
    const renglon = unica(textos, RENGLON_CONTRATADO);
    const nombre = unica(textos, 'Persona Autorizada');
    const cargo = unica(textos, 'Cargo Autorizado');
    assert.deepEqual([nombre.tamano, renglon.tamano, cargo.tamano], [11, 9, 11]);
    assert.ok(abajo(nombre) >= arriba(renglon) - 0.01 && abajo(renglon) >= arriba(cargo) - 0.01, 'entre el nombre y el cargo, sin pisarlos');
    // Centrado en el ancho de la firma de la izquierda (200 pt desde el margen), como el nombre y el cargo
    for (const t of [nombre, renglon, cargo]) assert.ok(cerca(centro(t), 30 * MM + 100, 0.5), `"${t.texto}" no está centrado`);
    // (la firma del titular, de planta, no lo lleva: hay un solo renglón)
    assert.ok(renglon.x < unica(textos, 'Persona Titular').x);
  });

  it('con una sola firma (el titular contratado) el renglón va en la firma de la derecha', async () => {
    const firma = { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado: true }, presentante: null, leyenda: null };
    const textos = await textosDe(nota(1, { firma }), { firmaImagen: FIRMA_A });
    const renglon = unica(textos, RENGLON_CONTRATADO);
    assert.equal(renglon.tamano, 9);
    assert.ok(cerca(centro(renglon), ANCHO_HOJA - 30 * MM - 100, 0.5), 'centrado en la firma de la derecha');
    assert.ok(unica(textos, 'Persona Titular').base > renglon.base && renglon.base > unica(textos, 'Cargo Titular').base);
  });

  it('las dos firmas siguen alineadas: nombre con nombre, la base de las imágenes a la misma altura y la leyenda debajo de la más alta', async () => {
    // La disposición de siempre (las dos de planta), para comparar
    const planta = await textosDe(nota(1, { firma: firmasContratadas() }));
    const leyendaDe = (textos) => textos.find(t => t.texto.startsWith('Nota presentada por'));
    const aireLeyenda = abajo(unica(planta, 'Cargo Titular')) - arriba(leyendaDe(planta));
    for (const quien of [{ autorizada: true }, { titular: true }, { titular: true, autorizada: true }]) {
      const caso = JSON.stringify(quien);
      const pdf = await renderPdf(nota(1, { firma: firmasContratadas(quien) }), IMAGENES);
      const textos = textosPorHoja(pdf).flat();
      const de = (texto) => unica(textos, texto);
      assert.equal(de('Persona Autorizada').base, de('Persona Titular').base, `${caso}: los nombres a distinta altura`);
      assert.equal(de('Persona Titular').base, unica(planta, 'Persona Titular').base, `${caso}: los nombres no quedan donde siempre`);
      const imagenes = imagenesPorHoja(pdf).flat();
      assert.equal(imagenes.length, 2, caso);
      assert.ok(cerca(imagenes[0].y + imagenes[0].alto, imagenes[1].y + imagenes[1].alto), `${caso}: la base de las imágenes a distinta altura`);
      // La leyenda, debajo del cargo más bajo, con el mismo aire que siempre
      const cargoMasBajo = [de('Cargo Titular'), de('Cargo Autorizado')].reduce((a, b) => (a.base < b.base ? a : b));
      assert.ok(cerca(abajo(cargoMasBajo) - arriba(leyendaDe(textos)), aireLeyenda), `${caso}: la leyenda no quedó debajo de la firma más alta`);
      // Una firma de planta tiene su cargo un renglón debajo del nombre, como siempre
      if (!quien.titular) assert.equal(de('Cargo Titular').base, unica(planta, 'Cargo Titular').base, caso);
      if (!quien.autorizada) assert.equal(de('Cargo Autorizado').base, unica(planta, 'Cargo Autorizado').base, caso);
    }
  });

  // El cierre se reserva con el renglón: el remitente, las firmas y la línea CC no se separan, y la firma no queda sola
  it('con 1 a 30 datasets, el cierre (remitente, firmas con el renglón, leyenda y línea CC) queda entero en la última hoja', async () => {
    const solo = { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado: true }, presentante: null, leyenda: null };
    for (const [caso, firma, partes] of [
      ['una firma contratada', solo, ['Persona Titular', RENGLON_CONTRATADO, 'Cargo Titular']],
      ['la autorizada contratada', firmasContratadas({ autorizada: true }), ['Persona Autorizada', RENGLON_CONTRATADO, 'Cargo Autorizado', 'Persona Titular', 'conforme a la autorización']],
      ['las dos contratadas', firmasContratadas({ titular: true, autorizada: true }), ['Persona Autorizada', 'Persona Titular', 'conforme a la autorización']]
    ]) {
      for (let cantidad = 1; cantidad <= 30; cantidad++) {
        const n = nota(cantidad, { firma });
        const hojas = lineasPorHoja(await renderPdf(n, IMAGENES));
        const ultima = hojas.at(-1);
        const donde = `${caso}, ${cantidad} datasets`;
        for (const parte of [n.justificacion.at(-1).slice(0, 25), n.remitente, n.lineaCc, ...partes]) {
          assert.ok(ultima.join(' ').includes(parte), `${donde}: falta "${parte}" en la última hoja`);
        }
        assert.equal(ultima.filter(l => l === RENGLON_CONTRATADO).length, caso === 'las dos contratadas' ? 2 : 1, donde);
        for (const anterior of hojas.slice(0, -1)) {
          assert.ok(!anterior.join(' ').includes(n.remitente) && !anterior.includes('Persona Titular'), `${donde}: el cierre se partió entre hojas`);
        }
      }
    }
  });

  // ALTO_CIERRE deja aire de sobra, así que el barrido de arriba pasaría aunque la reserva no contara el renglón. Lo que sí
  // se ve: con el renglón medido, la reserva es más alta y en algunas notas el último párrafo pasa con el cierre a la hoja
  // siguiente, donde con la firma de planta entraba (sin medirlo, las dos cortan siempre igual)
  it('la reserva del cierre cuenta el renglón: la firma contratada nunca ocupa menos hojas que la de planta, y en algún caso una más', async () => {
    const firma = (contratado) => ({ titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado }, presentante: null, leyenda: null });
    let conUnaMas = 0;
    for (let cantidadAreas = 1; cantidadAreas <= 5; cantidadAreas++) {
      const areas = Array.from({ length: cantidadAreas }, (_, i) => ({
        id: i + 1, nombre: `Área ${i + 1}`, email_principal: 'area@rpad.test', telefono_area: '297 400-0000'
      }));
      for (let cantidad = 1; cantidad <= 30; cantidad++) {
        const [planta, contratada] = await Promise.all([false, true].map(async (contratado) => paginas(await renderPdf(nota(cantidad, { areas, firma: firma(contratado) })))));
        assert.ok(contratada >= planta, `${cantidadAreas} áreas, ${cantidad} datasets: ${contratada} hojas contra ${planta}`);
        if (contratada > planta) conUnaMas++;
      }
    }
    assert.ok(conUnaMas > 0, 'ninguna nota corrió el cierre: la reserva no cuenta el renglón');
  });
});

describe('renderPdf: nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.3)', () => {
  const LARGA = `Descripción ${'muy '.repeat(150)}larga del conjunto de datos, que se transcribe completa.`;
  const cambio = (i) => ({
    id: i, tipo_cambio: 'editar', dataset_titulo: `Dataset ${i} auditado`, usuario_nombre: 'Persona Editora',
    usuario_cargo: 'Cargo de Prueba', fecha_propuesta: '2026-10-16',
    datos_anteriores: { descripcion: 'Antes' }, datos_nuevos: { descripcion: LARGA }
  });
  const auditoria = (cantidad, cambios = {}) => construirNotaDeAuditoria({
    numero: 15, anio: 2026, fecha: '2026-10-19', nuevos: Array.from({ length: cantidad }, (_, i) => cambio(i + 1)), reiterados: [],
    catalogos: { areas: {}, frecuencias: {}, temas: {}, formatos: {} }, config, ...cambios
  });
  // El texto de todas las hojas, en el orden en que se dibujó (cada celda es una sola escritura: su texto queda junto)
  const todo = (pdf) => lineasPorHoja(pdf).flat().join(' ').replace(/\s+/g, ' ');
  const incluye = (pdf, esperado) => todo(pdf).includes(esperado.replace(/\s+/g, ' '));

  it('lleva las tablas, el detalle con los textos largos completos y los apartados con viñetas', async () => {
    const pdf = await renderPdf(auditoria(2), { firmaImagen: PNG });
    for (const esperado of ['Cambios pendientes de auditoría', 'Detalle de cada cambio', '1. Dataset 1 auditado – Modificación',
      '2. Dataset 2 auditado – Modificación', LARGA, 'Qué implica la auditoría:',
      '• los datos coincidan con la información remitida por el área responsable;', 'Importancia:',
      '/perfil.html (sección "Para revisar").', 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN']) {
      assert.ok(incluye(pdf, esperado), esperado.slice(0, 60));
    }
    assert.ok(!incluye(pdf, 'Justificación:'));
  });

  it('con muchos cambios ocupa varias hojas y el cierre (remitente y firma) queda entero en la última', async () => {
    const pdf = await renderPdf(auditoria(12));
    const hojas = lineasPorHoja(pdf);
    assert.ok(hojas.length > 1);
    const ultima = hojas.at(-1).join(' ');
    assert.ok(ultima.includes('DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN'));
    assert.ok(ultima.includes('Nombre') && ultima.includes('Cargo'));
  });

  // La firma nunca queda sola: arriba del remitente va el último apartado ("Importancia:"). El espacio que queda en la hoja
  // anterior cae en cualquier punto, así que se barre la cantidad de cambios y el largo de lo que cambia
  it('el remitente y la firma no quedan solos en una hoja: "Importancia" viaja con ellos (1 a 12 cambios, una y dos firmas)', async () => {
    const dos = {
      titular: { nombre: 'Firma Titular', cargo: 'Director' }, presentante: { nombre: 'Firma Autorizada', cargo: 'Coordinadora' },
      leyenda: 'Nota presentada por Firma Autorizada, Coordinadora, en nombre de Firma Titular, Director, conforme a la autorización conferida mediante Nota Digital N° 3/26 (licencia del 19/10/2026 al 30/10/2026).'
    };
    const importancia = auditoria(1).apartados.at(-1).parrafos[0].slice(0, 30);
    let conVariasHojas = 0;
    for (const [caso, firma, opciones] of [
      ['una firma', undefined, { firmaImagen: PNG }],
      ['dos firmas', dos, { firmaImagen: PNG, presentanteImagen: PNG }]
    ]) {
      for (let cantidad = 1; cantidad <= 12; cantidad++) {
        for (const palabras of [1, 12, 30]) {
          const nuevos = Array.from({ length: cantidad }, (_, i) => ({ ...cambio(i + 1), datos_nuevos: { descripcion: 'palabra '.repeat(palabras).trim() } }));
          const n = auditoria(cantidad, { nuevos, firma });
          const hojas = lineasPorHoja(await renderPdf(n, opciones));
          const donde = `${caso}, ${cantidad} cambios, ${palabras} palabras`;
          const ultima = hojas.at(-1).join(' ');
          for (const parte of ['Importancia:', importancia, n.remitente, n.firma.nombre, n.firma.cargo]) {
            assert.ok(ultima.includes(parte), `${donde}: falta "${parte}" en la última hoja`);
          }
          for (const anterior of hojas.slice(0, -1)) {
            assert.ok(!anterior.join(' ').includes(n.remitente), `${donde}: el remitente quedó en una hoja anterior`);
          }
          if (hojas.length > 1) conVariasHojas++;
        }
      }
    }
    assert.ok(conVariasHojas > 0, 'el barrido tiene que incluir notas de varias hojas');
  });

  // Lo que se reserva para el último apartado tiene que ser exactamente lo que ocupa (el alto de cada renglón y el aire que
  // deja debajo): con una reserva corta, "Importancia:" entraba justo y el remitente y la firma saltaban solos a otra hoja
  const textoDe = (n) => 'palabra '.repeat(n).trim();
  const DATASET_URL = 'https://datos.comodoro.gov.ar/dataset/';
  const TITULO_LARGO = 'Dataset con un título bastante más largo que ocupa dos renglones en el detalle del cambio propuesto por la persona editora';
  const CATALOGOS_AREAS = { areas: { 1: 'Área Uno', 2: 'Área Dos' }, frecuencias: {}, temas: {}, formatos: {} };
  // Esta nota (3 cambios, 3 hojas) dejaba el remitente y la firma solos en la última hoja: "Importancia:" empezaba en la hoja 2
  // y la reserva se quedaba corta por un par de puntos (no contaba el aire que deja debajo el párrafo)
  const REPRODUCTOR = [
    {
      id: 1, tipo_cambio: 'editar', dataset_titulo: 'Dataset auditado 1', usuario_nombre: 'Persona Editora', usuario_cargo: null,
      fecha_propuesta: '2026-10-16', datos_anteriores: { titulo: 'Dataset auditado 1', descripcion: 'Antes', area_id: 1 },
      datos_nuevos: { titulo: 'Dataset auditado 1', descripcion: textoDe(3), area_id: 1, url_dataset: `${DATASET_URL}${'x'.repeat(32)}` }
    },
    {
      id: 2, tipo_cambio: 'editar', dataset_titulo: `${TITULO_LARGO} 2`, usuario_nombre: 'Persona Editora', usuario_cargo: 'Cargo de Prueba',
      fecha_propuesta: '2026-10-16', datos_anteriores: { titulo: `${TITULO_LARGO} 2`, descripcion: 'Antes', area_id: 1 },
      datos_nuevos: { titulo: `${TITULO_LARGO} 2`, descripcion: textoDe(108), area_id: 2, url_dataset: `${DATASET_URL}${'x'.repeat(14)}` }
    },
    {
      id: 3, tipo_cambio: 'crear', dataset_titulo: null, usuario_nombre: 'Persona Editora', usuario_cargo: null, fecha_propuesta: '2026-10-16',
      datos_anteriores: null,
      datos_nuevos: { titulo: 'Dataset auditado 3', descripcion: textoDe(148), area_id: 1, url_dataset: `${DATASET_URL}${'x'.repeat(82)}` }
    }
  ];
  // Lo que tiene que cumplir cada nota de auditoría: la última hoja trae "Importancia:" arriba del remitente y la firma, el
  // remitente no está en ninguna hoja anterior y ninguna hoja termina en un título o en el primer párrafo de un apartado
  const TITULOS_SUELTOS = ['Detalle de cada cambio', 'Qué implica la auditoría:', 'La auditoría consiste en verificar que:', 'Importancia:'];
  const cierreConElTexto = (n, hojas, donde) => {
    const ultima = hojas.at(-1).join(' ');
    for (const parte of ['Importancia:', n.apartados.at(-1).parrafos[0].slice(0, 30), n.remitente, n.firma.nombre, n.firma.cargo]) {
      assert.ok(ultima.includes(parte), `${donde}: falta "${parte}" en la última hoja (${hojas.length} hojas)`);
    }
    for (const anterior of hojas.slice(0, -1)) {
      assert.ok(!anterior.join(' ').includes(n.remitente), `${donde}: el remitente quedó en una hoja anterior`);
    }
    for (const hoja of hojas) {
      const ultimaLinea = hoja.filter(linea => !esPaginacion(linea)).at(-1);
      assert.ok(!TITULOS_SUELTOS.includes(ultimaLinea), `${donde}: la hoja termina en "${ultimaLinea}"`);
    }
  };

  it('el caso que dejaba el remitente y la firma solos en la última hoja: "Importancia" viaja con ellos', async () => {
    const n = auditoria(3, { nuevos: REPRODUCTOR, catalogos: CATALOGOS_AREAS });
    const hojas = lineasPorHoja(await renderPdf(n));
    assert.equal(hojas.length, 3, 'el caso tiene que ocupar tres hojas');
    cierreConElTexto(n, hojas, 'reproductor');
  });

  // El espacio que queda al llegar a "Importancia:" cae en cualquier punto de la hoja: se barren la cantidad de cambios, cuáles
  // tienen el título de dos renglones (alto de 12 pt) y el largo de lo que cambia (renglones de 8,5 pt). Con la reserva corta
  // fallaban 8 de estas 480 notas, y 22 hojas terminaban en un título o en "La auditoría consiste en verificar que:".
  it('barrido denso (480 notas): "Importancia" siempre va con el remitente y la firma, y ningún título queda solo al pie', async () => {
    const cantidadesDeHojas = [];
    for (let cantidad = 1; cantidad <= 4; cantidad++) {
      for (let titulosLargos = 0; titulosLargos < 2 ** cantidad; titulosLargos++) {
        for (let caracteres = 30; caracteres <= 480; caracteres += 30) {
          const nuevos = Array.from({ length: cantidad }, (_, i) => ({
            ...cambio(i + 1), dataset_titulo: `${(titulosLargos >> i) & 1 ? TITULO_LARGO : 'Dataset auditado'} ${i + 1}`,
            datos_nuevos: { descripcion: textoDe(Math.ceil(caracteres / 8)).slice(0, caracteres).trim() }
          }));
          const n = auditoria(cantidad, { nuevos });
          const hojas = lineasPorHoja(await renderPdf(n));
          cierreConElTexto(n, hojas, `${cantidad} cambios, títulos largos ${titulosLargos.toString(2)}, ${caracteres} caracteres`);
          cantidadesDeHojas.push(hojas.length);
        }
      }
    }
    assert.ok([2, 3].every(hojas => cantidadesDeHojas.includes(hojas)), 'el barrido tiene que recorrer notas de dos y de tres hojas');
  });

  // partirPalabras (tablas del detalle): una URL larga se parte dentro de su celda; no agranda su columna a costa de la de las
  // etiquetas ("Campo" conserva su 24% en las modificaciones y su 28% en las altas y las bajas)
  it('en el detalle, una URL larga se parte dentro de su celda y la columna "Campo" conserva su ancho', async () => {
    const ancho = ANCHO_HOJA - 60 * MM;
    const RELLENO_CELDA = 3;
    for (const [caso, parte] of [['sin cortes', (letra) => letra.repeat(160)], ['con guiones', (letra) => Array.from({ length: 30 }, (_, i) => `${letra}${i}`).join('-')]]) {
      const anterior = `${DATASET_URL}viejo-${parte('a')}`;
      const nueva = `${DATASET_URL}${parte('b')}`;
      for (const [tipo, columnas] of [['editar', ['Valor anterior', 'Valor nuevo']], ['crear', ['Valor']]]) {
        const alta = tipo === 'crear';
        const c = {
          id: 1, tipo_cambio: tipo, dataset_titulo: alta ? null : 'Dataset', usuario_nombre: 'Persona Editora', usuario_cargo: null,
          fecha_propuesta: '2026-10-16', datos_anteriores: alta ? null : { url_dataset: anterior },
          datos_nuevos: alta ? { titulo: 'Dataset', url_dataset: nueva } : { url_dataset: nueva }
        };
        const textos = textosPorHoja(await renderPdf(auditoria(1, { nuevos: [c] }))).flat();
        const donde = `${caso}, ${tipo}`;
        const columna = (encabezado) => textos.find(t => t.texto === encabezado).x;
        const x0 = columna('Campo');
        const anchos = alta ? [0.28 * ancho, 0.72 * ancho] : [0.24 * ancho, 0.38 * ancho, 0.38 * ancho];
        columnas.forEach((encabezado, i) => {
          assert.ok(cerca(columna(encabezado) - x0, anchos[0] + anchos.slice(1, i + 1).reduce((a, b) => a + b, 0), 0.5), `${donde}: la columna "${encabezado}" no empieza donde le toca`);
          // Los renglones de la URL de esa columna: más de uno, completos al juntarlos y cada uno dentro de su celda
          const url = alta || i === 1 ? nueva : anterior;
          const renglones = textos.filter(t => cerca(t.x, columna(encabezado), 0.01) && t.texto !== encabezado && url.includes(t.texto));
          assert.ok(renglones.length > 1, `${donde}: la URL de "${encabezado}" no se partió`);
          assert.equal(renglones.map(t => t.texto).join(''), url, `${donde}: la URL de "${encabezado}" está incompleta`);
          for (const { texto } of renglones) {
            assert.ok(anchoDe(texto, 8.5) <= anchos[i + 1] - 2 * RELLENO_CELDA + 1, `${donde}: un renglón de la URL de "${encabezado}" se sale de su celda`);
          }
        });
      }
    }
  });

  it('presentada por la persona autorizada: las dos imágenes y la leyenda', async () => {
    const firma = {
      titular: { nombre: 'Firma Titular', cargo: 'Director', imagen: PNG },
      presentante: { nombre: 'Firma Autorizada', cargo: 'Coordinadora', imagen: PNG },
      leyenda: 'Nota presentada por Firma Autorizada, Coordinadora, en nombre de Firma Titular, Director, conforme a la autorización conferida mediante Nota Digital N° 3/26 (licencia del 19/10/2026 al 30/10/2026).'
    };
    const pdf = await renderPdf(auditoria(1, { firma }), { firmaImagen: PNG, presentanteImagen: PNG });
    const ultima = lineasPorHoja(pdf).at(-1).join(' ');
    assert.ok(ultima.includes('Firma Autorizada') && ultima.includes('Firma Titular'));
    assert.ok(incluye(pdf, firma.leyenda));
    assert.equal(imagenesPorHoja(pdf).at(-1).length, 2);
  });

  // Personal contratado (pedido del usuario el 16/10/2026): con el renglón de más en la firma, "Importancia" sigue viajando con
  // el remitente y la firma; "Propuesto por" dice "personal contratado, cumpliendo funciones de"
  it('propuesta por una persona contratada y presentada por la autorizada contratada: "Importancia" va con el remitente y la firma (1 a 12 cambios)', async () => {
    let conVariasHojas = 0;
    for (let cantidad = 1; cantidad <= 12; cantidad++) {
      for (const palabras of [1, 12, 30]) {
        const nuevos = Array.from({ length: cantidad }, (_, i) => ({ ...cambio(i + 1), usuario_contratado: true, datos_nuevos: { descripcion: textoDe(palabras) } }));
        const n = auditoria(cantidad, { nuevos, firma: firmasContratadas({ autorizada: true }) });
        const hojas = lineasPorHoja(await renderPdf(n, { firmaImagen: PNG, presentanteImagen: PNG }));
        const donde = `${cantidad} cambios, ${palabras} palabras`;
        cierreConElTexto(n, hojas, donde);
        assert.ok(hojas.at(-1).includes(RENGLON_CONTRATADO), `${donde}: falta el renglón en la última hoja`);
        if (hojas.length > 1) conVariasHojas++;
      }
    }
    assert.ok(conVariasHojas > 0, 'el barrido tiene que incluir notas de varias hojas');
    const contratada = await renderPdf(auditoria(1, { nuevos: [{ ...cambio(1), usuario_contratado: true }] }));
    assert.ok(incluye(contratada, 'Persona Editora, personal contratado, cumpliendo funciones de Cargo de Prueba'));
  });
});
