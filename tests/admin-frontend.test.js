// Admin (public/js/admin-fechas.js), ejecutado en Node: lo puro que arma la lista, el registro de una actualización y la
// línea del ciclo (spec 2026-10-17-fechas-datasets, sección 8). El script, al cargarse, solo declara.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

// api.js es un script de navegador: se ejecuta en un contexto aislado y se expone el Utils de verdad, para que el escape
// que prueban estos tests sea el que usa la página
const cargarUtils = () => {
  const contexto = vm.createContext({ CONFIG: { API_URL: '/api' }, console });
  vm.runInContext(`${fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8')}\n;globalThis.Utils = Utils;`, contexto);
  return contexto.Utils;
};

// admin-fechas.js se carga sin document, window ni nada del navegador: si tocara el DOM al cargarse, este contexto lo delataría
const cargarAdmin = () => {
  const contexto = vm.createContext({ Utils: cargarUtils(), console });
  vm.runInContext(fs.readFileSync(new URL('../public/js/admin-fechas.js', import.meta.url), 'utf8'), contexto);
  return contexto;
};

const admin = cargarAdmin();
const HOY = '2026-10-17';

// Un dataset como lo devuelve GET /datasets: las fechas de MySQL viajan como ISO con hora (la zona del servidor), las
// nuevas como 'AAAA-MM-DD'
const dataset = (extra = {}) => ({
  id: 10,
  titulo: 'Pauta Publicitaria',
  area_nombre: 'Subsecretaría de Comunicación',
  tipo_gestion: 'externa',
  frecuencia_nombre: 'Trimestralmente',
  frecuencia_meses: 3,
  proxima_actualizacion: '2027-01-31T03:00:00.000Z',
  ultima_actualizacion: '2026-10-13T03:00:00.000Z',
  datos_al: '2026-07-31',
  tipo_pedido: 'acumulado',
  tipo_pedido_nombre: 'Acumulado',
  pedido: { desde: '2026-01-01', hasta: '2026-12-31', texto: 'Del 01/01/2026 al 31/12/2026' },
  estado: 'actualizado',
  dias_para_vencer: 106,
  ...extra
});
const vencido = (extra = {}) => dataset({
  id: 11, titulo: 'Parque Automotor (Patentamiento)', frecuencia_meses: 12, proxima_actualizacion: '2024-01-31T03:00:00.000Z',
  datos_al: '2022-12-31', pedido: { desde: '2023-01-01', hasta: '2025-12-31', texto: 'Del 01/01/2023 al 31/12/2025' },
  estado: 'sin-respuesta', dias_para_vencer: -990, ...extra
});
const eventual = (extra = {}) => dataset({
  id: 66, titulo: 'Barrios de Comodoro Rivadavia', tipo_gestion: 'interna', frecuencia_nombre: 'Eventual', frecuencia_meses: null,
  proxima_actualizacion: null, tipo_pedido: 'eventual', tipo_pedido_nombre: 'Eventual', pedido: null, estado: 'eventual',
  dias_para_vencer: null, ...extra
});
const ejercicio = (extra = {}) => dataset({
  id: 57, titulo: 'Presupuesto con perspectiva de género', frecuencia_meses: 12, datos_al: '2025-12-31', tipo_pedido: 'ejercicio',
  tipo_pedido_nombre: 'Ejercicio que empieza', pedido: { desde: '2026-01-01', hasta: '2027-12-31', texto: 'Presupuestos de los ejercicios 2026 y 2027' },
  ...extra
});

const cantidad = (texto, parte) => texto.split(parte).length - 1;
// Lo que devuelve una función del vm es de otro contexto: deepStrictEqual compara prototipos, así que se pasa a un objeto de acá
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const estadoPlano = (...argumentos) => plano(admin.textoEstado(...argumentos));
const conteoPlano = (...argumentos) => plano(admin.contarPorEstado(...argumentos));

describe('admin-fechas.js: al cargarse solo declara', () => {
  it('se carga sin document ni window y deja las funciones a la vista', () => {
    for (const nombre of ['hoyEnArgentina', 'fechaCorta', 'mesAnio', 'finDeMesDe', 'opcionesDeMes', 'opcionesDeAnio', 'textoEstado',
      'htmlDeFila', 'htmlDeTarjeta', 'htmlDeOpciones', 'htmlDeCiclo', 'puedeProponer', 'contarPorEstado', 'claseDeEstado']) {
      assert.equal(typeof admin[nombre], 'function', nombre);
    }
  });
});

