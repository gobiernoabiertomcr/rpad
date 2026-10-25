// El Generador de Notas en la página (spec 2026-10-24-generador-de-notas, secciones 1 y 3), ejecutado en Node: lo puro de
// public/js/notas.js (los filtros y las filas de las áreas, las insignias, los datasets del área, la nota anterior, la hoja de la
// vista previa, los errores y el pedido), la descarga del Word y el arranque de la página con un DOM falso. Como seguimiento.js, el
// script al cargarse solo declara: se carga en un vm con un document que no hace nada, junto con el api.js de verdad (Utils).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { MENSAJES_GENERADOR, LARGO_NUMERO, FECHA_MINIMA, DIAS_ADELANTE, validarPedidoDeNota } from '../services/notasGeneradorReglas.js';
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
    assert.ok(html.includes('<span class="area-texto"><span class="area-nombre">Secretaría de la Mujer, Género y Diversidad<span class="ambito municipal">Municipal</span></span>'));
    assert.ok(html.includes('<span class="area-ds">Áreas específicas de género</span></span>'), 'solo los títulos de los vencidos o próximos');
    assert.ok(html.includes('<span class="area-estado"><span class="badge badge-proximo">Vence en 37 días</span></span>'));
    // Dentro de un <button> solo va contenido de frase: nada de <div>
    assert.ok(!html.includes('<div'), 'sin <div> dentro del botón');
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
    assert.ok(transito.includes('<span class="area-ds">Infracciones de Tránsito, Licencias de Conducir</span>'));
    assert.ok(transito.includes('<span class="area-estado"><span class="badge badge-actualizado">Los 2 al día</span></span>'));
    const uno = ctx.htmlDeFilaDeArea({ ...areas.find((a) => a.id === 21), datasets: [areas.find((a) => a.id === 21).datasets[0]] }, false);
    assert.ok(uno.includes('<span class="area-estado"><span class="badge badge-actualizado">Al día</span></span>'));
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
    assert.ok(html.includes('<span class="ds-cuerpo"><span class="ds-titulo">Facturación de energía</span><span class="badge badge-atrasado">Vencido hace 118 días</span>'));
    assert.ok(html.includes('<span class="ds-datos">Trimestralmente · Datos solicitados: <b>Del 01/01/2026 al 31/05/2026</b></span></span></label>'));
    // Dentro de un <label> solo va contenido de frase: nada de <div>
    assert.ok(!html.includes('<div'), 'sin <div> dentro de la etiqueta');
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
    assert.ok(html.includes('<span class="ds-datos">Trimestralmente · Vence el 31/03/2027. Al día: todavía no hay datos para pedir.</span>'));
    assert.ok(html.includes('<span class="badge badge-actualizado">Al día</span>'));
  });

  it('htmlDeDataset: las notas DGMIT del ciclo, en violeta y por fecha de recepción', () => {
    const reclamos = DATASETS_DE_LA_COOPERATIVA().find((d) => d.id === 69);
    assert.ok(ctx.htmlDeDataset(reclamos, true).includes(
      '<span class="ds-dgmit">Notas DGMIT del ciclo: N° 102/26 (solicitud, recibida el 15/07/2026) · N° 131/26 (reiteración, recibida el 10/09/2026)</span>'));
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

  it('tipoDeNotaSugerido: interna para un área municipal, externa para una de fuera del municipio', () => {
    assert.equal(ctx.tipoDeNotaSugerido('municipal'), 'interna');
    assert.equal(ctx.tipoDeNotaSugerido('externo'), 'externa');
    assert.equal(ctx.tipoDeNotaSugerido(undefined), 'interna');
    // El nombre no choca con tipoSugerido (el tipo de pedido de un dataset, services/fechasDatasetReglas.js)
    assert.equal(typeof ctx.tipoSugerido, 'undefined');
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
    // Sin maxlength: cuenta unidades de UTF-16 y cortaría un número con emoji a los 20 (el largo lo controlan numerosConOtro y el servidor)
    assert.ok(html.includes('<input class="form-input" id="nt-anterior-nuevo" type="text" placeholder="Ej.: 124/25" aria-label="Número de otra nota anterior" aria-describedby="nt-anteriores-error">'));
    assert.ok(!html.includes('maxlength'));
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
    const datasets = DATASETS_DE_LA_COOPERATIVA();
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: [] })), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: new Set() })), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({})), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2()), { datasets: 'Elegí al menos un dataset.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: new Set([46]), numero: '', anteriores: [] })), {});
  });

  // Revisión de la Task 8, hallazgo 1: si la fecha de la nota cambia y un dataset tildado pasa a estar al día, ya no se manda
  // (cuerpoDelPedido usa idsElegidos): el paso 2 no puede dejar seguir con lo que el servidor va a rechazar
  it('erroresDelPaso2: cuenta solo los elegidos que se pueden pedir, como cuerpoDelPedido', () => {
    const datasets = DATASETS_DE_LA_COOPERATIVA();
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: new Set([72]) })), { datasets: 'Elegí al menos un dataset.' },
      'el 72 está al día a la fecha de la nota');
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: new Set([999, '72']) })), { datasets: 'Elegí al menos un dataset.' },
      'uno que no está en la lista tampoco cuenta');
    assert.deepEqual(plano(ctx.erroresDelPaso2({ elegidos: new Set([46]) })), { datasets: 'Elegí al menos un dataset.' }, 'sin la lista, ninguno');
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: new Set([72, '70']) })), {});
  });

  it('erroresDelPaso2: el número y las notas anteriores, hasta 40 caracteres sin los espacios de los extremos (contados con Array.from)', () => {
    const datasets = DATASETS_DE_LA_COOPERATIVA();
    const cuarenta = 'x'.repeat(40);
    const emojis = '😀'.repeat(40);
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: [46], numero: `  ${cuarenta}  `, anteriores: [emojis] })), {});
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: [46], numero: `${cuarenta}y`, anteriores: [] })),
      { numero: 'El número de la nota puede tener hasta 40 caracteres.' });
    assert.deepEqual(plano(ctx.erroresDelPaso2({ datasets, elegidos: [46], numero: null, anteriores: ['1/26', `${emojis}😀`] })),
      { anteriores: 'Cada número de nota anterior puede tener hasta 40 caracteres.' });
    // En el orden de los campos del servidor: número, notas anteriores, datasets
    assert.deepEqual(Object.keys(ctx.erroresDelPaso2({ datasets, elegidos: [], numero: `${cuarenta}y`, anteriores: [`${cuarenta}y`] })),
      ['numero', 'anteriores', 'datasets']);
    // Lo que el servidor rechaza aunque no sea largo: un número que no es texto, una lista que no es lista
    assert.deepEqual(Object.keys(ctx.erroresDelPaso2({ datasets, elegidos: [46], numero: 125, anteriores: 'x' })), ['numero', 'anteriores']);
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

  it('FECHA_MINIMA_NOTA y DIAS_ADELANTE_NOTA son los de services/notasGeneradorReglas.js', () => {
    assert.equal(constante('FECHA_MINIMA_NOTA'), FECHA_MINIMA);
    assert.equal(constante('DIAS_ADELANTE_NOTA'), DIAS_ADELANTE);
  });

  it('errorDeFecha: la misma regla que la fecha de validarPedidoDeNota, en los bordes', () => {
    const HOY = '2026-10-24';
    const casos = ['', null, undefined, 20261024, 'abc', '2026-02-30', '2026-10-24T00:00', '24/10/2026', '2024-12-31', '2025-01-01',
      '2026-10-24', '2026-11-23', '2026-11-24', '2027-10-24'];
    for (const fecha of casos) {
      const servidor = validarPedidoDeNota({ fecha }, HOY).errores.fecha ?? null;
      assert.equal(ctx.errorDeFecha(fecha, HOY), servidor, String(fecha));
    }
    assert.equal(ctx.errorDeFecha('2026-11-23', HOY), null, 'hoy + 30 días todavía se puede');
    assert.equal(ctx.errorDeFecha('2026-11-24', HOY), 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.');
    assert.equal(ctx.errorDeFecha('', HOY), 'Elegí la fecha de la nota.');
  });

  it('erroresParaSeguir: la fecha y los del paso 2, en el orden de los campos; las notas anteriores, solo en una reiteración', () => {
    const area = { id: 41, datasets: DATASETS_DE_LA_COOPERATIVA() };
    const estado = { fecha: '2026-10-24', numero: '', pedido: 'solicitud', anteriores: ['x'.repeat(41)], area, elegidos: new Set([46]) };
    assert.deepEqual(plano(ctx.erroresParaSeguir(estado, '2026-10-24')), {}, 'con solicitud no cuentan las notas anteriores');
    assert.deepEqual(plano(ctx.erroresParaSeguir({ ...estado, pedido: 'reiteracion' }, '2026-10-24')),
      { anteriores: 'Cada número de nota anterior puede tener hasta 40 caracteres.' });
    assert.deepEqual(Object.keys(ctx.erroresParaSeguir({ ...estado, fecha: '', numero: 'y'.repeat(41), elegidos: new Set([72]) }, '2026-10-24')),
      ['fecha', 'numero', 'datasets']);
    assert.deepEqual(plano(ctx.erroresParaSeguir(null, '2026-10-24')),
      { fecha: 'Elegí la fecha de la nota.', datasets: 'Elegí al menos un dataset.' });
  });

  it('erroresParaSeguir: si no se pudo cargar el área, queda solo ese error (nunca "Elegí al menos un dataset."), y el de la fecha escrita', () => {
    const estado = { fecha: '2026-10-24', numero: 'y'.repeat(41), pedido: 'solicitud', area: null, elegidos: new Set(), errorDeArea: 'Error al obtener el área' };
    assert.deepEqual(plano(ctx.erroresParaSeguir({ ...estado, campoDeArea: 'datasets' }, '2026-10-24')), { datasets: 'Error al obtener el área' });
    assert.deepEqual(plano(ctx.erroresParaSeguir(estado, '2026-10-24')), { datasets: 'Error al obtener el área' }, 'sin campo, en los datasets');
    const rechazada = { ...estado, errorDeArea: 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.', campoDeArea: 'fecha' };
    assert.deepEqual(plano(ctx.erroresParaSeguir(rechazada, '2026-10-24')), { fecha: rechazada.errorDeArea });
    assert.deepEqual(plano(ctx.erroresParaSeguir({ ...rechazada, fecha: '' }, '2026-10-24')), { fecha: 'Elegí la fecha de la nota.' });
    assert.deepEqual(plano(ctx.erroresParaSeguir({ ...estado, fecha: '' }, '2026-10-24')),
      { fecha: 'Elegí la fecha de la nota.', datasets: 'Error al obtener el área' });
  });

  it('numerosConOtro: suma un número recortado; vacío o repetido no cambia la lista; uno largo da el error', () => {
    assert.deepEqual(plano(ctx.numerosConOtro(['88/26'], '  5/25 ')), { numeros: ['88/26', '5/25'], agregado: true, error: null });
    assert.deepEqual(plano(ctx.numerosConOtro(['88/26'], '   ')), { numeros: ['88/26'], agregado: false, error: null });
    assert.deepEqual(plano(ctx.numerosConOtro(['88/26'], '88/26')), { numeros: ['88/26'], agregado: false, error: null });
    assert.deepEqual(plano(ctx.numerosConOtro([], '😀'.repeat(40))), { numeros: ['😀'.repeat(40)], agregado: true, error: null });
    assert.deepEqual(plano(ctx.numerosConOtro(['1/26'], 'x'.repeat(41))),
      { numeros: ['1/26'], agregado: false, error: 'Cada número de nota anterior puede tener hasta 40 caracteres.' });
    assert.deepEqual(plano(ctx.numerosConOtro(null, undefined)), { numeros: [], agregado: false, error: null });
    const lista = ['1/26'];
    ctx.numerosConOtro(lista, '2/26');
    assert.deepEqual(lista, ['1/26'], 'la lista recibida no cambia');
  });
});

