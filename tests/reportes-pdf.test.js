// Los reportes PDF con el diseño del anexo (spec 2026-10-24-metricas-y-reportes, 5.1): la base (services/reportesPdfBase.js), el
// Estado general de los datasets, Métricas del año, Por área y Avisos del RPAD. Puro: los datos se arman acá, sin base de datos (los textos del reporte
// servido por la API, con el set controlado, están en estados-api.test.js, reportes.test.js y metricas-api.test.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderEstadoGeneral } from '../services/reportesEstadoGeneralPdf.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, dibujarPildora, prepararTabla, LIMITE, ENTRE, lugarPara, dibujarJuntos, prepararTitulo,
  prepararPildora, prepararTarjetas, prepararRecuadro, prepararParrafo, prepararSeccion, ANCHO_DEL_RECUADRO, hojasDe
} from '../services/reportesPdfBase.js';
import { renderSeguimiento, OPCIONES_CINTA_PDF, ALTO_DE_LA_CABEZA_DE_SECCION } from '../services/seguimientoPdf.js';
import { renderMetricasDelAnio, textoDeLaPildora } from '../services/reportesMetricasPdf.js';
import { renderPorArea } from '../services/reportesPorAreaPdf.js';
import { renderAvisos, avisosDelPeriodo } from '../services/reportesAvisosPdf.js';
import { estadoDelDataset } from '../services/fechasDatasetReglas.js';
import { seguimientoDe } from '../services/seguimientoReglas.js';
import { casosDe, vistaDe, contextoDelAnio, trabajoDelAnio, areasYTemas, unidadDe } from '../services/metricasReglas.js';
import { cintasDeLaVista } from '../services/metricasCinta.js';
import { formatoLargo, sumarDias } from '../services/notasDigitalesCalendario.js';
import { IZQUIERDA, CONTENIDO } from '../services/notasDigitalesAnexo.js';
import { lineasPorHoja, textosPorHoja, contenidoPorHoja, HOJA_A4, todasDelTamano } from './pdf-lector.js';
import { diagramacion, verificarDiagramacion, contiene } from './pdf-diagramacion.js';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS } from './seguimiento-casos.js';
import { mapaDeLosCasos, HOY_DE_LAS_METRICAS, notaDgmit } from './metricas-casos.js';

const HOY = '2026-10-24';
const GENERADO = { momento: '2026-10-24 15:22:07', por: 'Usuario Ejemplo' };
const render = (datasets, generado = GENERADO) => renderEstadoGeneral(datasets, { hoy: HOY, generado });

const ENCABEZADO_DE_LA_TABLA = ['Título', 'Área', 'Frecuencia', 'Datos al', 'Próx. Act.', 'Estado'];
const TEXTO_DEL_ESTADO = {
  actualizado: 'Actualizado', proximo: 'Próximo a vencer', atrasado: 'Atrasado', 'sin-respuesta': 'Sin respuesta',
  'sin-fecha': 'Sin fecha', eventual: 'Eventual'
};
const AREAS = [
  'Dir. de Información Tributaria', 'Dirección General de Modernización e Investigación Territorial',
  'Sec. de Economía, Finanzas y Control de Gestión', 'Subsecretaría de Comunicación'
];
const FRECUENCIAS = ['Anualmente', 'Cuatrimestralmente', 'Trimestralmente', 'Cada medio año', 'Mensualmente'];

// Los 81 datasets de la maqueta del 24/10/2026 (6-reportes-datos-reales.html): 53 actualizados, 2 próximos, 12 vencidos (8
// atrasados y 4 sin respuesta) y 14 eventuales; al día, 55 de 67. «Dataset NN», con un título largo cada 10 (va en dos líneas).
const REPARTO = [['actualizado', 53], ['proximo', 2], ['atrasado', 8], ['sin-respuesta', 4], ['eventual', 14]];
const numero = (i) => String(i + 1).padStart(2, '0');
const ochentaYUno = () => REPARTO.flatMap(([estado, n]) => Array.from({ length: n }, () => estado)).map((estado, i) => ({
  titulo: i % 10 === 3 ? `Dataset ${numero(i)}: relevamiento de espacios reservados para estacionamiento de motos` : `Dataset ${numero(i)}`,
  area: AREAS[i % AREAS.length],
  frecuencia: estado === 'eventual' ? 'Eventual' : FRECUENCIAS[i % FRECUENCIAS.length],
  datos_al: estado === 'eventual' ? null : '2026-06-30',
  proxima: estado === 'eventual' ? null : '2027-01-31',
  estado
}));
// Un dataset con todo al máximo: título de 250 caracteres, área de 200 y una frecuencia larguísima
const larguisimo = () => ({
  titulo: 'Título larguísimo de un conjunto de datos de prueba '.repeat(6).slice(0, 250),
  area: 'Dirección General de un área con un nombre larguísimo de prueba '.repeat(4).slice(0, 200),
  frecuencia: 'Trimestralmente o cuando haya cambios relevantes en la normativa',
  datos_al: '2026-06-30', proxima: '2026-09-30', estado: 'sin-respuesta'
});
const sinFecha = () => ({ titulo: 'Dataset sin fecha', area: 'Área B', frecuencia: 'Mensualmente', datos_al: null, proxima: null, estado: 'sin-fecha' });

// El valor de una tarjeta se dibuja justo antes de su rótulo (como lo lee estados-api.test.js)
const valorDeTarjeta = (lineas, rotulo) => lineas[lineas.indexOf(rotulo) - 1];
// Un color de PDFKit como lo escribe en el flujo: cada canal sobre 255, con «scn» (el color de relleno)
const relleno = (hex) => `${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).join(' ')} scn`;

