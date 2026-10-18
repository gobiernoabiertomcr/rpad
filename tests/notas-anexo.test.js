// Anexo de los avisos: una hoja A4 por dataset (spec 6.7)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
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
const CORTE = '… (continúa en el portal)';
const SOLICITA_POR_DEFECTO = 'La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal.';
const SOLICITA = 'Listado actualizado de las áreas e instituciones especializadas en género, con un registro por área y estos datos: nombre, dependencia, dirección, barrio, teléfono, correo electrónico y coordenadas (latitud y longitud). Remitir en planilla editable (Excel o CSV) con las mismas columnas del archivo publicado.';
const DEPENDE_REAL = 'Subsecretaría de Modernización y Transparencia. / Secretaría de Gobierno, Modernización y Transparencia';
// Pedidos (spec 2026-10-17-fechas-datasets, 9): el de un anual acumulado con Datos al el 31/10/2025, dos reales y uno más
// largo que cualquiera que arme pedido() (entra en dos líneas sin cortarse)
const PEDIDO_REAL = { desde: '2025-11-01', hasta: '2026-10-31', texto: 'Del 01/11/2025 al 31/10/2026' };
const PEDIDOS_REALES = ['Presupuestos de los ejercicios 2024 a 2027', 'Del 01/01/2023 al 31/12/2025'];
const PEDIDO_LARGO = 'Presupuestos de los ejercicios 2024 a 2027, con la ejecución mensual por partida, las modificaciones presupuestarias y los saldos al cierre';
const PEDIDO_LARGUISIMO = 'Datos solicitados larguísimos para probar el corte. '.repeat(12);
const conPedido = (texto) => ({ pedido: { desde: null, hasta: null, texto } });
// Ficha con textos del largo de los reales: descripción de unos 430 caracteres (van de 300 a 510), observaciones de
// hasta 90, "qué se solicita" de 200 a 450 y un "Depende de" de 101 caracteres como el más largo de la base
const fichaReal = (cambios = {}) => ficha({
  descripcion: 'Listado de las áreas municipales con funciones específicas en materia de género y diversidad, con su dependencia jerárquica, dirección, teléfono, correo electrónico y horario de atención. Incluye las oficinas de atención a personas en situación de violencia por motivos de género y los espacios de articulación con organizaciones de la sociedad civil, con su ubicación georreferenciada en el ejido municipal.',
  observaciones: 'Las coordenadas corresponden al relevamiento municipal de marzo de 2024.',
  que_se_solicita: SOLICITA, area_superior: DEPENDE_REAL, tema_secundario: 'Gobierno',
  nombre_contacto: 'Persona de contacto', email_contacto: 'contacto@ejemplo.gov.ar', datos_al: '2025-10-31', pedido: PEDIDO_REAL,
  ...cambios
});