describe('admin-fechas.js: hoyEnArgentina', () => {
  it('a las 22:30 de Argentina todavía es el día de antes en UTC: da el 17, no el 18', () => {
    assert.equal(admin.hoyEnArgentina(new Date('2026-10-18T01:30:00Z')), '2026-10-17');
  });

  it('de las 21:00 a las 23:59 de Argentina sigue siendo el mismo día, y a las 00:00 cambia', () => {
    assert.equal(admin.hoyEnArgentina(new Date('2026-10-18T00:00:00Z')), '2026-10-17');
    assert.equal(admin.hoyEnArgentina(new Date('2026-10-18T02:59:59Z')), '2026-10-17');
    assert.equal(admin.hoyEnArgentina(new Date('2026-10-18T03:00:00Z')), '2026-10-18');
    assert.equal(admin.hoyEnArgentina(new Date('2026-10-17T02:59:59Z')), '2026-10-16');
  });

  it('cruza el fin de año y el 1 de enero con la fecha de Argentina', () => {
    assert.equal(admin.hoyEnArgentina(new Date('2027-01-01T02:00:00Z')), '2026-12-31');
    assert.equal(admin.hoyEnArgentina(new Date('2027-01-01T03:00:00Z')), '2027-01-01');
  });

  it('sin argumento da la fecha de hoy con el formato AAAA-MM-DD', () => {
    assert.match(admin.hoyEnArgentina(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('admin-fechas.js: fechaCorta y mesAnio', () => {
  it('fechaCorta pasa AAAA-MM-DD a dd/mm/aaaa sin corrimiento', () => {
    assert.equal(admin.fechaCorta('2026-12-31'), '31/12/2026');
    assert.equal(admin.fechaCorta('2027-01-01'), '01/01/2027');
  });

  it('fechaCorta corta el texto de una fecha ISO con hora: nunca la pasa por Date', () => {
    assert.equal(admin.fechaCorta('2026-01-31T03:00:00.000Z'), '31/01/2026');
    assert.equal(admin.fechaCorta('2026-12-31T23:30:00.000Z'), '31/12/2026');
    assert.equal(admin.fechaCorta('2026-01-31T00:00:00.000Z'), '31/01/2026');
  });

  it('fechaCorta da una raya cuando no hay fecha o no es una fecha', () => {
    for (const valor of [null, undefined, '', 'basura', '0000-00-00', '2026-13-01', 20260131, {}]) {
      assert.equal(admin.fechaCorta(valor), '—', String(valor));
    }
  });

  it('mesAnio da el mes abreviado y el año', () => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    meses.forEach((mes, i) => assert.equal(admin.mesAnio(`2027-${String(i + 1).padStart(2, '0')}-15`), `${mes} 2027`));
    assert.equal(admin.mesAnio('2027-01-31'), 'ene 2027');
    assert.equal(admin.mesAnio('2024-01-31T03:00:00.000Z'), 'ene 2024');
  });

  it('mesAnio da una raya sin fecha', () => {
    assert.equal(admin.mesAnio(null), '—');
    assert.equal(admin.mesAnio('0000-00-00'), '—');
  });
});

describe('admin-fechas.js: finDeMesDe', () => {
  it('febrero va siempre en 28, también en los años bisiestos', () => {
    assert.equal(admin.finDeMesDe(2028, 2), '2028-02-28');
    assert.equal(admin.finDeMesDe(2027, 2), '2027-02-28');
    assert.equal(admin.finDeMesDe(2100, 2), '2100-02-28');
  });

  it('da el último día de los demás meses', () => {
    assert.equal(admin.finDeMesDe(2026, 1), '2026-01-31');
    assert.equal(admin.finDeMesDe(2026, 4), '2026-04-30');
    assert.equal(admin.finDeMesDe(2026, 12), '2026-12-31');
    assert.equal(admin.finDeMesDe(2026, 11), '2026-11-30');
  });

  it('acepta lo que devuelve un select (texto)', () => {
    assert.equal(admin.finDeMesDe('2026', '10'), '2026-10-31');
  });

  it('con un mes o un año que no sirven da null y no tira error', () => {
    for (const [anio, mes] of [[2026, 0], [2026, 13], [Number.NaN, 1], [2026, null], [undefined, undefined], ['', ''], [2026, 1.5]]) {
      assert.equal(admin.finDeMesDe(anio, mes), null, `${anio}/${mes}`);
    }
  });
});

describe('admin-fechas.js: opciones de los selectores de mes y año', () => {
  it('opcionesDeMes da los doce meses con mayúscula inicial y el valor numérico', () => {
    const html = admin.opcionesDeMes(null);
    assert.equal(cantidad(html, '<option'), 12);
    assert.match(html, /<option value="1">Enero<\/option>/);
    assert.match(html, /<option value="9">Septiembre<\/option>/);
    assert.match(html, /<option value="12">Diciembre<\/option>/);
    assert.doesNotMatch(html, /selected/);
  });

  it('opcionesDeMes marca solo el mes elegido', () => {
    const html = admin.opcionesDeMes(2);
    assert.equal(cantidad(html, 'selected'), 1);
    assert.match(html, /<option value="2" selected>Febrero<\/option>/);
    assert.equal(cantidad(admin.opcionesDeMes('10'), 'selected'), 1);
    assert.match(admin.opcionesDeMes('10'), /<option value="10" selected>Octubre<\/option>/);
  });

  it('opcionesDeAnio va en orden descendente, del año más alto al más bajo', () => {
    const html = admin.opcionesDeAnio(2024, 2027, 2026);
    const anios = [...html.matchAll(/<option value="(\d+)"/g)].map(m => Number(m[1]));
    assert.deepEqual(anios, [2027, 2026, 2025, 2024]);
    assert.equal(cantidad(html, 'selected'), 1);
    assert.match(html, /<option value="2026" selected>2026<\/option>/);
  });

  it('opcionesDeAnio con un solo año, o con el rango al revés, no se rompe', () => {
    assert.equal(cantidad(admin.opcionesDeAnio(2026, 2026, 2026), '<option'), 1);
    assert.equal(admin.opcionesDeAnio(2027, 2024, 2026), '');
  });
});

describe('admin-fechas.js: textoEstado', () => {
  it('actualizado: dice cuándo vence, con el mes y el año', () => {
    assert.deepEqual(estadoPlano('actualizado', 106, '2027-01-31', 'externa', false),
      { clase: 'al-dia', texto: 'Actualizado', detalle: 'Vence en ene 2027' });
  });

  it('la próxima viaja como ISO con hora y se lee por su texto', () => {
    assert.equal(admin.textoEstado('actualizado', 106, '2027-01-31T03:00:00.000Z', 'externa', false).detalle, 'Vence en ene 2027');
  });

  it('próximo a vencer: dice cuántos días faltan', () => {
    assert.deepEqual(estadoPlano('proximo', 44, '2026-11-30', 'externa', false),
      { clase: 'proximo', texto: 'Próximo a vencer', detalle: 'Vence en 44 días' });
    assert.equal(admin.textoEstado('proximo', 1, '2026-10-18', 'externa', false).detalle, 'Vence en 1 día');
    assert.equal(admin.textoEstado('proximo', 0, '2026-10-17', 'externa', false).detalle, 'Vence hoy');
  });

  it('vencido: "Sin respuesta" si la gestión es externa y "Atrasado" si es interna, con el mes en que venció', () => {
    assert.deepEqual(estadoPlano('sin-respuesta', -990, '2024-01-31', 'externa', false),
      { clase: 'vencido', texto: 'Sin respuesta', detalle: 'Venció en ene 2024' });
    assert.deepEqual(estadoPlano('atrasado', -10, '2026-10-07', 'interna', false),
      { clase: 'vencido', texto: 'Atrasado', detalle: 'Venció en oct 2026' });
  });

  it('eventual y sin fecha', () => {
    assert.deepEqual(estadoPlano('eventual', null, null, 'interna', false),
      { clase: 'eventual', texto: 'Eventual', detalle: 'Sin vencimiento' });
    assert.deepEqual(estadoPlano('sin-fecha', null, null, 'externa', false),
      { clase: 'sin-fecha', texto: 'Sin fecha', detalle: 'Sin próxima actualización' });
  });

  it('un cambio pendiente le gana a cualquier otro estado', () => {
    for (const [estado, dias, proxima] of [['actualizado', 106, '2027-01-31'], ['proximo', 44, '2026-11-30'], ['sin-respuesta', -990, '2024-01-31'],
      ['atrasado', -10, '2026-10-07'], ['eventual', null, null], ['sin-fecha', null, null]]) {
      assert.deepEqual(estadoPlano(estado, dias, proxima, 'externa', true),
        { clase: 'pendiente', texto: 'Cambio pendiente', detalle: 'Esperando aprobación' }, estado);
    }
  });

  it('un estado que no conoce no se hace pasar por uno al día', () => {
    assert.equal(admin.textoEstado(undefined, null, null, 'externa', false).clase, 'sin-fecha');
    assert.equal(admin.textoEstado('inventado', 5, '2026-10-22', 'externa', false).clase, 'sin-fecha');
  });

  it('un vencido sin una próxima legible no escribe "Venció en —"', () => {
    assert.equal(admin.textoEstado('sin-respuesta', -5, null, 'externa', false).detalle, 'Vencido');
  });
});

describe('admin-fechas.js: htmlDeFila', () => {
  const fila = (d = dataset(), opciones = {}) => admin.htmlDeFila(d, { pendiente: false, esAdmin: true, hoy: HOY, ...opciones });

  it('es una fila con las cinco columnas de la spec: dataset, estado, datos publicados, próximo pedido y acciones', () => {
    const html = fila();
    assert.match(html, /^<tr[ >]/);
    assert.match(html, /<\/tr>$/);
    assert.equal(cantidad(html, '<td'), 5);
    const orden = ['Pauta Publicitaria', 'Subsecretaría de Comunicación', 'Actualizado', 'Al 31/07/2026', 'Cargado el 13/10/2026',
      'Del 01/01/2026 al 31/12/2026', 'Registrar actualización'].map(t => html.indexOf(t));
    assert.ok(orden.every(i => i >= 0), `falta algún texto: ${orden}`);
    assert.deepEqual([...orden].sort((a, b) => a - b), orden);
  });

  it('escapa el título, el área y todo lo que viene de la base: nada queda como etiqueta', () => {
    const html = fila(dataset({
      titulo: '<b>Hola</b> & "chau"', area_nombre: '<img src=x onerror=alert(1)>', tipo_pedido_nombre: '<i>tipo</i>',
      pedido: { desde: null, hasta: null, texto: '<script>x</script>' }
    }));
    assert.doesNotMatch(html, /<b>|<img|<i>|<script/);
    assert.match(html, /&lt;b&gt;Hola&lt;\/b&gt; &amp; &quot;chau&quot;/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
    assert.match(html, /&lt;i&gt;tipo&lt;\/i&gt;/);
  });

  it('el título escapado también queda a salvo dentro del aria-label de los botones', () => {
    const html = fila(dataset({ titulo: 'Nómina "oficial" <x>' }));
    assert.doesNotMatch(html, /<x>/);
    assert.match(html, /aria-label="Editar Nómina &quot;oficial&quot; &lt;x&gt;"/);
    assert.match(html, /aria-label="Eliminar Nómina &quot;oficial&quot; &lt;x&gt;"/);
  });

  it('un cambio pendiente lleva "Cambio pendiente" y los tres botones deshabilitados, con el motivo', () => {
    const html = fila(vencido(), { pendiente: true });
    assert.match(html, /ad-chip pendiente/);
    assert.match(html, />Cambio pendiente</);
    assert.match(html, /Esperando aprobación/);
    assert.doesNotMatch(html, /Sin respuesta/);
    assert.equal(cantidad(html, '<button'), 3);
    assert.equal(cantidad(html, ' disabled'), 3);
    assert.equal(cantidad(html, 'title="Tiene un cambio pendiente de aprobación"'), 3);
    assert.match(html, /class="bloqueada"/);
  });

  it('sin cambio pendiente los botones están habilitados y la fila no está atenuada', () => {
    const html = fila();
    assert.equal(cantidad(html, '<button'), 3);
    assert.doesNotMatch(html, /disabled/);
    assert.doesNotMatch(html, /bloqueada/);
    assert.doesNotMatch(html, /Tiene un cambio pendiente/);
  });

  it('con esAdmin en false no hay botones, pero la fila sigue teniendo sus cinco columnas', () => {
    const html = fila(dataset(), { esAdmin: false });
    assert.doesNotMatch(html, /<button/);
    assert.doesNotMatch(html, /Registrar actualización/);
    assert.equal(cantidad(html, '<td'), 5);
    assert.match(html, /Pauta Publicitaria/);
  });

  it('los botones usan data-atributos con el id, nunca onclick', () => {
    const html = fila(dataset({ id: 42 }));
    assert.match(html, /data-registrar="42"/);
    assert.match(html, /data-editar="42"/);
    assert.match(html, /data-eliminar="42"/);
    assert.doesNotMatch(html, /onclick/i);
  });

  it('el botón de registrar lleva ícono, el texto en un span "largo" y un aria-label con el título', () => {
    const html = fila();
    assert.match(html, /<button[^>]*data-registrar="10"[^>]*>\s*<svg[\s\S]*?<\/svg><span class="largo">Registrar actualización<\/span><\/button>/);
    assert.match(html, /aria-label="Registrar actualización de Pauta Publicitaria"/);
  });

  it('editar y eliminar son botones de ícono con un aria-label que dice a qué dataset se refieren', () => {
    const html = fila();
    assert.match(html, /<button[^>]*data-editar="10"[^>]*aria-label="Editar Pauta Publicitaria"[^>]*><svg/);
    assert.match(html, /<button[^>]*data-eliminar="10"[^>]*aria-label="Eliminar Pauta Publicitaria"[^>]*><svg/);
    assert.equal(cantidad(html, 'type="button"'), 3);
  });

  it('los íconos son decorativos: no se leen', () => {
    const html = fila();
    assert.equal(cantidad(html, '<svg'), 3);
    assert.equal(cantidad(html, 'aria-hidden="true"'), 3);
  });

  it('un eventual lleva "Eventual", no tiene pedido y no ofrece una fecha de envío', () => {
    const html = fila(eventual());
    assert.match(html, /ad-chip eventual/);
    assert.match(html, />Eventual</);
    assert.match(html, /Sin vencimiento/);
    assert.doesNotMatch(html, /Fecha sugerida/);
    // El pedido es una raya y debajo va el tipo
    assert.match(html, /<span class="ad-fecha">—<\/span><span class="ad-sub">Eventual<\/span>/);
  });

  it('un ejercicio muestra "Ejercicio 2025" y no la fecha', () => {
    const html = fila(ejercicio());
    assert.match(html, /Ejercicio 2025/);
    assert.doesNotMatch(html, /Al 31\/12\/2025/);
    assert.match(html, /Presupuestos de los ejercicios 2026 y 2027/);
  });

  it('datos publicados: "Al" con la fecha y debajo "Cargado el"; sin Datos al, una raya', () => {
    const html = fila();
    assert.match(html, /<span class="ad-fecha">Al 31\/07\/2026<\/span><span class="ad-sub">Cargado el 13\/10\/2026<\/span>/);
    const sinDatos = fila(dataset({ datos_al: null }));
    assert.match(sinDatos, /<span class="ad-fecha">—<\/span><span class="ad-sub">Cargado el 13\/10\/2026<\/span>/);
    assert.doesNotMatch(sinDatos, /Al —/);
  });

  it('un ejercicio sin Datos al muestra una raya, no "Ejercicio —"', () => {
    const html = fila(ejercicio({ datos_al: null }));
    assert.doesNotMatch(html, /Ejercicio —|Ejercicio undefined|Ejercicio null/);
    assert.match(html, /<span class="ad-fecha">—<\/span>/);
  });

  it('sin fecha de carga no escribe "Cargado el —"', () => {
    const html = fila(dataset({ ultima_actualizacion: null }));
    assert.doesNotMatch(html, /Cargado el/);
  });

  it('la fecha de carga se lee por su texto: a las 21 en Argentina no corre al día siguiente', () => {
    assert.match(fila(dataset({ ultima_actualizacion: '2026-10-13T00:00:00.000Z' })), /Cargado el 13\/10\/2026/);
    assert.match(fila(dataset({ ultima_actualizacion: '2026-10-13T23:59:59.000Z' })), /Cargado el 13\/10\/2026/);
  });

  it('próximo pedido: debajo va el tipo y la fecha sugerida de envío cuando la próxima es de hoy en adelante', () => {
    assert.match(fila(), /<span class="ad-sub">Acumulado\. Fecha sugerida de envío: 31\/01\/2027<\/span>/);
    assert.match(fila(dataset({ proxima_actualizacion: '2026-10-17T03:00:00.000Z' })), /Fecha sugerida de envío: 17\/10\/2026/);
  });

  it('próximo pedido: si ya venció no hay fecha sugerida, solo el tipo', () => {
    const html = fila(vencido());
    assert.doesNotMatch(html, /Fecha sugerida/);
    assert.match(html, /<span class="ad-sub">Acumulado<\/span>/);
  });

  it('próximo pedido: el día antes de hoy ya no es sugerida', () => {
    assert.doesNotMatch(fila(dataset({ proxima_actualizacion: '2026-10-16T03:00:00.000Z' })), /Fecha sugerida/);
  });

  it('sin hoy explícito usa la fecha de Argentina (no rompe)', () => {
    const html = admin.htmlDeFila(dataset({ proxima_actualizacion: '2999-01-31T03:00:00.000Z' }), { pendiente: false, esAdmin: true });
    assert.match(html, /Fecha sugerida de envío: 31\/01\/2999/);
  });

  it('el estado se pinta con la pastilla y el renglón de detalle', () => {
    assert.match(fila(), /<span class="ad-chip al-dia">Actualizado<\/span><span class="ad-sub">Vence en ene 2027<\/span>/);
    assert.match(fila(vencido()), /<span class="ad-chip vencido">Sin respuesta<\/span><span class="ad-sub">Venció en ene 2024<\/span>/);
    assert.match(fila(dataset({ estado: 'proximo', dias_para_vencer: 44 })), /<span class="ad-chip proximo">Próximo a vencer<\/span><span class="ad-sub">Vence en 44 días<\/span>/);
    assert.match(fila(dataset({ estado: 'sin-fecha', proxima_actualizacion: null, pedido: null, dias_para_vencer: null })),
      /<span class="ad-chip sin-fecha">Sin fecha<\/span>/);
  });

  it('una gestión interna vencida dice "Atrasado"', () => {
    assert.match(fila(vencido({ tipo_gestion: 'interna', estado: 'atrasado' })), />Atrasado</);
  });

  it('un dataset con datos raros (todo nulo) no rompe ni escribe "undefined" o "null"', () => {
    const html = fila({ id: 1, titulo: 'Raro' });
    assert.doesNotMatch(html, /undefined|null|NaN/);
    assert.match(html, /Raro/);
    assert.equal(cantidad(html, '<td'), 5);
  });
});

describe('admin-fechas.js: htmlDeTarjeta', () => {
  const tarjeta = (d = dataset(), opciones = {}) => admin.htmlDeTarjeta(d, { pendiente: false, esAdmin: true, hoy: HOY, ...opciones });

  it('es una tarjeta con los mismos datos de la fila', () => {
    const html = tarjeta();
    assert.doesNotMatch(html, /<tr|<td/);
    for (const texto of ['Pauta Publicitaria', 'Subsecretaría de Comunicación', 'Actualizado', 'Vence en ene 2027', 'Al 31/07/2026',
      'Cargado el 13/10/2026', 'Del 01/01/2026 al 31/12/2026', 'Acumulado. Fecha sugerida de envío: 31/01/2027']) {
      assert.ok(html.includes(texto), texto);
    }
  });

  it('escapa el título y el área', () => {
    const html = tarjeta(dataset({ titulo: '<b>Hola</b>', area_nombre: '<u>área</u>' }));
    assert.doesNotMatch(html, /<b>|<u>/);
    assert.match(html, /&lt;b&gt;Hola&lt;\/b&gt;/);
  });

  it('un cambio pendiente: pastilla violeta y los tres botones deshabilitados, con el motivo', () => {
    const html = tarjeta(vencido(), { pendiente: true });
    assert.match(html, /ad-chip pendiente/);
    assert.match(html, /bloqueada/);
    assert.equal(cantidad(html, '<button'), 3);
    assert.equal(cantidad(html, ' disabled'), 3);
    assert.equal(cantidad(html, 'title="Tiene un cambio pendiente de aprobación"'), 3);
  });

  it('con esAdmin en false no hay botones', () => {
    assert.doesNotMatch(tarjeta(dataset(), { esAdmin: false }), /<button/);
  });

  it('los botones llevan los mismos data-atributos y aria-label que en la fila', () => {
    const html = tarjeta(dataset({ id: 7 }));
    assert.match(html, /data-registrar="7"/);
    assert.match(html, /data-editar="7"/);
    assert.match(html, /data-eliminar="7"/);
    assert.match(html, /aria-label="Eliminar Pauta Publicitaria"/);
    assert.doesNotMatch(html, /onclick/i);
  });

  it('un eventual y un ejercicio se ven como en la fila', () => {
    assert.match(tarjeta(eventual()), /Eventual/);
    assert.doesNotMatch(tarjeta(eventual()), /Fecha sugerida/);
    assert.match(tarjeta(ejercicio()), /Ejercicio 2025/);
  });
});

describe('admin-fechas.js: htmlDeOpciones', () => {
  const OPCIONES = [
    { fecha: '2027-04-30', motivo: 'Siguiente período', sugerida: true, advertencia: null, pideDespues: 'Del 01/10/2026 al 31/03/2027' },
    { fecha: '2027-01-31', motivo: 'Mantener: se siguen debiendo datos de lo que se pidió', sugerida: false, advertencia: null, pideDespues: 'Del 01/01/2026 al 31/12/2026' },
    { fecha: '2025-01-31', motivo: 'Siguiente período', sugerida: false, advertencia: 'Ya pasó y pediría datos que ya llegaron', pideDespues: null }
  ];

  it('da una tarjeta de radio por opción más "Otra fecha", y ninguna viene elegida', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    assert.equal(cantidad(html, 'type="radio"'), 4);
    assert.equal(cantidad(html, '<label class="ad-opcion"'), 4);
    assert.doesNotMatch(html, /checked/i);
  });

  it('todos los radios comparten el nombre "proxima", con el índice de la opción como valor y "otra" al final', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    assert.equal(cantidad(html, 'name="proxima"'), 4);
    const valores = [...html.matchAll(/type="radio"[^>]*value="([^"]*)"/g)].map(m => m[1]);
    assert.deepEqual(valores, ['0', '1', '2', 'otra']);
  });

  it('cada tarjeta muestra la fecha en dd/mm/aaaa y el motivo', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    for (const texto of ['30/04/2027', '31/01/2027', '31/01/2025', 'Siguiente período', 'Mantener: se siguen debiendo datos de lo que se pidió']) {
      assert.ok(html.includes(texto), texto);
    }
  });

  it('la sugerida lleva la marca "Sugerida" y las demás no', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    assert.equal(cantidad(html, 'Sugerida'), 1);
    const primera = html.split('<label class="ad-opcion"')[1];
    assert.ok(primera.includes('Sugerida'));
  });

  it('la advertencia sale en ámbar y solo en la opción que la trae', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    assert.equal(cantidad(html, 'porque aviso'), 1);
    assert.match(html, /<span class="porque aviso">Atención: ya pasó y pediría datos que ya llegaron\.<\/span>/);
  });

  it('cada tarjeta con pideDespues dice "La nota siguiente va a pedir: …"; sin pideDespues, no', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    assert.equal(cantidad(html, 'La nota siguiente va a pedir:'), 2);
    assert.match(html, /La nota siguiente va a pedir: <b>Del 01\/10\/2026 al 31\/03\/2027<\/b>/);
  });

  it('la última tarjeta es "Otra fecha", con la explicación, y no tiene fecha', () => {
    const html = admin.htmlDeOpciones(OPCIONES);
    const ultima = html.split('<label class="ad-opcion"').pop();
    assert.ok(ultima.includes('Otra fecha'));
    assert.ok(ultima.includes('Elegís el mes y el año'));
    assert.ok(ultima.includes('value="otra"'));
    assert.doesNotMatch(ultima, /\d{2}\/\d{2}\/\d{4}/);
    assert.equal(cantidad(html, 'Otra fecha'), 1);
  });

  it('escapa el motivo, la advertencia y el texto del pedido', () => {
    const html = admin.htmlDeOpciones([{ fecha: '2027-04-30', motivo: '<b>m</b>', sugerida: true, advertencia: '<i>a</i>', pideDespues: '<u>p</u>' }]);
    assert.doesNotMatch(html, /<b>m|<i>a|<u>p/);
    assert.match(html, /&lt;b&gt;m&lt;\/b&gt;/);
    assert.match(html, /&lt;u&gt;p&lt;\/u&gt;/);
  });

  it('sin opciones (o con algo que no es una lista) ofrece solo "Otra fecha" y no tira error', () => {
    for (const valor of [[], undefined, null]) {
      const html = admin.htmlDeOpciones(valor);
      assert.equal(cantidad(html, 'type="radio"'), 1);
      assert.match(html, /value="otra"/);
      assert.doesNotMatch(html, /checked/i);
    }
  });

  it('la fecha de una opción se lee por su texto, sin corrimiento', () => {
    assert.match(admin.htmlDeOpciones([{ fecha: '2027-01-31T03:00:00.000Z', motivo: 'x', sugerida: false }]), /31\/01\/2027/);
  });
});