describe('el Estado general con el diseño del anexo', () => {
  it('el Estado general lleva el encabezado del anexo y el pie «Estado general · Hoja k de N»', async () => {
    const pdf = await render(ochentaYUno());
    assert.ok(todasDelTamano(pdf, HOJA_A4), 'todas las hojas son A4');
    const hojas = lineasPorHoja(pdf);
    assert.ok(hojas.length >= 2, `${hojas.length} hojas`);
    hojas.forEach((lineas, k) => {
      for (const t of ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'Municipalidad de Comodoro Rivadavia',
        'Estado general de los datasets', formatoLargo(HOY), 'Generado el 24/10/2026 a las 15:22 por Usuario Ejemplo',
        `Estado general · Hoja ${k + 1} de ${hojas.length}`]) {
        assert.ok(lineas.includes(t), `hoja ${k + 1}: falta "${t}" en ${lineas.join(' | ')}`);
      }
    });
    // El rótulo y el título, solo arriba de la primera hoja
    for (const t of ['ESTADO GENERAL · AL 24/10/2026', '81 conjuntos de datos en el registro']) {
      assert.ok(hojas[0].includes(t), `falta "${t}"`);
      assert.ok(hojas.slice(1).every(lineas => !lineas.includes(t)), `"${t}" se repite`);
    }
  });

  it('el encabezado y el pie están donde los dibuja el Seguimiento, con la misma letra', async () => {
    const delReporte = textosPorHoja(await render(ochentaYUno()));
    const seguimiento = seguimientoDe({ ...CASOS[52], catalogos: CATALOGOS }, HOY_DE_LOS_CASOS, OPCIONES_CINTA_PDF);
    const [delSeguimiento] = textosPorHoja(await renderSeguimiento(seguimiento, { hoy: HOY_DE_LOS_CASOS, generado: GENERADO }));
    const posicion = (t) => ({ x: t.x, base: t.base, tamano: t.tamano, fuente: t.fuente });
    const enLinea = (t) => ({ base: t.base, tamano: t.tamano, fuente: t.fuente });
    const buscar = (textos, condicion, que) => {
      const t = textos.find(condicion);
      assert.ok(t, `falta ${que}`);
      return t;
    };
    for (const hoja of delReporte) {
      // A la izquierda, los mismos textos en el mismo lugar
      for (const texto of ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'Municipalidad de Comodoro Rivadavia']) {
        assert.deepEqual(posicion(buscar(hoja, t => t.texto === texto, texto)), posicion(buscar(delSeguimiento, t => t.texto === texto, texto)));
      }
      // A la derecha, otro texto en el mismo renglón y la misma letra: el nombre del reporte y la fecha larga
      assert.deepEqual(enLinea(buscar(hoja, t => t.texto === 'Estado general de los datasets', 'el nombre del reporte')),
        enLinea(buscar(delSeguimiento, t => t.texto === 'Seguimiento del dataset', 'el nombre del Seguimiento')));
      assert.deepEqual(enLinea(buscar(hoja, t => t.texto === formatoLargo(HOY), 'la fecha larga')),
        enLinea(buscar(delSeguimiento, t => t.texto === formatoLargo(HOY_DE_LOS_CASOS), 'la fecha del Seguimiento')));
      // El pie: «Generado …» en el mismo lugar y el número de hoja en el mismo renglón
      assert.deepEqual(posicion(buscar(hoja, t => t.texto.startsWith('Generado el'), 'el pie')),
        posicion(buscar(delSeguimiento, t => t.texto.startsWith('Generado el'), 'el pie del Seguimiento')));
      assert.deepEqual(enLinea(buscar(hoja, t => t.texto.startsWith('Estado general · Hoja'), 'la hoja')),
        enLinea(buscar(delSeguimiento, t => t.texto.startsWith('Seguimiento del dataset · Hoja'), 'la hoja del Seguimiento')));
    }
  });

  it('las tarjetas, la tasa y las aclaraciones de siempre, con la píldora del índice', async () => {
    const lineas = lineasPorHoja(await render([...ochentaYUno(), sinFecha()])).flat();
    // 82 datasets: los 81 y uno sin fecha (cuenta en la base de la tasa, como no al día): 55 de 68
    assert.ok(lineas.includes('El 81 % de los que tienen vencimiento están al día: 55 de 68'), lineas.slice(0, 20).join(' | '));
    assert.equal(valorDeTarjeta(lineas, 'Total Datasets'), '82');
    assert.equal(valorDeTarjeta(lineas, 'Actualizados'), '53');
    assert.equal(valorDeTarjeta(lineas, 'Próximos'), '2');
    assert.equal(valorDeTarjeta(lineas, 'Vencidos'), '12');
    assert.equal(valorDeTarjeta(lineas, 'Eventuales'), '14');
    assert.ok(lineas.includes('Tasa de actualización: 81%'));
    assert.ok(lineas.includes('Los 14 datasets eventuales no entran en la tasa: no tienen fecha de vencimiento.'));
    assert.ok(lineas.includes('1 dataset todavía no tiene fecha de próxima actualización: cuenta en la tasa como no al día.'));
  });

  it('la píldora: «El 82 % de los que tienen vencimiento están al día: 55 de 67», el número de la maqueta', async () => {
    const lineas = lineasPorHoja(await render(ochentaYUno()))[0];
    assert.ok(lineas.includes('El 82 % de los que tienen vencimiento están al día: 55 de 67'));
    assert.ok(lineas.includes('Tasa de actualización: 82%'));
    // Sin sin fecha, no hay aclaración de los sin fecha
    assert.ok(!lineas.some(l => /fecha de próxima actualización/.test(l)));
  });

  it('sin ninguno con vencimiento (todos eventuales) no hay píldora, y la tasa sigue diciendo 0%', async () => {
    const eventuales = ochentaYUno().filter(d => d.estado === 'eventual');
    const lineas = lineasPorHoja(await render(eventuales)).flat();
    assert.ok(!lineas.some(l => /de los que tienen vencimiento/.test(l)), lineas.join(' | '));
    assert.ok(lineas.includes('Tasa de actualización: 0%'));
    assert.ok(lineas.includes('14 conjuntos de datos en el registro'));
  });

  it('un solo dataset: «1 conjunto de datos en el registro» y una sola hoja', async () => {
    const hojas = lineasPorHoja(await render([sinFecha()]));
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('1 conjunto de datos en el registro'));
    assert.ok(hojas[0].includes('Estado general · Hoja 1 de 1'));
  });

  it('la tabla de 81 filas corta de hoja y repite el encabezado', async () => {
    const datasets = ochentaYUno();
    const hojas = lineasPorHoja(await render(datasets));
    assert.ok(hojas.length >= 3, `${hojas.length} hojas`);
    hojas.forEach((lineas, k) => {
      // Un encabezado por hoja, antes de la primera fila de esa hoja
      assert.equal(lineas.filter(l => l === 'Título').length, 1, `hoja ${k + 1}`);
      const i = lineas.indexOf('Título');
      assert.deepEqual(lineas.slice(i, i + 6), ENCABEZADO_DE_LA_TABLA, `hoja ${k + 1}`);
      const primeraFila = lineas.findIndex(l => /^Dataset \d{2}/.test(l));
      assert.ok(primeraFila > i, `hoja ${k + 1}: la tabla no sigue en esta hoja`);
    });
    // Cada fila una sola vez, en el orden dado, y ninguna partida entre dos hojas
    const numeros = hojas.flat().map(l => /^Dataset (\d{2})/.exec(l)?.[1]).filter(Boolean).map(Number);
    assert.deepEqual(numeros, datasets.map((_, i) => i + 1));
    hojas.forEach((lineas, k) => {
      for (const [j, linea] of lineas.entries()) {
        const n = /^Dataset (\d{2})/.exec(linea)?.[1];
        if (!n) continue;
        const d = datasets[Number(n) - 1];
        const resto = lineas.slice(j + 1);
        const fin = resto.findIndex(l => /^Dataset \d{2}|^Generado el/.test(l));
        const celdas = fin === -1 ? resto : resto.slice(0, fin);
        assert.equal(celdas.at(-1), TEXTO_DEL_ESTADO[d.estado], `hoja ${k + 1}, ${d.titulo}: ${celdas.join(' | ')}`);
      }
    });
    // En cada hoja que no es la primera, una fila corta (título y área de una línea) con sus seis celdas seguidas
    const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
    hojas.slice(1).forEach((lineas, k) => {
      const j = lineas.findIndex((l, i) => /^Dataset \d{2}$/.test(l) && lineas[i + 1] === AREAS[3]);
      assert.ok(j !== -1, `hoja ${k + 2}: sin una fila corta`);
      const d = datasets[Number(lineas[j].slice(-2)) - 1];
      assert.deepEqual(lineas.slice(j, j + 6), [d.titulo, d.area, d.frecuencia, fecha(d.datos_al), fecha(d.proxima), TEXTO_DEL_ESTADO[d.estado]]);
    });
  });

  it('cada estado va en una insignia con los colores del Seguimiento', async () => {
    const datasets = [...ochentaYUno(), sinFecha()];
    const { textos, bloques } = await diagramacion(() => render(datasets));
    // Los de la columna Estado (la frecuencia de un eventual también dice «Eventual», en texto)
    const xEstado = textos.find(t => t.texto === 'Estado').x0;
    for (const texto of Object.values(TEXTO_DEL_ESTADO)) {
      const deLaTabla = textos.filter(t => t.texto === texto && t.x0 >= xEstado - 0.01);
      assert.ok(deLaTabla.length > 0, `falta "${texto}"`);
      for (const t of deLaTabla) assert.ok(bloques.some(b => b.hoja === t.hoja && contiene(b, t)), `"${texto}" no está en su insignia`);
    }
    const contenido = contenidoPorHoja(await render(datasets)).join('\n');
    // Fondo y texto de cada insignia, los de la pantalla del Seguimiento: vencido (atrasado y sin respuesta), actualizado, próximo,
    // eventual y sin fecha
    for (const color of ['#F8E1E1', '#8A3434', '#DDF1E6', '#2E6B4C', '#FCE8A8', '#7A5200', '#DCEAF7', '#24507A', '#F4F7FA', '#56677F']) {
      assert.ok(contenido.includes(relleno(color)), `falta el color ${color}`);
    }
  });

  it('un texto que no entra en su celda se corta con «…», en la misma fila', async () => {
    const { textos } = await diagramacion(() => render([larguisimo()]));
    assert.ok(textos.some(t => t.texto.startsWith('Título larguísimo') && t.texto.endsWith('…')), 'el título no se cortó');
    assert.ok(textos.some(t => t.texto.startsWith('Dirección General de un área') && t.texto.endsWith('…')), 'el área no se cortó');
  });

  const casos = [
    ['81 datasets, en varias hojas', ochentaYUno],
    ['un dataset con todo al máximo, entre los 81', () => [...ochentaYUno().slice(0, 30), larguisimo(), ...ochentaYUno().slice(30)]],
    ['un solo dataset, sin fecha', () => [sinFecha()]],
    ['todos eventuales (sin píldora)', () => ochentaYUno().filter(d => d.estado === 'eventual')]
  ];
  for (const [titulo, armar] of casos) {
    it(`nada se pisa: ${titulo}`, async () => {
      const datasets = armar();
      verificarDiagramacion(await diagramacion(() => render(datasets)));
    });
  }
});

describe('la base de los reportes', () => {
  const PIE = (k, n) => `Prueba · Hoja ${k} de ${n}`;
  const hojaDePrueba = (doc) => agregarHoja(doc, { derecha: 'Reporte de prueba', fecha: HOY });

  it('el pie va en las hojas que agregó agregarHoja, numeradas sobre todas las del documento', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    hojaDePrueba(doc);
    // Una hoja que dibuja otro (como las del Seguimiento en el reporte por área, con su propio pie): la base no le pone el suyo
    doc.addPage();
    hojaDePrueba(doc);
    const pdf = await cerrarReporte(doc, { generado: GENERADO, pieDe: PIE });
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 3);
    assert.ok(hojas[0].includes('Prueba · Hoja 1 de 3'), hojas[0].join(' | '));
    assert.deepEqual(hojas[1], []);
    assert.ok(hojas[2].includes('Prueba · Hoja 3 de 3'), hojas[2].join(' | '));
    assert.ok(todasDelTamano(pdf, HOJA_A4));
  });

  it('hojasDe cuenta las hojas del documento hasta ahora: las de agregarHoja y las que dibujó otro', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    assert.equal(hojasDe(doc), 0);
    hojaDePrueba(doc);
    assert.equal(hojasDe(doc), 1);
    // Una hoja que dibuja otro (como las del Seguimiento en el reporte por área)
    doc.addPage();
    assert.equal(hojasDe(doc), 2);
    // lugarPara también agrega hojas, cuando lo que sigue no entra
    lugarPara(doc, LIMITE - 1, 100);
    assert.equal(hojasDe(doc), 3);
    hojaDePrueba(doc);
    assert.equal(hojasDe(doc), 4);
    const hojas = lineasPorHoja(await cerrarReporte(doc, { generado: GENERADO, pieDe: PIE }));
    assert.equal(hojas.length, 4);
    assert.ok(hojas[3].includes('Prueba · Hoja 4 de 4'), hojas[3].join(' | '));
  });

  it('un reporte sin hojas no se cierra', async () => {
    await assert.rejects(cerrarReporte(nuevoReporte({ titulo: 'Vacío' }), { generado: GENERADO, pieDe: PIE }), /no tiene hojas/);
  });

  it('la tabla no deja su encabezado solo al pie de una hoja: pasa con la primera fila a la siguiente', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    hojaDePrueba(doc);
    prepararTabla(doc, { columnas: [{ titulo: 'Columna A', ancho: 1 }, { titulo: 'Columna B', ancho: 1 }], filas: [['uno', 'dos']] })
      .dibujar(LIMITE - 20);
    const hojas = lineasPorHoja(await cerrarReporte(doc, { generado: GENERADO, pieDe: PIE }));
    assert.equal(hojas.length, 2);
    assert.ok(!hojas[0].includes('Columna A'), hojas[0].join(' | '));
    const i = hojas[1].indexOf('Columna A');
    assert.deepEqual(hojas[1].slice(i, i + 4), ['Columna A', 'Columna B', 'uno', 'dos']);
    // La hoja nueva lleva el encabezado de la anterior
    assert.ok(hojas[1].includes('Reporte de prueba'));
  });

  it('la píldora en sol (un aviso) y un estado que no es una insignia va como texto', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    let y = hojaDePrueba(doc);
    y = dibujarPildora(doc, 'Calculado sin 1 dataset', y, { tono: 'sol' });
    const render = () => prepararTabla(doc, {
      columnas: [{ titulo: 'Dataset', ancho: 3 }, { titulo: 'Estado', ancho: 1 }],
      filas: [['Uno', 'Otro estado'], ['Dos', 'Proto']], estados: ['inventado', '__proto__']
    }).dibujar(y);
    const { textos, bloques } = await diagramacion(async () => {
      render();
      await cerrarReporte(doc, { generado: GENERADO, pieDe: PIE });
    });
    for (const texto of ['Otro estado', 'Proto']) {
      const t = textos.find(c => c.texto === texto);
      assert.ok(t && !bloques.some(b => contiene(b, t)), `"${texto}" no va como texto`);
    }
    const otro = nuevoReporte({ titulo: 'Reporte de prueba' });
    dibujarPildora(otro, 'Calculado sin 1 dataset', hojaDePrueba(otro), { tono: 'sol' });
    const contenido = contenidoPorHoja(await cerrarReporte(otro, { generado: GENERADO, pieDe: PIE }))[0];
    assert.ok(contenido.includes(relleno('#FDF1CC')) && contenido.includes(relleno('#7A5200')), 'la píldora no está en sol');
  });
});

