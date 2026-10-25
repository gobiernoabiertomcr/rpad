// El Generador de Notas en la página (spec 2026-10-24-generador-de-notas, secciones 1 y 3), ejecutado en Node: lo puro de
// public/js/notas.js (los filtros y las filas de las áreas, las insignias, los datasets del área, la nota anterior, la hoja de la
// vista previa, los errores y el pedido), la descarga del Word y el arranque de la página con un DOM falso. Como seguimiento.js, el
// script al cargarse solo declara: se carga en un vm con un document que no hace nada, junto con el api.js de verdad (Utils).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { MENSAJES_GENERADOR, LARGO_NUMERO } from '../services/notasGeneradorReglas.js';
import { INFORMACION_SIN_PEDIDO } from '../services/notasGeneradorContenido.js';
import { TEXTO_TIPO_NOTA_DGMIT } from '../services/notasDgmitReglas.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');

const cargar = (globales = {}) => {
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: { addEventListener() {}, getElementById: () => null },
    URLSearchParams,
    Auth: { isAuthenticated: () => true, isAdmin: () => false, puedeCargarNotasDgmit: () => true },
    window: { location: { search: '' } },
    ...globales
  });
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer('js/notas.js'), contexto);
  return contexto;
};

// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a uno de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const ctx = cargar();
const constante = (nombre) => vm.runInContext(nombre, ctx);
const cuantas = (texto, patron) => (texto.match(patron) ?? []).length;

// Las áreas de la maqueta (datos reales del 24/10/2026), como las manda GET /api/notas/areas: un vencido de 997 días, uno de 85,
// un próximo de 37 (con dos al día en la misma área) y un área con todos al día
const AREAS = () => [
  {
    id: 21, nombre: 'Dirección General de Tránsito', ambito: 'municipal', area_superior: null, articulo: 'la', articulo_superior: null,
    datasets: [
      { id: 7, titulo: 'Infracciones de Tránsito', estado: 'actualizado', dias: 99, proxima: '2027-01-31' },
      { id: 8, titulo: 'Licencias de Conducir', estado: 'actualizado', dias: 160, proxima: '2027-03-31' }
    ]
  },
  {
    id: 37, nombre: 'Secretaría de la Mujer, Género y Diversidad', ambito: 'municipal', area_superior: null, articulo: 'la', articulo_superior: null,
    datasets: [
      { id: 58, titulo: 'Áreas específicas de género', estado: 'proximo', dias: 37, proxima: '2026-11-30' },
      { id: 57, titulo: 'Presupuesto con perspectiva de género', estado: 'actualizado', dias: 99, proxima: '2027-01-31' },
      { id: 56, titulo: 'Guía Telefónica de áreas específicas de género', estado: 'actualizado', dias: 219, proxima: '2027-05-31' }
    ]
  },
  {
    id: 19, nombre: 'Dirección General de Relaciones Laborales', ambito: 'municipal', area_superior: null, articulo: 'la', articulo_superior: null,
    datasets: [{ id: 52, titulo: 'Directores Generales de Planta Permanente', estado: 'sin-respuesta', dias: -85, proxima: '2026-07-31' }]
  },
  {
    id: 38, nombre: 'Dirección de Información Tributaria. Dirección General de Análisis y Administración Tributaria', ambito: 'externo',
    area_superior: null, articulo: 'la', articulo_superior: null,
    datasets: [{ id: 11, titulo: 'Parque Automotor (Patentamiento)', estado: 'sin-respuesta', dias: -997, proxima: '2024-01-31' }]
  }
];

// Los datasets de un área como los manda GET /api/notas/areas/:id (a la fecha de la nota)
const DATASET = (cambios = {}) => ({
  id: 46, titulo: 'Facturación de energía', estado: 'sin-respuesta', dias: -118, proxima: '2026-06-30', frecuencia: 'Trimestralmente',
  datos_solicitados: 'Del 01/01/2026 al 31/05/2026', que_se_solicita: 'Cantidad de usuarios por mes.', se_puede_pedir: true, notas_dgmit: [],
  ...cambios
});
const DATASETS_DE_LA_COOPERATIVA = () => [
  DATASET({ id: 46, notas_dgmit: [{ numero: '88/26', tipo: 'solicitud', recibida: '2026-06-20' }] }),
  DATASET({ id: 48, titulo: 'Consumo de agua', dias: -118, notas_dgmit: [{ numero: '88/26', tipo: 'solicitud', recibida: '2026-06-20' }] }),
  DATASET({
    id: 69, titulo: 'Reclamos', dias: -52,
    notas_dgmit: [{ numero: '102/26', tipo: 'solicitud', recibida: '2026-07-15' }, { numero: '131/26', tipo: 'reiteracion', recibida: '2026-09-10' }]
  }),
  DATASET({ id: 70, titulo: 'Tarifas', estado: 'proximo', dias: 20, proxima: '2026-11-30', datos_solicitados: 'Vigente al 31/10/2026' }),
  DATASET({ id: 71, titulo: 'Usuarios por categoría', estado: 'eventual', dias: null, proxima: null, frecuencia: 'Eventual', datos_solicitados: null }),
  DATASET({ id: 72, titulo: 'Cortes programados', estado: 'actualizado', dias: 150, proxima: '2027-03-31', se_puede_pedir: false, datos_solicitados: 'Vigente al 28/02/2027' })
];