describe('notas.js: los pasos y los textos de la página', () => {
  it('htmlDePasos: el actual con aria-current="step", los hechos con la tilde y los que faltan con su número', () => {
    const uno = ctx.htmlDePasos(1);
    assert.equal(cuantas(uno, /aria-current="step"/g), 1);
    assert.equal(uno, '<li class="actual" aria-current="step"><span class="num" aria-hidden="true">1</span>Área</li>'
      + '<li><span class="num" aria-hidden="true">2</span>Datasets y nota</li>'
      + '<li><span class="num" aria-hidden="true">3</span>Revisar y descargar</li>');
    const tres = ctx.htmlDePasos(3);
    assert.equal(cuantas(tres, /aria-current="step"/g), 1);
    assert.ok(tres.startsWith('<li class="hecho"><span class="num" aria-hidden="true">✓</span>Área<span class="sr-only"> (hecho)</span></li>'));
    assert.ok(tres.includes('<li class="hecho"><span class="num" aria-hidden="true">✓</span>Datasets y nota<span class="sr-only"> (hecho)</span></li>'));
    assert.ok(tres.endsWith('<li class="actual" aria-current="step"><span class="num" aria-hidden="true">3</span>Revisar y descargar</li>'));
  });

  it('textoDeIntro: el texto de ayuda del paso 1 (spec 3.1), con la cantidad de áreas', () => {
    assert.equal(ctx.textoDeIntro(24), 'Tocá el área a la que se le piden los datos. Primero están las que tienen datasets vencidos o próximos a '
      + 'vencer (60 días); en "Todas", las 24 áreas con datasets que requieren nota DGMIT.');
  });

  it('textoDeDependencia: "dependiente de la …", "dependiente del …" o "sin dependencia cargada"', () => {
    assert.equal(ctx.textoDeDependencia({ area_superior: 'Secretaría de Salud', articulo_superior: 'la' }), 'dependiente de la Secretaría de Salud');
    assert.equal(ctx.textoDeDependencia({ area_superior: 'Ministerio de Educación del Chubut', articulo_superior: 'el' }),
      'dependiente del Ministerio de Educación del Chubut');
    assert.equal(ctx.textoDeDependencia({ area_superior: 'Intendencia', articulo_superior: null }), 'dependiente de la Intendencia');
    assert.equal(ctx.textoDeDependencia({ area_superior: '   ', articulo_superior: 'el' }), 'sin dependencia cargada');
    assert.equal(ctx.textoDeDependencia({ area_superior: null }), 'sin dependencia cargada');
    assert.equal(ctx.textoDeDependencia(null), 'sin dependencia cargada');
  });

  it('htmlDelAreaElegida: el nombre, la dependencia y el ámbito, escapados', () => {
    assert.equal(ctx.htmlDelAreaElegida({ nombre: 'Agencia <b>X</b>', ambito: 'externo', area_superior: 'Ministerio & Co', articulo_superior: 'el' }),
      '<b>Agencia &lt;b&gt;X&lt;/b&gt;</b> · <span class="text-muted">dependiente del Ministerio &amp; Co</span> · '
      + '<span class="ambito externo">Fuera del municipio</span>');
    assert.ok(ctx.htmlDelAreaElegida({ nombre: 'Secretaría de la Mujer', ambito: 'municipal' })
      .endsWith('<span class="text-muted">sin dependencia cargada</span> · <span class="ambito municipal">Municipal</span>'));
  });

  it('textoDeAyudaDelNumero: el año de la fecha de la nota (spec 3.2)', () => {
    assert.equal(ctx.textoDeAyudaDelNumero('2026-10-24'),
      'Sin número, la nota sale con "Nota N° ____/26" para completarlo después. No se guarda en ningún lado.');
    assert.ok(ctx.textoDeAyudaDelNumero('2027-01-05').includes('"Nota N° ____/27"'));
    assert.ok(ctx.textoDeAyudaDelNumero('').includes('"Nota N° ____/AA"'), 'sin fecha, sin año');
  });

  it('htmlDelResumen: área, nota, fecha y número, y los datasets en el orden de la lista (spec 3.3)', () => {
    const area = { id: 41, nombre: 'Cooperativa <S.A.>', datasets: DATASETS_DE_LA_COOPERATIVA() };
    const estado = { area, tipo: 'interna', pedido: 'solicitud', fecha: '2026-10-24', numero: '  ', elegidos: new Set([70, 46, 72]) };
    const html = ctx.htmlDelResumen(estado);
    assert.ok(html.includes('<div><dt>Área</dt><dd>Cooperativa &lt;S.A.&gt;</dd></div>'));
    assert.ok(html.includes('<div><dt>Nota</dt><dd>Interna, a la Subsecretaría · Solicitud</dd></div>'));
    assert.ok(html.includes('<div><dt>Fecha y número</dt><dd>24/10/2026 · sin número (queda el espacio)</dd></div>'));
    assert.ok(html.includes('<div><dt>Datasets</dt><dd>Facturación de energía<br>Tarifas</dd></div>'), 'sin el que está al día');
    const reiteracion = ctx.htmlDelResumen({ ...estado, tipo: 'externa', pedido: 'reiteracion', numero: ' <156>/26 ' });
    assert.ok(reiteracion.includes('<dd>Externa, directo al área · Reiteración</dd>'));
    assert.ok(reiteracion.includes('<dd>24/10/2026 · &lt;156&gt;/26</dd>'));
  });

  it('vistaPreviaDe: cargando, lo que falta para armar la nota, la nota, una vieja mientras llega la nueva o el error', () => {
    const area = { id: 41, nombre: 'Cooperativa', datasets: DATASETS_DE_LA_COOPERATIVA() };
    const base = {
      area, areaId: 41, fecha: '2026-10-24', numero: '', tipo: 'externa', pedido: 'solicitud', anteriores: [], elegidos: new Set([46]),
      membrete: { imagen: null, pie: 'Moreno 815' }
    };
    const HOY = '2026-10-24';
    const clave = ctx.claveDelPedido(base);
    assert.deepEqual(JSON.parse(clave), plano(ctx.cuerpoDelPedido(base)));

    const cargando = ctx.vistaPreviaDe({ ...base, cargandoArea: true }, HOY);
    assert.equal(cargando.lista, false);
    assert.match(cargando.html, /class="spinner"/);
    assert.match(ctx.vistaPreviaDe({ ...base, area: null }, HOY).html, /class="spinner"/);

    const sinElegidos = ctx.vistaPreviaDe({ ...base, elegidos: new Set() }, HOY);
    assert.equal(sinElegidos.lista, false);
    assert.ok(sinElegidos.html.includes('<p class="hoja-mensaje">Elegí al menos un dataset.</p>'));
    assert.ok(sinElegidos.html.includes('<div class="pie">Moreno 815</div>'), 'la hoja, con su pie');

    const errorDelArea = ctx.vistaPreviaDe({ ...base, area: null, errorDeArea: 'Error <al> obtener el área' }, HOY);
    assert.ok(errorDelArea.html.includes('<p class="hoja-mensaje">Error &lt;al&gt; obtener el área</p>'));

    const lista = ctx.vistaPreviaDe({ ...base, vistaPrevia: { clave, html: '<p>La nota</p>', nombre: 'Nota.docx' } }, HOY);
    assert.deepEqual([lista.lista, lista.actualizando ?? false], [true, false]);
    assert.ok(lista.html.includes('<div class="texto"><p>La nota</p></div>'));

    const vieja = ctx.vistaPreviaDe({ ...base, numero: '156/26', vistaPrevia: { clave, html: '<p>La nota</p>', nombre: 'Nota.docx' } }, HOY);
    assert.deepEqual([vieja.lista, vieja.actualizando], [false, true], 'la anterior, marcada, mientras llega la nueva');
    assert.ok(vieja.html.includes('<p>La nota</p>'));

    const fallo = ctx.vistaPreviaDe({ ...base, falloDeVista: { clave, mensaje: 'Error al armar <la> vista previa' } }, HOY);
    assert.equal(fallo.lista, false);
    assert.ok(fallo.html.includes('<p class="hoja-mensaje">Error al armar &lt;la&gt; vista previa</p>'));
  });
});