// La base para lo que no es una tabla (Ruling 22): los elementos se miden antes de dibujarlos, lugarPara pasa a una hoja nueva lo que
// no entra antes del pie, dibujarJuntos no deja un título solo al final de una hoja, y el recuadro gris o con borde azul (spec 5.1)
describe('la base de los reportes: medidas, lugar y recuadros', () => {
  const PIE = (k, n) => `Prueba · Hoja ${k} de ${n}`;
  const hojaDePrueba = (doc) => agregarHoja(doc, { derecha: 'Reporte de prueba', fecha: HOY });
  const cerrar = (doc) => cerrarReporte(doc, { generado: GENERADO, pieDe: PIE });

  it('lugarPara deja la y si el alto entra antes del pie y, si no, pasa a una hoja nueva con el encabezado de la última', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    const tope = hojaDePrueba(doc);
    assert.equal(lugarPara(doc, tope, 100), tope);
    assert.equal(lugarPara(doc, LIMITE - 100, 100), LIMITE - 100);
    // No entra: la hoja nueva empieza donde empezó la anterior
    const nueva = lugarPara(doc, LIMITE - 99, 100);
    assert.equal(nueva, tope);
    // En una hoja sin nada dibujado, algo más alto que una hoja no agrega hojas en blanco
    assert.equal(lugarPara(doc, nueva, 10000), nueva);
    const hojas = lineasPorHoja(await cerrar(doc));
    assert.equal(hojas.length, 2);
    assert.ok(hojas[1].includes('Reporte de prueba') && hojas[1].includes(formatoLargo(HOY)), hojas[1].join(' | '));
    assert.ok(hojas[1].includes('Prueba · Hoja 2 de 2'));
  });

  it('cada elemento mide lo que dibuja: devuelve la y de abajo más el aire de la base', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    let y = hojaDePrueba(doc);
    const elementos = [
      prepararTitulo(doc, { rotulo: 'Prueba · rótulo', titulo: 'Un título largo que ocupa dos líneas en la hoja A4 con la letra de veinte puntos' }),
      prepararTitulo(doc, { titulo: 'Sin rótulo' }),
      prepararPildora(doc, 'Mediana en días hábiles · con todos los datasets'),
      prepararPildora(doc, 'Calculado sin 1 dataset', { tono: 'sol' }),
      prepararTarjetas(doc, [{ valor: 40, rotulo: 'avisos y notas a la DGMIT' }, { valor: 0, rotulo: 'datasets nuevos' }]),
      prepararSeccion(doc, { titulo: 'Una sección', derecha: 'Lo de la derecha' }),
      prepararParrafo(doc, 'Un párrafo de texto. '.repeat(30)),
      prepararRecuadro(doc, { rotulo: 'Gestión externa', contenido: prepararParrafo(doc, 'Adentro del recuadro. '.repeat(10), { ancho: ANCHO_DEL_RECUADRO }) }),
      prepararRecuadro(doc, { rotulo: 'Cómo se cuenta', contenido: prepararParrafo(doc, 'Texto', { ancho: ANCHO_DEL_RECUADRO }) }, { tono: 'gris' })
    ];
    for (const elemento of elementos) {
      assert.ok(elemento.alto > 0, JSON.stringify(elemento));
      const siguiente = elemento.dibujar(y);
      assert.ok(Math.abs(siguiente - (y + elemento.alto + ENTRE)) < 1e-9, `${siguiente} ≠ ${y} + ${elemento.alto} + ${ENTRE}`);
      y = siguiente;
    }
    assert.ok(y <= LIMITE, `${y} > ${LIMITE}`);
    // La cabeza de una sección es la del Seguimiento, con su alto (la base no copia su letra)
    assert.equal(prepararSeccion(doc, { titulo: 'Otra' }).alto, ALTO_DE_LA_CABEZA_DE_SECCION);
    await cerrar(doc);
    // Sin tarjetas, nada (alto 0)
    assert.equal(prepararTarjetas(nuevoReporte({ titulo: 'x' }), []).alto, 0);
  });

  it('el recuadro azul lleva el filete del acento a la izquierda; el gris, no; el contenido va adentro y la diagramación cierra', async () => {
    let azul;
    let gris;
    const { textos, bloques, acentos, lineas } = await diagramacion(async () => {
      const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
      let y = hojaDePrueba(doc);
      azul = prepararRecuadro(doc, { rotulo: 'Gestión externa · mediana en días hábiles', contenido: prepararParrafo(doc, 'Adentro del azul. '.repeat(20), { ancho: ANCHO_DEL_RECUADRO }) });
      gris = prepararRecuadro(doc, { rotulo: 'Cómo se cuenta', contenido: prepararParrafo(doc, 'Adentro del gris.', { ancho: ANCHO_DEL_RECUADRO }) }, { tono: 'gris' });
      y = azul.dibujar(y);
      gris.dibujar(y);
      await cerrar(doc);
    });
    verificarDiagramacion({ textos, bloques, lineas });
    // Los dos recuadros, del ancho útil y con el alto que midieron
    const recuadros = bloques.filter(b => Math.abs(b.x0 - IZQUIERDA) < 0.01 && Math.abs(b.x1 - (IZQUIERDA + CONTENIDO)) < 0.01);
    assert.equal(recuadros.length, 2, JSON.stringify(bloques));
    assert.ok(Math.abs((recuadros[0].y1 - recuadros[0].y0) - azul.alto) < 1e-9);
    assert.ok(Math.abs((recuadros[1].y1 - recuadros[1].y0) - gris.alto) < 1e-9);
    // El filete del acento, solo en el azul y de su alto
    assert.equal(acentos.length, 1, JSON.stringify(acentos));
    assert.ok(Math.abs(acentos[0].y0 - recuadros[0].y0) < 0.01 && Math.abs(acentos[0].y1 - recuadros[0].y1) < 0.01);
    // El rótulo en mayúsculas y el contenido, adentro de su recuadro
    for (const [texto, recuadro] of [['GESTIÓN EXTERNA · MEDIANA EN DÍAS HÁBILES', recuadros[0]], ['CÓMO SE CUENTA', recuadros[1]], ['Adentro del gris.', recuadros[1]]]) {
      const t = textos.find(c => c.texto === texto);
      assert.ok(t && contiene(recuadro, t), texto);
    }
    assert.ok(textos.filter(c => c.texto.startsWith('Adentro del azul')).every(t => contiene(recuadros[0], t)));
  });

  it('un título viaja con lo primero que le sigue: si no entran juntos, pasan juntos a la hoja siguiente', async () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    const tope = hojaDePrueba(doc);
    const seccion = prepararSeccion(doc, { titulo: 'La sección que no queda sola' });
    const recuadro = prepararRecuadro(doc, { rotulo: 'El recuadro', contenido: prepararParrafo(doc, 'Lo que sigue al título.', { ancho: ANCHO_DEL_RECUADRO }) });
    // La sección entra sola al pie de la hoja, pero no con el recuadro
    const y = LIMITE - seccion.alto - 1;
    const fin = dibujarJuntos(doc, y, [seccion, recuadro]);
    assert.ok(Math.abs(fin - (tope + seccion.alto + ENTRE + recuadro.alto + ENTRE)) < 1e-9);
    // Si entran, quedan donde están
    const otro = nuevoReporte({ titulo: 'Reporte de prueba' });
    const arriba = hojaDePrueba(otro);
    const sola = prepararSeccion(otro, { titulo: 'Arriba' });
    assert.ok(Math.abs(dibujarJuntos(otro, arriba, [sola]) - (arriba + sola.alto + ENTRE)) < 1e-9);
    await cerrar(otro);
    const hojas = lineasPorHoja(await cerrar(doc));
    assert.equal(hojas.length, 2);
    assert.ok(!hojas[0].includes('LA SECCIÓN QUE NO QUEDA SOLA'), hojas[0].join(' | '));
    const i = hojas[1].indexOf('LA SECCIÓN QUE NO QUEDA SOLA');
    assert.ok(i !== -1 && hojas[1].indexOf('EL RECUADRO') > i, hojas[1].join(' | '));
  });

  it('la tabla mide lo que tiene que entrar junto con lo de antes: el encabezado y la primera fila', () => {
    const doc = nuevoReporte({ titulo: 'Reporte de prueba' });
    hojaDePrueba(doc);
    const columnas = [{ titulo: 'Columna A', ancho: 1 }, { titulo: 'Columna B', ancho: 1 }];
    const una = prepararTabla(doc, { columnas, filas: [['uno', 'dos']] });
    const dos = prepararTabla(doc, { columnas, filas: [['uno', 'dos'], ['tres', 'cuatro']] });
    assert.ok(una.alto > 0);
    assert.equal(dos.alto, una.alto);
    assert.equal(prepararTabla(doc, { columnas, filas: [] }).alto, 0);
  });
});

// =====================================================
// Métricas del año (spec 2026-10-24-metricas-y-reportes, 5: lo mismo que la pestaña Métricas)
// =====================================================

const GENERADO_METRICAS = { momento: '2026-10-24 15:20:41', por: 'Usuario Ejemplo' };
const renderMetricas = (datos) => renderMetricasDelAnio(datos, { generado: GENERADO_METRICAS });
const tituloDe = (mapa, id) => [...mapa.values()].find(f => f.dataset.id === id)?.dataset?.titulo;

// Las métricas de 2026 de los casos reales (tests/metricas-casos.js), como las arma GET /api/metricas en vivo (metricasDe), más la
// combinación de los selectores con que se pidieron (lo que el PDF dice en su píldora)
const metricasDeLosCasos = ({ estadistico = 'mediana', dias = 'habiles', sin = [], mapa = mapaDeLosCasos(), al = HOY_DE_LAS_METRICAS, ...resto } = {}) => {
  const casos = casosDe(mapa, { hoy: al });
  const opciones = { anio: 2026, al, sin };
  const vista = vistaDe(casos, { ...opciones, estadistico, dias });
  return {
    anio: 2026, al, en_vivo: true, aviso_foto: null, anios: [2026], vista,
    cinta: cintasDeLaVista(vista, { estadistico, dias }),
    contexto: contextoDelAnio(mapa, opciones),
    trabajo: trabajoDelAnio(mapa, casos, { ...opciones, estadistico }),
    areas: areasYTemas(mapa, opciones),
    sin_titulos: sin.map(id => tituloDe(mapa, id)).filter(Boolean),
    estadistico, dias, ...resto
  };
};

// Los casos reales con una nota DGMIT recibida por el área para Comercios habilitados por rubro (el 61, avisado y vencido): el tramo
// de la DGMIT y el del área ya se cuentan
const conNotaDgmit = () => {
  const mapa = mapaDeLosCasos();
  const fuentes = [...mapa.values()].find(f => f.dataset.id === 61);
  fuentes.notasDgmit = [notaDgmit({ recibida: '2026-02-10', datasets: [{ id: 61, titulo: fuentes.dataset.titulo }] })];
  return mapa;
};

