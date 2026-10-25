// Los reportes PDF con el diseño del anexo (spec 2026-10-24-metricas-y-reportes, 5.1): la base (services/reportesPdfBase.js) y el
// Estado general de los datasets. Puro: los datasets se arman acá, sin base de datos (los textos del reporte servido por la API, con
// el set controlado, están en estados-api.test.js y reportes.test.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderEstadoGeneral } from '../services/reportesEstadoGeneralPdf.js';
import { nuevoReporte, agregarHoja, cerrarReporte, dibujarPildora, prepararTabla, LIMITE } from '../services/reportesPdfBase.js';
import { renderSeguimiento, OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { seguimientoDe } from '../services/seguimientoReglas.js';
import { formatoLargo } from '../services/notasDigitalesCalendario.js';
import { lineasPorHoja, textosPorHoja, contenidoPorHoja, HOJA_A4, todasDelTamano } from './pdf-lector.js';
import { diagramacion, verificarDiagramacion, contiene } from './pdf-diagramacion.js';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS } from './seguimiento-casos.js';

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
