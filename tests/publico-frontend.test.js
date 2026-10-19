// Sitio público (spec 2026-10-17-fechas-datasets, sección 11), ejecutado en Node: lo puro de dataset-detail.js (las tres
// fechas del detalle), datasets.js (la tarjeta, el filtro, ?mes= y el CSV), dashboard.js (la portada: el índice, el mosaico, los
// 12 meses y las listas), calendario.js (el almanaque, los filtros y el iCal) y gestion.js (la tasa y el ranking de Gestión). Las páginas usan el
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
    document: { addEventListener() {}, getElementById: () => null },
    // No es de ECMAScript (es del navegador y de Node): el vm no lo trae. datasets.js lo usa para leer y escribir la URL
    URLSearchParams
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

  it('los temas escapados, y nada si no hay', () => {
    assert.equal(detalle.htmlDeTemas(dataset({ tema_secundario_nombre: '<b>S</b>' })), '<span class="tema">Economía</span><span class="tema">&lt;b&gt;S&lt;/b&gt;</span>');
    assert.equal(detalle.htmlDeTemas(dataset({ tema_principal_nombre: null })), '');
  });

  it('la información técnica: frecuencia, formatos y tipo de gestión, con raya si falta', () => {
    assert.deepEqual(plano(detalle.filasTecnicas(dataset())), [
      { rotulo: 'Frecuencia', valor: 'Cada medio año' }, { rotulo: 'Formatos', valor: 'CSV, XLSX' }, { rotulo: 'Tipo de gestión', valor: 'Externa (otra área)' }
    ]);
    assert.equal(plano(detalle.filasTecnicas(dataset({ frecuencia_nombre: null, formatos: '' })))[1].valor, '-');
  });

  it('dataset.html: el área tiene su ícono y su texto aparte, y hay dónde avisar un error', () => {
    const html = leer('dataset.html');
    assert.match(html, /id="dataset-area-text"/);
    assert.match(html, /id="dataset-error"/);
    assert.doesNotMatch(leer('js/dataset-detail.js'), /getElementById\('dataset-area'\)\.textContent/);
  });

  it('dataset.html: los ids de siempre una sola vez, el aviso de error, "Ver todos los datasets" y el link al portal en otra pestaña', () => {
    const html = leer('dataset.html');
    for (const id of ['loading', 'dataset-content', 'not-found', 'breadcrumb-title', 'dataset-titulo', 'dataset-area', 'dataset-area-text',
      'dataset-estado', 'dataset-temas', 'dataset-descripcion', 'que-se-solicita-card', 'dataset-que-se-solicita', 'observaciones-card',
      'dataset-observaciones', 'url-card', 'dataset-url', 'dataset-fechas', 'info-frecuencia', 'info-formatos', 'info-tipo-gestion', 'dataset-error']) {
      assert.equal(html.match(new RegExp(`id="${id}"`, 'g'))?.length, 1, id);
    }
    assert.doesNotMatch(html, /<style|class="spinner"/);
    // El error, con su h1 (como "no encontrado") y el aviso debajo
    assert.match(html, /<div class="detalle-cabeza hidden" id="dataset-error" role="alert">\s*<h1>No se pudo cargar el conjunto de datos<\/h1>\s*<p class="aviso-error detalle-aviso">Probá de nuevo en unos minutos\.<\/p>\s*<\/div>/);
    assert.match(html, /<div class="detalle-cabeza hidden" id="not-found">\s*<h1>Conjunto de datos no encontrado<\/h1>/);
    // La última miga es la página actual
    assert.match(html, /<li><span id="breadcrumb-title" aria-current="page">Conjunto de datos<\/span><\/li>\s*<\/ol>/);
    assert.match(html, /<a [^>]*href="datasets\.html"[^>]*>Ver todos los datasets<\/a>/);
    const portal = html.match(/<a [^>]*id="dataset-url"[^>]*>/)?.[0] ?? '';
    assert.match(portal, /target="_blank"/);
    assert.match(portal, /rel="noopener"/);
    assert.match(html, /Ver en el Portal de Datos Abiertos/);
  });
});