// Un circuito con todo lo que puede decir una flecha (cifras grandes y orientativas, en curso, pendientes), para ver que entra
const TRAMOS_A_MANO = {
  aviso: ['Aviso anticipado', 'Del aviso al vencimiento', 'DDPC', false],
  tramite: ['Trámite y entrega de la nota', 'Del aviso a la nota en el área', 'DGMIT y DA', true],
  respuesta: ['Respuesta del área', 'De la nota a la entrega', 'Área', false],
  produccion: ['Producción del relevamiento', 'Del aviso a la entrega', 'DGMIT y DIT', true],
  carga: ['Preparación y carga', 'De la entrega a la carga', 'DDPC', false]
};
const tramoAMano = (clave, valor, dias = 'corridos') => {
  const [nombre, desdeHasta, responsable, dgmit] = TRAMOS_A_MANO[clave];
  return {
    clave, nombre, desde_hasta: desdeHasta, responsable, dgmit,
    cifra: valor === 0
      ? { valor: 0, texto: 'En el día', unidad: '', debajo: `promedio en días ${dias}`, ciclos: 3, ciclos_texto: '3 ciclos', en_el_dia: true, orientativo: true }
      : { valor, texto: String(valor), unidad: unidadDe(valor, dias), debajo: 'promedio de 1234 ciclos', ciclos: 1234, ciclos_texto: '1234 ciclos', en_el_dia: false, orientativo: false },
    vacio: null,
    en_curso: ['respuesta', 'produccion'].includes(clave) ? { n: 1234, valor: 9876, texto: `1234 sin datos registrados todavía, hace 9876 ${unidadDe(9876, dias)} (promedio)` } : null,
    pendientes: clave === 'tramite' ? 1234 : null,
    pendientes_texto: clave === 'tramite' ? '1234 notas pendientes de carga' : null
  };
};
const conCircuitoCompleto = () => {
  const datos = metricasDeLosCasos({ estadistico: 'promedio', dias: 'corridos' });
  datos.vista.circuito.externa = [tramoAMano('aviso', 1234), tramoAMano('tramite', 1), tramoAMano('respuesta', 4567), tramoAMano('carga', 0)];
  datos.vista.circuito.interna = [tramoAMano('aviso', 41), tramoAMano('produccion', 999), tramoAMano('carga', 1)];
  return datos;
};

// Las métricas manuales de Gestión, como las lee el controlador (del mes más nuevo al más viejo y por tipo); la de 2025 no es del año
const MANUALES = [
  { tipo: 'reuniones_capacitaciones', anio: 2026, mes: 10, cantidad: 4 },
  { tipo: 'consultas_atendidas', anio: 2026, mes: 10, cantidad: 0 },
  { tipo: 'notas_enviadas', anio: 2026, mes: 3, cantidad: 12 },
  { tipo: 'notas_enviadas', anio: 2025, mes: 12, cantidad: 2 }
];
// Las tres de cada mes de 2026, de octubre a enero: 30 (la tabla corta de hoja)
const muchasManuales = () => Array.from({ length: 10 }, (_, i) => 10 - i)
  .flatMap(mes => ['notas_enviadas', 'reuniones_capacitaciones', 'consultas_atendidas'].map((tipo, j) => ({ tipo, anio: 2026, mes, cantidad: mes * 3 + j })));

// Los casos reales con `n` vencimientos sin el aviso de la regla en la cobertura (la lista de «los que faltan» crece)
const conFaltan = (n) => {
  const datos = metricasDeLosCasos();
  datos.vista.resultados.cobertura.faltan = Array.from({ length: n }, (_, i) => ({
    titulo: `Dataset ${i + 1} con un título de largo común`, venc: '2026-03-31', motivo: 'sin el aviso de la regla'
  }));
  datos.vista.resultados.textos.cobertura.faltan = n === 0 ? '' : n === 1 ? 'El que falta:' : `Los ${n} que faltan:`;
  return datos;
};

// Un año cerrado: con su foto, o todavía sin ella (en vivo «al 31/12», con el aviso de la foto)
const anioCerrado = (conFoto) => metricasDeLosCasos({
  al: '2026-12-31', anios: [2026, 2027], en_vivo: !conFoto,
  aviso_foto: conFoto ? null : 'La foto de 2026 se saca el 10/01/2027'
});