describe('admin-fechas.js: htmlDeCiclo', () => {
  // Pauta: pide del 01/01/2026 al 31/12/2026, publicado al 31/07/2026, vence el 31/01/2027, hoy es 17/10/2026
  const PAUTA = { datosAl: '2026-07-31', desde: '2026-01-01', hasta: '2026-12-31', proxima: '2027-01-31', hoy: HOY };
  // Todos los porcentajes que salen en el HTML (left y width)
  const porcentajes = (html) => [...html.matchAll(/(?:left|width):([\d.]+)%/g)].map(m => Number(m[1]));

  it('sin desde o sin hasta da solo la pista vacía', () => {
    assert.equal(admin.htmlDeCiclo({ ...PAUTA, desde: null }), '<div class="pista"></div>');
    assert.equal(admin.htmlDeCiclo({ ...PAUTA, hasta: null }), '<div class="pista"></div>');
    assert.equal(admin.htmlDeCiclo({ datosAl: null, desde: null, hasta: null, proxima: null, hoy: HOY }), '<div class="pista"></div>');
    assert.equal(admin.htmlDeCiclo({}), '<div class="pista"></div>');
  });

  it('dibuja la pista, la banda publicada, la banda que falta y las cuatro marcas', () => {
    const html = admin.htmlDeCiclo(PAUTA);
    assert.match(html, /^<div class="pista"><\/div>/);
    assert.equal(cantidad(html, 'class="banda publicado"'), 1);
    assert.equal(cantidad(html, 'class="banda falta"'), 1);
    assert.equal(cantidad(html, 'class="banda llega"'), 0);
    for (const rotulo of ['Publicado', 'Corte pedido', 'Envío sugerido', 'Hoy']) assert.ok(html.includes(`>${rotulo}</div>`), rotulo);
    assert.equal(cantidad(html, 'class="marca'), 4);
  });

  it('las posiciones son porcentajes sobre el rango de meses (con un mes de margen a cada lado)', () => {
    const html = admin.htmlDeCiclo(PAUTA);
    // 15 meses de ancho: enero 2026 a enero 2027 y un mes de margen a cada lado
    assert.match(html, /<div class="banda publicado" style="left:0%;width:53\.33%"><\/div>/);
    assert.match(html, /<div class="banda falta" style="left:53\.33%;width:33\.33%"><\/div>/);
    assert.match(html, /<div class="marca" style="left:53\.33%"><\/div><div class="etiqueta abajo" style="left:53\.33%;transform:none">Publicado<\/div>/);
    assert.match(html, /<div class="marca" style="left:86\.67%"><\/div><div class="etiqueta abajo" style="left:86\.67%;transform:translateX\(-100%\)">Corte pedido<\/div>/);
    assert.match(html, /<div class="marca" style="left:93\.33%"><\/div><div class="etiqueta arriba" style="left:93\.33%;transform:translateX\(-100%\)">Envío sugerido<\/div>/);
    assert.match(html, /<div class="marca hoy" style="left:70\.32%"><\/div><div class="etiqueta hoy" style="left:70\.32%">Hoy<\/div>/);
  });

  it('con datosNuevo agrega la banda verde, desde lo publicado hasta lo que llega', () => {
    const html = admin.htmlDeCiclo({ ...PAUTA, datosNuevo: '2026-09-30' });
    assert.match(html, /<div class="banda llega" style="left:53\.33%;width:13\.33%"><\/div>/);
  });

  it('si lo que llega no pasa de lo ya publicado, no hay banda verde', () => {
    assert.equal(cantidad(admin.htmlDeCiclo({ ...PAUTA, datosNuevo: '2026-07-31' }), 'banda llega'), 0);
    assert.equal(cantidad(admin.htmlDeCiclo({ ...PAUTA, datosNuevo: '2026-03-31' }), 'banda llega'), 0);
    assert.equal(cantidad(admin.htmlDeCiclo({ ...PAUTA, datosNuevo: null }), 'banda llega'), 0);
  });

  it('si ya venció no hay "Envío sugerido": el día de hoy sí cuenta como de hoy en adelante', () => {
    const vencida = admin.htmlDeCiclo({ datosAl: '2022-12-31', desde: '2023-01-01', hasta: '2025-12-31', proxima: '2024-01-31', hoy: HOY });
    assert.doesNotMatch(vencida, /Envío sugerido/);
    for (const rotulo of ['Publicado', 'Corte pedido', 'Hoy']) assert.ok(vencida.includes(`>${rotulo}</div>`), rotulo);
    assert.match(admin.htmlDeCiclo({ ...PAUTA, proxima: HOY }), /Envío sugerido/);
    assert.doesNotMatch(admin.htmlDeCiclo({ ...PAUTA, proxima: '2026-10-16' }), /Envío sugerido/);
  });

  it('lee las fechas por su texto, también si viajan como ISO con hora', () => {
    const conHora = admin.htmlDeCiclo({ ...PAUTA, proxima: '2027-01-31T03:00:00.000Z', datosAl: '2026-07-31T03:00:00.000Z' });
    assert.equal(conHora, admin.htmlDeCiclo(PAUTA));
  });

  it('todas las posiciones quedan dentro de la pista, también cuando el pedido va más allá de la próxima (ejercicio)', () => {
    const casos = [
      PAUTA,
      { ...PAUTA, datosNuevo: '2026-09-30' },
      // Ejercicio: pide hasta el 31/12/2027 y la próxima es el 31/01/2027
      { datosAl: '2025-12-31', desde: '2026-01-01', hasta: '2027-12-31', proxima: '2027-01-31', hoy: HOY, datosNuevo: '2026-12-31' },
      // Vencido hace años, con datos nuevos más nuevos que el pedido
      { datosAl: '2022-12-31', desde: '2023-01-01', hasta: '2025-12-31', proxima: '2024-01-31', hoy: HOY, datosNuevo: '2026-09-30' },
      // Los datos ya publicados son posteriores al pedido
      { datosAl: '2027-03-31', desde: '2026-01-01', hasta: '2026-12-31', proxima: '2027-01-31', hoy: HOY },
      // Una foto: el desde y el hasta son el mismo día
      { datosAl: '2025-12-31', desde: '2026-06-30', hasta: '2026-06-30', proxima: '2026-07-31', hoy: HOY, datosNuevo: '2026-06-30' },
      // Sin Datos al
      { datosAl: null, desde: '2026-01-01', hasta: '2026-12-31', proxima: '2027-01-31', hoy: HOY }
    ];
    for (const caso of casos) {
      const html = admin.htmlDeCiclo(caso);
      assert.doesNotMatch(html, /NaN|undefined|null|Infinity|:-\d/, JSON.stringify(caso));
      for (const n of porcentajes(html)) assert.ok(n >= 0 && n <= 100, `${n} fuera de la pista en ${JSON.stringify(caso)}`);
      // Cada banda cabe entera en la pista
      for (const m of html.matchAll(/class="banda [^"]*" style="left:([\d.]+)%;width:([\d.]+)%"/g)) {
        assert.ok(Number(m[1]) + Number(m[2]) <= 100.01, `la banda se pasa de la pista en ${JSON.stringify(caso)}`);
      }
    }
  });

  it('sin Datos al no hay banda publicada, pero sí la que falta', () => {
    const html = admin.htmlDeCiclo({ ...PAUTA, datosAl: null });
    assert.equal(cantidad(html, 'banda publicado'), 0);
    assert.equal(cantidad(html, 'banda falta'), 1);
    assert.doesNotMatch(html, />Publicado</);
  });

  it('si lo publicado ya cubre todo el pedido, la banda que falta no tiene ancho negativo', () => {
    const html = admin.htmlDeCiclo({ datosAl: '2027-03-31', desde: '2026-01-01', hasta: '2026-12-31', proxima: '2027-01-31', hoy: HOY });
    assert.doesNotMatch(html, /width:-/);
  });

  it('con fechas que no son fechas no rompe: da la pista vacía', () => {
    assert.equal(admin.htmlDeCiclo({ ...PAUTA, desde: 'basura' }), '<div class="pista"></div>');
    assert.equal(admin.htmlDeCiclo({ ...PAUTA, hasta: '0000-00-00' }), '<div class="pista"></div>');
  });
});

