// Sitio público (spec 2026-10-17-fechas-datasets, sección 11), ejecutado en Node: lo puro de dataset-detail.js (las tres
// fechas del detalle), datasets.js (la tarjeta, el filtro, ?mes= y el CSV), dashboard.js (la portada: el índice, el mosaico, los
// 12 meses y las listas), calendario.js (el color de cada día) y gestion.js (la tasa y el ranking de Gestión). Las páginas usan el
// estado que manda el servidor (d.estado) y leen las fechas por su texto, nunca con new Date.
// Cada script, al cargarse, solo declara y registra su DOMContentLoaded: se carga en un vm con un document que no hace nada,
// junto con el api.js de verdad (Utils), como perfil.js y correos.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

const cargar = (script) => {
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: { addEventListener() {}, getElementById: () => null }
  });
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer(`js/${script}`), contexto);
  return contexto;
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));

// Un dataset como lo devuelve GET /datasets: las fechas de siempre viajan como ISO con hora (mysql2, la zona del servidor),
// datos_al como 'AAAA-MM-DD', y el estado y los días los calcula el servidor
const dataset = (extra = {}) => ({
  id: 20,
  titulo: 'Gasto Público',
  descripcion: 'Gasto ejecutado por partida',
  area_nombre: 'Secretaría de Hacienda',
  tipo_gestion: 'externa',
  frecuencia_id: 6,
  frecuencia_nombre: 'Cada medio año',
  frecuencia_dias: 180,
  frecuencia_meses: 6,
  tema_principal_id: 3,
  tema_principal_nombre: 'Economía',
  tema_secundario_id: null,
  tema_secundario_nombre: null,
  formatos: 'CSV, XLSX',
  ultima_actualizacion: '2026-03-26T03:00:00.000Z',
  proxima_actualizacion: '2027-01-31T03:00:00.000Z',
  datos_al: '2025-12-31',
  tipo_pedido: 'acumulado',
  tipo_pedido_nombre: 'Acumulado',
  estado: 'actualizado',
  dias_para_vencer: 106,
  ...extra
});
const eventual = (extra = {}) => dataset({
  id: 66, titulo: 'Barrios de Comodoro Rivadavia', frecuencia_id: 11, frecuencia_nombre: 'Eventual', frecuencia_dias: null,
  frecuencia_meses: null, proxima_actualizacion: null, datos_al: '2024-06-30', tipo_pedido: 'eventual', tipo_pedido_nombre: 'Eventual',
  estado: 'eventual', dias_para_vencer: null, ...extra
});

describe('las páginas públicas ya no calculan el estado por su cuenta', () => {
  for (const [script, copias] of [
    ['dataset-detail.js', ['calcularEstado', 'formatDate']],
    ['datasets.js', ['calcularEstado', 'formatDate']],
    ['calendario.js', ['calcularEstadoDataset']]
  ]) {
    it(`${script}: se carga sin el DOM y no tiene su copia de ${copias.join(' ni de ')}`, () => {
      const contexto = cargar(script);
      for (const copia of copias) assert.equal(typeof contexto[copia], 'undefined', copia);
      assert.doesNotMatch(leer(`js/${script}`), /function calcularEstado/);
    });
  }

  it('dashboard.js no llama a Utils.calcularEstado ni a getDiasRestantes: usa el estado y los días del servidor', () => {
    assert.doesNotMatch(leer('js/dashboard.js'), /Utils\.calcularEstado|getDiasRestantes|frecuencia_dias/);
  });
});