describe('notas.html', () => {
  const HTML = leer('notas.html');
  const ARCHIVO = leer('js/notas.js');

  it('cada id que nombra notas.js está una sola vez en la página', () => {
    const ids = new Set([...ARCHIVO.matchAll(/'(nt-[a-z0-9-]+)'/g)].map((m) => m[1]));
    // Los que se arman con el número del paso, el tipo o el pedido
    for (const n of [1, 2, 3]) ids.add(`nt-paso-${n}`).add(`nt-titulo-${n}`);
    for (const id of ['nt-tipo-interna', 'nt-tipo-externa', 'nt-pedido-solicitud', 'nt-pedido-reiteracion']) ids.add(id);
    // El campo para agregar una nota anterior lo dibuja htmlDeNotaAnterior
    ids.delete('nt-anterior-nuevo');
    assert.ok(ids.size > 20, `ids: ${ids.size}`);
    for (const id of ids) assert.equal(cuantas(HTML, new RegExp(`id="${id}"`, 'g')), 1, id);
  });

  it('el título, el aviso para los lectores de pantalla y los tres pasos; sin lo del generador viejo', () => {
    assert.match(HTML, /<h1 class="page-title">\s*<svg aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*Generador de Notas\s*<\/h1>/);
    assert.ok(HTML.includes('<div id="nt-aviso" role="status" aria-live="polite"></div>'));
    assert.match(HTML, /<ol id="nt-pasos" aria-label="Pasos">/);
    for (const n of [1, 2, 3]) assert.match(HTML, new RegExp(`<h2 class="sr-only" id="nt-titulo-${n}" tabindex="-1">Paso ${n}: `));
    assert.match(HTML, /<div id="nt-paso-2" hidden>/);
    assert.match(HTML, /<div id="nt-paso-3" hidden>/);
    for (const viejo of ['modal-buscar-dataset', 'escalonada', 'Escalonada', 'abrirBuscadorDataset', 'onclick=', 'indique los períodos']) {
      assert.ok(!HTML.includes(viejo), viejo);
    }
  });

  it('los textos fijos de la spec (secciones 3.2 y 3.3)', () => {
    for (const texto of [
      'A la Subsecretaría de Modernización y Transparencia, para que gestione ante el área.',
      'Directo al área u organismo, con "Al/A la … PRESENTE".',
      'La primera vez que se piden estos datos.',
      'Ya se pidieron y siguen pendientes.',
      'Vienen elegidos los vencidos y los próximos a vencer. Los "Datos solicitados" los calcula el RPAD, igual que en las Notas Digitales.',
      'Sale en la hoja membretada, sin firma: se imprime y se firma a mano. El Word se puede retocar antes de imprimir.',
      'Buscar por área o por dataset', 'Ej.: 156/26', 'Cambiar el área', 'Ver en grande', 'Siguiente: revisar la nota',
      'Volver a los datasets', 'Armar otra nota', 'Descargar Word', 'Datasets del área que requieren nota DGMIT'
    ]) assert.ok(HTML.includes(texto), texto);
  });

  it('el <style> define .alert, .alert-error, .alert-success y [hidden], y las clases de la Task 8', () => {
    const estilo = HTML.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const selector of ['.alert ', '.alert-error', '.alert-success', '[hidden]', '.area-texto', '.ambito.externo', '.ds-aviso', '.nota-tabla', '.nota-firma']) {
      assert.ok(estilo.includes(selector), selector);
    }
  });

  // maxlength cuenta unidades de UTF-16: un número con emoji se cortaba a los 20 caracteres, y el servidor acepta 40 (Array.from)
  it('el número de la nota no tiene maxlength (lo controlan erroresDelPaso2 y el servidor)', () => {
    const campo = HTML.match(/<input[^>]*id="nt-numero"[^>]*>/)?.[0] ?? '';
    assert.ok(campo, 'está el campo');
    assert.doesNotMatch(campo, /maxlength/);
    assert.doesNotMatch(HTML, /maxlength/, 'ningún campo de la página');
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

});

// La página entera con un DOM falso (spec 3 y 3.4): cada id es un elemento que guarda sus oyentes y anota quién tiene el foco; los
// temporizadores no corren solos (los corre `correr`); API.pedirJson contesta con `responder`, que se puede cambiar a mitad de una
// prueba; fetch (el Word) contesta con `respuestaWord`.
const falla = (status, mensaje, campo) => Object.assign(new Error(mensaje), { status, campo });
const AREA_LISTA_41 = () => ({
  id: 41, nombre: 'Cooperativa Eléctrica', ambito: 'externo', area_superior: null, articulo: 'la', articulo_superior: null,
  datasets: DATASETS_DE_LA_COOPERATIVA().map(({ id, titulo, estado, dias, proxima }) => ({ id, titulo, estado, dias, proxima }))
});
const AREA_41 = () => ({ ...AREA_LISTA_41(), datasets: DATASETS_DE_LA_COOPERATIVA() });
const AREA_37 = () => ({
  ...AREAS().find((a) => a.id === 37),
  datasets: [
    DATASET({ id: 58, titulo: 'Áreas específicas de género', estado: 'proximo', dias: 37, proxima: '2026-11-30', datos_solicitados: 'Vigente al 31/10/2026' }),
    DATASET({ id: 57, titulo: 'Presupuesto con perspectiva de género', estado: 'actualizado', dias: 99, proxima: '2027-01-31', se_puede_pedir: false })
  ]
});
const RESPUESTAS = (metodo, ruta, cuerpo) => {
  if (metodo === 'GET' && ruta === '/notas/areas') return [...AREAS(), AREA_LISTA_41()];
  if (metodo === 'GET' && ruta === '/notas/membrete') return { imagen: null, pie: 'Moreno 815' };
  if (metodo === 'GET' && ruta.startsWith('/notas/areas/41?')) return AREA_41();
  if (metodo === 'GET' && ruta.startsWith('/notas/areas/37?')) return AREA_37();
  if (metodo === 'POST' && ruta === '/notas/vista-previa') {
    return { html: `<p>Nota ${cuerpo.numero ?? 'sin número'}</p>`, nombre: `Nota ${cuerpo.tipo} - ${cuerpo.area_id} - ${cuerpo.fecha}.docx` };
  }
  throw falla(404, `Sin respuesta para ${metodo} ${ruta}`);
};

const montar = ({ responder = RESPUESTAS } = {}) => {
  const estado = { foco: null, sesionCerrada: false, fetch: [], enlaces: [], blobs: [], responder, respuestaWord: { ok: true, status: 200, blob: async () => 'EL-WORD' } };
  const temporizadores = new Map();
  let siguienteTemporizador = 1;
  const pedidos = [];
  const elemento = (id) => {
    const clases = new Set();
    const atributos = {};
    const oyentes = {};
    return {
      id, hidden: false, innerHTML: '', textContent: '', value: '', checked: false, disabled: false, dataset: {},
      classList: {
        add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c),
        toggle: (c, si = !clases.has(c)) => { if (si) clases.add(c); else clases.delete(c); return si; }
      },
      setAttribute(nombre, valor) { atributos[nombre] = String(valor); },
      removeAttribute(nombre) { delete atributos[nombre]; },
      getAttribute: (nombre) => atributos[nombre] ?? null,
      addEventListener: (tipo, funcion) => { (oyentes[tipo] ??= []).push(funcion); },
      disparar: (tipo, evento) => { for (const funcion of oyentes[tipo] ?? []) funcion(evento); },
      querySelector: () => null, querySelectorAll: () => [], closest: () => null,
      focus() { estado.foco = id; }
    };
  };
  const elementos = {};
  const ventana = { location: { search: '' } };
  const pagina = cargar({
    document: {
      addEventListener() {},
      getElementById: (id) => (elementos[id] ??= elemento(id)),
      createElement: () => { const enlace = { clics: 0, click() { this.clics += 1; } }; estado.enlaces.push(enlace); return enlace; }
    },
    Auth: {
      isAuthenticated: () => true, isAdmin: () => false, puedeCargarNotasDgmit: () => true,
      getAuthHeaders: () => ({ Authorization: 'Bearer token-de-prueba' }), clearSession: () => { estado.sesionCerrada = true; }
    },
    window: ventana,
    setTimeout: (funcion, ms) => { const id = siguienteTemporizador++; temporizadores.set(id, { funcion, ms }); return id; },
    clearTimeout: (id) => { temporizadores.delete(id); },
    URL: { createObjectURL: (blob) => { estado.blobs.push(blob); return 'blob:1'; }, revokeObjectURL() {} },
    fetch: async (url, opciones) => { estado.fetch.push([url, opciones]); return estado.respuestaWord; }
  });
  pagina.console = { error() {} };
  pagina.Utils.hoyEnArgentina = () => '2026-10-24';
  vm.runInContext('API', pagina).pedirJson = async (metodo, ruta, cuerpo) => {
    pedidos.push({ metodo, ruta, cuerpo: cuerpo === undefined ? undefined : plano(cuerpo) });
    return { success: true, data: await estado.responder(metodo, ruta, cuerpo) };
  };
  const esperar = () => new Promise((resolver) => setImmediate(resolver));
  // Corre los temporizadores pendientes (los de 300 ms) y espera lo que pidan
  const correr = async () => {
    const pendientes = [...temporizadores.entries()];
    temporizadores.clear();
    for (const [, { funcion }] of pendientes) funcion();
    await esperar();
  };
  const el = (id) => pagina.document.getElementById(id);
  const generador = () => vm.runInContext('generador', pagina);
  const rutas = (metodo) => pedidos.filter((p) => p.metodo === metodo).map((p) => p.ruta);
  const vistasPedidas = () => pedidos.filter((p) => p.ruta === '/notas/vista-previa');
  // Una casilla de la lista de datasets (la página la busca en #nt-datasets)
  const conCasilla = (id) => {
    const casilla = elemento(id);
    el('nt-datasets').querySelector = (selector) => (selector.includes('dataset') ? casilla : null);
    el('nt-datasets').querySelectorAll = (selector) => (selector.includes('dataset') ? [casilla] : []);
    return casilla;
  };
  const iniciar = async () => { await pagina.iniciarGenerador(); await esperar(); };
  const conArea = async (id = 41) => { await iniciar(); await pagina.elegirArea(id); await esperar(); };
  return { pagina, el, estado, ventana, pedidos, temporizadores, esperar, correr, generador, rutas, vistasPedidas, conCasilla, iniciar, conArea };
};