describe('notas.js: las copias del servidor', () => {
  it('MENSAJES_GENERADOR y LARGO_NUMERO_NOTA son los de services/notasGeneradorReglas.js', () => {
    assert.deepEqual(plano(constante('MENSAJES_GENERADOR')), { ...MENSAJES_GENERADOR });
    assert.equal(constante('LARGO_NUMERO_NOTA'), LARGO_NUMERO);
    assert.equal(constante('LARGO_NUMERO_NOTA'), 40);
  });

  it('INFORMACION_SIN_PEDIDO es la de la tabla de la nota y TIPOS_NOTA_DGMIT, los de las notas DGMIT', () => {
    assert.equal(constante('INFORMACION_SIN_PEDIDO'), INFORMACION_SIN_PEDIDO);
    assert.deepEqual(plano(constante('TIPOS_NOTA_DGMIT')), { ...TEXTO_TIPO_NOTA_DGMIT });
  });

  it('MENSAJE_SIN_PERMISO es el 403 de usaGeneradorDeNotas (middleware/auth.js)', async () => {
    // El middleware corta el arranque sin JWT_SECRET; acá no se firma nada
    process.env.JWT_SECRET ??= 'secreto-de-prueba-del-generador';
    const { usaGeneradorDeNotas } = await import('../middleware/auth.js');
    let status = null;
    let cuerpo = null;
    let siguio = false;
    const res = { status(s) { status = s; return this; }, json(c) { cuerpo = c; return this; } };
    usaGeneradorDeNotas({ user: { rol: 'lector' } }, res, () => { siguio = true; });
    assert.equal(siguio, false);
    assert.equal(status, 403);
    assert.equal(cuerpo.error, constante('MENSAJE_SIN_PERMISO'));
    assert.equal(constante('MENSAJE_SIN_PERMISO'), 'No tenés permiso para usar el generador de notas.');
  });
});