describe('admin-fechas.js: puedeProponer', () => {
  it('sin una opción elegida da false', () => {
    for (const opcionElegida of [undefined, null, '']) {
      assert.equal(admin.puedeProponer({ opcionElegida, errores: [], enviando: false }), false, String(opcionElegida));
    }
  });

  it('con errores da false', () => {
    assert.equal(admin.puedeProponer({ opcionElegida: 0, errores: ['Todavía no puede haber datos al 30/11/2026.'], enviando: false }), false);
    assert.equal(admin.puedeProponer({ opcionElegida: 0, errores: { datosAl: 'Todavía no puede haber datos.' }, enviando: false }), false);
  });

  it('mientras envía da false: el doble clic no manda dos propuestas', () => {
    assert.equal(admin.puedeProponer({ opcionElegida: 0, errores: [], enviando: true }), false);
  });

  it('con una opción elegida, sin errores y sin enviar da true; la opción 0 también cuenta', () => {
    assert.equal(admin.puedeProponer({ opcionElegida: 0, errores: [], enviando: false }), true);
    assert.equal(admin.puedeProponer({ opcionElegida: 2, errores: [], enviando: false }), true);
    assert.equal(admin.puedeProponer({ opcionElegida: 'otra', errores: [], enviando: false }), true);
    assert.equal(admin.puedeProponer({ opcionElegida: { fecha: '2027-04-30' }, errores: [], enviando: false }), true);
  });

  it('los errores pueden faltar o venir vacíos', () => {
    assert.equal(admin.puedeProponer({ opcionElegida: 1, enviando: false }), true);
    assert.equal(admin.puedeProponer({ opcionElegida: 1, errores: {}, enviando: false }), true);
    assert.equal(admin.puedeProponer({ opcionElegida: 1, errores: { datosAl: null }, enviando: false }), true);
  });

  it('un dataset sin paso de próxima (eventual) no necesita opción, pero los errores y el envío siguen frenando', () => {
    assert.equal(admin.puedeProponer({ opcionElegida: null, requiereOpcion: false, errores: [], enviando: false }), true);
    assert.equal(admin.puedeProponer({ opcionElegida: null, requiereOpcion: false, errores: ['x'], enviando: false }), false);
    assert.equal(admin.puedeProponer({ opcionElegida: null, requiereOpcion: false, errores: [], enviando: true }), false);
  });

  it('sin argumentos da false y no tira error', () => {
    assert.equal(admin.puedeProponer(), false);
    assert.equal(admin.puedeProponer({}), false);
  });
});