describe('Métricas del año con el diseño del anexo', () => {
  it('el encabezado dice «Métricas del RPAD · 2026» y la fecha larga; el pie, «Métricas del RPAD · 2026 · Hoja k de N»', async () => {
    const pdf = await renderMetricas(metricasDeLosCasos());
    assert.ok(todasDelTamano(pdf, HOJA_A4), 'todas las hojas son A4');
    const hojas = lineasPorHoja(pdf);
    assert.ok(hojas.length >= 4, `${hojas.length} hojas`);
    hojas.forEach((lineas, k) => {
      for (const t of ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'Métricas del RPAD · 2026', formatoLargo('2026-10-24'),
        'Generado el 24/10/2026 a las 15:20 por Usuario Ejemplo', `Métricas del RPAD · 2026 · Hoja ${k + 1} de ${hojas.length}`]) {
        assert.ok(lineas.includes(t), `hoja ${k + 1}: falta "${t}" en ${lineas.join(' | ')}`);
      }
    });
    // La primera hoja: el rótulo del año en curso, el título de la maqueta, los dos circuitos, los resultados y «Cómo se cuenta»
    for (const t of ['MÉTRICAS · AÑO 2026, EN CURSO', 'GESTIÓN EXTERNA · MEDIANA EN DÍAS HÁBILES', 'GESTIÓN INTERNA · MEDIANA EN DÍAS HÁBILES',
      'RESULTADOS DEL AÑO', 'CÓMO SE CUENTA']) {
      assert.ok(hojas[0].includes(t), `falta "${t}" en ${hojas[0].join(' | ')}`);
    }
    assert.ok(hojas[0].join(' ').includes('El circuito, del aviso del RPAD a la carga en el portal'));
    // Las secciones, en el orden de la pestaña: las cintas, el contexto y el trabajo, y las áreas y los temas
    const todo = hojas.flat();
    const orden = ['GESTIÓN EXTERNA · RECORRIDO TÍPICO', 'GESTIÓN INTERNA · RECORRIDO TÍPICO', 'ÍNDICE DE ACTUALIZACIÓN, MES A MES',
      'ANTIGÜEDAD DE LOS VENCIDOS', 'EL TRABAJO DEL RPAD', 'POR MES', 'DOBLE VERIFICACIÓN', 'RANKING DE ÁREAS', 'DATASETS POR TEMA', 'DATASETS POR FRECUENCIA'];
    const posiciones = orden.map(t => todo.indexOf(t));
    assert.ok(posiciones.every(p => p !== -1), JSON.stringify(Object.fromEntries(orden.map((t, i) => [t, posiciones[i]]))));
    assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
    // Cada parte empieza en su hoja: las cintas en la 2, el contexto en la 3 y las áreas después
    assert.ok(hojas[1].includes('GESTIÓN EXTERNA · RECORRIDO TÍPICO'));
    assert.ok(hojas[2].includes('ÍNDICE DE ACTUALIZACIÓN, MES A MES'));
    assert.ok(hojas.slice(3).some(lineas => lineas.includes('RANKING DE ÁREAS')));
  });

  it('la píldora dice la combinación y los destildados', async () => {
    assert.equal(textoDeLaPildora({ estadistico: 'mediana', dias: 'habiles', sin_titulos: [] }), 'Mediana en días hábiles · con todos los datasets');
    assert.equal(textoDeLaPildora({ estadistico: 'promedio', dias: 'corridos', sin_titulos: [] }), 'Promedio en días corridos · con todos los datasets');
    assert.equal(textoDeLaPildora({ estadistico: 'mediana', dias: 'corridos', sin_titulos: ['Parque Automotor'] }),
      'Mediana en días corridos · calculado sin 1 dataset: Parque Automotor');
    assert.equal(textoDeLaPildora({ estadistico: 'promedio', dias: 'habiles', sin_titulos: ['Parque Automotor', 'Pauta Publicitaria'] }),
      'Promedio en días hábiles · calculado sin 2 datasets: Parque Automotor, Pauta Publicitaria');
    // Lo raro cae a lo de entrada, como en la API
    assert.equal(textoDeLaPildora({}), 'Mediana en días hábiles · con todos los datasets');

    // En el PDF: en la primera hoja, en el azul con todos y en el sol (la franja ámbar de la pestaña) con destildados
    const conTodos = await renderMetricas(metricasDeLosCasos({ estadistico: 'promedio', dias: 'corridos' }));
    assert.ok(lineasPorHoja(conTodos)[0].includes('Promedio en días corridos · con todos los datasets'));
    assert.ok(!contenidoPorHoja(conTodos)[0].includes(relleno('#FDF1CC')), 'con todos, la píldora no va en el sol');
    const sinDos = await renderMetricas(metricasDeLosCasos({ estadistico: 'promedio', dias: 'corridos', sin: [11, 10] }));
    const hojas = lineasPorHoja(sinDos);
    assert.ok(hojas[0].includes('Promedio en días corridos · calculado sin 2 datasets: Parque Automotor (Patentamiento), Pauta Publicitaria'),
      hojas[0].slice(0, 12).join(' | '));
    assert.ok(contenidoPorHoja(sinDos)[0].includes(relleno('#FDF1CC')), 'con destildados, la píldora va en el sol');
    // Los rótulos de los circuitos dicen la combinación
    assert.ok(hojas[0].includes('GESTIÓN EXTERNA · PROMEDIO EN DÍAS CORRIDOS'));
    // Los casos destildados van en la hoja de las cintas, con su área (cada ciclo del dataset, una fila); sin destildados, no va
    const segunda = hojas[1].join(' ');
    assert.ok(hojas[1].some(l => /^LOS CASOS DESTILDADOS \(\d+\)$/.test(l)), hojas[1].join(' | '));
    for (const t of ['Parque Automotor (Patentamiento)', 'Pauta Publicitaria']) assert.ok(segunda.includes(t), t);
    assert.ok(!lineasPorHoja(conTodos).flat().some(l => l.startsWith('LOS CASOS DESTILDADOS')));
  });

  it('el circuito sin notas DGMIT dice «Todavía no hay notas DGMIT cargadas»', async () => {
    const datos = metricasDeLosCasos();
    const hojas = lineasPorHoja(await renderMetricas(datos));
    const primera = hojas[0].join(' ');
    const aviso = datos.vista.circuito.externa.find(t => t.clave === 'aviso').cifra;
    assert.deepEqual([aviso.texto, aviso.unidad], ['27', 'días hábiles']);
    // La DGMIT sin cifra y con los pendientes de carga, y el área que todavía no se puede contar (los textos del servidor)
    for (const t of ['Todavía no hay notas DGMIT cargadas', '7 notas pendientes de carga', 'Sin datos todavía',
      'Se empieza a contar cuando haya notas DGMIT cargadas']) {
      assert.ok(primera.includes(t), `falta "${t}" en ${primera}`);
    }
    // Las otras flechas, con su cifra, su unidad y el estadístico con los ciclos (o «En el día» con los ciclos en el texto)
    for (const t of ['27 días hábiles', aviso.debajo, 'En el día', 'mediana en días hábiles', 'Aviso anticipado',
      'Preparación y carga', 'Producción del relevamiento', '1 sin datos registrados todavía, hace 206 días hábiles (mediana)',
      'Se cuenta hasta que se registra la actualización.', 'con tan pocos casos, es orientativo']) {
      assert.ok(primera.includes(t), `falta "${t}"`);
    }
    // La cinta de la externa se corta en la DGMIT, con el gris que lo dice
    assert.ok(hojas[1].includes('La cinta se completa cuando haya notas DGMIT cargadas'), hojas[1].join(' | '));
    assert.ok(hojas[1].includes('Aviso · 27 días hábiles antes'), hojas[1].join(' | '));
    // Con una nota DGMIT cargada, el tramo de la DGMIT ya tiene su cifra
    const conNota = lineasPorHoja(await renderMetricas(metricasDeLosCasos({ mapa: conNotaDgmit() })));
    assert.ok(!conNota[0].join(' ').includes('Todavía no hay notas DGMIT cargadas'), conNota[0].join(' | '));
    assert.ok(conNota[0].join(' ').includes('Trámite y entrega de la nota'));
  });

  it('las cintas del PDF salen del circuito, con las letras del PDF: no las de la pantalla ni las de la foto', async () => {
    const datos = metricasDeLosCasos();
    // Una foto guarda las cintas de la pantalla: el PDF no las usa, las rehace con el circuito
    const sinCintas = await renderMetricas({ ...datos, cinta: { externa: null, interna: null } });
    const hojas = lineasPorHoja(sinCintas);
    for (const t of ['Aviso · 27 días hábiles antes', 'Aviso · 42 días hábiles antes', 'días hábiles respecto del vencimiento', 'vencimiento',
      'La cinta pone las medianas una detrás de la otra: es orientativa, no un ciclo real.', 'Aviso del RPAD']) {
      assert.ok(hojas[1].includes(t), `falta "${t}" en ${hojas[1].join(' | ')}`);
    }
    // Los números del eje con una raya (Helvetica no tiene el signo menos: saldría «?»)
    assert.ok(hojas[1].includes('–40'), hojas[1].join(' | '));
    assert.ok(!hojas.flat().some(l => l.includes('?')), hojas.flat().filter(l => l.includes('?')).join(' | '));
    // Con días corridos, la cinta lo dice
    const corridos = lineasPorHoja(await renderMetricas(metricasDeLosCasos({ dias: 'corridos' })))[1];
    assert.ok(corridos.includes('días corridos respecto del vencimiento'), corridos.join(' | '));
  });

  it('un año cerrado dice de dónde sale: de su foto, o en vivo al 31/12 con el aviso de la foto', async () => {
    const conFoto = lineasPorHoja(await renderMetricas(anioCerrado(true)))[0];
    assert.ok(conFoto.includes('MÉTRICAS · AÑO 2026, AL 31/12/2026'), conFoto.join(' | '));
    assert.ok(conFoto.join(' ').includes('Sale de la foto del 31/12/2026, calculada con todos los datasets.'));
    const sinFoto = lineasPorHoja(await renderMetricas(anioCerrado(false)))[0];
    assert.ok(sinFoto.join(' ').includes('La foto de 2026 se saca el 10/01/2027'), sinFoto.join(' | '));
  });

  it('el contexto, el trabajo del RPAD y las áreas, con los textos del servidor', async () => {
    const datos = metricasDeLosCasos();
    const todo = lineasPorHoja(await renderMetricas(datos)).flat();
    const unido = todo.join(' ');
    const { contexto, trabajo, areas } = datos;
    for (const t of [contexto.indice.at(-1).texto, contexto.antiguedad.textos.titulo, contexto.antiguedad.textos.inicio, trabajo.textos.auditoria,
      'De la propuesta a la revisión, en tiempo corrido.', ...Object.values(trabajo.textos.totales)]) {
      assert.ok(unido.includes(t), `falta "${t}"`);
    }
    // Cada área del ranking, y los temas y las frecuencias
    for (const { area } of areas.ranking) assert.ok(unido.includes(area), area);
    for (const [nombre] of [...areas.temas, ...areas.frecuencias]) assert.ok(todo.includes(nombre), nombre);
    // Los meses del trabajo, en la tabla por mes
    for (const mes of trabajo.textos.meses) assert.ok(todo.includes(mes), mes);
  });

  it('las métricas manuales del año van en «El trabajo del RPAD», con los nombres de la pestaña; sin ninguna, lo dice', async () => {
    const todo = lineasPorHoja(await renderMetricas(metricasDeLosCasos({ manuales: MANUALES }))).flat();
    const titulo = todo.indexOf('MÉTRICAS MANUALES (LAS CARGA ADMINISTRACIÓN)');
    assert.ok(titulo > todo.indexOf('POR MES') && titulo < todo.indexOf('DOBLE VERIFICACIÓN'), todo.join(' | '));
    // Una fila por métrica del año, en el orden que llegan (el de la pestaña): el tipo, el mes y la cantidad (también un 0)
    const fila = (tipo, mes, cantidad) => todo.findIndex((l, i) => l === tipo && todo[i + 1] === mes && todo[i + 2] === cantidad);
    const filas = [fila('Reuniones y capacitaciones', 'Octubre 2026', '4'), fila('Consultas atendidas', 'Octubre 2026', '0'),
      fila('Notas enviadas fuera del RPAD', 'Marzo 2026', '12')];
    assert.ok(filas.every(i => i > titulo), JSON.stringify(filas));
    assert.deepEqual([...filas].sort((a, b) => a - b), filas);
    // La de otro año no va
    assert.ok(!todo.includes('Diciembre 2025'));
    // Sin ninguna del año, el texto de la pestaña
    for (const manuales of [undefined, [], MANUALES.filter(m => m.anio === 2025)]) {
      const sin = lineasPorHoja(await renderMetricas(metricasDeLosCasos({ manuales }))).flat();
      assert.ok(sin.includes('MÉTRICAS MANUALES (LAS CARGA ADMINISTRACIÓN)'));
      assert.ok(sin.includes('Todavía no hay métricas manuales cargadas en 2026.'), JSON.stringify(manuales));
    }
  });

  // Con los casos de los tests, «Cómo se cuenta» quedaba solo en la hoja 2 con 5 a 8 «faltan» en la cobertura: los resultados entraban
  // en la hoja 1 y el recuadro no
  it('«Cómo se cuenta» nunca queda solo en una hoja (viaja con los resultados) y cada parte empieza con su título junto a su primera sección', async () => {
    for (let n = 0; n <= 12; n++) {
      const hojas = lineasPorHoja(await renderMetricas(conFaltan(n)));
      const k = hojas.findIndex(lineas => lineas.includes('CÓMO SE CUENTA'));
      assert.ok(k !== -1 && hojas[k].includes('RESULTADOS DEL AÑO'), `${n} faltan: hoja ${k + 1}: ${hojas[k]?.join(' | ')}`);
      for (const [titulo, seccion] of [['El recorrido típico de un pedido', 'GESTIÓN EXTERNA · RECORRIDO TÍPICO'],
        ['El contexto y el trabajo del RPAD', 'ÍNDICE DE ACTUALIZACIÓN, MES A MES'], ['Áreas y temas', 'RANKING DE ÁREAS']]) {
        const hoja = hojas.find(lineas => lineas.includes(titulo));
        assert.ok(hoja && hoja.includes(seccion), `${n} faltan: «${titulo}» sin «${seccion}»`);
      }
    }
  });

  const variantes = [
    ['los casos reales, mediana y días hábiles', () => metricasDeLosCasos()],
    ['con 10 que faltan en la cobertura y 30 métricas manuales', () => ({ ...conFaltan(10), manuales: muchasManuales() })],
    ['mediana y días corridos', () => metricasDeLosCasos({ dias: 'corridos' })],
    ['promedio y días hábiles', () => metricasDeLosCasos({ estadistico: 'promedio' })],
    ['promedio y días corridos, con dos destildados', () => metricasDeLosCasos({ estadistico: 'promedio', dias: 'corridos', sin: [11, 10] })],
    ['con una nota DGMIT', () => metricasDeLosCasos({ mapa: conNotaDgmit() })],
    ['un circuito con todos los textos y cifras de cuatro cifras', conCircuitoCompleto],
    ['un año sin ningún caso (la base vacía)', () => metricasDeLosCasos({ mapa: new Map() })],
    ['un año cerrado con su foto', () => anioCerrado(true)],
    ['un año cerrado sin foto todavía', () => anioCerrado(false)]
  ];
  for (const [titulo, armar] of variantes) {
    it(`nada se pisa: ${titulo}`, async () => {
      const datos = armar();
      verificarDiagramacion(await diagramacion(() => renderMetricas(datos)));
      const pdf = await renderMetricas(datos);
      assert.ok(todasDelTamano(pdf, HOJA_A4));
      const hojas = lineasPorHoja(pdf);
      hojas.forEach((lineas, k) => assert.ok(lineas.includes(`Métricas del RPAD · 2026 · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}`));
      // Nada dice NaN, null ni undefined
      assert.ok(!hojas.flat().some(l => /NaN|null|undefined/.test(l)), hojas.flat().filter(l => /NaN|null|undefined/.test(l)).join(' | '));
    });
  }
});

// =====================================================
// Por área (spec 2026-10-24-metricas-y-reportes, 5: la portada y detrás una hoja del Seguimiento por cada dataset activo)
// =====================================================

const HOY_AREA = HOY_DE_LOS_CASOS;
const GENERADO_AREA = { momento: '2026-10-20 15:22:07', por: 'Usuario Ejemplo' };
// Un área con todos sus datos de contacto cargados (los de la tabla areas; inventados)
const AREA = {
  id: 34, nombre: 'Secretaría de Economía, Finanzas y Control de Gestión', area_superior: 'Intendencia',
  email_principal: 'economia@ejemplo.test', email_secundario: 'mesa.economia@ejemplo.test', telefono_area: '0297 400-0001',
  celular_area: '0297 15 400-0002', nombre_contacto: 'Persona de Contacto', telefono_contacto: '0297 400-0003',
  email_contacto: 'persona.contacto@ejemplo.test'
};
// Los datos de contacto de la portada, con los rótulos de la nota y del anexo, en su orden: [rótulo, columna]
const CONTACTOS_DEL_AREA = [['DEPENDE DE', 'area_superior'], ['EMAIL', 'email_principal'], ['EMAIL ALTERNATIVO', 'email_secundario'],
  ['TELÉFONO', 'telefono_area'], ['CELULAR', 'celular_area'], ['PERSONA DE CONTACTO', 'nombre_contacto'],
  ['TELÉFONO DE CONTACTO', 'telefono_contacto'], ['EMAIL DE CONTACTO', 'email_contacto']];
// Un dataset de la portada, de un caso real (tests/seguimiento-casos.js), con su estado (estadoDelDataset, como el controlador) y su
// Seguimiento (el de la descarga: seguimientoDe con la cinta del PDF). `cambios` cambia campos del dataset antes de calcularlos.
const delCaso = (id, cambios = {}) => {
  const dataset = { ...CASOS[id].dataset, ...cambios };
  return {
    titulo: dataset.titulo, datos_al: dataset.datos_al, proxima: dataset.proxima, activo: dataset.activo,
    estado: estadoDelDataset({ proxima: dataset.proxima, meses: dataset.meses, tipoGestion: dataset.tipo_gestion, hoy: HOY_AREA }).estado,
    seguimiento: seguimientoDe({ ...CASOS[id], dataset, catalogos: CATALOGOS }, HOY_AREA, OPCIONES_CINTA_PDF)
  };
};
const renderArea = (datasets, area = AREA) => renderPorArea({ area, datasets }, { hoy: HOY_AREA, generado: GENERADO_AREA });
const ddmmaaaa = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const renglonDe = (d) => `${d.titulo} · Datos al: ${ddmmaaaa(d.datos_al)} · Próxima: ${ddmmaaaa(d.proxima)}`;