describe('notas.js: el paso 1 (el área)', () => {
  it('textoParaBuscar: sin tildes ni mayúsculas, y el archivo escribe el rango de las tildes con \\u', () => {
    assert.equal(ctx.textoParaBuscar('  Género y DIVERSIDAD '), 'genero y diversidad');
    assert.equal(ctx.textoParaBuscar('Pingüino Ñandú'), 'pinguino nandu');
    assert.equal(ctx.textoParaBuscar(null), '');
    assert.equal(ctx.textoParaBuscar(0), '0');
    assert.doesNotMatch(leer('js/notas.js'), /[\u0300-\u036f]/, 'ningún carácter combinable suelto en el archivo');
  });

  it('esUrgente: vencido (días negativos) o próximo a vencer', () => {
    assert.equal(ctx.esUrgente({ estado: 'sin-respuesta', dias: -85 }), true);
    assert.equal(ctx.esUrgente({ estado: 'atrasado', dias: -1 }), true);
    assert.equal(ctx.esUrgente({ estado: 'proximo', dias: 0 }), true);
    assert.equal(ctx.esUrgente({ estado: 'proximo', dias: 60 }), true);
    for (const raro of [{ estado: 'actualizado', dias: 61 }, { estado: 'eventual', dias: null }, { estado: 'sin-fecha', dias: null }, null, {}]) {
      assert.equal(ctx.esUrgente(raro), false, JSON.stringify(raro));
    }
  });

  it('areasDelFiltro: "urgentes" son las que tienen alguno vencido o próximo, la más vencida primero', () => {
    const urgentes = ctx.areasDelFiltro(AREAS(), 'urgentes', '');
    assert.deepEqual(plano(urgentes.map((a) => a.id)), [38, 19, 37]);
  });

  it('areasDelFiltro: "todas", por nombre en castellano; la lista recibida no cambia', () => {
    const areas = AREAS();
    assert.deepEqual(plano(ctx.areasDelFiltro(areas, 'todas', '').map((a) => a.id)), [38, 19, 21, 37]);
    assert.deepEqual(areas.map((a) => a.id), [21, 37, 19, 38]);
  });

  it('areasDelFiltro: la búsqueda mira el nombre del área y los títulos de sus datasets, sin tildes ni mayúsculas', () => {
    const ids = (filtro, busqueda) => plano(ctx.areasDelFiltro(AREAS(), filtro, busqueda).map((a) => a.id));
    assert.deepEqual(ids('urgentes', 'genero'), [37]);
    assert.ok(ctx.areasDelFiltro(AREAS(), 'urgentes', 'genero')[0].datasets.some((d) => d.titulo === 'Áreas específicas de género'));
    assert.deepEqual(ids('todas', 'PATENTAMIENTO'), [38]);
    assert.deepEqual(ids('todas', '  relaciones laborales '), [19]);
    assert.deepEqual(ids('todas', 'transito'), [21]);
    assert.deepEqual(ids('urgentes', 'transito'), []);
    assert.deepEqual(ids('todas', 'no existe'), []);
  });

  it('areasDelFiltro: lo que no es una lista o un área no cuenta', () => {
    assert.deepEqual(plano(ctx.areasDelFiltro(null, 'todas', '')), []);
    assert.deepEqual(plano(ctx.areasDelFiltro([null, 'x', { id: 1, nombre: 'Sin datasets' }], 'urgentes', '')), []);
    assert.deepEqual(plano(ctx.areasDelFiltro([null, { id: 1, nombre: 'Sin datasets' }], 'todas', '').map((a) => a.id)), [1]);
  });

  it('cantidadesDeFiltros: las de los dos botones, sin la búsqueda', () => {
    assert.deepEqual(plano(ctx.cantidadesDeFiltros(AREAS())), { urgentes: 3, todas: 4 });
    assert.deepEqual(plano(ctx.cantidadesDeFiltros([])), { urgentes: 0, todas: 0 });
  });

  it('textoDeInsignia: los textos neutros de cada estado, con su clase', () => {
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'sin-respuesta', dias: -85 })), ['badge-atrasado', 'Vencido hace 85 días']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'atrasado', dias: -1 })), ['badge-atrasado', 'Vencido hace 1 día']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'proximo', dias: 0 })), ['badge-proximo', 'Vence hoy']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'proximo', dias: 1 })), ['badge-proximo', 'Vence en 1 día']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'proximo', dias: 37 })), ['badge-proximo', 'Vence en 37 días']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'actualizado', dias: 99 })), ['badge-actualizado', 'Al día']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'eventual', dias: null })), ['badge-eventual', 'Eventual']);
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'sin-fecha', dias: null })), ['badge-secondary', 'Sin fecha']);
    // Un estado que no conoce nunca se hace pasar por uno al día
    assert.deepEqual(plano(ctx.textoDeInsignia({ estado: 'raro', dias: 120 })), ['badge-secondary', 'Sin fecha']);
    assert.deepEqual(plano(ctx.textoDeInsignia(null)), ['badge-secondary', 'Sin fecha']);
  });

  it('htmlDeFilaDeArea: un botón con el nombre, el ámbito, los títulos de los urgentes y sus insignias', () => {
    const [mujer] = AREAS().filter((a) => a.id === 37);
    const html = ctx.htmlDeFilaDeArea(mujer, false);
    assert.match(html, /^<button type="button" class="area-opcion" data-area="37">/);
    assert.ok(html.includes('<div class="area-nombre">Secretaría de la Mujer, Género y Diversidad<span class="ambito municipal">Municipal</span></div>'));
    assert.ok(html.includes('<div class="area-ds">Áreas específicas de género</div>'), 'solo los títulos de los vencidos o próximos');
    assert.ok(html.includes('<div class="area-estado"><span class="badge badge-proximo">Vence en 37 días</span></div>'));
    assert.ok(html.includes('<span class="ir" aria-hidden="true">›</span>'));
    assert.match(html, /<\/button>$/);
    assert.match(ctx.htmlDeFilaDeArea(mujer, true), /^<button type="button" class="area-opcion elegida" data-area="37">/);
  });

  it('htmlDeFilaDeArea: fuera del municipio; con todos al día, los títulos de todos y "Los N al día"', () => {
    const areas = AREAS();
    const tributaria = ctx.htmlDeFilaDeArea(areas.find((a) => a.id === 38), false);
    assert.ok(tributaria.includes('<span class="ambito externo">Fuera del municipio</span>'));
    assert.ok(tributaria.includes('<span class="badge badge-atrasado">Vencido hace 997 días</span>'));
    const transito = ctx.htmlDeFilaDeArea(areas.find((a) => a.id === 21), false);
    assert.ok(transito.includes('<div class="area-ds">Infracciones de Tránsito, Licencias de Conducir</div>'));
    assert.ok(transito.includes('<div class="area-estado"><span class="badge badge-actualizado">Los 2 al día</span></div>'));
    const uno = ctx.htmlDeFilaDeArea({ ...areas.find((a) => a.id === 21), datasets: [areas.find((a) => a.id === 21).datasets[0]] }, false);
    assert.ok(uno.includes('<div class="area-estado"><span class="badge badge-actualizado">Al día</span></div>'));
  });

  it('htmlDeFilaDeArea: un eventual o uno sin fecha nunca se cuentan como al día', () => {
    const area = {
      id: 5, nombre: 'Área con eventuales', ambito: 'municipal', datasets: [
        { id: 1, titulo: 'Uno al día', estado: 'actualizado', dias: 99 },
        { id: 2, titulo: 'Uno eventual', estado: 'eventual', dias: null },
        { id: 3, titulo: 'Uno sin fecha', estado: 'sin-fecha', dias: null }
      ]
    };
    const html = ctx.htmlDeFilaDeArea(area, false);
    assert.ok(html.includes('<span class="badge badge-eventual">Eventual</span>'));
    assert.ok(html.includes('<span class="badge badge-secondary">Sin fecha</span>'));
    assert.ok(html.includes('<span class="badge badge-actualizado">Al día</span>'));
    assert.ok(!html.includes('Los 3 al día'));
  });

  it('htmlDeFilaDeArea escapa el nombre, los títulos y el id', () => {
    const html = ctx.htmlDeFilaDeArea({
      id: '1"><script>', nombre: '<img src=x onerror=alert(1)>', ambito: 'externo"><b>',
      datasets: [{ id: 1, titulo: 'A & <b>B</b>', estado: 'proximo', dias: 3 }]
    }, false);
    assert.ok(!html.includes('<img') && !html.includes('<script>') && !html.includes('<b>B'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.includes('A &amp; &lt;b&gt;B&lt;/b&gt;'));
    assert.ok(html.includes('data-area="1&quot;&gt;&lt;script&gt;"'));
    assert.ok(html.includes('<span class="ambito municipal">Municipal</span>'), 'un ámbito que no conoce es el de la base por defecto');
  });

  it('htmlDeListaDeAreas: las filas del filtro, con la elegida marcada', () => {
    const html = ctx.htmlDeListaDeAreas(AREAS(), 'urgentes', '', 19);
    assert.equal(cuantas(html, /<button type="button" class="area-opcion/g), 3);
    assert.equal(cuantas(html, /class="area-opcion elegida"/g), 1);
    assert.ok(html.includes('class="area-opcion elegida" data-area="19"'));
    assert.ok(html.indexOf('data-area="38"') < html.indexOf('data-area="19"') && html.indexOf('data-area="19"') < html.indexOf('data-area="37"'));
  });

  it('htmlDeListaDeAreas: sin urgentes y sin coincidencias, los textos vacíos de la spec', () => {
    const alDia = AREAS().filter((a) => a.id === 21);
    assert.equal(ctx.htmlDeListaDeAreas(alDia, 'urgentes', '', null),
      '<div class="vacio">Hoy ninguna área tiene datasets vencidos o próximos a vencer.</div>');
    assert.equal(ctx.htmlDeListaDeAreas(alDia, 'urgentes', 'transito', null),
      '<div class="vacio">Hoy ninguna área tiene datasets vencidos o próximos a vencer.</div>');
    assert.equal(ctx.htmlDeListaDeAreas(AREAS(), 'urgentes', 'no existe', null), '<div class="vacio">Ninguna área coincide con la búsqueda.</div>');
    assert.equal(ctx.htmlDeListaDeAreas(AREAS(), 'todas', 'no existe', null), '<div class="vacio">Ninguna área coincide con la búsqueda.</div>');
  });
});

describe('notas.js: el paso 2 (los datasets y la nota)', () => {
  it('elegidosIniciales: los vencidos y los próximos que se pueden pedir', () => {
    assert.deepEqual(plano(ctx.elegidosIniciales(DATASETS_DE_LA_COOPERATIVA())), [46, 48, 69, 70]);
    assert.deepEqual(plano(ctx.elegidosIniciales([DATASET({ id: 9, se_puede_pedir: false })])), []);
    assert.deepEqual(plano(ctx.elegidosIniciales(null)), []);
  });

  it('htmlDeDataset: uno que se puede pedir, con su casilla, la insignia, la frecuencia y los datos solicitados', () => {
    const html = ctx.htmlDeDataset(DATASET(), true);
    assert.match(html, /^<label class="ds">/);
    assert.ok(html.includes('<input type="checkbox" name="dataset" value="46" checked>'));
    assert.ok(html.includes('<span class="ds-titulo">Facturación de energía</span><span class="badge badge-atrasado">Vencido hace 118 días</span>'));
    assert.ok(html.includes('<div class="ds-datos">Trimestralmente · Datos solicitados: <b>Del 01/01/2026 al 31/05/2026</b></div>'));
    assert.ok(!html.includes('ds-dgmit'), 'sin notas DGMIT, sin la línea violeta');
    assert.ok(!ctx.htmlDeDataset(DATASET(), false).includes('checked'));
  });

  it('htmlDeDataset: un eventual (sin pedido) pide la información actualizada disponible', () => {
    const eventual = DATASETS_DE_LA_COOPERATIVA().find((d) => d.id === 71);
    assert.ok(ctx.htmlDeDataset(eventual, false).includes('Eventual · Datos solicitados: <b>Información actualizada disponible</b>'));
  });

  it('htmlDeDataset: uno al día, en gris, con la casilla deshabilitada y el texto de la spec', () => {
    const alDia = DATASETS_DE_LA_COOPERATIVA().find((d) => d.id === 72);
    const html = ctx.htmlDeDataset(alDia, true);
    assert.match(html, /^<div class="ds ds-off">/);
    assert.ok(html.includes('<input type="checkbox" disabled aria-label="Cortes programados: al día, no se puede pedir">'));
    assert.ok(!html.includes('checked'));
    assert.ok(html.includes('<div class="ds-datos">Trimestralmente · Vence el 31/03/2027. Al día: todavía no hay datos para pedir.</div>'));
    assert.ok(html.includes('<span class="badge badge-actualizado">Al día</span>'));
  });

  it('htmlDeDataset: las notas DGMIT del ciclo, en violeta y por fecha de recepción', () => {
    const reclamos = DATASETS_DE_LA_COOPERATIVA().find((d) => d.id === 69);
    assert.ok(ctx.htmlDeDataset(reclamos, true).includes(
      '<div class="ds-dgmit">Notas DGMIT del ciclo: N° 102/26 (solicitud, recibida el 15/07/2026) · N° 131/26 (reiteración, recibida el 10/09/2026)</div>'));
  });

  it('htmlDeDataset escapa el título, la frecuencia, los datos solicitados y los números de las notas', () => {
    const html = ctx.htmlDeDataset(DATASET({
      id: '1"><script>', titulo: 'Con <b>negrita</b>', frecuencia: '<i>x</i>', datos_solicitados: '"y" & <z>',
      notas_dgmit: [{ numero: '<u>1</u>', tipo: 'solicitud', recibida: '2026-01-02' }]
    }), true);
    assert.ok(html.includes('Con &lt;b&gt;negrita&lt;/b&gt;'));
    assert.ok(!html.includes('<b>negrita') && !html.includes('<i>x') && !html.includes('<u>1') && !html.includes('<script>'));
    assert.ok(html.includes('&lt;i&gt;x&lt;/i&gt; · Datos solicitados: <b>&quot;y&quot; &amp; &lt;z&gt;</b>'));
    assert.ok(html.includes('N° &lt;u&gt;1&lt;/u&gt; (solicitud, recibida el 02/01/2026)'));
    assert.ok(html.includes('value="1&quot;&gt;&lt;script&gt;"'));
    const alDia = ctx.htmlDeDataset(DATASET({ titulo: 'Con <b>negrita</b>', se_puede_pedir: false }), false);
    assert.ok(alDia.includes('aria-label="Con &lt;b&gt;negrita&lt;/b&gt;: al día, no se puede pedir"'));
  });

  it('htmlDeListaDeDatasets: las filas, tildadas las elegidas (como número o como texto)', () => {
    const html = ctx.htmlDeListaDeDatasets(DATASETS_DE_LA_COOPERATIVA(), new Set([46, '70']));
    assert.equal(cuantas(html, /<label class="ds">/g), 5);
    assert.equal(cuantas(html, /<div class="ds ds-off">/g), 1);
    assert.equal(cuantas(html, / checked>/g), 2);
    assert.ok(html.includes('value="46" checked>') && html.includes('value="70" checked>'));
    assert.ok(!html.includes('ds-aviso'), 'con alguno para pedir, sin el aviso');
    assert.ok(ctx.htmlDeListaDeDatasets(DATASETS_DE_LA_COOPERATIVA(), [48]).includes('value="48" checked>'));
  });

  it('htmlDeListaDeDatasets: con todos al día, la lista en gris y el aviso de la spec', () => {
    const alDia = [DATASET({ id: 1, se_puede_pedir: false, estado: 'actualizado' }), DATASET({ id: 2, se_puede_pedir: false, estado: 'actualizado' })];
    const html = ctx.htmlDeListaDeDatasets(alDia, new Set());
    assert.ok(html.includes('<p class="ds-aviso">Hoy no hay datos para pedirle a esta área: sus datasets están al día.</p>'));
    assert.equal(cuantas(html, /<div class="ds ds-off">/g), 2);
    assert.ok(!html.includes('<label'));
    const vacia = ctx.htmlDeListaDeDatasets([], new Set());
    assert.equal(vacia, '<p class="ds-aviso">Hoy no hay datos para pedirle a esta área.</p>', 'sin datasets no dice que están al día');
  });

  it('textoDelTipo: la pista del tipo de nota (spec 3.2)', () => {
    assert.equal(ctx.textoDelTipo('municipal', 'interna'), 'Viene elegida porque el área figura como municipal en Áreas.');
    assert.equal(ctx.textoDelTipo('externo', 'externa'), 'Viene elegida porque el área figura como fuera del municipio en Áreas.');
    assert.equal(ctx.textoDelTipo('externo', 'interna'), 'Cambiada a mano: el área figura como fuera del municipio, que lleva nota externa.');
    assert.equal(ctx.textoDelTipo('municipal', 'externa'), 'Cambiada a mano: el área figura como municipal, que lleva nota interna.');
  });

  it('tipoSugerido: interna para un área municipal, externa para una de fuera del municipio', () => {
    assert.equal(ctx.tipoSugerido('municipal'), 'interna');
    assert.equal(ctx.tipoSugerido('externo'), 'externa');
    assert.equal(ctx.tipoSugerido(undefined), 'interna');
  });

  it('numerosTraidos: la primera nota de cada elegido, sin repetidos y por fecha de recepción', () => {
    const datasets = DATASETS_DE_LA_COOPERATIVA();
    assert.deepEqual(plano(ctx.numerosTraidos(datasets, new Set([69, 46, 48]))), ['88/26', '102/26']);
    assert.deepEqual(plano(ctx.numerosTraidos(datasets, ['69'])), ['102/26'], 'solo la original: la reiteración 131/26 no');
    assert.deepEqual(plano(ctx.numerosTraidos(datasets, new Set())), []);
    assert.deepEqual(plano(ctx.numerosTraidos(datasets, new Set([70, 71]))), [], 'elegidos sin notas DGMIT');
    assert.deepEqual(plano(ctx.numerosTraidos(null, [46])), []);
  });

  it('htmlDeNotaAnterior: los números como etiquetas, el campo para agregar y "Traída…" si vienen de las cargadas', () => {
    const html = ctx.htmlDeNotaAnterior({ numeros: ['88/26', '102/26'], editada: false, traidos: ['88/26', '102/26'] });
    assert.match(html, /^<div class="subpanel">/);
    assert.ok(html.includes('<div class="subpanel-titulo">Nota anterior <span class="text-muted">(opcional)</span></div>'));
    assert.ok(html.includes('<span class="chip-nota">N° 88/26<button type="button" data-quitar-nota="0" aria-label="Quitar la nota N° 88/26">×</button></span>'));
    assert.ok(html.includes('data-quitar-nota="1" aria-label="Quitar la nota N° 102/26"'));
    assert.ok(html.includes('<input class="form-input" id="nt-anterior-nuevo" type="text" maxlength="40" placeholder="Ej.: 124/25" aria-label="Número de otra nota anterior">'));
    assert.ok(html.includes('<button type="button" class="btn btn-outline btn-sm" data-agregar-nota>Agregar</button>'));
    assert.match(html, /<div class="origen"><svg aria-hidden="true"[^>]*>[\s\S]*<\/svg>Traída de las notas DGMIT cargadas en el Seguimiento\.<\/div>/);
    assert.ok(!html.includes('Editada a mano') && !html.includes('No hay notas DGMIT'));
  });

  it('htmlDeNotaAnterior: editada a mano, con el botón para volver a traer las cargadas', () => {
    const html = ctx.htmlDeNotaAnterior({ numeros: ['88/26', '5/25'], editada: true, traidos: ['88/26'] });
    assert.ok(html.includes('<div class="origen">Editada a mano. <button type="button" class="link" data-reponer-notas>Volver a traer las cargadas</button></div>'));
    assert.ok(!html.includes('Traída de las notas'));
    assert.ok(html.includes('N° 5/25'));
  });

  it('htmlDeNotaAnterior: sin notas DGMIT cargadas para los elegidos', () => {
    const html = ctx.htmlDeNotaAnterior({ numeros: [], editada: false, traidos: [] });
    assert.ok(html.includes('<div class="origen gris">No hay notas DGMIT cargadas para estos datasets: escribila si la sabés.</div>'));
    assert.ok(!html.includes('chip-nota'));
  });

  it('htmlDeNotaAnterior escapa los números', () => {
    const html = ctx.htmlDeNotaAnterior({ numeros: ['<b>1</b>"'], editada: true, traidos: [] });
    assert.ok(html.includes('N° &lt;b&gt;1&lt;/b&gt;&quot;<button'));
    assert.ok(html.includes('aria-label="Quitar la nota N° &lt;b&gt;1&lt;/b&gt;&quot;"'));
    assert.ok(!html.includes('<b>1'));
  });
});

describe('notas.js: la hoja de la vista previa', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  it('el membrete, la marca de agua, el cuerpo tal cual (lo arma el servidor) y el pie', () => {
    const html = ctx.htmlDeHoja('<p>Hola <b>mundo</b></p>', { imagen: PNG, pie: 'www.comodoro.gov.ar   –  Moreno 815' });
    assert.match(html, /^<div class="hoja" role="document" aria-label="Vista previa de la nota">/);
    assert.ok(html.includes(`<img class="enc" src="${PNG}" alt="">`));
    assert.ok(html.includes('<div class="agua"><img src="img/membrete-isotipo-aclarado.png" alt=""></div>'));
    assert.ok(html.includes('<div class="texto"><p>Hola <b>mundo</b></p></div>'));
    assert.ok(html.includes('<div class="pie">www.comodoro.gov.ar – Moreno 815</div>'));
    assert.ok(html.indexOf('class="enc"') < html.indexOf('class="agua"') && html.indexOf('class="agua"') < html.indexOf('class="texto"'));
  });

  it('sin membrete (como el Word) y sin pie: solo la marca de agua y el cuerpo; una imagen que no es un PNG o un JPEG no va', () => {
    const sin = ctx.htmlDeHoja('<p>x</p>', { imagen: null, pie: '' });
    assert.ok(!sin.includes('class="enc"') && !sin.includes('class="pie"'));
    assert.ok(sin.includes('class="agua"'));
    assert.ok(!ctx.htmlDeHoja('<p>x</p>', { imagen: 'javascript:alert(1)', pie: '' }).includes('class="enc"'));
    assert.ok(!ctx.htmlDeHoja('<p>x</p>', { imagen: 'data:image/svg+xml;base64,PHN2Zz4=', pie: '' }).includes('class="enc"'));
    assert.ok(!ctx.htmlDeHoja('<p>x</p>', { imagen: 'data:image/png;base64,AA"onerror="x', pie: '' }).includes('class="enc"'));
    assert.ok(ctx.htmlDeHoja('<p>x</p>', { imagen: 'data:image/jpeg;base64,/9j/4AAQ', pie: '' }).includes('<img class="enc" src="data:image/jpeg;base64,/9j/4AAQ" alt="">'));
    assert.ok(ctx.htmlDeHoja('<p>x</p>').includes('<div class="texto"><p>x</p></div>'));
  });

  it('el pie se escapa', () => {
    const html = ctx.htmlDeHoja('', { imagen: null, pie: '<script>alert(1)</script>' });
    assert.ok(html.includes('<div class="pie">&lt;script&gt;alert(1)&lt;/script&gt;</div>'));
  });
});