describe('admin-fechas.js: claseDeEstado y contarPorEstado', () => {
  const LISTA = [
    dataset({ id: 1 }),
    dataset({ id: 2, estado: 'actualizado' }),
    dataset({ id: 3, estado: 'proximo', dias_para_vencer: 44 }),
    vencido({ id: 4 }),
    vencido({ id: 5, tipo_gestion: 'interna', estado: 'atrasado' }),
    eventual({ id: 6 }),
    eventual({ id: 7 }),
    eventual({ id: 8 }),
    dataset({ id: 9, estado: 'sin-fecha', proxima_actualizacion: null, pedido: null, dias_para_vencer: null })
  ];

  it('claseDeEstado dice en qué filtro cae un dataset, y un cambio pendiente le gana al estado', () => {
    assert.equal(admin.claseDeEstado(dataset(), false), 'al-dia');
    assert.equal(admin.claseDeEstado(vencido(), false), 'vencido');
    assert.equal(admin.claseDeEstado(vencido({ estado: 'atrasado', tipo_gestion: 'interna' }), false), 'vencido');
    assert.equal(admin.claseDeEstado(dataset({ estado: 'proximo', dias_para_vencer: 3 }), false), 'proximo');
    assert.equal(admin.claseDeEstado(eventual(), false), 'eventual');
    assert.equal(admin.claseDeEstado(vencido(), true), 'pendiente');
  });

  it('cuenta cada dataset una sola vez, en el estado con que se muestra', () => {
    const cuentas = conteoPlano(LISTA, []);
    assert.deepEqual(cuentas, { todos: 9, vencido: 2, proximo: 1, 'al-dia': 2, eventual: 3, pendiente: 0, 'sin-fecha': 1 });
  });

  it('un dataset con cambio pendiente cuenta como pendiente y deja de contar en su estado', () => {
    const cuentas = conteoPlano(LISTA, [4, 6]);
    assert.deepEqual(cuentas, { todos: 9, vencido: 1, proximo: 1, 'al-dia': 2, eventual: 2, pendiente: 2, 'sin-fecha': 1 });
  });

  it('los ids de los pendientes pueden venir como número, como texto o en un Set', () => {
    assert.equal(admin.contarPorEstado(LISTA, ['4']).pendiente, 1);
    assert.equal(admin.contarPorEstado(LISTA, new Set([4, 5])).pendiente, 2);
  });

  it('un pendiente que no está en la lista no suma', () => {
    const cuentas = admin.contarPorEstado(LISTA, [999]);
    assert.equal(cuentas.pendiente, 0);
    assert.equal(cuentas.todos, 9);
  });

  it('las categorías suman el total', () => {
    const cuentas = admin.contarPorEstado(LISTA, [2, 5]);
    assert.equal(cuentas.vencido + cuentas.proximo + cuentas['al-dia'] + cuentas.eventual + cuentas.pendiente + cuentas['sin-fecha'], cuentas.todos);
  });

  it('con una lista vacía, o sin lista, da todo en cero', () => {
    const ceros = { todos: 0, vencido: 0, proximo: 0, 'al-dia': 0, eventual: 0, pendiente: 0, 'sin-fecha': 0 };
    assert.deepEqual(conteoPlano([], []), ceros);
    assert.deepEqual(conteoPlano(), ceros);
    assert.deepEqual(conteoPlano(undefined, undefined), ceros);
  });
});