// Nueve casos, uno o más de cada estado, en el orden en que los manda el controlador (por próxima): el 52 y el 61, vencidos (sin
// respuesta), y el 26, vencido (atrasado: gestión interna); el 58 y el 81, próximos a vencer; el 9 y el 38, actualizados; el 66,
// eventual; y el 33 sin próxima, sin fecha
const nueve = () => [delCaso(9), delCaso(66), delCaso(52), delCaso(33, { proxima: null }), delCaso(58), delCaso(26), delCaso(38),
  delCaso(81), delCaso(61)];
// El orden de la lista de la portada (y de las hojas): Vencidos, Próximos a vencer, Actualizados, Eventuales y Sin fecha; en cada grupo,
// en el orden en que llegan
const ORDEN_DE_NUEVE = [52, 26, 61, 58, 81, 9, 38, 66, 33];
// La Pauta Publicitaria (10, actualizada) dada de baja
const deBaja = () => delCaso(10, { activo: false });
// Muchos datasets con títulos larguísimos (cada renglón de la portada, en tres líneas): la portada ocupa dos hojas
const TITULO_LARGUISIMO = 'relevamiento de espacios reservados para estacionamiento de motos y bicicletas en la vía pública '.repeat(3).slice(0, 230).trim();
const largos = (n) => Array.from({ length: n }, (_, i) => delCaso(ORDEN_DE_NUEVE[i % ORDEN_DE_NUEVE.length], {
  titulo: `Dataset ${String(i + 1).padStart(2, '0')}: ${TITULO_LARGUISIMO}`
}));