describe('notas.js: el pedido', () => {
  it('erroresDelPaso2: sin ningún dataset elegido, el mensaje del servidor', () => {
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: [] })), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: new Set() })), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({})), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2()), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: new Set([46]), numero: '', anteriores: [] })), {});
  });

  it('erroresDelPaso2: el número y las notas anteriores, hasta 40 caracteres sin los espacios de los extremos (contados con Array.from)', () => {
    const cuarenta = 'x'.repeat(40);
    const emojis = '😀'.repeat(40);
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: [1], numero: `  ${cuarenta}  `, anteriores: [emojis] })), {});
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: [1], numero: `${cuarenta}y`, anteriores: [] })),
      { numero: 'El número de la nota puede tener hasta 40 caracteres.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: [1], numero: null, anteriores: ['1/26', `${emojis}😀`] })),
      { anteriores: 'Cada número de nota anterior puede tener hasta 40 caracteres.' });
    // En el orden de los campos del servidor: número, notas anteriores, datasets
    assert.deepEqual(Object.keys(ctx.erroresDelPaso2({ elegidos: [], numero: `${cuarenta}y`, anteriores: [`${cuarenta}y`] })),
      ['numero', 'anteriores', 'datasets']);
    // Lo que el servidor rechaza aunque no sea largo: un número que no es texto, una lista que no es lista
    assert.deepEqual(Object.keys(ctx.erroresDelPaso2({ elegidos: [1], numero: 125, anteriores: 'x' })), ['numero', 'anteriores']);
  });

  it('idsElegidos: los elegidos que se pueden pedir, como número y en el orden de la lista', () => {
    assert.deepEqual(plano(ctx.idsElegidos(DATASETS_DE_LA_COOPERATIVA(), new Set(['70', 46, 72, 999]))), [46, 70]);
    assert.deepEqual(plano(ctx.idsElegidos(null, [46])), []);
  });

  it('cuerpoDelPedido: lo que va a la vista previa y al Word', () => {
    const area = { id: 41, nombre: 'Cooperativa', ambito: 'externo', datasets: DATASETS_DE_LA_COOPERATIVA() };
    const estado = {
      fecha: '2026-10-24', numero: '  156/26 ', tipo: 'externa', pedido: 'reiteracion', anteriores: ['88/26', '102/26'], areaId: 41, area,
      elegidos: new Set([69, 46, 72])
    };
    assert.deepEqual(plano(ctx.cuerpoDelPedido(estado)), {
      fecha: '2026-10-24', numero: '156/26', tipo: 'externa', pedido: 'reiteracion', anteriores: ['88/26', '102/26'], area_id: 41, datasets: [46, 69]
    });
    // Una solicitud no lleva notas anteriores; sin número, null
    assert.deepEqual(plano(ctx.cuerpoDelPedido({ ...estado, pedido: 'solicitud', numero: '   ' })), {
      fecha: '2026-10-24', numero: null, tipo: 'externa', pedido: 'solicitud', anteriores: [], area_id: 41, datasets: [46, 69]
    });
  });
});