describe('construirAnexo', () => {
  it('arma una hoja por ficha, con estado, línea de tiempo y campos', () => {
    const a = anexo([ficha(), ficha({ id: 2, titulo: 'Otro', vencimiento: '2026-11-02' })]);
    assert.equal(a.numeroTexto, '3/26');
    assert.equal(a.hojas.length, 2);
    assert.equal(a.hojas[0].estado, 'Fecha sugerida de envío: 30/11/2026 · faltan 28 días');
    assert.equal(a.hojas[1].estado, 'Vence hoy');
    assert.equal(a.hojas[0].etiqueta, 'CONJUNTO DE DATOS · GESTIÓN EXTERNA');
    // Sin Datos al, la línea de tiempo arranca en la carga en el portal
    assert.deepEqual(a.hojas[0].linea, { inicio: '2025-12-16', rotuloInicio: 'Cargado en el portal', fin: '2026-11-30', hoy: '2026-11-02' });
    assert.equal(a.hojas[0].pedido, null);
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
    assert.equal(anexo([ficha({ vencimiento: '2026-11-03' })]).hojas[0].estado, 'Fecha sugerida de envío: 03/11/2026 · falta 1 día');
    assert.equal(anexo([ficha({ vencimiento: '2026-10-30' })]).hojas[0].estado, 'Fecha sugerida de envío: 30/10/2026 · hace 3 días');
    assert.equal(anexo([ficha({ vencimiento: '2026-11-01' })]).hojas[0].estado, 'Fecha sugerida de envío: 01/11/2026 · hace 1 día');
  });

  it('la línea de tiempo arranca en Datos al ("Datos publicados al") o, sin él, en la carga en el portal ("Cargado en el portal")', () => {
    const linea = (cambios) => anexo([ficha(cambios)]).hojas[0].linea;
    assert.deepEqual(linea({ datos_al: '2025-10-31' }), { inicio: '2025-10-31', rotuloInicio: 'Datos publicados al', fin: '2026-11-30', hoy: '2026-11-02' });
    // Un Datos al que no es una fecha (la fecha cero de MariaDB) es como no tenerlo
    for (const valor of [null, undefined, '', '0000-00-00', '2026-02-30']) {
      assert.deepEqual(linea({ datos_al: valor }), { inicio: '2025-12-16', rotuloInicio: 'Cargado en el portal', fin: '2026-11-30', hoy: '2026-11-02' }, String(valor));
    }
    // Sin ninguna de las dos, "Sin registro" (renderAnexo), con el rótulo de la carga
    assert.deepEqual(linea({ datos_al: null, ultima_actualizacion: null }), { inicio: null, rotuloInicio: 'Cargado en el portal', fin: '2026-11-30', hoy: '2026-11-02' });
  });

  it('hoja.pedido es el texto del pedido (el de la nota); sin pedido, null', () => {
    assert.equal(anexo([ficha({ pedido: PEDIDO_REAL })]).hojas[0].pedido, 'Del 01/11/2025 al 31/10/2026');
    assert.equal(anexo([ficha(conPedido('  Relevamiento actualizado '))]).hojas[0].pedido, 'Relevamiento actualizado');
    for (const pedido of [undefined, null, { desde: null, hasta: null, texto: '' }, { texto: '   ' }]) {
      assert.equal(anexo([ficha({ pedido })]).hojas[0].pedido, null, JSON.stringify(pedido));
    }
  });

  it('"Qué se solicita": el texto del dataset sin espacios de más o, si no tiene, el texto por defecto de la spec', () => {
    assert.equal(anexo([ficha({ que_se_solicita: `  ${SOLICITA}\n ` })]).hojas[0].queSeSolicita, SOLICITA);
    for (const vacio of [undefined, null, '', '  \n  ']) {
      assert.equal(anexo([ficha({ que_se_solicita: vacio })]).hojas[0].queSeSolicita, SOLICITA_POR_DEFECTO);
    }
  });

  it('una última actualización que no es una fecha (la fecha cero de MariaDB) se toma como sin registro', () => {
    for (const valor of ['0000-00-00', '2026-02-30', '', undefined]) {
      assert.equal(anexo([ficha({ ultima_actualizacion: valor })]).hojas[0].linea.inicio, null, String(valor));
    }
  });

  it('la ficha no repite las fechas, que ya están en la línea de tiempo, ni el pedido, que está en la cabecera', () => {
    const hoja = anexo([ficha({ tema_secundario: 'Gobierno', datos_al: '2025-10-31', pedido: PEDIDO_REAL })]).hojas[0];
    assert.ok(!hoja.campos.some(([, valor]) => /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(String(valor))), JSON.stringify(hoja.campos));
    assert.deepEqual(hoja.campos.map(([etiqueta]) => etiqueta),
      ['Área responsable', 'Depende de', 'Gestión', 'Frecuencia', 'Tema principal', 'Tema secundario', 'Formatos']);
  });
});