// La carga del detalle (spec 2026-10-18-rediseno-publico, 8): con un DOM mínimo (cada id es un elemento que arranca oculto, salvo
// #loading, como en dataset.html), un API.pedirJson falso y el id de la URL
describe('dataset-detail.js: la carga del detalle', () => {
  const preparar = ({ id = '20', respuesta, error } = {}) => {
    const detalle = cargar('dataset-detail.js');
    const elementos = {};
    const pedidos = [];
    detalle.document.getElementById = (clave) => {
      if (!elementos[clave]) {
        const clases = new Set(clave === 'loading' ? [] : ['hidden']);
        elementos[clave] = {
          textContent: '', innerHTML: '', className: '', href: '',
          classList: {
            add: (c) => clases.add(c),
            remove: (c) => clases.delete(c),
            contains: (c) => clases.has(c),
            toggle: (c, poner = !clases.has(c)) => (poner ? clases.add(c) : clases.delete(c))
          }
        };
      }
      return elementos[clave];
    };
    detalle.console = { error() {} };
    detalle.Utils.getUrlParams = () => (id === null ? {} : { id });
    vm.runInContext('API', detalle).pedirJson = async (metodo, ruta) => {
      pedidos.push(`${metodo} ${ruta}`);
      if (error) throw error;
      return respuesta;
    };
    const el = (clave) => detalle.document.getElementById(clave);
    const visible = (clave) => !el(clave).classList.contains('hidden');
    return { detalle, el, visible, pedidos };
  };
  const conEstado = (status) => Object.assign(new Error(`Error ${status}`), { status });

  it('pide el dataset por su id y lo dibuja: el área va en su texto (el ícono queda), la insignia larga, los temas y lo técnico', async () => {
    const { detalle, el, visible, pedidos } = preparar({
      respuesta: { success: true, data: dataset({ estado: 'sin-respuesta', observaciones: 'Uno\nDos', url_dataset: ' https://datos.comodoro.gov.ar/dataset/gasto ' }) }
    });
    await detalle.loadDataset();
    assert.deepEqual(pedidos, ['GET /datasets/20']);
    assert.ok(!visible('loading') && visible('dataset-content') && !visible('not-found') && !visible('dataset-error'));
    assert.equal(el('dataset-area-text').textContent, 'Secretaría de Hacienda');
    assert.equal(el('dataset-area').textContent, '');
    assert.equal(el('dataset-titulo').textContent, 'Gasto Público');
    assert.equal(el('breadcrumb-title').textContent, 'Gasto Público');
    assert.equal(el('dataset-estado').textContent, 'Sin respuesta del área responsable');
    assert.equal(el('dataset-estado').className, 'badge badge-sin-respuesta');
    assert.equal(el('dataset-temas').innerHTML, '<span class="tema">Economía</span>');
    assert.equal(el('info-frecuencia').textContent, 'Cada medio año');
    assert.equal(el('info-formatos').textContent, 'CSV, XLSX');
    assert.equal(el('info-tipo-gestion').textContent, 'Externa (otra área)');
    assert.equal(el('dataset-observaciones').textContent, 'Uno\nDos');
    assert.ok(visible('observaciones-card') && !visible('que-se-solicita-card'));
    assert.ok(visible('url-card'));
    assert.equal(el('dataset-url').href, 'https://datos.comodoro.gov.ar/dataset/gasto');
    assert.match(el('dataset-fechas').innerHTML, /Cargado en el portal/);
  });

  it('una URL que no es http/https no aparece', async () => {
    const { detalle, el, visible } = preparar({ respuesta: { success: true, data: dataset({ url_dataset: 'javascript:alert(1)' }) } });
    await detalle.loadDataset();
    assert.ok(!visible('url-card'));
    assert.equal(el('dataset-url').href, '');
  });

  it('sin id, o con un 404, dice que no se encontró (no el error)', async () => {
    for (const caso of [{ id: null }, { id: '' }, { error: conEstado(404) }]) {
      const { detalle, visible, pedidos } = preparar(caso);
      await detalle.loadDataset();
      assert.ok(visible('not-found') && !visible('loading') && !visible('dataset-content') && !visible('dataset-error'), JSON.stringify(caso));
      if (!caso.error) assert.deepEqual(pedidos, []);
    }
  });

  it('?id=estadisticas: el id va codificado y, como la respuesta no es un dataset, no se encontró', async () => {
    const { detalle, visible, pedidos } = preparar({ id: 'estadisticas', respuesta: { success: true, data: { total: 80, actualizados: 52 } } });
    await detalle.loadDataset();
    assert.deepEqual(pedidos, ['GET /datasets/estadisticas']);
    assert.ok(visible('not-found') && !visible('dataset-content'));
    const otro = preparar({ id: '1/../usuarios', error: conEstado(404) });
    await otro.detalle.loadDataset();
    assert.deepEqual(otro.pedidos, ['GET /datasets/1%2F..%2Fusuarios']);
  });

  it('otro error (500, sin conexión): el aviso de error, no "no encontrado"', async () => {
    for (const error of [conEstado(500), new TypeError('Failed to fetch')]) {
      const { detalle, visible } = preparar({ error });
      await detalle.loadDataset();
      assert.ok(visible('dataset-error') && !visible('not-found') && !visible('loading') && !visible('dataset-content'), error.message);
    }
  });

  it('si el dibujo se rompe con un dato raro: el aviso de error, no "Cargando…" para siempre ni el conjunto a medias', async () => {
    const { detalle, el, visible } = preparar({ respuesta: { success: true, data: dataset() } });
    // Se rompe al final del dibujo, con el título, las migas y la banda ya puestos
    detalle.filasTecnicas = () => { throw new TypeError('dato raro'); };
    await detalle.loadDataset();
    assert.ok(visible('dataset-error'), 'el aviso de error');
    for (const id of ['loading', 'dataset-cabeza', 'url-card', 'dataset-content', 'not-found']) assert.ok(!visible(id), id);
    assert.equal(detalle.document.title, 'No se pudo cargar el conjunto de datos - RPAD');
    assert.equal(el('breadcrumb-title').textContent, 'Conjunto de datos');
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

  it('datasets.html tiene el aviso del filtro por mes y los botones de estado, sin el select viejo', () => {
    const html = leer('datasets.html');
    assert.match(html, /id="filtro-mes"/);
    assert.match(html, /id="estados"/);
    assert.doesNotMatch(html, /id="filter-estado"/);
    for (const id of ['search', 'filter-tema', 'filter-frecuencia', 'filter-orden']) assert.match(html, new RegExp(`<label for="${id}"`), id);
  });
});

describe('datasets.js: estados, orden, vista y URL', () => {
  const listado = cargar('datasets.js');
  const LISTA = [
    dataset({ id: 1, titulo: 'Beta', area_nombre: 'Zona', proxima_actualizacion: '2027-03-31T03:00:00.000Z' }),
    dataset({ id: 2, titulo: 'alfa', area_nombre: null, proxima_actualizacion: '2026-11-30T03:00:00.000Z', estado: 'proximo', dias_para_vencer: 43 }),
    dataset({ id: 3, titulo: 'Gamma', area_nombre: 'Archivo', proxima_actualizacion: '2025-01-31T03:00:00.000Z', estado: 'atrasado', dias_para_vencer: -625 }),
    eventual({ id: 4, titulo: 'Delta', proxima_actualizacion: '2026-01-31T03:00:00.000Z' }),
    dataset({ id: 5, titulo: 'Épsilon', proxima_actualizacion: null, estado: 'sin-fecha', dias_para_vencer: null })
  ];

  it('ordena por nombre, por próximo vencimiento (sin fecha al final) y por área (sin área al final)', () => {
    assert.deepEqual(plano(listado.ordenarDatasets(LISTA, 'nombre')).map(d => d.id), [2, 1, 4, 5, 3]);
    assert.deepEqual(plano(listado.ordenarDatasets(LISTA, 'proxima')).map(d => d.id), [3, 2, 1, 4, 5]);
    assert.deepEqual(plano(listado.ordenarDatasets(LISTA, 'area')).map(d => d.id), [3, 4, 5, 1, 2]);
  });

  it('cuenta por estado del servidor, con vencidos = atrasados + sin respuesta', () => {
    const c = plano(listado.cantidadesPorEstado(LISTA));
    assert.equal(c.todos, 5); assert.equal(c.actualizado, 1); assert.equal(c.proximo, 1);
    assert.equal(c.vencidos, 1); assert.equal(c.atrasado, 1); assert.equal(c['sin-respuesta'], 0);
    assert.equal(c.eventual, 1); assert.equal(c['sin-fecha'], 1);
  });

  it('los botones: Vencidos presionado con atrasado y la segunda fila; Sin fecha solo si hay o si está elegido', () => {
    const c = listado.cantidadesPorEstado(LISTA);
    const html = listado.htmlDeEstados(c, 'atrasado');
    assert.match(html, /data-estado="vencidos" aria-pressed="true"/);
    assert.match(html, /class="sub-estados"/);
    assert.match(html, /data-estado="atrasado" aria-pressed="true"/);
    assert.match(html, /data-estado="sin-fecha"/);
    const sinNinguno = listado.htmlDeEstados({ ...plano(c), 'sin-fecha': 0 }, '');
    assert.doesNotMatch(sinNinguno, /data-estado="sin-fecha"/);
    assert.match(listado.htmlDeEstados({ ...plano(c), 'sin-fecha': 0 }, 'sin-fecha'), /data-estado="sin-fecha" aria-pressed="true"/);
    assert.match(sinNinguno, /data-estado="" aria-pressed="true"/);
  });

  it('la fila de la lista escapa, lleva al detalle y usa la insignia de siempre', () => {
    const html = listado.htmlDeFila(dataset({ id: 7, titulo: '<i>x</i>', area_nombre: 'A & B' }));
    assert.ok(html.includes('href="dataset.html?id=7"'));
    assert.ok(html.includes('A &amp; B'));
    assert.doesNotMatch(html, /<i>x<\/i>/);
    assert.match(html, /<span class="badge badge-success">Actualizado<\/span>/);
    assert.ok(html.includes('ene 2027'));
  });

  it('lee y escribe la URL: los parámetros de siempre siguen igual y orden/vista solo si no son los por defecto', () => {
    const p = plano(listado.leerParametros('?estado=vencidos&mes=2027-01&tema=8&frecuencia=9&busqueda=pauta&orden=area&vista=lista'));
    assert.deepEqual(p, { temaId: '8', frecId: '9', estado: 'vencidos', busqueda: 'pauta', mes: '2027-01', orden: 'area', vista: 'lista' });
    assert.deepEqual(plano(listado.leerParametros('?orden=x&vista=y&mes=2027-13')), { temaId: '', frecId: '', estado: '', busqueda: '', mes: null, orden: 'nombre', vista: 'tarjetas' });
    assert.equal(listado.armarParametros({ temaId: '8', frecId: '', estado: 'vencidos', busqueda: '', mes: '2027-01', orden: 'nombre', vista: 'tarjetas' }), 'tema=8&estado=vencidos&mes=2027-01');
    assert.equal(listado.armarParametros({ temaId: '', frecId: '', estado: '', busqueda: '', mes: null, orden: 'proxima', vista: 'lista' }), 'orden=proxima&vista=lista');
  });

  // Los links que ya circulan (la portada, el tablero viejo, los guardados): cada ?estado= de hoy elige su botón
  it('los valores de ?estado= de siempre, Eventual y Sin fecha incluidos, y un estado que no existe no filtra', () => {
    for (const estado of ['actualizado', 'proximo', 'vencidos', 'atrasado', 'sin-respuesta', 'eventual', 'sin-fecha']) {
      assert.equal(plano(listado.leerParametros(`?estado=${estado}`)).estado, estado, estado);
    }
    assert.equal(plano(listado.leerParametros('?estado=otro')).estado, '');
    const html = listado.htmlDeEstados(listado.cantidadesPorEstado(LISTA), 'eventual');
    assert.match(html, /data-estado="eventual" aria-pressed="true"/);
    assert.doesNotMatch(html, /class="sub-estados"/);
    // Cada botón con su cantidad; los de los otros estados, sin presionar
    assert.match(html, /data-estado="actualizado" aria-pressed="false"><span class="tile c-actualizado" aria-hidden="true"><\/span>Actualizados <span class="estado-n">1<\/span><\/button>/);
    assert.match(html, /data-estado="" aria-pressed="false">Todos <span class="estado-n">5<\/span>/);
  });

  it('la búsqueda con espacios y acentos va y vuelve por la URL', () => {
    const texto = armar => listado.armarParametros({ ...plano(listado.leerParametros('')), busqueda: armar });
    assert.equal(plano(listado.leerParametros(`?${texto('parque automotor')}`)).busqueda, 'parque automotor');
    assert.equal(plano(listado.leerParametros(`?${texto('Educación & Salud')}`)).busqueda, 'Educación & Salud');
  });

  it('las cantidades cuentan lo que dejan los otros filtros (búsqueda, tema, frecuencia y mes), no el estado elegido', () => {
    const conTema = LISTA.map(d => ({ ...d, tema_principal_id: d.id <= 2 ? 8 : 3 }));
    const c = plano(listado.cantidadesConFiltros(conTema, { temaId: '8', estado: 'atrasado', busqueda: '' }));
    assert.equal(c.todos, 2); assert.equal(c.actualizado, 1); assert.equal(c.proximo, 1); assert.equal(c.vencidos, 0);
    const delMes = plano(listado.cantidadesConFiltros(LISTA, { mes: '2026-11', estado: 'actualizado' }));
    assert.equal(delMes.todos, 1); assert.equal(delMes.proximo, 1); assert.equal(delMes.actualizado, 0);
    assert.equal(plano(listado.cantidadesConFiltros(LISTA, { busqueda: 'gamma' })).atrasado, 1);
  });

  it('el orden no cambia la lista que recibe', () => {
    const copia = [...LISTA];
    listado.ordenarDatasets(copia, 'area');
    assert.deepEqual(copia.map(d => d.id), [1, 2, 3, 4, 5]);
  });

  it('la tarjeta nueva: el título es el link al detalle y en el pie van los formatos y las dos fechas, sin <b>', () => {
    const html = listado.htmlDeTarjeta(dataset({ id: 9 }));
    assert.match(html, /<article class="tarjeta">/);
    assert.match(html, /<h2 class="tarjeta-titulo"><a href="dataset\.html\?id=9">Gasto Público<\/a><\/h2>/);
    assert.match(html, /<span class="badge badge-success">Actualizado<\/span>/);
    assert.match(html, /<li class="formato">CSV<\/li><li class="formato">XLSX<\/li>/);
    assert.match(html, /<span class="tema">Economía<\/span>/);
    assert.doesNotMatch(html, /<b>|<i>|<img/);
  });

  it('la vista de lista: la tabla con sus seis columnas, Tema y Frecuencia marcadas para ocultarse en el celular', () => {
    const html = listado.htmlDeLista([dataset(), eventual()]);
    assert.deepEqual([...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map(m => m[1]), ['Conjunto de datos', 'Tema', 'Frecuencia', 'Datos', 'Próxima', 'Estado']);
    assert.match(html, /<th scope="col" class="t-col-tema">Tema<\/th><th scope="col" class="t-col-frec">Frecuencia<\/th>/);
    assert.equal(html.split('<tr>').length - 1, 3);
    // La próxima, sin el prefijo; el eventual dice Eventual
    const fila = listado.htmlDeFila(eventual({ area_nombre: null, tema_principal_nombre: null }));
    assert.match(fila, />Eventual<\/td>/);
    assert.ok(fila.includes('Sin área asignada'));
    assert.match(listado.htmlDeFila(dataset({ proxima_actualizacion: null, estado: 'sin-fecha' })), />sin fecha<\/td>/);
    assert.doesNotMatch(listado.htmlDeFila(dataset()), /Próxima: /);
  });

  it('la paginación dice "Página N de M" con tilde, con Anterior y Siguiente; con una sola página, nada', () => {
    const html = listado.htmlDePaginacion(80, 1, 24);
    assert.match(html, /Página 1 de 4/);
    assert.match(html, /Mostrando 1–24 de 80/);
    assert.match(html, /data-pagina="-1" disabled>/);
    assert.match(html, /data-pagina="1">Siguiente/);
    assert.match(listado.htmlDePaginacion(80, 4, 24), /Mostrando 73–80 de 80[^]*data-pagina="1" disabled>/);
    assert.equal(listado.htmlDePaginacion(50, 1, 50), '');
    assert.equal(listado.htmlDePaginacion(0, 1, 24), '');
    assert.doesNotMatch(listado.htmlDePaginacion(80, 2, 24), /Pag\.|disabled/);
    assert.deepEqual(plano(vm.runInContext('ITEMS_POR_PAGINA', listado)), { tarjetas: 24, lista: 50 });
  });

  it('la bajada y la cuenta de resultados, en singular y en plural', () => {
    assert.equal(listado.textoBajada(80), 'Los 80 conjuntos de datos que sigue el registro, con su estado y cuándo se actualizan.');
    assert.equal(listado.htmlDeCuenta(80), '<strong>80</strong> conjuntos');
    assert.equal(listado.htmlDeCuenta(1), '<strong>1</strong> conjunto');
    assert.equal(listado.htmlDeCuenta(0), '<strong>0</strong> conjuntos');
  });

  it('datasets.html: la banda, las herramientas, la vista, el resultado, el vacío y el error', () => {
    const html = leer('datasets.html');
    assert.match(html, /<title>Datasets - RPAD<\/title>/);
    assert.doesNotMatch(html, /<style/);
    assert.doesNotMatch(html, /onclick=|onchange=/);
    assert.match(html, /<main class="main-content main-publico">/);
    assert.match(html, /<h1>Datasets<\/h1>/);
    assert.match(html, /<div class="estados" id="estados" role="group" aria-label="Filtrar por estado">/);
    assert.match(html, /<option value="nombre">Nombre<\/option>\s*<option value="proxima">Próximo vencimiento<\/option>\s*<option value="area">Área<\/option>/);
    assert.equal((html.match(/<button type="button" data-vista="(tarjetas|lista)" aria-pressed="(true|false)">/g) || []).length, 2);
    assert.match(html, /id="vista" role="group"/);
    assert.match(html, /id="resultado-cuenta" aria-live="polite"/);
    assert.match(html, /id="filtro-mes-texto"/);
    assert.match(html, />Quitar<\/button>/);
    assert.match(html, />Exportar CSV<\/button>/);
    assert.match(html, />Limpiar filtros<\/button>/);
    for (const id of ['datasets-grid', 'datasets-paginacion', 'empty-state']) assert.match(html, new RegExp(`id="${id}"`), id);
    assert.match(html, /No hay conjuntos con esos filtros\./);
    assert.match(html, /id="datasets-error" role="alert">No se pudo cargar el listado\. Probá de nuevo en unos minutos\.</);
    assert.doesNotMatch(html, /class="spinner"/);
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

describe('publico.css', () => {
  const css = leer('css/publico.css');
  // Las reglas sin anidar ({ selector, cuerpo }): las de adentro de un @media también aparecen, con su selector
  const reglas = [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), cuerpo: m[2] }));
  const contraste = (a, b) => {
    const luz = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((suma, v, i) => suma + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [claro, oscuro] = [luz(a), luz(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (oscuro + 0.05);
  };

  it('el contenedor solo pone los costados: no pisa el relleno de arriba y de abajo de la banda', () => {
    const delContenedor = reglas.filter(r => r.selector === '.publico-contenedor');
    assert.ok(delContenedor.length >= 2, 'la regla base y la del celular');
    for (const { cuerpo } of delContenedor) {
      assert.doesNotMatch(cuerpo, /(^|[\s;])padding\s*:/, cuerpo);
      assert.match(cuerpo, /padding-inline:/);
    }
  });

  it('el borde de los campos llega a 3:1 contra el blanco y la bruma (WCAG 1.4.11)', () => {
    const borde = css.match(/--borde-control:\s*(#[0-9A-Fa-f]{6});/)?.[1];
    assert.ok(borde, '--borde-control definido');
    assert.ok(contraste(borde, '#FFFFFF') >= 3, `${borde} sobre blanco`);
    assert.ok(contraste(borde, '#F4F7FA') >= 3, `${borde} sobre la bruma`);
    const campos = reglas.find(r => r.selector.includes('.campo input') && /border:/.test(r.cuerpo));
    assert.match(campos.cuerpo, /border:\s*1px solid var\(--borde-control\)/);
  });

  it('el texto de ejemplo de los campos va en --suave, entero (Firefox lo dibuja al 54 % si no)', () => {
    const regla = reglas.find(r => r.selector === '.campo ::placeholder')?.cuerpo ?? '';
    assert.match(regla, /color:\s*var\(--suave\)/);
    assert.match(regla, /opacity:\s*1/);
  });

  it('los cuadritos del mosaico quedan a 24 px o más entre centros, también en el celular (WCAG 2.5.8)', () => {
    const sinComentarios = css.replace(/\/\*[^]*?\*\//g, '');
    const px = (cuerpo, propiedad) => Number(cuerpo.match(new RegExp(`(?:^|[\\s;])${propiedad}:\\s*(\\d+)px`))?.[1]);
    const base = { cuadro: reglas.find(r => r.selector === '.cuadro').cuerpo, cuadros: reglas.find(r => r.selector === '.cuadros').cuerpo };
    assert.ok(px(base.cuadro, 'width') + px(base.cuadros, 'gap') >= 24, 'en la pantalla ancha');
    const celular = sinComentarios.match(/@media \(max-width: 760px\)\s*\{[^@]*?\.cuadros\s*\{([^}]*)\}[^@]*?\.cuadro\s*\{([^}]*)\}/);
    assert.ok(celular, 'el bloque de 760 px pone el tamaño y la separación');
    assert.equal(px(celular[2], 'width') + px(celular[1], 'gap'), 24, 'en el celular');
  });

  it('la paginación se parte si no entra (a 305 px los controles se salían 11 px)', () => {
    assert.match(reglas.find(r => r.selector === '.paginado-controles')?.cuerpo ?? '', /flex-wrap:\s*wrap/);
  });

  it('alto contraste (forced colors): la ola no se dibuja (saldría como una franja del color del texto)', () => {
    assert.match(css.replace(/\/\*[^]*?\*\//g, ''), /@media \(forced-colors: active\)\s*\{\s*\.ola\s*\{\s*display:\s*none;?\s*\}\s*\}/);
  });

  it('el cuadrito de cada insignia es el del mosaico, del color de su estado y sin transparencia', () => {
    for (const [insignia, estado] of [['success', 'actualizado'], ['warning', 'proximo'], ['danger', 'atrasado'], ['sin-respuesta', 'sin-respuesta'], ['secondary', 'eventual']]) {
      const regla = reglas.find(r => r.selector === `.badge-${insignia}`);
      assert.match(regla.cuerpo, new RegExp(`--cuadrito-insignia:\\s*var\\(--cuadro-${estado}\\)`), insignia);
    }
    const cuadrito = reglas.find(r => r.selector === '.badge::before').cuerpo;
    assert.match(cuadrito, /background:\s*var\(--cuadrito-insignia/);
    assert.doesNotMatch(cuadrito, /opacity/);
  });

  it('detalle: dos columnas, una a 980 px con las fechas antes que los textos largos, que respetan los saltos de línea', () => {
    assert.ok(reglas.some(r => r.selector === '.detalle-grilla' && /grid-template-columns:\s*minmax\(0, 1fr\) 340px/.test(r.cuerpo)));
    assert.match(css.replace(/\/\*[^]*?\*\//g, ''), /@media \(max-width: 980px\)\s*\{[^@]*\.detalle-lateral\s*\{[^}]*order:\s*-1/);
    assert.ok(reglas.some(r => r.selector === '.detalle-texto' && /white-space:\s*pre-line/.test(r.cuerpo)));
  });

  it('calendario: el rótulo en 200 px y las fichas al lado, una debajo de la otra a 760 px; el texto de las filas de color llega a 4,5:1', () => {
    assert.ok(reglas.some(r => r.selector === '.almanaque-fila' && /grid-template-columns:\s*200px minmax\(0, 1fr\)/.test(r.cuerpo)));
    assert.match(css.replace(/\/\*[^]*?\*\//g, ''), /@media \(max-width: 760px\)\s*\{[^@]*\.almanaque-fila\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    const fondo = reglas.find(r => r.selector === '.almanaque-fila.vencidos')?.cuerpo.match(/background:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    assert.equal(fondo, '#FDF0EE');
    // --suave, --texto y --tinta sobre el rosado de Vencidos y sobre el --cielo del mes en curso
    for (const sobre of [fondo, '#DCEEF5']) {
      for (const texto of ['#56677F', '#22324A', '#1A365D']) assert.ok(contraste(texto, sobre) >= 4.5, `${texto} sobre ${sobre}`);
    }
    assert.ok(reglas.some(r => r.selector === '.ficha' && /border:\s*1px solid var\(--linea\)/.test(r.cuerpo) && /border-radius:\s*999px/.test(r.cuerpo)));
  });
});

describe('dashboard.js: el índice y el mosaico', () => {
  const tablero = cargar('dashboard.js');
  const STATS = { total: 80, actualizados: 52, proximos: 1, atrasados: 3, sinRespuesta: 10, eventuales: 14, sinFecha: 0, tasaActualizacion: 80 };

  // Primero el registro y los eventuales (la aclaración, que va arriba) y después el índice (la frase, en grande), con la tasa del
  // servidor y la misma base: el total sin los eventuales (spec 2026-10-19-indice-portada)
  it('la aclaración y la frase, con los números de producción del 19/10/2026', () => {
    const { tasa, frase, aclaracion } = plano(tablero.textoIndice({ ...STATS, total: 81, proximos: 2, tasaActualizacion: 81 }));
    assert.equal(tasa, '81%');
    assert.equal(aclaracion, 'El registro sigue 81 conjuntos de datos. De ellos, 14 tienen frecuencia de actualización eventual: se publican cuando hay novedades y no tienen vencimiento.');
    assert.equal(frase, 'Los otros 67 tienen fecha de vencimiento, y el 81% está al día: 54 de 67.');
  });

  it('la frase usa la tasa del servidor, no la recalcula', () => {
    assert.equal(plano(tablero.textoIndice(STATS)).frase, 'Los otros 66 tienen fecha de vencimiento, y el 80% está al día: 53 de 66.');
  });

  it('un solo eventual, en singular; sin eventuales, "Todos"', () => {
    const uno = plano(tablero.textoIndice({ ...STATS, total: 67, eventuales: 1 }));
    assert.equal(uno.aclaracion, 'El registro sigue 67 conjuntos de datos. De ellos, 1 tiene frecuencia de actualización eventual: se publica cuando hay novedades y no tiene vencimiento.');
    assert.equal(uno.frase, 'Los otros 66 tienen fecha de vencimiento, y el 80% está al día: 53 de 66.');
    const ninguno = plano(tablero.textoIndice({ ...STATS, total: 66, eventuales: 0 }));
    assert.equal(ninguno.aclaracion, 'El registro sigue 66 conjuntos de datos.');
    assert.equal(ninguno.frase, 'Todos tienen fecha de vencimiento, y el 80% está al día: 53 de 66.');
  });

  it('los sin fecha cuentan en la base sin tener fecha: la frase lo dice, y la aclaración ya no', () => {
    const dos = plano(tablero.textoIndice({ ...STATS, total: 82, sinFecha: 2 }));
    assert.equal(dos.frase, 'Los otros 68 deberían tener fecha de vencimiento (2 todavía no la tienen), y el 80% está al día: 53 de 68.');
    assert.doesNotMatch(dos.aclaracion, /todavía/);
    assert.equal(plano(tablero.textoIndice({ ...STATS, total: 81, sinFecha: 1 })).frase,
      'Los otros 67 deberían tener fecha de vencimiento (1 todavía no la tiene), y el 80% está al día: 53 de 67.');
    assert.equal(plano(tablero.textoIndice({ ...STATS, total: 66, eventuales: 0, sinFecha: 1 })).frase,
      'Todos deberían tener fecha de vencimiento (1 todavía no la tiene), y el 80% está al día: 53 de 66.');
  });

  it('con un solo conjunto con vencimiento, en singular; sin ninguno, no hay frase', () => {
    const base = { total: 15, actualizados: 1, proximos: 0, eventuales: 14, sinFecha: 0, tasaActualizacion: 100 };
    assert.equal(plano(tablero.textoIndice(base)).frase, 'El otro tiene fecha de vencimiento, y el 100% está al día: 1 de 1.');
    assert.equal(plano(tablero.textoIndice({ ...base, total: 1, eventuales: 0 })).aclaracion, 'El registro sigue 1 conjunto de datos.');
    assert.equal(plano(tablero.textoIndice({ ...base, total: 1, eventuales: 0 })).frase, 'Tiene fecha de vencimiento, y el 100% está al día: 1 de 1.');
    assert.equal(plano(tablero.textoIndice({ ...base, total: 1, eventuales: 0, actualizados: 0, sinFecha: 1, tasaActualizacion: 0 })).frase,
      'Debería tener fecha de vencimiento (1 todavía no la tiene), y el 0% está al día: 0 de 1.');
    assert.equal(plano(tablero.textoIndice({ ...base, total: 14, actualizados: 0, tasaActualizacion: 0 })).frase, '');
  });

  it('la situación dice el día de la semana sin depender de la zona del navegador', () => {
    assert.equal(tablero.textoSituacion('2026-10-18'), 'Situación al domingo 18 de octubre de 2026.');
    assert.equal(tablero.textoSituacion('2027-01-01'), 'Situación al viernes 1 de enero de 2027.');
  });

  // Al día (actualizados y próximos) y Vencidos (atrasados y sin respuesta), como en la frase; dentro de cada grupo, por
  // categoría (en el orden de la leyenda) y después por título
  const LISTA = [
    dataset({ id: 1, titulo: 'Zeta', estado: 'actualizado' }), dataset({ id: 2, titulo: 'Alfa', estado: 'actualizado' }),
    dataset({ id: 3, titulo: 'Abedul', estado: 'proximo' }), dataset({ id: 4, titulo: 'Zona atrasada', estado: 'atrasado' }),
    dataset({ id: 5, titulo: 'Alfa sin respuesta', estado: 'sin-respuesta' }),
    eventual({ id: 6 }), dataset({ id: 7, area_nombre: null, descripcion: null, datos_al: null })
  ];

  it('agrupa por estado del servidor: al día y vencidos juntos, sin fecha solo si hay', () => {
    const grupos = plano(tablero.gruposDelMosaico(LISTA));
    assert.deepEqual(grupos.map(g => [g.etiqueta, g.estados]),
      [['Al día', ['actualizado', 'proximo']], ['Vencidos', ['atrasado', 'sin-respuesta']], ['Eventuales', ['eventual']]]);
    assert.equal(grupos.reduce((s, g) => s + g.datasets.length, 0), LISTA.length);
    const conSinFecha = plano(tablero.gruposDelMosaico([...LISTA, dataset({ id: 8, estado: 'sin-fecha', proxima_actualizacion: null })]));
    assert.deepEqual(conSinFecha.at(-1).etiqueta, 'Sin fecha');
  });

  it('dentro de cada grupo, primero una categoría y después la otra, cada una por título', () => {
    const grupos = plano(tablero.gruposDelMosaico(LISTA));
    // Los actualizados (Alfa, Gasto Público, Zeta) y al final el próximo, aunque su título vaya primero
    assert.deepEqual(grupos[0].datasets.map(d => d.id), [2, 7, 1, 3]);
    // El atrasado y después el sin respuesta, aunque su título vaya primero
    assert.deepEqual(grupos[1].datasets.map(d => d.id), [4, 5]);
  });

  it('Al día y Vencidos llevan la leyenda de sus categorías con la cantidad de cada una', () => {
    const html = tablero.htmlDelMosaico(tablero.gruposDelMosaico(LISTA));
    assert.ok(html.includes('<div class="mosaico-cabeza"><h3>Al día</h3><span class="mosaico-cuenta">4</span></div>'), html);
    assert.ok(html.includes('<div class="leyenda-vencidos">'
      + '<span><span class="tile c-actualizado" aria-hidden="true"></span>Actualizados <strong>3</strong></span>'
      + '<span><span class="tile c-proximo" aria-hidden="true"></span>Próximos a vencer <strong>1</strong></span></div>'), html);
    assert.ok(html.includes('<div class="leyenda-vencidos">'
      + '<span><span class="tile c-atrasado" aria-hidden="true"></span>Atrasados (gestión interna) <strong>1</strong></span>'
      + '<span><span class="tile c-sin-respuesta" aria-hidden="true"></span>Sin respuesta del área (gestión externa) <strong>1</strong></span></div>'), html);
    // Eventuales y Sin fecha tienen una sola categoría: sin leyenda
    assert.equal(html.split('class="leyenda-vencidos"').length - 1, 2);
  });

  it('la leyenda sale aunque una categoría tenga 0', () => {
    const html = tablero.htmlDelMosaico(tablero.gruposDelMosaico([eventual()]));
    assert.ok(html.includes('Actualizados <strong>0</strong>'));
    assert.ok(html.includes('Próximos a vencer <strong>0</strong>'));
    assert.ok(html.includes('Atrasados (gestión interna) <strong>0</strong>'));
  });

  it('cada cuadrito es un link al detalle con su nombre y su estado, escapados', () => {
    const html = tablero.htmlDelMosaico(tablero.gruposDelMosaico([dataset({ id: 9, titulo: '<b>X</b> & Y', estado: 'sin-respuesta' })]));
    assert.match(html, /<a class="cuadro c-sin-respuesta" href="dataset\.html\?id=9" data-id="9" aria-label="&lt;b&gt;X&lt;\/b&gt; &amp; Y, Sin respuesta del área responsable"><\/a>/);
    assert.doesNotMatch(html, /<b>X<\/b>/);
  });

  it('el estado va escapado también en la clase del cuadrito (es el texto que manda el servidor)', () => {
    const html = tablero.htmlDelCuadro(dataset({ id: 9, estado: 'x" onmouseover="alert(1)' }));
    assert.ok(html.startsWith('<a class="cuadro c-x&quot; onmouseover=&quot;alert(1)" href="dataset.html?id=9"'), html);
    assert.doesNotMatch(html, /onmouseover="/);
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

// La carga de la portada, con un DOM mínimo (cada id es un elemento; el aviso de error arranca oculto, como en index.html) y un
// API.pedirJson falso
describe('dashboard.js: la carga', () => {
  const STATS = { total: 2, actualizados: 2, proximos: 0, atrasados: 0, sinRespuesta: 0, eventuales: 0, sinFecha: 0, tasaActualizacion: 100 };
  const preparar = (lista) => {
    const tablero = cargar('dashboard.js');
    const elementos = {};
    const crear = (clave) => {
      const clases = new Set(clave === 'portada-error' ? ['hidden'] : []);
      return {
        textContent: '', innerHTML: '',
        classList: {
          add: (c) => clases.add(c),
          remove: (c) => clases.delete(c),
          contains: (c) => clases.has(c),
          toggle: (c, poner = !clases.has(c)) => (poner ? clases.add(c) : clases.delete(c))
        }
      };
    };
    tablero.document.getElementById = (clave) => (elementos[clave] ??= crear(clave));
    tablero.document.querySelector = (selector) => (elementos[selector] ??= crear(selector));
    tablero.console = { error() {} };
    tablero.Utils.hoyEnArgentina = () => '2026-10-18';
    vm.runInContext('API', tablero).pedirJson = async (metodo, ruta) => ({ success: true, data: ruta === '/datasets/estadisticas' ? STATS : lista });
    const el = (clave) => tablero.document.getElementById(clave);
    const visible = (clave) => !el(clave).classList.contains('hidden');
    return { tablero, el, visible };
  };

  it('con los datos, dibuja el índice, el mosaico, los meses y las listas, sin el aviso', async () => {
    const { tablero, el, visible } = preparar([dataset({ id: 1 }), dataset({ id: 2, titulo: 'Otro' })]);
    await tablero.cargarPortada();
    assert.ok(!visible('portada-error'));
    for (const id of ['mosaico', 'seccion-meses', 'portada-listas']) assert.ok(visible(id), id);
    assert.match(el('indice-frase').innerHTML, /<strong class="indice-cifra">100%<\/strong>/);
    assert.equal(el('mosaico-grupos').innerHTML.split('class="cuadro ').length - 1, 2);
  });

  it('si el dibujo se rompe con un dato raro: el aviso de error y nada a medias, no "Cargando…" para siempre', async () => {
    const { tablero, el, visible } = preparar([dataset({ id: 1 }), null]);
    await tablero.cargarPortada();
    assert.ok(visible('portada-error'), 'el aviso de error');
    for (const id of ['mosaico', 'seccion-meses', 'portada-listas']) assert.ok(!visible(id), id);
    for (const id of ['indice-frase', 'indice-aclaracion', 'indice-situacion']) assert.equal(el(id).textContent, '', id);
    assert.ok(el('.portada-banda').classList.contains('portada-sin-datos'));
  });
});

// El pie del mosaico (aria-live): al pasar el mouse o el foco por un cuadrito dice cuál es, y al salir de los cuadritos (sin
// entrar en otro) vuelve el texto de index.html. Con el mouse, después de una pausa corta: al cruzar los 5 px entre dos cuadritos
// no parpadea. Con el teclado, enseguida. Un mosaico de mentira guarda los oyentes, y un reloj de mentira, la espera
describe('dashboard.js: el pie del mosaico vuelve al texto de index.html al salir de los cuadritos', () => {
  const INICIAL = 'Cada cuadrado es un conjunto de datos. Pasá el mouse por uno para ver cuál es; al tocarlo se abre su detalle.';
  const preparar = () => {
    const tablero = cargar('dashboard.js');
    const oyentes = {};
    const mosaico = { addEventListener: (tipo, fn) => { oyentes[tipo] = fn; }, contains: () => true };
    const pie = { innerHTML: INICIAL, dataset: {} };
    tablero.document.getElementById = (id) => ({ mosaico, 'mosaico-pie': pie })[id] ?? null;
    const reloj = { pendiente: null };
    tablero.setTimeout = (fn, ms) => { reloj.pendiente = { fn, ms }; return 1; };
    tablero.clearTimeout = () => { reloj.pendiente = null; };
    tablero.lista = [dataset({ id: 1, titulo: 'Gasto Público' }), dataset({ id: 2, titulo: 'Obra Pública', estado: 'sin-respuesta' })];
    vm.runInContext('datasetsDelMosaico = new Map(lista.map(d => [String(d.id), d]))', tablero);
    const cuadro = (id) => { const c = { dataset: { id: String(id) } }; c.closest = (sel) => (sel === '.cuadro' ? c : null); return c; };
    const otro = { closest: () => null };
    tablero.prepararPieDelMosaico();
    return {
      tablero, pie, reloj, otro, A: cuadro(1), B: cuadro(2),
      sobre: (el) => oyentes.mouseover({ target: el }),
      saleElMouse: (desde, hacia) => oyentes.mouseout({ target: desde, relatedTarget: hacia }),
      enfoca: (el) => oyentes.focusin({ target: el }),
      desenfoca: (desde, hacia) => oyentes.focusout({ target: desde, relatedTarget: hacia })
    };
  };

  it('el texto inicial es el de index.html', () => {
    assert.ok(leer('index.html').includes(`id="mosaico-pie" aria-live="polite">${INICIAL}</p>`));
  });

  it('con el mouse: dice cuál es, y al salir a una parte vacía vuelve el texto inicial después de una pausa corta', () => {
    const { pie, reloj, otro, A, sobre, saleElMouse } = preparar();
    sobre(A);
    assert.match(pie.innerHTML, /^<strong>Gasto Público<\/strong>/);
    saleElMouse(A, otro);
    assert.match(pie.innerHTML, /Gasto Público/, 'todavía no: espera la pausa');
    assert.ok(reloj.pendiente && reloj.pendiente.ms > 0 && reloj.pendiente.ms <= 500, `pausa corta: ${reloj.pendiente?.ms}`);
    reloj.pendiente.fn();
    assert.equal(pie.innerHTML, INICIAL);
    // Al volver a pasar por el mismo cuadrito, lo dice de nuevo
    sobre(A);
    assert.match(pie.innerHTML, /Gasto Público/);
  });

  it('del mouse fuera de la ventana (sin destino) también vuelve', () => {
    const { pie, reloj, A, sobre, saleElMouse } = preparar();
    sobre(A);
    saleElMouse(A, null);
    reloj.pendiente.fn();
    assert.equal(pie.innerHTML, INICIAL);
  });

  it('de un cuadrito a otro no parpadea: directo, o cruzando el espacio entre los dos', () => {
    const { pie, reloj, otro, A, B, sobre, saleElMouse } = preparar();
    sobre(A);
    saleElMouse(A, B);
    assert.equal(reloj.pendiente, null, 'directo a otro cuadrito: no hay espera');
    sobre(B);
    assert.match(pie.innerHTML, /Obra Pública/);
    saleElMouse(B, otro);
    sobre(otro);
    saleElMouse(otro, A);
    sobre(A);
    assert.equal(reloj.pendiente, null, 'al entrar en otro cuadrito se cancela la espera');
    assert.match(pie.innerHTML, /Gasto Público/);
  });

  it('con el teclado: entre cuadritos dice cada uno, y al salir de ellos vuelve enseguida', () => {
    const { pie, reloj, otro, A, B, enfoca, desenfoca } = preparar();
    enfoca(A);
    desenfoca(A, B);
    assert.match(pie.innerHTML, /Gasto Público/);
    enfoca(B);
    assert.match(pie.innerHTML, /Obra Pública/);
    desenfoca(B, otro);
    assert.equal(pie.innerHTML, INICIAL);
    assert.equal(reloj.pendiente, null);
  });

  it('si un cuadrito tiene el foco cuando sale el mouse, dice ese en lugar del texto inicial', () => {
    const { tablero, pie, reloj, otro, A, B, sobre, saleElMouse } = preparar();
    tablero.document.activeElement = B;
    sobre(A);
    saleElMouse(A, otro);
    reloj.pendiente.fn();
    assert.match(pie.innerHTML, /Obra Pública/);
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
    // Primero el registro y los eventuales (la aclaración) y después el índice (la frase, en grande)
    assert.ok(html.indexOf('id="indice-aclaracion"') < html.indexOf('id="indice-frase"'), 'la aclaración va antes que la frase');
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

describe('calendario.js: el almanaque', () => {
  const calendario = cargar('calendario.js');
  const LISTA = [
    dataset({ id: 1, titulo: 'Enero B', proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
    dataset({ id: 2, titulo: 'Enero A', proxima_actualizacion: '2027-01-31' }),
    dataset({ id: 3, titulo: 'Viejo', proxima_actualizacion: '2024-01-31T03:00:00.000Z', estado: 'sin-respuesta', dias_para_vencer: -990 }),
    dataset({ id: 4, titulo: 'Menos viejo', proxima_actualizacion: '2025-09-30T03:00:00.000Z', estado: 'atrasado', dias_para_vencer: -383 }),
    dataset({ id: 5, titulo: 'Lejano', proxima_actualizacion: '2027-11-30T03:00:00.000Z' }),
    dataset({ id: 6, titulo: 'Este mes', proxima_actualizacion: '2026-10-31T03:00:00.000Z', estado: 'proximo', dias_para_vencer: 13 }),
    eventual({ id: 7, proxima_actualizacion: '2027-01-31T03:00:00.000Z' }),
    dataset({ id: 8, proxima_actualizacion: null, estado: 'sin-fecha', dias_para_vencer: null })
  ];

  it('vencidos primero, los 12 meses desde el actual y después "más adelante"; sin eventuales ni sin fecha', () => {
    const filas = plano(calendario.filasDelAlmanaque(LISTA, '2026-10-18'));
    assert.deepEqual(filas.map(f => f.tipo), ['vencidos', ...Array(12).fill('mes'), 'despues']);
    assert.deepEqual(filas[0].datasets.map(d => d.id), [3, 4]);
    assert.equal(filas[1].clave, '2026-10'); assert.equal(filas[1].actual, true);
    assert.deepEqual(filas[1].datasets.map(d => d.id), [6]);
    assert.deepEqual(filas[4].datasets.map(d => d.id), [2, 1]);
    assert.deepEqual(filas.at(-1).datasets.map(d => d.id), [5]);
    assert.ok(!filas.some(f => f.datasets.some(d => d.id === 7 || d.id === 8)));
  });

  it('sin vencidos ni lejanos, solo los 12 meses', () => {
    assert.equal(calendario.filasDelAlmanaque([LISTA[0]], '2026-10-18').length, 12);
  });

  it('los meses son los mismos que los del gráfico de la portada', () => {
    const tablero = cargar('dashboard.js');
    assert.deepEqual(plano(calendario.mesesDelAlmanaque('2026-10-18')), plano(tablero.mesesDelGrafico('2026-10-18')));
  });

  it('filtra por área y por tema principal o secundario', () => {
    const lista = [dataset({ id: 1, area_id: 3, tema_principal_id: 5 }), dataset({ id: 2, area_id: 4, tema_secundario_id: 5 }), dataset({ id: 3, area_id: 3 })];
    assert.deepEqual(plano(calendario.filtrarCalendario(lista, { areaId: '3', temaId: '' })).map(d => d.id), [1, 3]);
    assert.deepEqual(plano(calendario.filtrarCalendario(lista, { areaId: '', temaId: '5' })).map(d => d.id), [1, 2]);
  });

  it('el HTML: el mes lleva al listado, cada ficha al detalle, escapado, y los meses vacíos lo dicen', () => {
    const html = calendario.htmlDelAlmanaque(calendario.filasDelAlmanaque([...LISTA, dataset({ id: 9, titulo: '<b>x</b>', area_nombre: 'A "B"', proxima_actualizacion: '2027-03-31T03:00:00.000Z' })], '2026-10-18'));
    assert.ok(html.includes('href="datasets.html?mes=2027-01"'));
    assert.ok(html.includes('href="dataset.html?id=9"'));
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
    assert.ok(html.includes('title="A &quot;B&quot;"'));
    assert.ok(html.includes('Nada vence este mes.'));
    assert.ok(html.includes('Este mes'));
    assert.equal(calendario.textoCantidad(1), '1 conjunto');
  });

  it('calendario.html ya no carga FullCalendar ni tiene el modal del día', () => {
    const html = leer('calendario.html');
    assert.doesNotMatch(html, /fullcalendar/i);
    assert.doesNotMatch(html, /modal-dia/);
    assert.match(html, /id="almanaque"/);
    assert.match(html, /exportarIcal\(\)/);
  });
});

describe('calendario.js: los rótulos y las fichas del almanaque', () => {
  const calendario = cargar('calendario.js');
  const filas = (lista, hoy = '2026-10-18') => calendario.filasDelAlmanaque(lista, hoy);

  it('el año va en el mes en curso y en cada enero; en los otros meses, solo para los lectores de pantalla', () => {
    const html = calendario.htmlDelAlmanaque(filas([dataset()]));
    assert.match(html, /href="datasets\.html\?mes=2026-10">octubre <span class="anio">2026<\/span><\/a>/);
    assert.match(html, /href="datasets\.html\?mes=2027-01">enero <span class="anio">2027<\/span><\/a>/);
    assert.match(html, /href="datasets\.html\?mes=2026-11">noviembre<span class="solo-lectores"> de 2026<\/span><\/a>/);
    assert.equal(html.match(/class="anio"/g).length, 2);
    assert.equal(html.match(/Este mes/g).length, 1);
    // Los 11 meses sin vencimientos, finitos y con el aviso
    assert.equal(html.match(/<p class="vacio">Nada vence este mes\.<\/p>/g).length, 11);
    assert.equal(html.match(/almanaque-fila[^"]*sin-nada/g).length, 11);
  });

  it('cada ficha: el cuadrito del estado del servidor, el título, el área en title y el estado para los lectores de pantalla', () => {
    const html = calendario.htmlDelAlmanaque(filas([dataset({ id: 20, estado: 'proximo', proxima_actualizacion: '2026-11-30T03:00:00.000Z' })]));
    assert.ok(html.includes('<li><a class="ficha" href="dataset.html?id=20" title="Secretaría de Hacienda">'
      + '<i class="tile c-proximo" aria-hidden="true"></i><span class="ficha-texto">Gasto Público'
      + '<span class="solo-lectores">, Próximo a vencer</span></span></a></li>'), html);
    assert.match(html, /<span class="almanaque-cuenta">1 conjunto<\/span>/);
  });

  it('los vencidos y los de más adelante llevan su mes; las dos filas dicen cuántos son', () => {
    const html = calendario.htmlDelAlmanaque(filas([
      dataset({ id: 3, estado: 'sin-respuesta', proxima_actualizacion: '2024-01-31T03:00:00.000Z', dias_para_vencer: -990 }),
      dataset({ id: 4, estado: 'atrasado', proxima_actualizacion: '2025-09-30T03:00:00.000Z', dias_para_vencer: -383 }),
      dataset({ id: 5, proxima_actualizacion: '2027-11-30T03:00:00.000Z' })
    ]));
    assert.match(html, /^<div class="almanaque-fila vencidos">/);
    assert.match(html, /<h2>Vencidos<\/h2><span class="almanaque-cuenta">2 conjuntos, con el mes en que vencieron<\/span>/);
    assert.match(html, /<i class="tile c-sin-respuesta" aria-hidden="true"><\/i><span class="ficha-texto">Gasto Público <small>ene 2024<\/small>/);
    assert.match(html, /<i class="tile c-atrasado" aria-hidden="true"><\/i><span class="ficha-texto">Gasto Público <small>sep 2025<\/small>/);
    assert.match(html, /<h2>Más adelante<\/h2><span class="almanaque-cuenta">1 conjunto, después de septiembre de 2027<\/span>/);
    assert.match(html, /Gasto Público <small>nov 2027<\/small>/);
    // En los meses, sin el mes: ya lo dice la fila
    assert.doesNotMatch(calendario.htmlDelAlmanaque(filas([dataset()])), /<small>/);
  });

  it('un vencido del mes en curso va en Vencidos, no en el mes; un id raro va codificado', () => {
    const lista = [dataset({ id: '1"><b>', estado: 'atrasado', proxima_actualizacion: '2026-10-15', dias_para_vencer: -3 })];
    const resultado = plano(filas(lista));
    assert.deepEqual(resultado[0].datasets.map(d => d.id), ['1"><b>']);
    assert.equal(resultado[1].datasets.length, 0);
    assert.ok(calendario.htmlDelAlmanaque(filas(lista)).includes('href="dataset.html?id=1%22%3E%3Cb%3E"'));
  });

  it('textoCantidad: singular y plural', () => {
    assert.equal(calendario.textoCantidad(1), '1 conjunto');
    assert.equal(calendario.textoCantidad(0), '0 conjuntos');
    assert.equal(calendario.textoCantidad(16), '16 conjuntos');
  });

  it('calendario.html: filtros con <label for>, la leyenda de los cuatro estados, el vacío, el error y sin la grilla vieja', () => {
    const html = leer('calendario.html');
    assert.match(html, /<label for="filter-area">Área<\/label>/);
    assert.match(html, /<label for="filter-tema">Tema<\/label>/);
    assert.match(html, /onclick="limpiarFiltros\(\)"/);
    for (const estado of ['actualizado', 'proximo', 'atrasado', 'sin-respuesta']) assert.match(html, new RegExp(`class="tile c-${estado}"`), estado);
    assert.match(html, /id="almanaque" aria-label="Vencimientos por mes"/);
    assert.match(html, /id="calendario-vacio"[^>]*>No hay conjuntos con fecha para esos filtros\.</);
    assert.match(html, /id="calendario-error"[^>]*>No se pudo cargar el calendario\. Probá de nuevo en unos minutos\.</);
    assert.match(html, /Exportar a mi calendario \(iCal\)/);
    assert.match(html, /<h1>Calendario de vencimientos<\/h1>/);
    assert.doesNotMatch(html, /id="calendar"|cdn\.jsdelivr|<style|style="/);
    assert.match(html, /<main class="main-content main-publico">/);
  });
});

describe('calendario.js: la carga, los filtros y el iCal', () => {
  // Un DOM mínimo: cada id es un elemento (los selectores con su valor y sus opciones; el vacío y el error arrancan ocultos, como
  // en calendario.html), API y Utils falsos, y lo que baja el iCal
  const preparar = ({ lista = [], error = null, areas = [], temas = [] } = {}) => {
    const calendario = cargar('calendario.js');
    const elementos = {};
    const pedidos = [];
    const bajadas = [];
    const crear = (clave) => {
      const clases = new Set(['calendario-vacio', 'calendario-error'].includes(clave) ? ['hidden'] : []);
      return {
        textContent: '', innerHTML: '', value: '', escuchas: {},
        addEventListener(tipo, funcion) { this.escuchas[tipo] = funcion; },
        insertAdjacentHTML(donde, html) { this.innerHTML += html; },
        click() {},
        classList: {
          add: (c) => clases.add(c),
          remove: (c) => clases.delete(c),
          contains: (c) => clases.has(c),
          toggle: (c, poner = !clases.has(c)) => (poner ? clases.add(c) : clases.delete(c))
        }
      };
    };
    calendario.document.getElementById = (clave) => (elementos[clave] ??= crear(clave));
    calendario.document.createElement = () => crear();
    calendario.document.body = { appendChild(a) { bajadas.push(a); }, removeChild() {} };
    calendario.console = { error() {} };
    calendario.Blob = class { constructor(partes, opciones) { this.texto = partes.join(''); this.type = opciones.type; } };
    calendario.URL = { createObjectURL: (blob) => { bajadas.blob = blob; return 'blob:x'; }, revokeObjectURL() {} };
    calendario.Utils.hoyEnArgentina = () => '2026-10-18';
    const api = vm.runInContext('API', calendario);
    api.pedirJson = async (metodo, ruta) => {
      pedidos.push(`${metodo} ${ruta}`);
      if (error) throw error;
      return { success: true, data: lista };
    };
    api.getAreas = async () => { pedidos.push('areas'); return areas; };
    api.getTemas = async () => { pedidos.push('temas'); return temas; };
    const el = (clave) => calendario.document.getElementById(clave);
    const visible = (clave) => !el(clave).classList.contains('hidden');
    return { calendario, el, visible, pedidos, bajadas };
  };
  const LISTA = [
    dataset({ id: 1, area_id: 3, tema_principal_id: 5, titulo: 'Uno', proxima_actualizacion: '2026-11-30T03:00:00.000Z' }),
    dataset({ id: 2, area_id: 4, tema_secundario_id: 5, titulo: 'Dos', proxima_actualizacion: '2027-01-31' }),
    dataset({ id: 3, area_id: 3, titulo: 'Tres', estado: 'atrasado', proxima_actualizacion: '2025-09-30T03:00:00.000Z' })
  ];

  it('pide los datasets con pedirJson y, en paralelo, las áreas y los temas; llena los filtros (escapados) y dibuja', async () => {
    const { calendario, el, visible, pedidos } = preparar({ lista: LISTA, areas: [{ id: 3, nombre: 'Hacienda & "Co"' }], temas: [{ id: 5, nombre: 'Economía' }] });
    await calendario.cargarCalendario();
    assert.deepEqual([...pedidos].sort(), ['GET /datasets', 'areas', 'temas']);
    assert.ok(el('filter-area').innerHTML.includes('<option value="3">Hacienda &amp; &quot;Co&quot;</option>'));
    assert.ok(el('filter-tema').innerHTML.includes('<option value="5">Economía</option>'));
    assert.match(el('almanaque').innerHTML, /<h2>Vencidos<\/h2>/);
    assert.ok(visible('almanaque') && !visible('calendario-vacio') && !visible('calendario-error'));
  });

  it('si falla el pedido de los datasets, el aviso de error y nada más', async () => {
    const { calendario, visible } = preparar({ error: Object.assign(new Error('Error 500'), { status: 500 }) });
    await calendario.cargarCalendario();
    assert.ok(visible('calendario-error'));
    for (const id of ['almanaque', 'calendario-vacio', 'calendario-controles', 'exportar-ical']) assert.ok(!visible(id), id);
  });

  it('con un tema entran también los del tema secundario; sin nada para esos filtros, el aviso del vacío; Limpiar vuelve a todo', async () => {
    const { calendario, el, visible } = preparar({ lista: LISTA });
    calendario.prepararFiltros();
    await calendario.cargarCalendario();
    el('filter-tema').value = '5';
    el('filter-tema').escuchas.change();
    assert.match(el('almanaque').innerHTML, /Uno/);
    assert.match(el('almanaque').innerHTML, /Dos/);
    assert.doesNotMatch(el('almanaque').innerHTML, /Tres/);
    el('filter-area').value = '4';
    el('filter-tema').value = '';
    el('filter-area').escuchas.change();
    assert.ok(visible('almanaque') && !visible('calendario-vacio'));
    el('filter-tema').value = '99';
    el('filter-tema').escuchas.change();
    assert.ok(!visible('almanaque') && visible('calendario-vacio'));
    calendario.limpiarFiltros();
    assert.equal(el('filter-area').value, '');
    assert.equal(el('filter-tema').value, '');
    assert.ok(visible('almanaque') && !visible('calendario-vacio'));
    assert.match(el('almanaque').innerHTML, /Tres/);
  });

  it('exportarIcal baja rpad-vencimientos-AAAA-MM-DD.ics con los filtrados (tema secundario incluido) y el formato de siempre', async () => {
    const { calendario, el, bajadas } = preparar({ lista: LISTA });
    await calendario.cargarCalendario();
    el('filter-tema').value = '5';
    calendario.exportarIcal();
    assert.equal(bajadas.length, 1);
    assert.equal(bajadas[0].download, 'rpad-vencimientos-2026-10-18.ics');
    assert.equal(bajadas.blob.type, 'text/calendar;charset=utf-8');
    const ical = bajadas.blob.texto;
    assert.match(ical, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:-\/\/RPAD\/\/Calendario de Vencimientos\/\/ES\r\n/);
    assert.equal(ical.match(/BEGIN:VEVENT/g).length, 2);
    assert.match(ical, /UID:dataset-1@rpad\.comodoro\.gov\.ar\r\n/);
    assert.match(ical, /DTSTART;VALUE=DATE:20270131\r\n/);
    assert.match(ical, /DESCRIPTION:Dataset: Dos\\nÁrea: Secretaría de Hacienda\\nFrecuencia: Cada medio año\\nURL: -\r\n/);
    assert.match(ical, /END:VCALENDAR$/);
    assert.doesNotMatch(ical, /dataset-3@/);
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