describe('notas.js: la descarga del Word', () => {
  const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer token-de-prueba' };
  const conFetch = (respuesta) => {
    const llamadas = [];
    const pagina = cargar({
      Auth: { isAuthenticated: () => true, puedeCargarNotasDgmit: () => true, getAuthHeaders: () => HEADERS },
      fetch: async (url, opciones) => { llamadas.push([url, opciones]); return respuesta; }
    });
    return { pagina, llamadas };
  };
  const CUERPO = { fecha: '2026-10-24', numero: null, tipo: 'interna', pedido: 'solicitud', anteriores: [], area_id: 37, datasets: [58] };

  it('pedirWord: un POST a /notas/generar con el token en el encabezado; devuelve el blob', async () => {
    const { pagina, llamadas } = conFetch({ ok: true, status: 200, blob: async () => 'EL-WORD' });
    assert.equal(await pagina.pedirWord(CUERPO), 'EL-WORD');
    assert.equal(llamadas.length, 1);
    const [url, opciones] = llamadas[0];
    assert.equal(url, '/api/notas/generar');
    assert.equal(opciones.method, 'POST');
    assert.deepEqual(plano(opciones.headers), HEADERS);
    assert.deepEqual(JSON.parse(opciones.body), CUERPO);
  });

  it('pedirWord: con un 401 tira un error con status 401 (la sesión venció a mitad del armado)', async () => {
    const { pagina } = conFetch({ ok: false, status: 401, json: async () => ({ success: false, error: 'Token inválido o expirado' }) });
    await assert.rejects(pagina.pedirWord(CUERPO), (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.message, 'Token inválido o expirado');
      return true;
    });
  });

  it('pedirWord: un 400 trae el campo; una respuesta que no es JSON, el estado', async () => {
    const { pagina } = conFetch({ ok: false, status: 400, json: async () => ({ success: false, error: 'Elegí al menos un dataset.', campo: 'datasets' }) });
    await assert.rejects(pagina.pedirWord(CUERPO), (error) => error.status === 400 && error.campo === 'datasets' && error.message === 'Elegí al menos un dataset.');
    const roto = conFetch({ ok: false, status: 502, json: async () => { throw new SyntaxError('no es JSON'); } });
    await assert.rejects(roto.pagina.pedirWord(CUERPO), (error) => error.status === 502 && error.message === 'Error 502' && error.campo === undefined);
  });

  it('descargarBlob: un enlace con el nombre del archivo, y la URL se libera', () => {
    const creadas = [];
    const liberadas = [];
    const enlaces = [];
    const pagina = cargar({
      URL: { createObjectURL: (blob) => { creadas.push(blob); return 'blob:1'; }, revokeObjectURL: (url) => liberadas.push(url) },
      setTimeout: (funcion) => { funcion(); return 0; },
      document: {
        addEventListener() {}, getElementById: () => null,
        createElement: (tipo) => { const enlace = { tipo, clics: 0, click() { this.clics += 1; } }; enlaces.push(enlace); return enlace; }
      }
    });
    vm.runInContext('descargarBlob', pagina)('EL-WORD', 'Nota interna - Secretaría de Cultura - 2026-10-24.docx');
    assert.deepEqual(creadas, ['EL-WORD']);
    assert.equal(enlaces.length, 1);
    assert.equal(enlaces[0].tipo, 'a');
    assert.equal(enlaces[0].href, 'blob:1');
    assert.equal(enlaces[0].download, 'Nota interna - Secretaría de Cultura - 2026-10-24.docx');
    assert.equal(enlaces[0].clics, 1);
    assert.deepEqual(liberadas, ['blob:1']);
  });
});