// Diagramación de cada hoja del anexo, tomada de las llamadas a DocumentoNota mientras se dibuja:
// - textos: el rectángulo de cada texto, con la fuente, el tamaño y las opciones vigentes. El alto es el del ojo de
//   la letra (de la línea de ascendentes a la de descendentes), sin el interlineado de la última línea. Cada uno lleva
//   también el nombre de su fuente y su tamaño.
// - bloques: los rectángulos redondeados (estado, datos solicitados, tarjeta del QR, descripción, observaciones,
//   contacto).
// - lineas: las líneas finas (rectángulos de hasta 1 punto de alto y 50 o más de ancho: encabezado, ficha, pie).
// - acentos: el filete vertical del acento a la izquierda del recuadro destacado (la descripción) y del de los datos
//   solicitados.
// Cada uno: { hoja, texto, x0, y0, x1, y1 }, con y desde el borde superior.
const diagramacion = async (datos) => {
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
    await renderAnexo(datos);
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

// La hoja más cargada de la base (17/10/2026): un relevamiento interno con título en dos líneas, descripción de 466
// caracteres, "qué se solicita" de 338, link largo, dos temas y siete datos de contacto (estos, de ejemplo con el mismo
// largo). Ya sin el recuadro "Datos solicitados" achicaba sus textos; con él, la descripción quedaba cortada por menos de
// un punto mientras sobraba lugar en la hoja
const fichaDensa = (cambios = {}) => ficha({
  titulo: 'Relevamiento de espacios reservados para estacionamiento de motos',
  descripcion: 'Registro de espacios reservados para estacionamiento de motocicletas en Comodoro Rivadavia, producto del relevamiento oficial realizado por la Dirección de Investigación Territorial en 2026. Incluye ubicación exacta, infraestructura disponible (cartelería indicadora, vallas, señalización en pavimento) y estado de conservación de cada espacio. Información útil para motociclistas, planificación urbana y gestión del espacio público destinado a movilidad sostenible.',
  que_se_solicita: 'Relevamiento actualizado de espacios reservados para estacionamiento de motos, uno por fila, con tipo, ubicación (calle, lado, intersección y barrio), presencia de cartel, vallas y señalización en el pavimento, estado de conservación y coordenadas. Remitir en planilla editable (Excel o CSV) con las mismas columnas del archivo publicado.',
  url_dataset: 'https://datos.comodoro.gov.ar/dataset/relevamiento-de-espacios-reservados-para-estacionamiento-de-motos',
  tipo_gestion: 'interna', frecuencia_nombre: 'Cada dos años', ultima_actualizacion: '2026-03-06', datos_al: '2026-03-31', vencimiento: '2028-03-31',
  tema_principal: 'Transporte y Movilidad', tema_secundario: 'Geografía y Territorio',
  area_nombre: 'Dirección General de Modernización e Investigación Territorial',
  area_superior: 'Subsec. de Modernización y Transparencia. Sec. de Gobierno, Modernización y Transparencia',
  email_principal: 'area@ejemplo.gov.ar', email_secundario: 'investigacion.territorial@ejemplo.gov.ar', telefono_area: '297 400-0000',
  celular_area: '2974000001', nombre_contacto: 'Persona (contacto)', email_contacto: 'contacto@ejemplo.ar',
  ...conPedido('Relevamiento actualizado'), ...cambios
});

// Ficha con todos los textos al máximo: título, qué se solicita, campos, descripción, observaciones y contactos
const fichaLarguisima = (cambios = {}) => ficha({
  titulo: 'Título larguísimo '.repeat(18), descripcion: 'Texto muy largo de la descripción del dataset. '.repeat(120),
  observaciones: 'Observación larga. '.repeat(80), que_se_solicita: 'Solicitud larga de datos. '.repeat(60),
  formatos: Array.from({ length: 20 }, (_, i) => `FORMATO${i}`).join(', '),
  area_nombre: 'Secretaría de Ambiente, Desarrollo Sustentable, Cambio Climático y Gestión Integral de Residuos Urbanos y Rurales del Municipio',
  area_superior: 'Subsecretaría de Coordinación General de Políticas Públicas Territoriales y Planificación Estratégica Municipal',
  tema_principal: 'Medio ambiente, recursos naturales, energía y gestión de residuos sólidos urbanos',
  tema_secundario: 'Gobierno abierto, transparencia activa, participación ciudadana y rendición de cuentas',
  frecuencia_nombre: 'Trimestralmente o cuando haya cambios relevantes en la normativa',
  url_dataset: `https://datos.comodoro.gov.ar/dataset/${'conjunto-de-datos-con-nombre-muy-largo-'.repeat(4)}`,
  email_principal: 'direccion.general.de.ambiente.y.desarrollo.sustentable@ejemplo.gov.ar',
  email_secundario: 'mesa.de.entradas.de.la.secretaria.de.ambiente@ejemplo.gov.ar', celular_area: '297 400-0001',
  nombre_contacto: 'Persona de contacto con un nombre larguísimo de prueba', telefono_contacto: '297 400-0002 / 297 400-0003 interno 1234',
  email_contacto: 'persona.de.contacto.con.un.nombre.larguisimo@ejemplo.gov.ar', ...cambios
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

  it('la línea de tiempo va de "Datos publicados al" (Datos al) a "Fecha sugerida de envío"; sin Datos al, desde "Cargado en el portal"', async () => {
    const con = lineasPorHoja(await renderAnexo(anexo([fichaReal()])))[0];
    for (const t of ['DATOS PUBLICADOS AL', '31/10/2025', 'FECHA SUGERIDA DE ENVÍO', '30/11/2026', 'Hoy 02/11/2026']) {
      assert.ok(con.includes(t), `falta "${t}" en ${con.join(' | ')}`);
    }
    // La fecha de carga no se repite: la línea de tiempo arranca en los datos publicados. Los rótulos viejos ya no están
    for (const t of ['CARGADO EN EL PORTAL', '16/12/2025', 'ÚLTIMA ACTUALIZACIÓN', 'VENCIMIENTO']) {
      assert.ok(!con.some(l => l.includes(t)), `sobra "${t}" en ${con.join(' | ')}`);
    }
    const sin = lineasPorHoja(await renderAnexo(anexo([fichaReal({ datos_al: null })])))[0];
    for (const t of ['CARGADO EN EL PORTAL', '16/12/2025', 'FECHA SUGERIDA DE ENVÍO']) assert.ok(sin.includes(t), `falta "${t}" en ${sin.join(' | ')}`);
    assert.ok(!sin.some(l => l.includes('DATOS PUBLICADOS AL')), sin.join(' | '));
  });

  it('el recuadro "DATOS SOLICITADOS" va debajo del estado: el rótulo como la etiqueta de la cabecera, el pedido en negrita y el filete del acento', async () => {
    const { textos, bloques, acentos } = await diagramacion(anexo([fichaReal()]));
    const texto = (buscado) => {
      const encontrado = textos.find(t => t.texto === buscado);
      assert.ok(encontrado, `falta "${buscado}" en ${textos.map(t => t.texto).join(' | ')}`);
      return encontrado;
    };
    const rotulo = texto('DATOS SOLICITADOS');
    const pedido = texto(PEDIDO_REAL.texto);
    const etiqueta = texto('CONJUNTO DE DATOS · GESTIÓN EXTERNA');
    // El rótulo, en las mayúsculas chicas de la etiqueta de arriba del título; el pedido, en negrita y bien más grande
    assert.deepEqual([rotulo.fuente, rotulo.tamano], [etiqueta.fuente, etiqueta.tamano]);
    assert.equal(pedido.fuente, 'Helvetica-Bold');
    assert.ok(pedido.tamano >= 12, `el pedido va en ${pedido.tamano} puntos`);
    // Los dos en el mismo recuadro, con el filete del acento a la izquierda
    const recuadro = bloques.find(b => contiene(b, rotulo));
    assert.ok(recuadro && contiene(recuadro, pedido), 'el rótulo y el pedido no están en el mismo recuadro');
    assert.ok(acentos.some(a => Math.abs(a.y0 - recuadro.y0) < 0.1 && Math.abs(a.y1 - recuadro.y1) < 0.1), 'el recuadro no tiene el filete del acento');
    // Debajo del estado (la píldora) y arriba de la línea de tiempo (el "Hoy" va sobre la barra)
    const estado = textos.find(t => t.texto.startsWith('Fecha sugerida de envío:'));
    const pildora = bloques.find(b => contiene(b, estado));
    assert.ok(pildora && pildora.y1 < recuadro.y0, 'el recuadro no está debajo del estado');
    assert.ok(recuadro.y1 < texto('Hoy 02/11/2026').y0, 'el recuadro no está arriba de la línea de tiempo');
    assert.equal(acentos.length, 2);
  });

  it('la hoja más cargada de la base lleva el recuadro sin cortar ningún texto: un texto cortado recibe el lugar que sobra', async () => {
    const { textos } = await diagramacion(anexo([fichaDensa()]));
    assert.ok(textos.some(t => t.texto === 'DATOS SOLICITADOS'), textos.map(t => t.texto).join(' | '));
    // Ni "… (continúa en el portal)" en los textos largos ni "…" en los valores
    const cortados = textos.filter(t => t.texto.includes('…'));
    assert.deepEqual(cortados.map(t => t.texto.slice(-40)), []);
    assert.equal(lineasPorHoja(await renderAnexo(anexo([fichaDensa()]))).length, 1);
  });

  it('sin pedido no hay recuadro "DATOS SOLICITADOS"', async () => {
    const { textos, acentos } = await diagramacion(anexo([fichaReal({ pedido: null })]));
    assert.ok(!textos.some(t => t.texto.includes('DATOS SOLICITADOS')), textos.map(t => t.texto).join(' | '));
    assert.equal(acentos.length, 1);
  });

  it('un pedido más largo que los reales entra entero en dos líneas; uno larguísimo se corta con "…" y la hoja sigue siendo una', async () => {
    for (const texto of [...PEDIDOS_REALES, PEDIDO_LARGO]) {
      const lineas = lineasPorHoja(await renderAnexo(anexo([fichaReal(conPedido(texto))])));
      assert.equal(lineas.length, 1);
      assert.ok(lineas[0].join(' ').includes(texto), `no está entero "${texto}": ${lineas[0].join(' | ')}`);
    }
    const { textos } = await diagramacion(anexo([fichaReal(conPedido(PEDIDO_LARGUISIMO))]));
    const cortado = textos.find(t => t.texto.startsWith('Datos solicitados larguísimos'));
    assert.ok(cortado && cortado.texto.endsWith('…') && !cortado.texto.endsWith(CORTE), cortado?.texto);
    assert.equal(lineasPorHoja(await renderAnexo(anexo([fichaReal(conPedido(PEDIDO_LARGUISIMO))]))).length, 1);
  });

  it('sin última actualización, la línea de tiempo dice "Sin registro"', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha({ ultima_actualizacion: null })])));
    assert.ok(hojas[0].some(l => l.includes('Sin registro')));
  });

  it('con la fecha cero de MariaDB como última actualización, el anexo se dibuja con "Sin registro" (antes fallaba con NaN)', async () => {
    const hojas = lineasPorHoja(await renderAnexo(anexo([ficha({ ultima_actualizacion: '0000-00-00' })])));
    assert.ok(hojas[0].some(l => l.includes('Sin registro')), hojas[0].join(' | '));
    assert.ok(!hojas[0].some(l => l.includes('00/00/0000')), hojas[0].join(' | '));
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

  it('de arriba abajo: encabezado, título, estado, datos solicitados, línea de tiempo, descripción, ficha, qué se solicita, observaciones, contacto y pie', async () => {
    const pdf = await renderAnexo(anexo([fichaReal()]));
    const textos = textosPorHoja(pdf)[0];
    const buscar = (buscado) => {
      const encontrado = textos.find(t => t.texto.includes(buscado));
      assert.ok(encontrado, `falta "${buscado}" en ${textos.map(t => t.texto).join(' | ')}`);
      return encontrado;
    };
    // base: altura de la línea de base desde el borde inferior; cuanto más abajo en la hoja, menor
    const orden = ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'Áreas específicas de género', 'Fecha sugerida de envío: 30/11/2026',
      'DATOS SOLICITADOS', 'Del 01/11/2025 al 31/10/2026', 'DATOS PUBLICADOS AL', 'DESCRIPCIÓN', 'Listado de las áreas municipales', 'ÁREA RESPONSABLE', 'QUÉ SE SOLICITA',
      'Listado actualizado de las áreas', 'OBSERVACIONES', 'Las coordenadas corresponden', 'CONTACTO DEL ÁREA RESPONSABLE',
      'area@ejemplo.gov.ar', 'Hoja 1 de 1'].map(t => buscar(t).base);
    orden.slice(1).forEach((valor, i) => assert.ok(valor < orden[i], `fuera de orden en la posición ${i + 1}: ${orden.join(', ')}`));
    // La descripción es el bloque destacado: letra más grande que la de qué se solicita y la de las observaciones
    const descripcion = buscar('Listado de las áreas municipales').tamano;
    assert.ok(descripcion > buscar('Listado actualizado de las áreas').tamano);
    assert.ok(descripcion > buscar('Las coordenadas corresponden').tamano);
  });

  it('la descripción va en el recuadro destacado (filete del acento) y "Qué se solicita" en uno gris, también con el texto por defecto', async () => {
    const { textos, bloques, acentos } = await diagramacion(anexo([ficha()]));
    const texto = (buscado) => {
      const encontrado = textos.find(t => t.texto === buscado);
      assert.ok(encontrado, `falta "${buscado}" en ${textos.map(t => t.texto).join(' | ')}`);
      return encontrado;
    };
    const recuadroDe = (rotulo, contenido) => {
      const recuadro = bloques.find(b => contiene(b, texto(rotulo)));
      assert.ok(recuadro && contiene(recuadro, texto(contenido)), `"${rotulo}" y su texto no están en el mismo recuadro`);
      return recuadro;
    };
    const conAcento = (recuadro) => acentos.some(a => Math.abs(a.y0 - recuadro.y0) < 0.1 && Math.abs(a.y1 - recuadro.y1) < 0.1);
    assert.ok(conAcento(recuadroDe('DESCRIPCIÓN', ficha().descripcion)), 'la descripción no está en el recuadro destacado');
    assert.ok(!conAcento(recuadroDe('QUÉ SE SOLICITA', SOLICITA_POR_DEFECTO)), '"Qué se solicita" no está en un recuadro gris');
    assert.equal(acentos.length, 1);
  });

  it('aunque una descripción larguísima se achique, no queda más chica que qué se solicita ni que las observaciones', async () => {
    const textos = textosPorHoja(await renderAnexo(anexo([fichaReal({ descripcion: 'Descripción larguísima del conjunto. '.repeat(150) })])))[0];
    const tamano = (inicio) => textos.find(t => t.texto.startsWith(inicio)).tamano;
    assert.ok(tamano('Descripción larguísima') >= tamano('Listado actualizado de las áreas'), textos.map(t => `${t.tamano} ${t.texto.slice(0, 30)}`).join(' | '));
    assert.ok(tamano('Descripción larguísima') >= tamano('Las coordenadas corresponden'));
  });

  it('un "Depende de" largo como los reales ocupa la fila entera y no se corta', async () => {
    const lineas = lineasPorHoja(await renderAnexo(anexo([fichaReal()])))[0];
    assert.ok(lineas.join(' ').includes(DEPENDE_REAL), lineas.join(' | '));
    assert.ok(!lineas.some(l => l.includes('…')), lineas.join(' | '));
  });

  it('los valores de la ficha y del contacto se cortan con "…"; "(continúa en el portal)" queda para los textos largos', async () => {
    const { textos } = await diagramacion(anexo([fichaLarguisima({ area_superior: 'Subsecretaría '.repeat(40), email_contacto: 'x'.repeat(400) })]));
    const largos = ['Título larguísimo', 'Solicitud larga', 'Texto muy largo', 'Observación larga'];
    for (const t of textos.filter(t => t.texto.endsWith(CORTE))) {
      assert.ok(largos.some(inicio => t.texto.startsWith(inicio)), `"${t.texto.slice(0, 60)}" se cortó con "(continúa en el portal)"`);
    }
    assert.ok(textos.some(t => t.texto.startsWith('Subsecretaría') && t.texto.endsWith('…') && !t.texto.endsWith(CORTE)), 'el "Depende de" no se cortó con "…"');
    assert.ok(textos.some(t => t.texto.startsWith('xxx') && t.texto.endsWith('…') && !t.texto.endsWith(CORTE)), 'el email no se cortó con "…"');
  });

  it('el link al portal no baja de 8 puntos', async () => {
    const url = `https://datos.comodoro.gov.ar/dataset/${'conjunto-de-datos-con-nombre-muy-largo-'.repeat(7)}`;
    const textos = textosPorHoja(await renderAnexo(anexo([ficha({ url_dataset: url })])))[0].filter(t => t.texto.includes('conjunto-de-datos'));
    assert.ok(textos.length > 0);
    for (const t of textos) assert.ok(t.tamano >= 8, `el link va en ${t.tamano} puntos`);
  });

  it('aprovecha la A4: con textos reales, el contacto queda abajo, cerca del pie, y no quedan huecos grandes', async () => {
    const reales = [
      fichaReal(), fichaReal({ url_dataset: null }), fichaReal({ observaciones: null, area_superior: 'Intendencia' }),
      ...PEDIDOS_REALES.map(texto => fichaReal(conPedido(texto))), fichaReal({ ...conPedido(PEDIDO_LARGO), url_dataset: null }),
      fichaReal({ pedido: null, datos_al: null })
    ];
    for (const real of reales) {
      const { textos, bloques, lineas } = await diagramacion(anexo([real]));
      const lineaDelPie = lineas.reduce((a, b) => (b.y0 > a.y0 ? b : a));
      const rotulo = textos.find(t => t.texto === 'CONTACTO DEL ÁREA RESPONSABLE');
      const contacto = bloques.find(b => contiene(b, rotulo));
      assert.ok(lineaDelPie.y0 - contacto.y1 <= 8 * MM, `entre el contacto y el pie quedan ${((lineaDelPie.y0 - contacto.y1) / MM).toFixed(1)} mm`);
      // Recorriendo la hoja de arriba abajo, ningún espacio vacío de más de 14 mm entre lo dibujado
      const cosas = [...textos, ...bloques, ...lineas].sort((a, b) => a.y0 - b.y0);
      let hasta = cosas[0].y1;
      for (const c of cosas) {
        assert.ok(c.y0 - hasta <= 14 * MM, `hueco de ${((c.y0 - hasta) / MM).toFixed(1)} mm antes de ${nombre(c)}`);
        hasta = Math.max(hasta, c.y1);
      }
    }
  });

  it('un texto larguísimo sin espacios no demora el render', async () => {
    const inicio = performance.now();
    await renderAnexo(anexo([ficha({ descripcion: 'x'.repeat(30000), que_se_solicita: 'y'.repeat(30000), area_superior: 'z'.repeat(5000), email_contacto: 'w'.repeat(5000) })]));
    const demora = performance.now() - inicio;
    assert.ok(demora < 2000, `tardó ${Math.round(demora)} ms`);
  });

  it('nada sale de los márgenes ni se superpone, tampoco con todos los textos al máximo', async () => {
    // El peor caso: además, los 7 datos de contacto más largos que una línea de la hoja
    const contactoLarguisimo = Object.fromEntries(['email_principal', 'email_secundario', 'telefono_area', 'celular_area',
      'nombre_contacto', 'telefono_contacto', 'email_contacto'].map(campo => [campo, `${campo} `.repeat(30)]));
    const casos = [
      [ficha()],
      [fichaReal()],
      [fichaReal({ url_dataset: null, ultima_actualizacion: null, observaciones: null, que_se_solicita: null })],
      [ficha({ url_dataset: null, ultima_actualizacion: null, observaciones: 'Sin cambios.', area_superior: null })],
      [ficha({ vencimiento: '2026-11-03' }), ficha({ ultima_actualizacion: '2026-11-01' }), ficha({ vencimiento: '2026-11-02' })],
      [fichaLarguisima()],
      [fichaLarguisima({ url_dataset: null, observaciones: null })],
      [fichaLarguisima({ descripcion: 'Breve.', observaciones: 'Breve.' })],
      [fichaLarguisima(contactoLarguisimo), ficha()],
      [fichaReal(conPedido(PEDIDO_LARGO)), fichaReal(conPedido(PEDIDO_LARGUISIMO))],
      [fichaLarguisima(conPedido(PEDIDO_LARGO)), fichaLarguisima({ ...conPedido(PEDIDO_LARGUISIMO), url_dataset: null, observaciones: null })],
      [fichaLarguisima({ ...contactoLarguisimo, ...conPedido(PEDIDO_LARGUISIMO), datos_al: '2025-10-31' })]
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

  it('si falta la librería qrcode, los módulos se importan igual (la app arranca) y solo el anexo falla, con un error claro', async () => {
    // Otro proceso de Node en el que "qrcode" no se puede resolver, como si faltara node_modules/qrcode
    const gancho = `export const resolve = (especificador, contexto, siguiente) => (especificador === 'qrcode'
      ? Promise.reject(Object.assign(new Error("Cannot find package 'qrcode'"), { code: 'ERR_MODULE_NOT_FOUND' }))
      : siguiente(especificador, contexto));`;
    const codigo = `
      import { register } from 'node:module';
      register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(gancho)}));
      const salida = {};
      try { await import('qrcode'); salida.qrcode = 'cargó'; } catch { salida.qrcode = 'falta'; }
      try {
        await import('./services/notasDigitales.js');
        const { renderAnexo } = await import('./services/notasDigitalesAnexo.js');
        const { construirAnexo } = await import('./services/notasDigitalesContenido.js');
        salida.importa = true;
        const ficha = { titulo: 'Dataset', tipo_gestion: 'interna', vencimiento: '2026-11-30', url_dataset: 'https://datos.comodoro.gov.ar' };
        try {
          await renderAnexo(construirAnexo({ numero: 1, anio: 2026, fecha: '2026-11-02', fichas: [ficha] }));
          salida.anexo = 'se dibujó';
        } catch (error) {
          salida.anexo = error.message;
        }
      } catch (error) {
        salida.importa = error.message;
      }
      console.log(JSON.stringify(salida));
      process.exit(0);`;
    const raiz = fileURLToPath(new URL('..', import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', codigo], { cwd: raiz });
    const salida = JSON.parse(stdout.trim().split('\n').at(-1));
    assert.equal(salida.qrcode, 'falta', 'el gancho no simuló la falta de qrcode');
    assert.equal(salida.importa, true, `no se pudieron importar los módulos: ${salida.importa}`);
    assert.match(salida.anexo, /^No se pudo cargar la librería qrcode, que dibuja el código QR del anexo \(¿falta correr "npm install"\?\)/);
  });

  it('con textos larguísimos corta título, qué se solicita, descripción y observaciones con "… (continúa en el portal)"', async () => {
    const cajas = (await diagramacion(anexo([fichaLarguisima()]))).textos;
    const cortados = cajas.filter(c => c.texto.endsWith(CORTE));
    assert.ok(cortados.some(c => c.texto.startsWith('Título larguísimo')), 'el título no se cortó');
    assert.ok(cortados.some(c => c.texto.startsWith('Solicitud larga')), 'qué se solicita no se cortó');
    assert.ok(cortados.some(c => c.texto.startsWith('Texto muy largo')), 'la descripción no se cortó');
    assert.ok(cortados.some(c => c.texto.startsWith('Observación larga')), 'las observaciones no se cortaron');
  });
});