describe('dataset-detail.js: las tres fechas del detalle', () => {
  const detalle = cargar('dataset-detail.js');

  it('Gasto Público: datos al 31/12/2025, cargado en el portal el 26/03/2026 y la próxima prevista en mes y año', () => {
    const gasto = dataset({ proxima_actualizacion: '2026-07-31T03:00:00.000Z', estado: 'sin-respuesta', dias_para_vencer: -78 });
    assert.deepEqual(plano(detalle.filasDeFechas(gasto)), [
      { rotulo: 'Datos al', valor: '31/12/2025' },
      { rotulo: 'Cargado en el portal', valor: '26/03/2026' },
      { rotulo: 'Próxima actualización prevista', valor: 'julio de 2026' }
    ]);
  });

  it('Próxima actualización prevista: enero de 2027', () => {
    assert.equal(detalle.textoProximaPrevista(dataset()), 'enero de 2027');
  });

  it('un eventual dice "Eventual" en la próxima', () => {
    assert.equal(detalle.textoProximaPrevista(eventual()), 'Eventual');
    // Aunque le haya quedado una próxima vieja: manda el estado del servidor
    assert.equal(detalle.textoProximaPrevista(eventual({ proxima_actualizacion: '2025-01-31T03:00:00.000Z' })), 'Eventual');
  });

  it('sin próxima, o con una que no es fecha, da una raya', () => {
    assert.equal(detalle.textoProximaPrevista(dataset({ proxima_actualizacion: null, estado: 'sin-fecha' })), '—');
    assert.equal(detalle.textoProximaPrevista(dataset({ proxima_actualizacion: '0000-00-00', estado: 'sin-fecha' })), '—');
  });

  it('Datos al: dd/mm/aaaa, "Ejercicio aaaa" en un presupuesto, "Relevamiento de {mes} de {año}" en un relevamiento, o una raya', () => {
    assert.equal(detalle.textoDatosAl(dataset()), '31/12/2025');
    assert.equal(detalle.textoDatosAl(dataset({ tipo_pedido: 'ejercicio' })), 'Ejercicio 2025');
    // Con "de" antes del año, como "julio de 2026" en la próxima (Ruling 24)
    assert.equal(detalle.textoDatosAl(dataset({ tipo_pedido: 'relevamiento', datos_al: '2026-06-30' })), 'Relevamiento de junio de 2026');
    assert.equal(detalle.textoDatosAl(dataset({ datos_al: null })), '—');
    assert.equal(detalle.textoDatosAl(dataset({ datos_al: '0000-00-00' })), '—');
    assert.equal(detalle.textoDatosAl(dataset({ tipo_pedido: 'ejercicio', datos_al: null })), '—');
  });

  it('Cargado en el portal corta el texto: el 31/01 no pasa al 30/01 ni al 01/02', () => {
    assert.equal(detalle.textoCargadoEnElPortal(dataset({ ultima_actualizacion: '2026-01-31T03:00:00.000Z' })), '31/01/2026');
    assert.equal(detalle.textoCargadoEnElPortal(dataset({ ultima_actualizacion: '2026-01-31' })), '31/01/2026');
    assert.equal(detalle.textoCargadoEnElPortal(dataset({ ultima_actualizacion: null })), '—');
  });

  it('el HTML de las fechas lleva los tres rótulos y escapa los valores', () => {
    const html = detalle.htmlDeFechas(dataset());
    for (const rotulo of ['Datos al', 'Cargado en el portal', 'Próxima actualización prevista']) assert.ok(html.includes(`>${rotulo}<`), rotulo);
    assert.match(html, /<span class="info-value">enero de 2027<\/span>/);
    assert.doesNotMatch(html, /Última actualización/);
    assert.equal(html.split('class="info-row"').length - 1, 3);
  });

  it('dataset.html ya no dice "Última actualización" y tiene dónde poner las fechas', () => {
    const html = leer('dataset.html');
    assert.doesNotMatch(html, /Última actualización/);
    assert.match(html, /id="dataset-fechas"/);
    for (const rotulo of ['Datos al', 'Cargado en el portal', 'Próxima actualización prevista']) assert.ok(html.includes(rotulo), rotulo);
  });
});