// La página con un DOM falso: cada id es un elemento, un API.pedirJson falso que anota los pedidos y el arranque guardado
const elementoFalso = (id) => {
  const clases = new Set();
  const atributos = {};
  return {
    id, hidden: false, innerHTML: '', textContent: '', value: '', checked: false, disabled: false, dataset: {},
    classList: { add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c), toggle: (c, si = !clases.has(c)) => (si ? clases.add(c) : clases.delete(c), si) },
    setAttribute(nombre, valor) { atributos[nombre] = String(valor); }, removeAttribute(nombre) { delete atributos[nombre]; },
    getAttribute: (nombre) => atributos[nombre] ?? null,
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, focus() {}
  };
};
const preparar = ({ sesion = true, puede = true } = {}) => {
  let arranque = null;
  const elementos = {};
  const pedidos = [];
  const window = { location: { search: '' } };
  const pagina = cargar({
    document: {
      addEventListener: (tipo, funcion) => { if (tipo === 'DOMContentLoaded') arranque = funcion; },
      getElementById: (clave) => (elementos[clave] ??= elementoFalso(clave))
    },
    Auth: { isAuthenticated: () => sesion, isAdmin: () => false, puedeCargarNotasDgmit: () => puede },
    window,
    fetch: async (url) => { pedidos.push(`fetch ${url}`); throw new Error('sin servidor'); }
  });
  pagina.console = { error() {} };
  pagina.Utils.hoyEnArgentina = () => '2026-10-24';
  vm.runInContext('API', pagina).pedirJson = async (metodo, ruta) => { pedidos.push(`${metodo} ${ruta}`); return { success: true, data: [] }; };
  const inicios = [];
  pagina.iniciarGenerador = async () => { inicios.push(true); };
  const el = (clave) => pagina.document.getElementById(clave);
  return { pagina, arranque: () => arranque(), registrado: () => typeof arranque === 'function', el, pedidos, inicios, window };
};