describe('notas.js: la página (DOM falso)', () => {
  it('iniciarGenerador: el paso 1, con fecha de hoy en Argentina, solicitud y sin área; pide las áreas y el membrete', async () => {
    const p = montar();
    await p.iniciar();
    const g = p.generador();
    assert.deepEqual([g.paso, g.fecha, g.pedido, g.filtro, g.areaId, g.elegidos.size], [1, '2026-10-24', 'solicitud', 'urgentes', null, 0]);
    assert.deepEqual(p.rutas('GET').sort(), ['/notas/areas', '/notas/membrete']);
    assert.deepEqual([1, 2, 3].map((n) => p.el(`nt-paso-${n}`).hidden), [false, true, true]);
    assert.ok(p.el('nt-pasos').innerHTML.startsWith('<li class="actual" aria-current="step"><span class="num" aria-hidden="true">1</span>Área</li>'));
    // La lista: las 4 áreas con vencidos o próximos, las cantidades y el texto con las 5 áreas
    assert.equal(cuantas(p.el('nt-areas').innerHTML, /<button type="button" class="area-opcion/g), 4);
    assert.deepEqual([p.el('nt-cant-urgentes').textContent, p.el('nt-cant-todas').textContent], ['4', '5']);
    assert.equal(p.el('nt-intro').textContent, ctx.textoDeIntro(5));
    assert.equal(p.el('nt-barra').hidden, false);
    assert.equal(p.estado.foco, null, 'al abrir la página el foco no se mueve');
  });

  it('un 401 en GET /notas/areas lleva al login, con la sesión cerrada (Review Focus 5)', async () => {
    const p = montar({ responder: (metodo, ruta, cuerpo) => {
      if (ruta === '/notas/areas') throw falla(401, 'Token inválido o expirado');
      return RESPUESTAS(metodo, ruta, cuerpo);
    } });
    await p.iniciar();
    assert.equal(p.ventana.location.href, 'login.html');
    assert.equal(p.estado.sesionCerrada, true);
  });

  it('un 500 en GET /notas/areas: el mensaje de la spec en lugar de la lista, no una lista vacía', async () => {
    const p = montar({ responder: (metodo, ruta, cuerpo) => {
      if (ruta === '/notas/areas') throw falla(500, 'Error al obtener las áreas');
      return RESPUESTAS(metodo, ruta, cuerpo);
    } });
    await p.iniciar();
    assert.equal(p.el('nt-areas').innerHTML, '<div class="alert alert-error">No se pudieron cargar las áreas. Probá de nuevo en unos minutos.</div>');
    assert.equal(p.el('nt-barra').hidden, true, 'sin los filtros ni el buscador');
    assert.equal(p.ventana.location.href, undefined);
  });

  it('un clic en la fila de un área pide /notas/areas/<id>?fecha=<hoy> y pasa al paso 2, con el foco en su título', async () => {
    const p = montar();
    await p.iniciar();
    p.el('nt-areas').disparar('click', { target: { closest: (selector) => (selector.includes('data-area') ? { dataset: { area: '41' } } : null) } });
    await p.esperar();
    assert.ok(p.rutas('GET').includes('/notas/areas/41?fecha=2026-10-24'));
    const g = p.generador();
    assert.equal(g.paso, 2);
    assert.equal(p.estado.foco, 'nt-titulo-2');
    assert.deepEqual([1, 2, 3].map((n) => p.el(`nt-paso-${n}`).hidden), [true, false, true]);
    assert.ok(p.el('nt-pasos').innerHTML.includes('<li class="actual" aria-current="step"><span class="num" aria-hidden="true">2</span>Datasets y nota</li>'));
    // Vienen tildados los vencidos y los próximos, y la vista previa se pide enseguida con ellos
    assert.deepEqual([...g.elegidos].sort((a, b) => a - b), [46, 48, 69, 70]);
    assert.ok(p.el('nt-datasets').innerHTML.includes('value="46" checked>'));
    assert.deepEqual(p.vistasPedidas().at(-1).cuerpo, {
      fecha: '2026-10-24', numero: null, tipo: 'externa', pedido: 'solicitud', anteriores: [], area_id: 41, datasets: [46, 48, 69, 70]
    });
    assert.ok(p.el('nt-mini').innerHTML.includes('<p>Nota sin número</p>'));
    assert.ok(p.el('nt-area-elegida').innerHTML.startsWith('<b>Cooperativa Eléctrica</b>'));
  });

  // Revisión de la Task 8, hallazgo 4: el estado arranca con tipo null y textoDelTipo(ámbito, null) decía "Cambiada a mano"
  it('al elegir un área, el tipo de nota es el de su ámbito y la pista dice que viene elegido', async () => {
    const p = montar();
    await p.conArea(37);
    assert.equal(p.generador().tipo, 'interna');
    assert.equal(p.el('nt-tipo-interna').checked, true);
    assert.equal(p.el('nt-pista-tipo').textContent, 'Viene elegida porque el área figura como municipal en Áreas.');
    p.pagina.elegirTipo('externa');
    assert.equal(p.el('nt-pista-tipo').textContent, 'Cambiada a mano: el área figura como municipal, que lleva nota interna.');
    // Otra área: el tipo vuelve a ser el de su ámbito
    p.pagina.irAlPaso(1);
    await p.pagina.elegirArea(41);
    await p.esperar();
    assert.equal(p.generador().tipo, 'externa');
    assert.equal(p.el('nt-pista-tipo').textContent, 'Viene elegida porque el área figura como fuera del municipio en Áreas.');
  });

  it('cambiar la fecha vuelve a pedir el área con ?fecha=, 300 ms después del último cambio; una fecha fuera del rango marca el campo y no pide', async () => {
    const p = montar();
    await p.conArea(41);
    const antes = p.rutas('GET').length;
    p.pagina.cambiarFecha('2026-11-05');
    p.pagina.cambiarFecha('2026-11-10');
    assert.equal(p.rutas('GET').length, antes, 'todavía no');
    assert.ok([...p.temporizadores.values()].every(({ ms }) => ms === 300));
    assert.ok(p.el('nt-numero-ayuda').textContent.includes('"Nota N° ____/26"'));
    await p.correr();
    assert.deepEqual(p.rutas('GET').slice(antes), ['/notas/areas/41?fecha=2026-11-10']);
    assert.equal(p.vistasPedidas().at(-1).cuerpo.fecha, '2026-11-10', 'y la vista previa, con la fecha nueva');

    p.pagina.cambiarFecha('2027-06-01');
    await p.correr();
    assert.equal(p.rutas('GET').length, antes + 1, 'una fecha fuera del rango no se pide');
    assert.equal(p.el('nt-fecha-error').textContent, 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.');
    assert.equal(p.el('nt-fecha-error').hidden, false);
    assert.equal(p.el('nt-fecha').getAttribute('aria-invalid'), 'true');
    p.pagina.cambiarFecha('2026-10-30');
    assert.equal(p.el('nt-fecha-error').hidden, true);
    assert.equal(p.el('nt-fecha').getAttribute('aria-invalid'), null);
  });

  it('la vista previa se pide 300 ms después del último cambio, y una respuesta vieja se descarta', async () => {
    const p = montar();
    await p.conArea(41);
    const antes = p.vistasPedidas().length;
    p.pagina.cambiarNumero('1');
    p.pagina.cambiarNumero('15');
    p.pagina.cambiarNumero('156/26');
    assert.equal(p.vistasPedidas().length, antes, 'todavía no');
    await p.correr();
    assert.equal(p.vistasPedidas().length, antes + 1, 'una sola, con el último número');
    assert.equal(p.vistasPedidas().at(-1).cuerpo.numero, '156/26');
    assert.ok(p.el('nt-mini').innerHTML.includes('<p>Nota 156/26</p>'));

    // Una respuesta que llega cuando la nota ya cambió no se dibuja
    let soltar;
    p.estado.responder = (metodo, ruta, cuerpo) => (ruta === '/notas/vista-previa'
      ? new Promise((resolver) => { soltar = () => resolver({ html: '<p>VIEJA</p>', nombre: 'Vieja.docx' }); })
      : RESPUESTAS(metodo, ruta, cuerpo));
    p.pagina.cambiarNumero('157/26');
    await p.correr();
    p.estado.responder = RESPUESTAS;
    p.pagina.cambiarNumero('158/26');
    soltar();
    await p.esperar();
    assert.ok(!p.el('nt-mini').innerHTML.includes('VIEJA'));
    assert.notEqual(p.generador().vistaPrevia?.nombre, 'Vieja.docx');
    await p.correr();
    assert.ok(p.el('nt-mini').innerHTML.includes('<p>Nota 158/26</p>'));
  });

  it('la nota anterior: viene con las cargadas; editada a mano, tildar otro dataset no la cambia; "Volver a traer" la repone', async () => {
    const p = montar();
    await p.conArea(41);
    p.pagina.elegirPedido('reiteracion');
    const g = () => p.generador();
    assert.deepEqual(plano(g().anteriores), ['88/26', '102/26']);
    assert.equal(p.el('nt-anterior').hidden, false);
    assert.ok(p.el('nt-anterior').innerHTML.includes('Traída de las notas DGMIT cargadas en el Seguimiento.'));
    // Sin editarla, se vuelve a completar cuando cambian los tildados
    p.pagina.marcarDataset('69', false);
    assert.deepEqual(plano(g().anteriores), ['88/26']);
    // "Agregar" suma un número escrito a mano
    p.el('nt-anterior-nuevo').value = ' 5/25 ';
    p.pagina.agregarNotaAnterior();
    assert.deepEqual(plano(g().anteriores), ['88/26', '5/25']);
    assert.equal(g().anterioresEditadas, true);
    assert.ok(p.el('nt-anterior').innerHTML.includes('Editada a mano.'));
    assert.equal(p.estado.foco, 'nt-anterior-nuevo');
    // Editada a mano: tildar otro dataset no la cambia
    p.pagina.marcarDataset('69', true);
    assert.deepEqual(plano(g().anteriores), ['88/26', '5/25']);
    // Enter en el campo también agrega; la × quita
    p.el('nt-anterior-nuevo').value = '7/25';
    let prevenido = false;
    p.el('nt-anterior').disparar('keydown', { key: 'Enter', target: { id: 'nt-anterior-nuevo' }, preventDefault: () => { prevenido = true; } });
    assert.equal(prevenido, true);
    assert.deepEqual(plano(g().anteriores), ['88/26', '5/25', '7/25']);
    p.pagina.quitarNotaAnterior(0);
    assert.deepEqual(plano(g().anteriores), ['5/25', '7/25']);
    // Uno de más de 40 caracteres: el error en el campo, sin sumarlo
    p.el('nt-anterior-nuevo').value = 'x'.repeat(41);
    p.pagina.agregarNotaAnterior();
    assert.deepEqual(plano(g().anteriores), ['5/25', '7/25']);
    assert.equal(p.el('nt-anteriores-error').textContent, 'Cada número de nota anterior puede tener hasta 40 caracteres.');
    // "Volver a traer las cargadas"
    p.pagina.reponerNotasAnteriores();
    assert.deepEqual(plano(g().anteriores), ['88/26', '102/26']);
    assert.equal(g().anterioresEditadas, false);
    await p.correr();
    assert.deepEqual(p.vistasPedidas().at(-1).cuerpo.anteriores, ['88/26', '102/26']);
    // Con solicitud, el recuadro no está y no se mandan
    p.pagina.elegirPedido('solicitud');
    assert.equal(p.el('nt-anterior').hidden, true);
    await p.correr();
    assert.deepEqual(p.vistasPedidas().at(-1).cuerpo.anteriores, []);
  });

  it('"Siguiente" sin datasets tildados: el error junto a la lista, el foco ahí y el paso 2 sigue', async () => {
    const p = montar();
    await p.conArea(41);
    for (const id of ['46', '48', '69', '70']) p.pagina.marcarDataset(id, false);
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 2);
    assert.equal(p.el('nt-datasets-error').textContent, 'Elegí al menos un dataset.');
    assert.equal(p.el('nt-datasets-error').hidden, false);
    assert.equal(p.estado.foco, 'nt-datasets-grupo', 'sin casillas para enfocar, el grupo');
    assert.ok(p.el('nt-datasets').classList.contains('invalido'));
    // Tildar uno saca el error
    p.pagina.marcarDataset('70', true);
    assert.equal(p.el('nt-datasets-error').hidden, true);
    assert.ok(!p.el('nt-datasets').classList.contains('invalido'));
  });

  it('un 400 con campo datasets al revisar la nota: vuelve al paso 2, marca el campo y lleva el foco a la primera casilla', async () => {
    const p = montar();
    await p.conArea(41);
    const casilla = p.conCasilla('casilla-46');
    const mensaje = '«Tarifas» está al día: todavía no hay datos para pedir.';
    p.estado.responder = (metodo, ruta, cuerpo) => {
      if (ruta === '/notas/vista-previa') throw falla(400, mensaje, 'datasets');
      return RESPUESTAS(metodo, ruta, cuerpo);
    };
    p.pagina.marcarDataset('48', false);
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 3, 'pasa al paso 3 mientras pide la vista previa');
    await p.esperar();
    assert.equal(p.generador().paso, 2);
    assert.equal(p.el('nt-datasets-error').textContent, mensaje);
    assert.equal(p.el('nt-datasets-error').hidden, false);
    assert.equal(casilla.getAttribute('aria-invalid'), 'true');
    assert.equal(p.estado.foco, 'casilla-46');
    // "Siguiente" otra vez con lo mismo: no sale del paso 2 y vuelve a llevar el foco ahí
    p.estado.foco = null;
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 2);
    assert.equal(p.estado.foco, 'casilla-46');
  });

  // Ronda de arreglo 1, punto 1: la respuesta del área que estaba en camino al cambiar la fecha (la de la fecha anterior o la carga
  // inicial) llegaba durante la espera de 300 ms y dejaba los datasets de otra fecha
  it('una respuesta del área que llega durante la espera de una fecha nueva no se aplica; la de la fecha nueva sí', async () => {
    const p = montar();
    await p.iniciar();
    const enCamino = [];
    p.estado.responder = (metodo, ruta, cuerpo) => {
      if (ruta === '/notas/areas/41?fecha=2026-10-24') return new Promise((resolver) => { enCamino.push(() => resolver(AREA_41())); });
      if (ruta === '/notas/areas/41?fecha=2026-11-10') {
        // A la fecha nueva, Tarifas (70) ya está al día
        return { ...AREA_41(), datasets: AREA_41().datasets.map((d) => (d.id === 70 ? { ...d, estado: 'actualizado', dias: 141, se_puede_pedir: false } : d)) };
      }
      return RESPUESTAS(metodo, ruta, cuerpo);
    };
    const carga = p.pagina.elegirArea(41);
    p.pagina.cambiarFecha('2026-11-10');
    // La de la fecha anterior contesta durante la espera
    enCamino.forEach((soltar) => soltar());
    await carga;
    await p.esperar();
    const g = () => p.generador();
    assert.equal(g().area, null, 'los datasets de la fecha vieja no se aplican');
    assert.equal(g().cargandoArea, true);
    assert.equal(g().elegidos.size, 0);
    assert.deepEqual(p.vistasPedidas(), [], 'ni se pide una vista previa con la fecha nueva y los ids viejos');
    assert.match(p.el('nt-datasets').innerHTML, /class="spinner"/);
    // Termina la espera: se pide y se aplica la de la fecha nueva
    await p.correr();
    assert.ok(p.rutas('GET').includes('/notas/areas/41?fecha=2026-11-10'));
    assert.equal(g().cargandoArea, false);
    assert.deepEqual([...g().elegidos].sort((a, b) => a - b), [46, 48, 69], 'Tarifas ya no viene tildada');
    assert.deepEqual(p.vistasPedidas().map((v) => [v.cuerpo.fecha, v.cuerpo.datasets]), [['2026-11-10', [46, 48, 69]]]);
  });

  it('si la carga del área se descarta por una fecha que no sirve, "Siguiente" da el error de la fecha (no "cargando"), sin listas ni ruedas eternas', async () => {
    const p = montar();
    await p.iniciar();
    let soltar;
    p.estado.responder = (metodo, ruta, cuerpo) => (ruta.startsWith('/notas/areas/41?')
      ? new Promise((resolver) => { soltar = () => resolver(AREA_41()); })
      : RESPUESTAS(metodo, ruta, cuerpo));
    const carga = p.pagina.elegirArea(41);
    p.pagina.cambiarFecha('2027-06-01');
    soltar();
    await carga;
    await p.esperar();
    const mensaje = 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.';
    assert.equal(p.generador().area, null);
    assert.equal(p.el('nt-datasets').innerHTML, '');
    assert.ok(p.el('nt-mini').innerHTML.includes(`<p class="hoja-mensaje">${mensaje}</p>`));
    p.estado.foco = null;
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 2);
    assert.equal(p.el('nt-fecha-error').textContent, mensaje);
    assert.equal(p.estado.foco, 'nt-fecha');
    assert.equal(p.el('nt-aviso').innerHTML, '', 'sin el aviso de "cargando"');
    // Con una fecha que sirve, se vuelve a pedir
    p.pagina.cambiarFecha('2026-11-10');
    await p.correr();
    assert.ok(p.rutas('GET').includes('/notas/areas/41?fecha=2026-11-10'));
  });

  // Ronda de arreglo 1, punto 2: sin maxlength, el largo lo controla erroresDelPaso2 (Array.from), como el servidor
  it('un número de 41 caracteres da el error del número al tocar "Siguiente"; uno de 40 emoji pasa', async () => {
    const p = montar();
    await p.conArea(41);
    p.pagina.cambiarNumero('x'.repeat(41));
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 2);
    assert.equal(p.el('nt-numero-error').textContent, 'El número de la nota puede tener hasta 40 caracteres.');
    assert.equal(p.el('nt-numero-error').hidden, false);
    assert.equal(p.el('nt-numero').getAttribute('aria-invalid'), 'true');
    assert.equal(p.estado.foco, 'nt-numero');
    p.pagina.cambiarNumero('😀'.repeat(40));
    assert.equal(p.el('nt-numero-error').hidden, true);
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 3);
    await p.esperar();
    assert.equal(p.vistasPedidas().at(-1).cuerpo.numero, '😀'.repeat(40));
  });

  // Ronda de arreglo 1, punto 3
  it('"Siguiente" o "Ver en grande" mientras carga el área: un aviso, sin el error de datasets; se saca al terminar', async () => {
    const p = montar();
    await p.iniciar();
    let soltar;
    p.estado.responder = (metodo, ruta, cuerpo) => (ruta.startsWith('/notas/areas/41?')
      ? new Promise((resolver) => { soltar = () => resolver(AREA_41()); })
      : RESPUESTAS(metodo, ruta, cuerpo));
    const carga = p.pagina.elegirArea(41);
    p.estado.foco = null;
    p.el('nt-siguiente').disparar('click', {});
    assert.equal(p.generador().paso, 2);
    assert.equal(p.el('nt-aviso').innerHTML, '<div class="alert">Todavía se están cargando los datasets del área. Probá de nuevo en un momento.</div>');
    assert.equal(p.el('nt-datasets-error').hidden, true);
    assert.equal(p.el('nt-datasets-error').textContent, '');
    assert.equal(p.estado.foco, null, 'el foco no se mueve');
    p.el('nt-ver-grande').disparar('click', {});
    assert.equal(p.generador().paso, 2);
    soltar();
    await carga;
    await p.esperar();
    assert.equal(p.el('nt-aviso').innerHTML, '', 'al terminar la carga el aviso se va');
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 3);
  });

  it('con un error del área, "Siguiente" deja solo ese error (no "Elegí al menos un dataset."), una sola vez', async () => {
    const p = montar({ responder: (metodo, ruta, cuerpo) => {
      if (ruta.startsWith('/notas/areas/41?')) throw falla(500, 'Error al obtener el área');
      return RESPUESTAS(metodo, ruta, cuerpo);
    } });
    await p.conArea(41);
    assert.equal(p.el('nt-datasets-error').textContent, 'Error al obtener el área');
    assert.equal(p.el('nt-datasets').innerHTML, '', 'la lista no repite el error');
    assert.ok(p.el('nt-mini').innerHTML.includes('<p class="hoja-mensaje">Error al obtener el área</p>'));
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 2);
    assert.equal(p.el('nt-datasets-error').textContent, 'Error al obtener el área');
    assert.equal(p.estado.foco, 'nt-datasets-grupo');
    assert.equal(p.el('nt-aviso').innerHTML, '');
  });

  it('con un 400 del área en la fecha, el error va a la fecha y "Siguiente" no agrega el de datasets', async () => {
    const mensaje = 'La fecha de la nota tiene que estar entre el 01/01/2025 y 30 días después de hoy.';
    const p = montar({ responder: (metodo, ruta, cuerpo) => {
      if (ruta.startsWith('/notas/areas/41?')) throw falla(400, mensaje, 'fecha');
      return RESPUESTAS(metodo, ruta, cuerpo);
    } });
    await p.conArea(41);
    p.pagina.irAlPaso3();
    assert.equal(p.el('nt-fecha-error').textContent, mensaje);
    assert.equal(p.el('nt-fecha').getAttribute('aria-invalid'), 'true');
    assert.equal(p.el('nt-datasets-error').hidden, true);
    assert.equal(p.estado.foco, 'nt-fecha');
  });

  it('un 401 en la vista previa lleva al login', async () => {
    const p = montar({ responder: (metodo, ruta, cuerpo) => {
      if (ruta === '/notas/vista-previa') throw falla(401, 'Token inválido o expirado');
      return RESPUESTAS(metodo, ruta, cuerpo);
    } });
    await p.conArea(41);
    assert.equal(p.ventana.location.href, 'login.html');
  });

  it('"Descargar Word": pedirWord con el pedido y descargarBlob con el nombre de la última vista previa; un 401, al login', async () => {
    const p = montar();
    await p.conArea(41);
    p.pagina.irAlPaso3();
    assert.equal(p.generador().paso, 3);
    assert.equal(p.estado.foco, 'nt-titulo-3');
    assert.equal(p.el('nt-descargar').disabled, false);
    assert.equal(p.el('nt-archivo').textContent, 'Nota externa - 41 - 2026-10-24.docx');
    assert.ok(p.el('nt-grande').innerHTML.includes('<p>Nota sin número</p>'));
    assert.ok(p.el('nt-resumen').innerHTML.includes('<dd>Externa, directo al área · Solicitud</dd>'));
    await p.pagina.descargarWord();
    assert.equal(p.estado.fetch.length, 1);
    const [url, opciones] = p.estado.fetch[0];
    assert.equal(url, '/api/notas/generar');
    assert.deepEqual(JSON.parse(opciones.body), p.vistasPedidas().at(-1).cuerpo);
    assert.deepEqual(p.estado.blobs, ['EL-WORD']);
    assert.equal(p.estado.enlaces.at(-1).download, 'Nota externa - 41 - 2026-10-24.docx');
    assert.equal(p.estado.enlaces.at(-1).clics, 1);
    // Deshabilitado durante el pedido, el botón suelta el foco: si lo tenía, vuelve a tenerlo
    p.pagina.document.activeElement = p.el('nt-descargar');
    p.estado.foco = null;
    await p.pagina.descargarWord();
    assert.equal(p.estado.foco, 'nt-descargar');
    assert.equal(p.el('nt-descargar').disabled, false);

    p.estado.respuestaWord = { ok: false, status: 401, json: async () => ({ success: false, error: 'Token inválido o expirado' }) };
    await p.pagina.descargarWord();
    assert.equal(p.ventana.location.href, 'login.html');
  });

  it('"Descargar Word": un error sin campo, el aviso con el mensaje del servidor', async () => {
    const p = montar();
    await p.conArea(41);
    p.pagina.irAlPaso3();
    p.estado.respuestaWord = { ok: false, status: 500, json: async () => ({ success: false, error: 'Error al generar <la> nota' }) };
    await p.pagina.descargarWord();
    assert.equal(p.el('nt-aviso').innerHTML, '<div class="alert alert-error">Error al generar &lt;la&gt; nota</div>');
    assert.equal(p.generador().paso, 3);
    assert.equal(p.el('nt-descargar').disabled, false);
  });

  it('"Cambiar el área" conserva el filtro y la búsqueda; "Armar otra nota" vuelve al paso 1 sin área, número ni nota anterior', async () => {
    const p = montar();
    await p.iniciar();
    p.pagina.elegirFiltro('todas');
    p.pagina.buscarAreas('coop');
    assert.equal(cuantas(p.el('nt-areas').innerHTML, /class="area-opcion/g), 1);
    await p.pagina.elegirArea(41);
    await p.esperar();
    p.el('nt-cambiar-area').disparar('click', {});
    assert.equal(p.generador().paso, 1);
    assert.equal(p.estado.foco, 'nt-titulo-1');
    assert.deepEqual([p.generador().filtro, p.generador().busqueda], ['todas', 'coop']);
    assert.ok(p.el('nt-areas').innerHTML.includes('class="area-opcion elegida" data-area="41"'));

    await p.pagina.elegirArea(41);
    await p.esperar();
    p.pagina.cambiarNumero('156/26');
    p.pagina.elegirPedido('reiteracion');
    p.el('nt-anterior-nuevo').value = '5/25';
    p.pagina.agregarNotaAnterior();
    p.pagina.irAlPaso3();
    p.pagina.armarOtraNota();
    const g = p.generador();
    assert.deepEqual([g.paso, g.areaId, g.area, g.numero, g.pedido, g.anterioresEditadas, g.elegidos.size], [1, null, null, '', 'solicitud', false, 0]);
    assert.deepEqual(plano(g.anteriores), []);
    assert.equal(p.el('nt-numero').value, '');
    assert.equal(p.estado.foco, 'nt-titulo-1');
    assert.ok(!p.el('nt-areas').innerHTML.includes('elegida'));
  });
});