describe('Por área: la portada y una hoja del Seguimiento por dataset activo', () => {
  it('1 portada + N hojas, una por dataset activo; uno dado de baja no tiene hoja', async () => {
    const datasets = [...nueve(), deBaja()];
    const pdf = await renderArea(datasets);
    assert.ok(todasDelTamano(pdf, HOJA_A4), 'todas las hojas son A4');
    const hojas = lineasPorHoja(pdf);
    // La portada (una hoja) y las 9 de los activos: la Pauta Publicitaria va en la lista, pero no tiene hoja
    assert.equal(hojas.length, 1 + 9);
    assert.ok(hojas[0].includes(renglonDe(datasets[9])), hojas[0].join(' | '));
    assert.ok(hojas.slice(1).every(lineas => !lineas.join(' ').includes('Pauta Publicitaria')));
    // Cada hoja, la del Seguimiento de su dataset, en el orden de la lista de la portada
    ORDEN_DE_NUEVE.forEach((id, k) => {
      const lineas = hojas[k + 1];
      assert.ok(lineas.join(' ').includes(CASOS[id].dataset.titulo), `la hoja ${k + 2} no es la de ${id}: ${lineas.join(' | ')}`);
      assert.ok(lineas.includes('Seguimiento del dataset') && lineas.includes('AVISOS DEL CICLO ABIERTO'), lineas.join(' | '));
    });
    // La portada no es una hoja del Seguimiento
    assert.ok(!hojas[0].includes('Seguimiento del dataset') && hojas[0].includes('Reporte por área'), hojas[0].join(' | '));
  });

  it('cada hoja es la de la descarga del Seguimiento, salvo el pie', async () => {
    const dataset = delCaso(52);
    const [, enElReporte] = lineasPorHoja(await renderArea([dataset]));
    const sola = lineasPorHoja(await renderSeguimiento(dataset.seguimiento, { hoy: HOY_AREA, generado: GENERADO_AREA }))[0];
    assert.deepEqual(sola.filter(l => !enElReporte.includes(l)), ['Seguimiento del dataset · Hoja 1 de 1']);
    assert.deepEqual(enElReporte.filter(l => !sola.includes(l)), ['Reporte por área · Hoja 2 de 2']);
  });

  it('el pie dice «Reporte por área · Hoja k de N» en todas, con una portada de 1 hoja y con una de 2', async () => {
    for (const [datasets, hojasDeLaPortada] of [[[...nueve(), deBaja()], 1], [largos(16), 2]]) {
      const hojas = lineasPorHoja(await renderArea(datasets));
      const activos = datasets.filter(d => d.activo !== false).length;
      assert.equal(hojas.length, hojasDeLaPortada + activos);
      hojas.forEach((lineas, k) => {
        assert.ok(lineas.includes(`Reporte por área · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}: ${lineas.join(' | ')}`);
        assert.ok(lineas.includes('Generado el 20/10/2026 a las 15:22 por Usuario Ejemplo'), `hoja ${k + 1}`);
        // Un solo pie por hoja
        assert.equal(lineas.filter(l => /· Hoja \d+ de \d+$/.test(l)).length, 1, `hoja ${k + 1}: ${lineas.join(' | ')}`);
        // Las de la portada llevan el encabezado del reporte; las demás, el del Seguimiento
        const delSeguimiento = k >= hojasDeLaPortada;
        assert.equal(lineas.includes('Seguimiento del dataset'), delSeguimiento, `hoja ${k + 1}: ${lineas.join(' | ')}`);
        assert.equal(lineas.includes('Reporte por área'), !delSeguimiento, `hoja ${k + 1}`);
      });
    }
  });

  it('la portada agrupa como antes: el área y sus contactos, las cinco tarjetas y un renglón por dataset en su grupo', async () => {
    const datasets = nueve();
    const portada = lineasPorHoja(await renderArea(datasets))[0];
    const texto = portada.join(' ');
    // El rótulo, el área y sus contactos (los de la tabla areas)
    assert.ok(portada.includes('REPORTE POR ÁREA · AL 20/10/2026'), portada.join(' | '));
    assert.ok(texto.includes('Secretaría de Economía, Finanzas y Control de Gestión'));
    assert.ok(portada.includes('CONTACTOS DEL ÁREA') && portada.includes('Persona de Contacto'), portada.join(' | '));
    // Las cinco tarjetas: con los sin fecha (que se aclaran debajo), suman el total
    assert.equal(valorDeTarjeta(portada, 'Total Datasets'), '9');
    assert.equal(valorDeTarjeta(portada, 'Actualizados'), '2');
    assert.equal(valorDeTarjeta(portada, 'Próximos'), '2');
    assert.equal(valorDeTarjeta(portada, 'Vencidos'), '3');
    assert.equal(valorDeTarjeta(portada, 'Eventuales'), '1');
    assert.ok(portada.includes('1 dataset todavía no tiene fecha de próxima actualización.'), portada.join(' | '));
    // Los grupos, en este orden, y los sin fecha al final, nunca entre los vencidos
    const grupos = ['Vencidos (3)', 'Próximos a vencer (2)', 'Actualizados (2)', 'Eventuales (1)', 'Sin fecha (1)'];
    const posiciones = grupos.map(g => portada.indexOf(g));
    assert.ok(posiciones.every(p => p !== -1), JSON.stringify(Object.fromEntries(grupos.map((g, i) => [g, posiciones[i]]))));
    assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
    // Un renglón por dataset, «Título · Datos al: dd/mm/aaaa · Próxima: dd/mm/aaaa», debajo de su grupo y en el orden de la lista
    const renglones = ORDEN_DE_NUEVE.map(id => portada.indexOf(renglonDe(datasets.find(d => d.titulo === CASOS[id].dataset.titulo))));
    assert.ok(renglones.every(r => r !== -1), JSON.stringify(renglones));
    assert.deepEqual([...renglones].sort((a, b) => a - b), renglones);
    const grupoDe = (renglon) => grupos[posiciones.filter(p => p < renglon).length - 1];
    assert.deepEqual(renglones.map(grupoDe), [grupos[0], grupos[0], grupos[0], grupos[1], grupos[1], grupos[2], grupos[2], grupos[3], grupos[4]]);
    // Los textos exactos: sin «Datos al» o sin próxima, con el guion largo
    for (const t of ['Directores Generales de Planta Permanente · Datos al: 31/12/2025 · Próxima: 31/07/2026',
      'Áreas específicas de género · Datos al: 31/10/2025 · Próxima: 30/11/2026',
      'Barrios de Comodoro Rivadavia · Datos al: 30/06/2026 · Próxima: —',
      'Listado de Proveedores · Datos al: 30/06/2025 · Próxima: —']) {
      assert.ok(portada.includes(t), `falta "${t}" en ${portada.join(' | ')}`);
    }
    const sinDatosAl = lineasPorHoja(await renderArea([delCaso(58, { datos_al: null })]))[0];
    assert.ok(sinDatosAl.includes('Áreas específicas de género · Datos al: — · Próxima: 30/11/2026'), sinDatosAl.join(' | '));
  });

  it('un grupo que sigue en otra hoja repite su cabeza arriba; ningún renglón se parte entre dos hojas', async () => {
    // 20 vencidos con títulos larguísimos: el grupo ocupa las dos hojas de la portada
    const vencidos = largos(20).map(d => ({ ...d, estado: 'sin-respuesta' }));
    const hojas = lineasPorHoja(await renderArea(vencidos));
    assert.equal(hojas.length, 2 + 20);
    for (const portada of hojas.slice(0, 2)) assert.ok(portada.includes('Vencidos (20)'), portada.join(' | '));
    // Cada renglón, entero en una hoja: el título arriba y la próxima en la misma hoja (y cada uno una sola vez)
    const enLaPortada = hojas.slice(0, 2).map(lineas => lineas.join(' '));
    vencidos.forEach((d, i) => {
      const enLaHoja = enLaPortada.filter(texto => texto.includes(`Dataset ${String(i + 1).padStart(2, '0')}: `));
      assert.equal(enLaHoja.length, 1, d.titulo);
      assert.ok(enLaHoja[0].includes(renglonDe(d).slice(-40)), d.titulo);
    });
  });

  it('un grupo sin datasets no va, y sin sin fecha no hay aclaración', async () => {
    const portada = lineasPorHoja(await renderArea([delCaso(9), delCaso(58)]))[0];
    assert.ok(portada.includes('Próximos a vencer (1)') && portada.includes('Actualizados (1)'), portada.join(' | '));
    for (const grupo of ['Vencidos (', 'Eventuales (', 'Sin fecha (']) assert.ok(!portada.some(l => l.startsWith(grupo)), grupo);
    assert.equal(valorDeTarjeta(portada, 'Vencidos'), '0');
    assert.ok(!portada.some(l => /todavía no tiene/.test(l)));
  });

  it('los contactos del área: todos los datos de contacto de la nota y del anexo, con sus rótulos y en su orden', async () => {
    const portada = lineasPorHoja(await renderArea([delCaso(9)]))[0];
    const recuadro = portada.indexOf('CONTACTOS DEL ÁREA');
    assert.ok(recuadro !== -1, portada.join(' | '));
    // Cada rótulo con su valor debajo (el rótulo se dibuja antes que su valor), en el orden de la nota, antes de las tarjetas
    const posiciones = CONTACTOS_DEL_AREA.map(([rotulo, campo]) => {
      const i = portada.indexOf(rotulo);
      assert.ok(i > recuadro, `falta "${rotulo}" en ${portada.join(' | ')}`);
      assert.equal(portada[i + 1], AREA[campo], rotulo);
      return i;
    });
    assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
    assert.ok(posiciones.at(-1) < portada.indexOf('Total Datasets'));
    // Los rótulos de antes ya no van: «Depende de» es el del área superior, y «Contacto», «Persona de contacto»
    assert.ok(!portada.includes('ÁREA SUPERIOR') && !portada.includes('CONTACTO'), portada.join(' | '));
  });

  it('los contactos vacíos no van, como en el anexo (sin cargar, en blanco o solo espacios), y nada se pisa', async () => {
    const area = { ...AREA, area_superior: null, email_secundario: '', celular_area: '   ', telefono_contacto: undefined };
    const portada = lineasPorHoja(await renderArea([delCaso(9)], area))[0];
    for (const rotulo of ['DEPENDE DE', 'EMAIL ALTERNATIVO', 'CELULAR', 'TELÉFONO DE CONTACTO']) {
      assert.ok(!portada.includes(rotulo), `"${rotulo}" no tendría que ir: ${portada.join(' | ')}`);
    }
    for (const rotulo of ['EMAIL', 'TELÉFONO', 'PERSONA DE CONTACTO', 'EMAIL DE CONTACTO']) assert.ok(portada.includes(rotulo), rotulo);
    assert.ok(!portada.some(l => /null|undefined/.test(l)), portada.join(' | '));
    // Larguísimos, cada uno ocupa la fila entera en dos líneas y se corta con «…»; nada sale del recuadro ni se pisa
    const largo = (texto) => `${texto} `.repeat(12).trim();
    const larguisima = Object.fromEntries(CONTACTOS_DEL_AREA.map(([, campo]) => [campo, largo(`${campo}@una-direccion-larguisima.ejemplo.test`)]));
    verificarDiagramacion(await diagramacion(() => renderArea([delCaso(9)], { ...AREA, ...larguisima })));
    verificarDiagramacion(await diagramacion(() => renderArea([delCaso(9)], area)));
  });

  it('un área sin datasets activos: la portada sola, con las tarjetas en 0; sin contactos cargados, no van', async () => {
    const hojas = lineasPorHoja(await renderArea([], { id: 7, nombre: 'Área sin datasets', email_principal: '  ', nombre_contacto: null }));
    assert.equal(hojas.length, 1);
    assert.ok(hojas[0].includes('Reporte por área · Hoja 1 de 1'));
    assert.equal(valorDeTarjeta(hojas[0], 'Total Datasets'), '0');
    assert.ok(!hojas[0].some(l => /null|undefined/.test(l)), hojas[0].join(' | '));
    // Sin ningún contacto cargado, el recuadro no va (ni su rótulo ni los de los datos)
    assert.ok(!hojas[0].includes('CONTACTOS DEL ÁREA'), hojas[0].join(' | '));
    for (const [rotulo] of CONTACTOS_DEL_AREA) assert.ok(!hojas[0].includes(rotulo), rotulo);
    // Sin datasets, tampoco la cabeza de la lista
    assert.ok(!hojas[0].includes('CONJUNTOS DE DATOS DEL ÁREA'), hojas[0].join(' | '));
  });

  it('a un dataset activo le falta su Seguimiento: tira error, no sale un PDF con hojas de menos', async () => {
    await assert.rejects(renderArea([delCaso(9), { ...delCaso(52), seguimiento: null }]), /Seguimiento/);
    // Uno dado de baja no lo necesita
    const hojas = lineasPorHoja(await renderArea([delCaso(9), { ...deBaja(), seguimiento: null }]));
    assert.equal(hojas.length, 2);
  });

  const casos = [
    ['nueve casos y uno dado de baja (la portada en una hoja)', () => [...nueve(), deBaja()]],
    ['16 títulos larguísimos (la portada en dos hojas)', () => largos(16)],
    ['un área sin datasets', () => []]
  ];
  for (const [titulo, armar] of casos) {
    it(`nada se pisa: ${titulo}`, async () => {
      const datasets = armar();
      verificarDiagramacion(await diagramacion(() => renderArea(datasets)));
    });
  }
});

// =====================================================
// Avisos del RPAD (spec 2026-10-24-metricas-y-reportes, 5: reemplaza al Historial de notificaciones)
// =====================================================

const PERIODO_AVISOS = { desde: '2026-01-01', hasta: '2026-03-31' };
const HOY_AVISOS = '2026-10-25';
const GENERADO_AVISOS = { momento: '2026-10-25 09:41:12', por: 'Usuario Ejemplo' };
// Lo que lee el controlador de la base, con lo que nunca tiene que salir en el PDF: las direcciones (destinatarios, para, cc, cco) y
// el texto técnico de un error
const DIRECCIONES = { destinatarios: 'mit@ejemplo.test,da@ejemplo.test', para: 'mit@ejemplo.test', cc: 'da@ejemplo.test', cco: 'oculto@ejemplo.test' };
const emailDePrueba = (datos) => ({ success: true, error: null, ...DIRECCIONES, ...datos });
const notaDePrueba = (datos) => ({ numero: null, anio: 2026, gestion: 'externa', estado: 'enviada', enviada: null, ...DIRECCIONES, ...datos });
const EMAILS_DEL_PERIODO = [
  emailDePrueba({ id: 1, tipo: 'externo-40', enviado: '2026-03-10 08:15:04', datasets: ['Parque Automotor', 'Gasto Público'] }),
  emailDePrueba({ id: 2, tipo: 'interno-60', enviado: '2026-03-10 08:15:06', datasets: ['Relevamiento de espacios verdes'] }),
  emailDePrueba({ id: 3, tipo: 'area-aviso-40', enviado: '2026-03-11 08:15:10', datasets: ['Gasto Público'] }),
  emailDePrueba({ id: 4, tipo: 'externo-5', enviado: '2026-03-26 11:00:06', success: false, error: 'connect ECONNREFUSED smtp@ejemplo.test', datasets: ['Pauta Publicitaria'] }),
  // El primer instante del período y el último
  emailDePrueba({ id: 5, tipo: 'externo-vencido', enviado: '2026-01-01 00:00:00', datasets: ['Parque Automotor'] }),
  emailDePrueba({ id: 6, tipo: 'interno-vencido', enviado: '2026-03-31 23:59:59', datasets: [] }),
  // Fuera del período, de un tipo que no se conoce o sin momento: no van
  emailDePrueba({ id: 7, tipo: 'externo-60', enviado: '2025-12-31 23:59:59', datasets: ['Fuera del período'] }),
  emailDePrueba({ id: 8, tipo: 'externo-60', enviado: '2026-04-01 00:00:00', datasets: ['Fuera del período'] }),
  emailDePrueba({ id: 9, tipo: 'otro-tipo', enviado: '2026-02-01 08:00:00', datasets: ['Tipo raro'] }),
  emailDePrueba({ id: 10, tipo: 'externo-60', enviado: null, datasets: ['Sin momento'] })
];
const NOTAS_DEL_PERIODO = [
  notaDePrueba({ id: 20, numero: 4, tipo: 'aviso', fecha: '2026-03-21', enviada: '2026-03-21 08:15:00', datasets: ['Pauta Publicitaria', 'Comercios habilitados'] }),
  notaDePrueba({ id: 21, numero: 5, tipo: 'reiteracion', gestion: 'interna', fecha: '2026-03-25', estado: 'pendiente', datasets: ['Relevamiento de espacios verdes'] }),
  notaDePrueba({ id: 22, numero: 6, tipo: 'reiteracion', fecha: '2026-03-31', estado: 'fallida', datasets: ['Gasto Público'] }),
  // La auditoría, la autorización, una de prueba y una fuera del período no van
  notaDePrueba({ id: 23, numero: 7, tipo: 'auditoria', gestion: null, fecha: '2026-03-12', datasets: [] }),
  notaDePrueba({ id: 24, numero: 8, tipo: 'autorizacion', gestion: null, fecha: '2026-03-13', datasets: [] }),
  notaDePrueba({ id: 25, tipo: 'aviso', anio: null, es_prueba: 1, fecha: '2026-03-14', datasets: ['Nota de prueba'] }),
  notaDePrueba({ id: 26, numero: 9, tipo: 'aviso', fecha: '2026-04-01', datasets: ['Fuera del período'] })
];
const avisosDePrueba = () => avisosDelPeriodo({ emails: EMAILS_DEL_PERIODO, notas: NOTAS_DEL_PERIODO }, PERIODO_AVISOS);
const renderDeAvisos = (avisos, periodo = PERIODO_AVISOS) => renderAvisos({ ...periodo, avisos }, { hoy: HOY_AVISOS, generado: GENERADO_AVISOS });
const ENCABEZADO_DE_AVISOS = ['Fecha', 'Qué fue', 'Gestión', 'Datasets', 'Estado'];
// Muchos emails a DGMIT, uno por día desde el 1/1, cada uno con un dataset: la tabla ocupa varias hojas
const muchosAvisos = (n) => avisosDelPeriodo({
  emails: Array.from({ length: n }, (_, i) => emailDePrueba({
    id: 100 + i, tipo: i % 2 ? 'interno-30' : 'externo-60', enviado: `${sumarDias('2026-01-01', i)} 08:15:00`,
    datasets: [`Dataset ${String(i + 1).padStart(3, '0')}`]
  })),
  notas: []
}, { desde: '2026-01-01', hasta: '2026-12-31' });

describe('Avisos del RPAD: los avisos del período', () => {
  it('cada email y cada Nota Digital de aviso o de reiteración del período, del más viejo al más nuevo, con los textos del Seguimiento', () => {
    const enviado = { envio: 'enviado', estado: 'Enviado' };
    assert.deepEqual(avisosDePrueba(), [
      { fecha: '2026-01-01', clase: 'dgmit', que: 'Email a DGMIT: resumen mensual de vencidos', gestion: 'externa', datasets: ['Parque Automotor'], ...enviado },
      { fecha: '2026-03-10', clase: 'dgmit', que: 'Email a DGMIT: distribución de notas', gestion: 'externa', datasets: ['Gasto Público', 'Parque Automotor'], ...enviado },
      { fecha: '2026-03-10', clase: 'dgmit', que: 'Email a DGMIT: planificación (60 días)', gestion: 'interna', datasets: ['Relevamiento de espacios verdes'], ...enviado },
      { fecha: '2026-03-11', clase: 'area', que: 'Email al área: anticipo de la nota formal', gestion: 'externa', datasets: ['Gasto Público'], ...enviado },
      { fecha: '2026-03-21', clase: 'nota', que: 'Nota Digital N° 4/26 a DGMIT', gestion: 'externa', datasets: ['Comercios habilitados', 'Pauta Publicitaria'], envio: 'enviado', estado: 'Enviada' },
      { fecha: '2026-03-25', clase: 'nota', que: 'Nota Digital N° 5/26 a DGMIT', gestion: 'interna', datasets: ['Relevamiento de espacios verdes'], envio: 'pendiente', estado: 'Pendiente de envío' },
      { fecha: '2026-03-26', clase: 'dgmit', que: 'Email a DGMIT: vencimiento inminente', gestion: 'externa', datasets: ['Pauta Publicitaria'], envio: 'fallido', estado: 'No se pudo enviar' },
      { fecha: '2026-03-31', clase: 'nota', que: 'Nota Digital N° 6/26 a DGMIT', gestion: 'externa', datasets: ['Gasto Público'], envio: 'fallido', estado: 'No se pudo enviar' },
      { fecha: '2026-03-31', clase: 'dgmit', que: 'Email a DGMIT: resumen mensual de vencidos', gestion: 'interna', datasets: [], ...enviado }
    ]);
  });

  it('sin emails ni notas, o con datos raros, no tira: ninguno', () => {
    assert.deepEqual(avisosDelPeriodo({}, PERIODO_AVISOS), []);
    assert.deepEqual(avisosDelPeriodo({ emails: null, notas: [null, 'x', 3] }, PERIODO_AVISOS), []);
    assert.deepEqual(avisosDelPeriodo({ emails: [{ tipo: 'externo-40', enviado: 'ayer', datasets: 'x' }] }, PERIODO_AVISOS), []);
  });
});

describe('Avisos del RPAD con el diseño del anexo', () => {
  it('el encabezado del anexo, el período, los totales y el pie «Avisos del RPAD · Hoja k de N»', async () => {
    const pdf = await renderDeAvisos(avisosDePrueba());
    assert.ok(todasDelTamano(pdf, HOJA_A4), 'todas las hojas son A4');
    const hojas = lineasPorHoja(pdf);
    assert.equal(hojas.length, 1);
    const [lineas] = hojas;
    for (const t of ['DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN', 'Municipalidad de Comodoro Rivadavia', 'Avisos del RPAD',
      formatoLargo(HOY_AVISOS), 'AVISOS DEL RPAD · DEL 01/01/2026 AL 31/03/2026', '9 avisos del RPAD en el período',
      '6 de gestión externa y 3 de gestión interna', 'Generado el 25/10/2026 a las 09:41 por Usuario Ejemplo', 'Avisos del RPAD · Hoja 1 de 1']) {
      assert.ok(lineas.includes(t), `falta "${t}" en ${lineas.join(' | ')}`);
    }
    // Los totales: los nueve avisos, los emails a la DGMIT, los del área, las notas y los que no salieron (dos fallidos y uno pendiente)
    assert.equal(valorDeTarjeta(lineas, 'Total de avisos'), '9');
    assert.equal(valorDeTarjeta(lineas, 'Emails a DGMIT'), '5');
    assert.equal(valorDeTarjeta(lineas, 'Emails al área'), '1');
    assert.equal(valorDeTarjeta(lineas, 'Notas Digitales'), '3');
    assert.equal(valorDeTarjeta(lineas, 'Sin enviar'), '3');
  });

  it('la tabla: Fecha, Qué fue, Gestión, Datasets y Estado, una fila por aviso, con los títulos separados por coma', async () => {
    const lineas = lineasPorHoja(await renderDeAvisos(avisosDePrueba())).flat();
    const i = lineas.indexOf('Fecha');
    assert.deepEqual(lineas.slice(i, i + 5), ENCABEZADO_DE_AVISOS);
    const fila = (fecha, que) => {
      const j = lineas.findIndex((l, k) => l === fecha && lineas[k + 1] === que);
      assert.ok(j !== -1, `falta la fila de "${que}" del ${fecha}: ${lineas.join(' | ')}`);
      return lineas.slice(j, j + 5);
    };
    assert.deepEqual(fila('21/03/2026', 'Nota Digital N° 4/26 a DGMIT'),
      ['21/03/2026', 'Nota Digital N° 4/26 a DGMIT', 'Externa', 'Comercios habilitados, Pauta Publicitaria', 'Enviada']);
    assert.deepEqual(fila('25/03/2026', 'Nota Digital N° 5/26 a DGMIT'),
      ['25/03/2026', 'Nota Digital N° 5/26 a DGMIT', 'Interna', 'Relevamiento de espacios verdes', 'Pendiente de envío']);
    assert.deepEqual(fila('11/03/2026', 'Email al área: anticipo de la nota formal'),
      ['11/03/2026', 'Email al área: anticipo de la nota formal', 'Externa', 'Gasto Público', 'Enviado']);
    assert.deepEqual(fila('26/03/2026', 'Email a DGMIT: vencimiento inminente'),
      ['26/03/2026', 'Email a DGMIT: vencimiento inminente', 'Externa', 'Pauta Publicitaria', 'No se pudo enviar']);
    // Un email sin datasets que se puedan nombrar: el guion largo
    assert.deepEqual(fila('31/03/2026', 'Email a DGMIT: resumen mensual de vencidos'),
      ['31/03/2026', 'Email a DGMIT: resumen mensual de vencidos', 'Interna', '—', 'Enviado']);
    // En el orden de la lista: del más viejo al más nuevo
    const fechas = lineas.filter(l => /^\d{2}\/\d{2}\/2026$/.test(l)).map(l => l.split('/').reverse().join('-'));
    assert.deepEqual(fechas, avisosDePrueba().map(a => a.fecha));
  });

  it('sin direcciones de email, sin el texto técnico de los errores y sin lo que no es un aviso', async () => {
    const lineas = lineasPorHoja(await renderDeAvisos(avisosDePrueba())).flat();
    const texto = lineas.join(' ');
    assert.ok(!texto.includes('@'), texto);
    for (const t of ['ECONNREFUSED', 'Fuera del período', 'Tipo raro', 'Sin momento', 'Nota de prueba', '7/26', '8/26', '9/26', 'recordatorio']) {
      assert.ok(!texto.includes(t), `"${t}" no va: ${texto}`);
    }
  });

  it('el estado de cada aviso va en una insignia con los colores del Seguimiento: enviado, pendiente y sin enviar', async () => {
    const { textos, bloques } = await diagramacion(() => renderDeAvisos(avisosDePrueba()));
    const xEstado = textos.find(t => t.texto === 'Estado').x0;
    for (const texto of ['Enviado', 'Enviada', 'Pendiente de envío', 'No se pudo enviar']) {
      const deLaTabla = textos.filter(t => t.texto === texto && t.x0 >= xEstado - 0.01);
      assert.ok(deLaTabla.length > 0, `falta "${texto}"`);
      for (const t of deLaTabla) assert.ok(bloques.some(b => b.hoja === t.hoja && contiene(b, t)), `"${texto}" no está en su insignia`);
    }
    const contenido = contenidoPorHoja(await renderDeAvisos(avisosDePrueba())).join('\n');
    // Enviado como un actualizado (verde), pendiente como un próximo (amarillo) y sin enviar como un vencido (rojo)
    for (const color of ['#DDF1E6', '#2E6B4C', '#FCE8A8', '#7A5200', '#F8E1E1', '#8A3434']) {
      assert.ok(contenido.includes(relleno(color)), `falta el color ${color}`);
    }
  });

  it('la tabla corta de hoja y repite el encabezado; cada aviso una sola vez y el pie en todas', async () => {
    const avisos = muchosAvisos(150);
    const hojas = lineasPorHoja(await renderDeAvisos(avisos, { desde: '2026-01-01', hasta: '2026-12-31' }));
    assert.ok(hojas.length >= 3, `${hojas.length} hojas`);
    hojas.forEach((lineas, k) => {
      assert.equal(lineas.filter(l => l === 'Qué fue').length, 1, `hoja ${k + 1}`);
      assert.ok(lineas.includes(`Avisos del RPAD · Hoja ${k + 1} de ${hojas.length}`), `hoja ${k + 1}: ${lineas.join(' | ')}`);
      assert.ok(lineas.includes('Generado el 25/10/2026 a las 09:41 por Usuario Ejemplo'), `hoja ${k + 1}`);
    });
    // El título, solo arriba de la primera hoja
    assert.ok(hojas[0].includes('150 avisos del RPAD en el período'));
    assert.ok(hojas.slice(1).every(lineas => !lineas.includes('150 avisos del RPAD en el período')));
    const numeros = hojas.flat().map(l => /^Dataset (\d{3})$/.exec(l)?.[1]).filter(Boolean).map(Number);
    assert.deepEqual(numeros, avisos.map((_, i) => i + 1));
  });

  it('muchos datasets en un aviso: la celda se corta con «…», en la misma fila', async () => {
    const titulos = Array.from({ length: 24 }, (_, i) => `Conjunto de datos con un título bastante largo número ${String(i + 1).padStart(2, '0')}`);
    const avisos = avisosDelPeriodo({ emails: [emailDePrueba({ id: 1, tipo: 'externo-vencido', enviado: '2026-03-01 08:15:00', datasets: titulos })] }, PERIODO_AVISOS);
    const { textos } = await diagramacion(() => renderDeAvisos(avisos));
    assert.ok(textos.some(t => t.texto.startsWith('Conjunto de datos con un título bastante largo número 01') && t.texto.endsWith('…')), 'la celda no se cortó');
    assert.equal(lineasPorHoja(await renderDeAvisos(avisos)).length, 1);
  });

  it('un solo aviso: «1 aviso del RPAD en el período»; ninguno: lo dice, sin píldora ni tabla', async () => {
    const [uno] = lineasPorHoja(await renderDeAvisos(avisosDePrueba().slice(0, 1)));
    assert.ok(uno.includes('1 aviso del RPAD en el período') && uno.includes('1 de gestión externa y 0 de gestión interna'), uno.join(' | '));
    const hojas = lineasPorHoja(await renderDeAvisos([]));
    assert.equal(hojas.length, 1);
    const [lineas] = hojas;
    assert.ok(lineas.includes('Ningún aviso del RPAD en el período'), lineas.join(' | '));
    assert.equal(valorDeTarjeta(lineas, 'Total de avisos'), '0');
    assert.ok(!lineas.includes('Qué fue') && !lineas.some(l => / de gestión externa y /.test(l)), lineas.join(' | '));
    assert.ok(lineas.includes('Avisos del RPAD · Hoja 1 de 1'));
  });

  const casos = [
    ['los avisos de la prueba', () => avisosDePrueba()],
    ['150 avisos, en varias hojas', () => muchosAvisos(150)],
    ['ningún aviso', () => []]
  ];
  for (const [titulo, armar] of casos) {
    it(`nada se pisa: ${titulo}`, async () => {
      const avisos = armar();
      verificarDiagramacion(await diagramacion(() => renderDeAvisos(avisos)));
    });
  }
});