describe('datasets.js: la tarjeta del listado', () => {
  const listado = cargar('datasets.js');

  it('dice "Datos al dic 2025" y "Próxima: ene 2027", y ya no "Próx: dd/mm/aaaa"', () => {
    const html = listado.htmlDeTarjeta(dataset());
    assert.ok(html.includes('Datos al dic 2025'));
    assert.ok(html.includes('Próxima: ene 2027'));
    assert.doesNotMatch(html, /Próx:/);
  });

  it('muestra el área (area_nombre: area_responsable no existe)', () => {
    assert.ok(listado.htmlDeTarjeta(dataset()).includes('</svg> Secretaría de Hacienda</span>'));
    assert.ok(listado.htmlDeTarjeta(dataset({ area_nombre: null })).includes('</svg> -</span>'));
  });

  it('el estado es el del servidor: un eventual dice Eventual y un sin fecha, Sin fecha', () => {
    assert.match(listado.htmlDeTarjeta(eventual()), /<span class="badge badge-secondary">Eventual<\/span>/);
    assert.ok(listado.htmlDeTarjeta(eventual()).includes('Datos al jun 2024'));
    const sinFecha = listado.htmlDeTarjeta(dataset({ proxima_actualizacion: null, estado: 'sin-fecha', dias_para_vencer: null }));
    assert.match(sinFecha, /<span class="badge badge-secondary">Sin fecha<\/span>/);
    assert.ok(sinFecha.includes('Próxima: sin fecha'));
    // Aunque las fechas dirían otra cosa, manda d.estado
    assert.match(listado.htmlDeTarjeta(dataset({ estado: 'sin-respuesta' })), /badge-sin-respuesta">Sin respuesta</);
  });

  it('"Datos al" en un presupuesto y en un relevamiento, y sin dato', () => {
    assert.equal(listado.textoDatosAlCorto(dataset({ tipo_pedido: 'ejercicio' })), 'Ejercicio 2025');
    // En el listado va abreviado, como "Datos al dic 2025" (Ruling 25)
    assert.equal(listado.textoDatosAlCorto(dataset({ tipo_pedido: 'relevamiento', datos_al: '2026-06-30' })), 'Relevamiento de jun 2026');
    assert.equal(listado.textoDatosAlCorto(dataset({ datos_al: null })), 'Datos al —');
    assert.equal(listado.textoProximaCorta(eventual()), 'Eventual');
    assert.equal(listado.textoProximaCorta(dataset({ proxima_actualizacion: null, estado: 'sin-fecha' })), 'Próxima: sin fecha');
  });

  it('escapa el título, la descripción, el área, el tema y los formatos', () => {
    const html = listado.htmlDeTarjeta(dataset({
      id: 7, titulo: '<img src=x onerror=alert(1)>', descripcion: '<b>d</b>', area_nombre: 'A & "B"', tema_principal_nombre: '<i>t</i>',
      formatos: 'CSV, <script>x</script>'
    }));
    assert.doesNotMatch(html, /<img|<b>|<i>|<script>/);
    assert.ok(html.includes('A &amp; &quot;B&quot;'));
    assert.ok(html.includes('href="dataset.html?id=7"'));
  });
});

describe('datasets.js: filtros y ?mes=', () => {
  const listado = cargar('datasets.js');
  const LISTA = [
    dataset({ id: 1, titulo: 'Pauta Publicitaria', area_nombre: 'Comunicación', proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
    dataset({ id: 2, titulo: 'Proveedores', area_nombre: 'Compras', tema_principal_id: 8,
      proxima_actualizacion: '2027-01-31T03:00:00.000Z', frecuencia_id: 9 }),
    dataset({ id: 3, titulo: 'Parque Automotor', tema_secundario_id: 8, proxima_actualizacion: '2024-01-31T03:00:00.000Z',
      estado: 'sin-respuesta', dias_para_vencer: -990 }),
    dataset({ id: 4, titulo: 'Espacios Verdes', tipo_gestion: 'interna', proxima_actualizacion: '2026-09-30T03:00:00.000Z',
      estado: 'atrasado', dias_para_vencer: -17 }),
    dataset({ id: 5, titulo: 'Funcionarios', proxima_actualizacion: '2026-10-31T03:00:00.000Z', estado: 'proximo', dias_para_vencer: 14 }),
    eventual({ id: 6 }),
    // Un eventual con una próxima vieja no cuenta en ningún mes (tampoco en el gráfico del tablero)
    eventual({ id: 7, titulo: 'Gimnasios', proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
    dataset({ id: 8, titulo: 'Sin próxima', proxima_actualizacion: null, estado: 'sin-fecha', dias_para_vencer: null })
  ];
  const ids = (filtros) => listado.filtrarDatasets(LISTA, filtros).map(d => d.id);

  it('sin filtros, todos', () => {
    assert.deepEqual(ids({}), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('el estado es el del servidor: Actualizado no incluye a los eventuales (como la tarjeta del tablero)', () => {
    assert.deepEqual(ids({ estado: 'actualizado' }), [1, 2]);
    assert.deepEqual(ids({ estado: 'eventual' }), [6, 7]);
    assert.deepEqual(ids({ estado: 'vencidos' }), [3, 4]);
    assert.deepEqual(ids({ estado: 'atrasado' }), [4]);
    assert.deepEqual(ids({ estado: 'sin-respuesta' }), [3]);
    assert.deepEqual(ids({ estado: 'proximo' }), [5]);
    assert.deepEqual(ids({ estado: 'sin-fecha' }), [8]);
  });

  it('?mes= filtra por el mes de la próxima, y deja afuera a los eventuales', () => {
    assert.deepEqual(ids({ mes: '2027-01' }), [1, 2]);
    assert.deepEqual(ids({ mes: '2026-10' }), [5]);
    assert.deepEqual(ids({ mes: '2026-11' }), []);
    assert.deepEqual(ids({ mes: '2027-01', busqueda: 'pauta' }), [1]);
  });

  it('la búsqueda mira el título, el área y la descripción', () => {
    assert.deepEqual(ids({ busqueda: 'compras' }), [2]);
    assert.deepEqual(ids({ busqueda: 'PARQUE' }), [3]);
  });

  it('el tema es el principal o el secundario, y la frecuencia por id', () => {
    assert.deepEqual(ids({ temaId: '8' }), [2, 3]);
    assert.deepEqual(ids({ temaId: '3' }), [1, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(ids({ frecId: '9' }), [2]);
  });

  it('mesDelParametro acepta solo AAAA-MM', () => {
    assert.equal(listado.mesDelParametro('2027-01'), '2027-01');
    for (const valor of ['2027-13', '2027-00', '2027-1', 'abc', '', null, undefined, '2027-01-31']) {
      assert.equal(listado.mesDelParametro(valor), null, String(valor));
    }
  });

  it('el aviso del filtro por mes dice el mes con todas las letras', () => {
    assert.equal(listado.textoFiltroMes('2027-01'), 'Vencen en enero de 2027');
    assert.equal(listado.textoFiltroMes('2026-09'), 'Vencen en septiembre de 2026');
  });

  it('datasets.html tiene el aviso del filtro por mes y las opciones Eventual y Sin fecha', () => {
    const html = leer('datasets.html');
    assert.match(html, /id="filtro-mes"/);
    assert.match(html, /<option value="eventual">Eventual<\/option>/);
    assert.match(html, /<option value="sin-fecha">Sin fecha<\/option>/);
  });
});

describe('datasets.js: el CSV', () => {
  const listado = cargar('datasets.js');

  it('suma "Datos al" y llama "Cargado en el portal" a la que era "Última Actualización"', () => {
    const encabezado = listado.armarCsv([]).slice(1);
    assert.equal(encabezado, [
      'Título', 'Área', 'Tema', 'Frecuencia', 'Tipo Gestión', 'Estado', 'Datos al', 'Cargado en el portal', 'Próxima Actualización'
    ].map(celda => `"${celda}"`).join(','));
    assert.doesNotMatch(encabezado, /Última Actualización/);
  });

  it('cada fila trae el área, el estado del servidor y las fechas cortadas del texto', () => {
    assert.deepEqual(plano(listado.filaCsv(dataset())), [
      'Gasto Público', 'Secretaría de Hacienda', 'Economía', 'Cada medio año', 'Gestión Externa', 'Actualizado',
      '31/12/2025', '26/03/2026', '31/01/2027'
    ]);
    assert.deepEqual(plano(listado.filaCsv(eventual({ ultima_actualizacion: null, datos_al: null }))).slice(5), ['Eventual', '-', '-', '-']);
  });

  it('el archivo arranca con el BOM, entre comillas, y duplica las comillas de adentro', () => {
    const csv = listado.armarCsv([dataset({ titulo: 'Con "comillas", y coma' })]);
    assert.ok(csv.startsWith('\uFEFF"Título","Área",'));
    const [, fila] = csv.slice(1).split('\n');
    assert.ok(fila.startsWith('"Con ""comillas"", y coma","Secretaría de Hacienda"'));
    assert.equal(csv.slice(1).split('\n').length, 2);
  });

  it('el BOM es U+FEFF y en el código va escrito como escape, no como carácter invisible', () => {
    const BOM = 0xFEFF;
    assert.equal(listado.armarCsv([]).charCodeAt(0), BOM);
    assert.equal(listado.armarCsv([dataset()]).charCodeAt(0), BOM);
    // Un carácter invisible lo puede borrar un editor o una herramienta que saca BOM, sin que nadie lo note
    const fuente = leer('js/datasets.js');
    assert.ok(!fuente.includes(String.fromCharCode(BOM)), 'datasets.js no tiene un U+FEFF literal');
    assert.ok(fuente.includes(`'${String.fromCharCode(92)}uFEFF'`), 'datasets.js escribe el BOM como escape');
  });
});

describe('dashboard.js: el gráfico de los 12 meses', () => {
  const tablero = cargar('dashboard.js');

  it('arranca en el mes en curso y sigue 11 meses más, cruzando el año', () => {
    const meses = plano(tablero.mesesDelGrafico('2026-10-17'));
    assert.equal(meses.length, 12);
    assert.deepEqual(meses.map(m => m.clave), [
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09'
    ]);
    assert.equal(meses[0].etiqueta, 'oct 26');
    assert.equal(meses[3].etiqueta, 'ene 27');
    assert.equal(meses[0].titulo, 'octubre de 2026');
  });

  it('el último día del mes y el 29/02 caen en su mes', () => {
    assert.equal(plano(tablero.mesesDelGrafico('2026-10-31'))[0].clave, '2026-10');
    assert.equal(plano(tablero.mesesDelGrafico('2028-02-29'))[0].clave, '2028-02');
    assert.equal(plano(tablero.mesesDelGrafico('2026-12-01'))[1].clave, '2027-01');
  });

  it('cuenta los vencimientos de cada mes por el texto de la próxima, sin los eventuales; el mes en curso cuenta', () => {
    const lista = [
      dataset({ proxima_actualizacion: '2026-10-31T03:00:00.000Z', estado: 'proximo' }),
      dataset({ proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
      dataset({ proxima_actualizacion: '2027-01-31' }),
      dataset({ proxima_actualizacion: '2027-10-31T03:00:00.000Z' }),
      eventual(),
      eventual({ proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
      dataset({ proxima_actualizacion: null, estado: 'sin-fecha' })
    ];
    const meses = tablero.mesesDelGrafico('2026-10-17');
    assert.deepEqual(plano(tablero.vencimientosPorMes(lista, meses)), [1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('cada barra cuenta lo mismo que muestra el listado con ?mes= de ese mes', () => {
    const listado = cargar('datasets.js');
    const lista = [];
    for (let i = 0; i < 40; i++) {
      const anio = 2026 + Math.floor((9 + i) / 12);
      const mes = String(((9 + i) % 12) + 1).padStart(2, '0');
      lista.push(dataset({ id: i, proxima_actualizacion: `${anio}-${mes}-28T03:00:00.000Z`, estado: i % 3 ? 'actualizado' : 'proximo' }));
      if (i % 5 === 0) lista.push(eventual({ id: 100 + i, proxima_actualizacion: `${anio}-${mes}-28T03:00:00.000Z` }));
    }
    const meses = tablero.mesesDelGrafico('2026-10-17');
    const barras = plano(tablero.vencimientosPorMes(lista, meses));
    meses.forEach((m, i) => assert.equal(barras[i], listado.filtrarDatasets(lista, { mes: m.clave }).length, m.clave));
  });

  it('el clic en una barra lleva al listado filtrado por ese mes', () => {
    assert.equal(tablero.urlDelMes({ clave: '2026-10' }), 'datasets.html?mes=2026-10');
  });
});

describe('dashboard.js: el índice y el mosaico', () => {
  const tablero = cargar('dashboard.js');
  const STATS = { total: 80, actualizados: 52, proximos: 1, atrasados: 3, sinRespuesta: 10, eventuales: 14, sinFecha: 0, tasaActualizacion: 80 };

  it('la frase usa la tasa del servidor y la misma base: el total sin los eventuales', () => {
    const { tasa, frase, aclaracion } = plano(tablero.textoIndice(STATS));
    assert.equal(tasa, '80%');
    assert.equal(frase, 'El 80% de los conjuntos de datos con fecha de actualización están al día: 53 de 66.');
    assert.equal(aclaracion, 'El registro sigue 80 conjuntos. Los otros 14 son eventuales: se publican cuando hay novedades y no tienen vencimiento.');
  });

  it('nombra los sin fecha solo si hay, y el singular de un eventual', () => {
    assert.match(plano(tablero.textoIndice({ ...STATS, total: 82, sinFecha: 2 })).aclaracion, / 2 todavía no tienen fecha de próxima actualización\.$/);
    assert.match(plano(tablero.textoIndice({ ...STATS, total: 67, eventuales: 1 })).aclaracion, /El otro es eventual: se publica cuando hay novedades y no tiene vencimiento\.$/);
  });

  it('la situación dice el día de la semana sin depender de la zona del navegador', () => {
    assert.equal(tablero.textoSituacion('2026-10-18'), 'Situación al domingo 18 de octubre de 2026.');
    assert.equal(tablero.textoSituacion('2027-01-01'), 'Situación al viernes 1 de enero de 2027.');
  });

  it('agrupa por estado del servidor: vencidos juntos, sin fecha solo si hay, cada grupo por título', () => {
    const lista = [
      dataset({ id: 1, titulo: 'Zeta', estado: 'actualizado' }), dataset({ id: 2, titulo: 'Alfa', estado: 'actualizado' }),
      dataset({ id: 3, estado: 'proximo' }), dataset({ id: 4, estado: 'atrasado' }), dataset({ id: 5, estado: 'sin-respuesta' }),
      eventual({ id: 6 }), dataset({ id: 7, area_nombre: null, descripcion: null, datos_al: null })
    ];
    const grupos = plano(tablero.gruposDelMosaico(lista));
    assert.deepEqual(grupos.map(g => g.etiqueta), ['Actualizados', 'Próximos a vencer', 'Vencidos', 'Eventuales']);
    assert.deepEqual(grupos[0].datasets.map(d => d.id), [2, 7, 1]);
    assert.deepEqual(grupos[2].datasets.map(d => d.id).sort(), [4, 5]);
    assert.equal(grupos.reduce((s, g) => s + g.datasets.length, 0), lista.length);
    const conSinFecha = plano(tablero.gruposDelMosaico([...lista, dataset({ id: 8, estado: 'sin-fecha', proxima_actualizacion: null })]));
    assert.equal(conSinFecha.at(-1).etiqueta, 'Sin fecha');
  });

  it('cada cuadrito es un link al detalle con su nombre y su estado, escapados', () => {
    const html = tablero.htmlDelMosaico(tablero.gruposDelMosaico([dataset({ id: 9, titulo: '<b>X</b> & Y', estado: 'sin-respuesta' })]));
    assert.match(html, /<a class="cuadro c-sin-respuesta" href="dataset\.html\?id=9" data-id="9" aria-label="&lt;b&gt;X&lt;\/b&gt; &amp; Y, Sin respuesta del área responsable"><\/a>/);
    assert.doesNotMatch(html, /<b>X<\/b>/);
  });

  // Se conserva de la portada vieja: la tasa es la del servidor, nunca un cálculo del navegador
  it('la tasa que se muestra es la del servidor', () => {
    assert.equal(tablero.textoTasa(STATS), '80%');
    assert.equal(tablero.textoTasa({}), '0%');
  });

  it('el pie del mosaico dice el título, el área y el estado largo, escapados', () => {
    assert.equal(
      tablero.htmlDelPie(dataset({ titulo: 'A <b>&</b>', area_nombre: 'Área "X"', estado: 'proximo' })),
      '<strong>A &lt;b&gt;&amp;&lt;/b&gt;</strong><br>Área &quot;X&quot;. Próximo a vencer.'
    );
    assert.equal(tablero.htmlDelPie(eventual({ area_nombre: null })), '<strong>Barrios de Comodoro Rivadavia</strong><br>Sin área asignada. Actualización eventual.');
  });
});

describe('dashboard.js: los 12 meses y las listas', () => {
  const tablero = cargar('dashboard.js');

  it('cada mes es un link al listado, con la cantidad y una marca por conjunto', () => {
    const meses = tablero.mesesDelGrafico('2026-10-18');
    const html = tablero.htmlDeLosMeses(meses, [0, 1, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.match(html, /<a class="mes actual" href="datasets\.html\?mes=2026-10" aria-label="octubre de 2026: vencen 0 conjuntos">/);
    assert.match(html, /aria-label="noviembre de 2026: vence 1 conjunto"/);
    assert.equal(html.split('<i></i>').length - 1, 17);
  });

  it('las etiquetas de los meses van en una fila aparte, la primera marcada como el mes actual', () => {
    const html = tablero.htmlDeLosMeses(tablero.mesesDelGrafico('2026-10-18'), Array(12).fill(0));
    assert.match(html, /<div class="meses-nombres" id="meses-nombres" aria-hidden="true"><span class="actual">oct 26<\/span><span>nov 26<\/span>/);
    assert.equal(html.split('<a class="mes').length - 1, 12);
  });

  it('últimas cargas: por la fecha de carga (texto), sin los que no tienen, hasta 5', () => {
    const lista = [
      dataset({ id: 1, ultima_actualizacion: '2026-10-13T03:00:00.000Z' }), dataset({ id: 2, ultima_actualizacion: null }),
      dataset({ id: 3, ultima_actualizacion: '2026-10-16' }), dataset({ id: 4, ultima_actualizacion: '2026-01-31T03:00:00.000Z' })
    ];
    assert.deepEqual(plano(tablero.ultimasCargas(lista)).map(d => d.id), [3, 1, 4]);
    assert.equal(tablero.ultimasCargas(Array.from({ length: 9 }, (_, i) => dataset({ id: i }))).length, 5);
  });

  it('la fila escapa y lleva al detalle; sin área lo dice', () => {
    const html = tablero.htmlDeFila(dataset({ id: 5, titulo: '<i>T</i>', area_nombre: null }), '<strong>3 días</strong>');
    assert.ok(html.includes('href="dataset.html?id=5"'));
    assert.ok(html.includes('&lt;i&gt;T&lt;/i&gt;'));
    assert.ok(html.includes('Sin área asignada'));
    assert.equal(tablero.textoDias(1), '1 día');
    assert.equal(tablero.textoDias(625), '625 días');
  });

  it('el dato de cada lista: días de atraso con la insignia, días para vencer (o "Vence hoy") y la fecha de carga', () => {
    const vencido = tablero.datoDeVencido(dataset({ estado: 'sin-respuesta', dias_para_vencer: -1 }));
    assert.equal(vencido, '<strong>1 día</strong> de atraso<span class="badge badge-sin-respuesta">Sin respuesta</span>');
    assert.match(tablero.datoDeVencido(dataset({ estado: 'atrasado', dias_para_vencer: -625 })), /625 días<\/strong> de atraso<span class="badge badge-danger">Atrasado</);
    assert.equal(tablero.datoDeProximo(dataset({ estado: 'proximo', dias_para_vencer: 0 })), '<strong>Vence hoy</strong>');
    assert.equal(tablero.datoDeProximo(dataset({ estado: 'proximo', dias_para_vencer: 14 })), '<strong>14 días</strong> para vencer');
    assert.equal(tablero.datoDeCarga(dataset({ ultima_actualizacion: '2026-01-31T03:00:00.000Z' })), '<strong>31/01/2026</strong> cargado');
    assert.equal(tablero.textoVerVencidos(13), 'Ver los 13 vencidos');
    assert.equal(tablero.textoVerVencidos(1), 'Ver el vencido');
  });

  it('la frase destaca la tasa y escapa el resto', () => {
    assert.equal(tablero.htmlDeLaFrase({ tasa: '80%', frase: 'El 80% de <x>: 53 de 66.' }), 'El <strong class="indice-cifra">80%</strong> de &lt;x&gt;: 53 de 66.');
  });

  it('index.html tiene dónde dibujar cada parte, el aviso de error y el de sin JavaScript', () => {
    const html = leer('index.html');
    assert.match(html, /<title>RPAD - Índice de actualización de los datos abiertos<\/title>/);
    assert.match(html, /<h1>Índice de actualización<\/h1>/);
    for (const id of ['indice-frase', 'indice-aclaracion', 'indice-situacion', 'mosaico', 'mosaico-grupos', 'meses-marco', 'meses', 'meses-nombres',
      'seccion-meses', 'portada-listas', 'vencidos', 'proximos', 'ultimas']) {
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
    assert.match(html, /<p class="mosaico-pie" id="mosaico-pie" aria-live="polite">/);
    assert.match(html, /<a class="enlace hidden" id="ver-vencidos" href="datasets\.html\?estado=vencidos">/);
    assert.match(html, /<a class="btn-tinta" href="datasets\.html">Ver los datasets<\/a>/);
    assert.match(html, /<a class="btn-borde" href="calendario\.html">Ver el calendario<\/a>/);
    assert.match(html, /id="portada-error" role="alert">No se pudieron cargar los datos del registro\. Probá de nuevo en unos minutos\.</);
    assert.match(html, /<noscript>[^]*Para ver el índice hace falta JavaScript\.[^]*<\/noscript>/);
    assert.match(html, /<main class="main-content main-publico">/);
  });

  it('la portada vieja ya no está: ni la dona, ni los contadores, ni el reloj', () => {
    for (const vieja of ['porcentajesEnteros', 'porcionesDelEstado', 'htmlDeLeyenda', 'renderDonutChart', 'renderCalendarChart', 'animateCounter',
      'updateHeroDateTime', 'updateHeroGreeting', 'goToDatasets', 'toggleAtrasados', 'toggleProximos', 'renderStats', 'renderAlertas']) {
      assert.equal(typeof tablero[vieja], 'undefined', vieja);
    }
    assert.doesNotMatch(leer('js/dashboard.js'), /new Chart|setInterval|onclick/);
  });
});

describe('dashboard.js: las alertas', () => {
  const tablero = cargar('dashboard.js');

  it('vencidos y próximos salen del estado del servidor, ordenados por los días', () => {
    const lista = [
      dataset({ id: 1, estado: 'sin-respuesta', dias_para_vencer: -10 }),
      dataset({ id: 2, estado: 'atrasado', dias_para_vencer: -400 }),
      dataset({ id: 3, estado: 'proximo', dias_para_vencer: 30 }),
      dataset({ id: 4, estado: 'proximo', dias_para_vencer: 0 }),
      dataset({ id: 5, estado: 'actualizado', dias_para_vencer: 100 }),
      eventual({ id: 6 })
    ];
    const { vencidos, proximos } = tablero.alertasDe(lista);
    assert.deepEqual(vencidos.map(d => d.id), [2, 1]);
    assert.deepEqual(proximos.map(d => d.id), [4, 3]);
  });
});

describe('calendario.js: el color de cada día sale del estado del servidor', () => {
  const calendario = cargar('calendario.js');

  it('rojo si hay un vencido, amarillo si hay un próximo, verde si no', () => {
    assert.equal(calendario.determinarColorEvento([dataset({ estado: 'actualizado' }), dataset({ estado: 'sin-respuesta' })]), '#ef4444');
    assert.equal(calendario.determinarColorEvento([dataset({ estado: 'atrasado' })]), '#ef4444');
    assert.equal(calendario.determinarColorEvento([dataset({ estado: 'proximo' }), dataset({ estado: 'actualizado' })]), '#f59e0b');
    assert.equal(calendario.determinarColorEvento([dataset({ estado: 'actualizado' })]), '#22c55e');
    // Las fechas dirían vencido, pero manda d.estado
    assert.equal(calendario.determinarColorEvento([dataset({ estado: 'actualizado', proxima_actualizacion: '2020-01-31T03:00:00.000Z' })]), '#22c55e');
  });

  it('el detalle de un día escapa la frecuencia y usa el rótulo de cada estado', () => {
    const html = calendario.htmlDelDia([dataset({ frecuencia_nombre: '<b>x</b>', estado: 'proximo' }), eventual()]);
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(html, /badge-warning">Próximo</);
    assert.match(html, /badge-secondary">Eventual</);
  });
});

describe('gestion.js: la tasa de cumplimiento y el ranking', () => {
  const gestion = cargar('gestion.js');

  it('textoPorcentaje: un número con %, y null con una raya', () => {
    assert.equal(gestion.textoPorcentaje(83), '83%');
    assert.equal(gestion.textoPorcentaje(0), '0%');
    assert.equal(gestion.textoPorcentaje(null), '—');
    assert.equal(gestion.textoPorcentaje(undefined), '—');
  });

  it('un área con solo eventuales dice "—" y no 100%', () => {
    const html = gestion.htmlDelRanking([
      { area: 'Área A', total_datasets: 7, al_dia: 3, porcentaje: 60 },
      { area: 'Área <C>', total_datasets: 1, al_dia: 0, porcentaje: null }
    ]);
    assert.match(html, /<td>60%<\/td>/);
    assert.match(html, /<td>—<\/td>/);
    assert.doesNotMatch(html, /null|100%/);
    assert.ok(html.includes('Área &lt;C&gt;'));
    assert.match(html, /width:0%/);
  });

  it('sin áreas, lo dice', () => {
    assert.match(gestion.htmlDelRanking([]), /Sin datos de áreas/);
  });
});