describe('notas.js: el arranque de la página', () => {
  it('al cargarse solo registra el DOMContentLoaded: no toca el DOM ni pide nada', () => {
    const registros = [];
    const tocados = [];
    const pedidos = [];
    const window = { location: { search: '' } };
    cargar({
      document: {
        addEventListener: (tipo) => registros.push(tipo),
        getElementById: (id) => { tocados.push(id); return null; },
        querySelector: (s) => { tocados.push(s); return null; }
      },
      window,
      fetch: async (url) => { pedidos.push(url); throw new Error('sin servidor'); }
    });
    assert.deepEqual(registros, ['DOMContentLoaded']);
    assert.deepEqual(tocados, []);
    assert.deepEqual(pedidos, []);
    assert.equal(window.location.href, undefined);
  });

  it('sin sesión, al login, sin arrancar el generador', () => {
    const { arranque, registrado, window, inicios, pedidos } = preparar({ sesion: false });
    assert.ok(registrado());
    arranque();
    assert.equal(window.location.href, 'login.html');
    assert.deepEqual(inicios, []);
    assert.deepEqual(pedidos, []);
  });

  it('sin permiso (un lector que entra por la URL): el mensaje en la página, sin el generador y sin ningún pedido', () => {
    const { arranque, el, window, inicios, pedidos } = preparar({ puede: false });
    arranque();
    assert.equal(window.location.href, undefined);
    assert.ok(el('nt-aviso').innerHTML.includes('No tenés permiso para usar el generador de notas.'));
    assert.match(el('nt-aviso').innerHTML, /^<div class="alert alert-error">/);
    assert.equal(el('nt-generador').hidden, true);
    assert.deepEqual(inicios, []);
    assert.deepEqual(pedidos, []);
  });

  it('sin permiso aunque Auth no sepa decirlo (un auth.js viejo): falla cerrado', () => {
    const { pagina, arranque, el, inicios } = preparar();
    pagina.Auth = { isAuthenticated: () => true };
    arranque();
    assert.ok(el('nt-aviso').innerHTML.includes('No tenés permiso para usar el generador de notas.'));
    assert.deepEqual(inicios, []);
  });

  it('con sesión y permiso, arranca el generador', () => {
    const { arranque, el, inicios } = preparar();
    arranque();
    assert.deepEqual(inicios, [true]);
    assert.equal(el('nt-aviso').innerHTML, '');
  });

  it('iniciarGenerador: la nota arranca en el paso 1, con fecha de hoy en Argentina, solicitud y sin área', async () => {
    const pagina = cargar();
    pagina.Utils.hoyEnArgentina = () => '2026-10-24';
    vm.runInContext('API', pagina).pedirJson = async () => ({ success: true, data: [] });
    await pagina.iniciarGenerador();
    const estado = vm.runInContext('generador', pagina);
    assert.equal(estado.paso, 1);
    assert.equal(estado.fecha, '2026-10-24');
    assert.equal(estado.pedido, 'solicitud');
    assert.equal(estado.filtro, 'urgentes');
    assert.equal(estado.areaId, null);
    assert.equal(estado.elegidos.size, 0);
  });
});
