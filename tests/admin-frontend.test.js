// Admin (public/js/admin-fechas.js y public/js/admin.js), ejecutado en Node: lo puro que arma la lista, el registro de una
// actualización y la línea del ciclo (spec 2026-10-17-fechas-datasets, sección 8). Los dos scripts, al cargarse, solo declaran.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

  // La zona de la máquina que corre los tests no tiene que importar. Cada caso corre en un proceso aparte con TZ fija, y con
  // instantes en que la fecha local de esa zona es otra que la de Argentina: una cuenta con la hora local daría mal
  it('da la fecha de Argentina con cualquier zona horaria en la máquina (TZ fija en un proceso aparte)', () => {
    const CASOS = [
      // [zona, minutos de diferencia con UTC en ese instante (getTimezoneOffset), instante, fecha local en esa zona (lo que
      // daría una cuenta con la hora local), fecha de Argentina]
      ['Asia/Tokyo', -540, '2026-10-17T16:00:00Z', '2026-10-18', '2026-10-17'],
      ['Pacific/Kiritimati', -840, '2026-12-31T12:00:00Z', '2027-01-01', '2026-12-31'],
      ['America/Los_Angeles', 420, '2026-10-17T05:00:00Z', '2026-10-16', '2026-10-17'],
      ['UTC', 0, '2026-10-18T01:30:00Z', '2026-10-18', '2026-10-17'],
      ['America/Argentina/Buenos_Aires', 180, '2026-10-18T02:59:59Z', '2026-10-17', '2026-10-17']
    ];
    const archivo = fileURLToPath(new URL('../public/js/admin-fechas.js', import.meta.url));
    const programa = `
      const fs = require('fs'); const vm = require('vm');
      const contexto = vm.createContext({ console });
      vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), contexto);
      const instante = new Date(process.argv[2]);
      const dos = (n) => String(n).padStart(2, '0');
      process.stdout.write(JSON.stringify({
        diferencia: instante.getTimezoneOffset(),
        local: instante.getFullYear() + '-' + dos(instante.getMonth() + 1) + '-' + dos(instante.getDate()),
        argentina: contexto.hoyEnArgentina(instante)
      }));`;
    for (const [zona, diferencia, instante, local, argentina] of CASOS) {
      // Con -e, process.argv[1] es el primer argumento que sigue al programa
      const corrida = spawnSync(process.execPath, ['-e', programa, archivo, instante], {
        env: { ...process.env, TZ: zona }, encoding: 'utf8'
      });
      assert.equal(corrida.status, 0, corrida.stderr);
      const resultado = JSON.parse(corrida.stdout);
      // La zona se aplicó de verdad, y en ese instante la fecha local es otra (salvo en Argentina): el caso prueba algo
      assert.equal(resultado.diferencia, diferencia, `la zona ${zona} no se aplicó`);
      assert.equal(resultado.local, local, `${zona}: fecha local`);
      assert.equal(resultado.argentina, argentina, `${zona}, ${instante}`);
    }
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

  it('un día que no existe no es una fecha: 31/02, 29/02 de un año que no es bisiesto, 31/04', () => {
    for (const valor of ['2026-02-31', '2026-02-30', '2026-02-29', '2100-02-29', '2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31',
      '2026-04-31T03:00:00.000Z', '2026-01-32', '2026-01-00']) {
      assert.equal(admin.soloFecha(valor), null, valor);
      assert.equal(admin.fechaCorta(valor), '—', valor);
      assert.equal(admin.mesAnio(valor), '—', valor);
    }
  });

  it('los días que existen siguen siendo fechas, también el 29/02 de un año bisiesto', () => {
    for (const [valor, corta] of [['2028-02-29', '29/02/2028'], ['2000-02-29', '29/02/2000'], ['2026-02-28', '28/02/2026'], ['2026-04-30', '30/04/2026'],
      ['2026-01-31', '31/01/2026'], ['2026-12-31T03:00:00.000Z', '31/12/2026'], ['2026-03-01', '01/03/2026']]) {
      assert.equal(admin.fechaCorta(valor), corta, valor);
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

  // Si el año elegido quedara afuera, el select mostraría otro y, al guardar, la fecha vieja cambiaría sin que nadie la toque
  const anios = (html) => [...html.matchAll(/<option value="(\d+)"/g)].map(m => Number(m[1]));
  it('opcionesDeAnio amplía el rango hacia atrás para incluir un año elegido anterior a "desde"', () => {
    const html = admin.opcionesDeAnio(2015, 2027, 2012);
    assert.deepEqual(anios(html), Array.from({ length: 16 }, (_, i) => 2027 - i));
    assert.equal(cantidad(html, 'selected'), 1);
    assert.match(html, /<option value="2012" selected>2012<\/option>$/);
  });

  it('opcionesDeAnio amplía el rango hacia adelante para incluir un año elegido posterior a "hasta"', () => {
    const html = admin.opcionesDeAnio(2024, 2027, '2031');
    assert.deepEqual(anios(html), [2031, 2030, 2029, 2028, 2027, 2026, 2025, 2024]);
    assert.match(html, /^<option value="2031" selected>2031<\/option>/);
    assert.equal(cantidad(html, 'selected'), 1);
  });

  it('opcionesDeAnio no amplía el rango sin un año elegido, o con uno que no es un año', () => {
    for (const elegido of [null, undefined, '', 'basura', 0, 99999]) {
      assert.deepEqual(anios(admin.opcionesDeAnio(2024, 2027, elegido)), [2027, 2026, 2025, 2024], String(elegido));
    }
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
    assert.match(html, /aria-label="Registrar actualización de Nómina &quot;oficial&quot; &lt;x&gt;"/);
    assert.match(html, /aria-label="Editar Nómina &quot;oficial&quot; &lt;x&gt;"/);
    assert.match(html, /aria-label="Eliminar Nómina &quot;oficial&quot; &lt;x&gt;"/);
  });

  it('un id hostil queda escapado dentro de los data-atributos: no abre otro atributo', () => {
    for (const armar of [fila, (d) => admin.htmlDeTarjeta(d, { pendiente: false, esAdmin: true, hoy: HOY })]) {
      const html = armar(dataset({ id: '7" onmouseover="alert(1)' }));
      assert.doesNotMatch(html, /" onmouseover="/);
      for (const atributo of ['data-registrar', 'data-editar', 'data-eliminar']) {
        assert.match(html, new RegExp(`${atributo}="7&quot; onmouseover=&quot;alert\\(1\\)"`), atributo);
      }
    }
  });

  it('sin opciones, o con null, no tira error: sin botones y con hoy de Argentina', () => {
    for (const opciones of [null, undefined]) {
      const html = admin.htmlDeFila(dataset(), opciones);
      assert.equal(cantidad(html, '<td'), 5);
      assert.doesNotMatch(html, /<button/);
      assert.doesNotMatch(html, /bloqueada/);
      assert.doesNotMatch(admin.htmlDeTarjeta(dataset(), opciones), /<button/);
    }
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
    assert.match(html, /<span class="ad-pedido-texto">—<\/span><span class="ad-sub">Eventual<\/span>/);
  });

  it('el texto del pedido no va con la clase de las fechas (que no se parten): un pedido largo puede ocupar dos renglones', () => {
    const html = fila(ejercicio());
    assert.match(html, /<span class="ad-pedido-texto">Presupuestos de los ejercicios 2026 y 2027<\/span>/);
    assert.doesNotMatch(html, /<span class="ad-fecha">Presupuestos/);
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

  // Ruling 15: la tarjeta (<article>) tiene nombre accesible, el título del dataset
  it('la tarjeta se nombra con su título: aria-labelledby apunta al id del título', () => {
    const html = tarjeta(dataset({ id: 10 }));
    const id = html.match(/^<article class="ad-tarjeta" aria-labelledby="([^"]+)">/)?.[1];
    assert.ok(id, 'la tarjeta lleva aria-labelledby');
    assert.match(html, new RegExp(`<span class="ad-titulo" id="${id}">Pauta Publicitaria</span>`));
    assert.equal(cantidad(html, `id="${id}"`), 1);
  });

  it('el id del título es distinto para cada dataset, también si la tarjeta está bloqueada', () => {
    const id = (html) => html.match(/aria-labelledby="([^"]+)"/)[1];
    assert.notEqual(id(tarjeta(dataset({ id: 10 }))), id(tarjeta(dataset({ id: 11 }))));
    assert.match(tarjeta(vencido(), { pendiente: true }), /^<article class="ad-tarjeta bloqueada" aria-labelledby="[^"]+">/);
  });

  it('con un id hostil, el id del título solo lleva letras, números, guiones y guiones bajos', () => {
    const html = tarjeta(dataset({ id: '7" onmouseover="alert(1) x' }));
    const id = html.match(/aria-labelledby="([^"]*)"/)[1];
    assert.match(id, /^[\w-]+$/);
    assert.doesNotMatch(html, /" onmouseover="/);
    assert.match(html, new RegExp(`<span class="ad-titulo" id="${id}">`));
  });

  it('la fila de la tabla no lleva ese id: en la página están la fila y la tarjeta del mismo dataset', () => {
    assert.doesNotMatch(admin.htmlDeFila(dataset(), { esAdmin: true, hoy: HOY }), /\sid="/);
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

// =====================================================
// admin.js: la lista (spec 2026-10-17-fechas-datasets, 8.2 y 8.6)
// =====================================================

// admin.js se carga después de admin-fechas.js, en el mismo contexto, como en la página. El document solo deja registrar
// oyentes: si admin.js buscara un elemento al cargarse (como hacía con el submit del formulario), el test lo delataría. Auth,
// API y window no están: tocarlos al cargarse también tiraría error
const cargarAdminJs = () => {
  const oyentes = {};
  const prohibido = (que) => () => { throw new Error(`admin.js usó document.${que} al cargarse`); };
  const contexto = vm.createContext({
    Utils: cargarUtils(),
    console,
    document: {
      addEventListener: (tipo, funcion) => { (oyentes[tipo] ??= []).push(funcion); },
      getElementById: prohibido('getElementById'),
      querySelector: prohibido('querySelector'),
      querySelectorAll: prohibido('querySelectorAll')
    }
  });
  for (const archivo of ['admin-fechas.js', 'admin.js']) {
    vm.runInContext(fs.readFileSync(new URL(`../public/js/${archivo}`, import.meta.url), 'utf8'), contexto, { filename: archivo });
  }
  return { contexto, oyentes };
};

const CODIGO_ADMIN = fs.readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
const PAGINA_ADMIN = fs.readFileSync(new URL('../public/admin.html', import.meta.url), 'utf8');

describe('admin.js: al cargarse solo declara', () => {
  it('se carga después de admin-fechas.js sin tocar el DOM y sin redeclarar sus nombres', () => {
    const { oyentes } = cargarAdminJs();
    // Lo único que hace al cargarse es esperar a la página
    assert.deepEqual(Object.keys(oyentes), ['DOMContentLoaded']);
    assert.equal(oyentes.DOMContentLoaded.length, 1);
  });

  it('el estado de la lista arranca sin filtros, sin búsqueda y en la primera página', () => {
    const { contexto } = cargarAdminJs();
    assert.deepEqual(plano(vm.runInContext('estadoDeLista', contexto)), { filtro: '', busqueda: '', gestion: '', tipo: '', pagina: 1 });
  });

  it('el submit del formulario se registra en DOMContentLoaded, no al cargarse', () => {
    assert.match(CODIGO_ADMIN, /getElementById\('dataset-form'\)\.addEventListener\('submit'/);
    // Fuera de cualquier función no queda ninguna búsqueda de elementos (cada renglón que empieza en la columna 0)
    for (const renglon of CODIGO_ADMIN.split(/\r?\n/).filter((r) => /^document\./.test(r))) {
      assert.match(renglon, /^document\.addEventListener\('DOMContentLoaded'/, renglon);
    }
  });

  it('ya no están calcularProximaPropuesta ni la fecha en UTC', () => {
    const { contexto } = cargarAdminJs();
    assert.equal(typeof contexto.calcularProximaPropuesta, 'undefined');
    assert.doesNotMatch(CODIGO_ADMIN, /calcularProximaPropuesta|toISOString/);
  });

  it('los avisos van con showToast: nada de Utils.showSuccess (sin estilo) ni Utils.showError (detrás del velo)', () => {
    assert.doesNotMatch(CODIGO_ADMIN, /Utils\.showSuccess|Utils\.showError/);
    assert.match(CODIGO_ADMIN, /showToast\(/);
  });

  it('el bloqueo no depende de pointer-events: los botones van disabled y se verifica antes de abrir', () => {
    assert.doesNotMatch(CODIGO_ADMIN, /pointer-events/);
    // marcarActualizado(id, origen): origen es el botón que abrió la ventana (al cerrarla, el foco vuelve a él)
    const registrar = CODIGO_ADMIN.match(/function marcarActualizado\(id[^)]*\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    assert.match(registrar, /datasetEstaBloqueado\(id\)/, 'marcarActualizado verifica el bloqueo');
  });
});

describe('admin.js: filtros de la barra', () => {
  const { contexto: a } = cargarAdminJs();
  const LISTA = [
    dataset({ id: 1 }),
    vencido({ id: 2, area_nombre: 'Dirección de Información Tributaria' }),
    vencido({ id: 3, titulo: 'Espacios Verdes', area_nombre: 'Dirección General de Parques y Paseos', tipo_gestion: 'interna', estado: 'atrasado',
      tipo_pedido: 'relevamiento', tipo_pedido_nombre: 'Relevamiento interno' }),
    eventual({ id: 4 }),
    ejercicio({ id: 5, area_nombre: 'Secretaría de la Mujer, Género y Diversidad', estado: 'proximo', dias_para_vencer: 44 }),
    dataset({ id: 6, titulo: 'Sin próxima', estado: 'sin-fecha', proxima_actualizacion: null, pedido: null, dias_para_vencer: null })
  ];
  const ids = (lista) => Array.from(lista, (d) => d.id);
  const porBarra = (filtros) => ids(a.filtrarPorBarra(LISTA, filtros));

  it('busca en el título y en el área, sin distinguir mayúsculas ni tildes', () => {
    assert.deepEqual(porBarra({ busqueda: 'pauta' }), [1]);
    assert.deepEqual(porBarra({ busqueda: 'PAUTA' }), [1]);
    // El 1, el 4 y el 6 son de la Subsecretaría de Comunicación (el área de los datos de ejemplo)
    assert.deepEqual(porBarra({ busqueda: 'subsecretaria de comunicacion' }), [1, 4, 6]);
    assert.deepEqual(porBarra({ busqueda: 'genero' }), [5]);
    assert.deepEqual(porBarra({ busqueda: 'Tributaria' }), [2]);
  });

  it('sin búsqueda, o con espacios, da todos', () => {
    assert.deepEqual(porBarra({}), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(porBarra({ busqueda: '   ' }), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(ids(a.filtrarPorBarra(LISTA)), [1, 2, 3, 4, 5, 6]);
  });

  it('filtra por gestión y por tipo de pedido, y combina los tres', () => {
    assert.deepEqual(porBarra({ gestion: 'interna' }), [3, 4]);
    assert.deepEqual(porBarra({ gestion: 'externa' }), [1, 2, 5, 6]);
    assert.deepEqual(porBarra({ tipo: 'eventual' }), [4]);
    assert.deepEqual(porBarra({ tipo: 'ejercicio' }), [5]);
    assert.deepEqual(porBarra({ busqueda: 'dirección', gestion: 'interna' }), [3]);
    assert.deepEqual(porBarra({ busqueda: 'dirección', gestion: 'externa', tipo: 'acumulado' }), [2]);
  });

  it('sin lista da una lista vacía y no tira error', () => {
    assert.deepEqual(ids(a.filtrarPorBarra(null, { busqueda: 'x' })), []);
    assert.deepEqual(ids(a.filtrarPorBarra([{ id: 9 }], { busqueda: 'x' })), []);
    assert.deepEqual(ids(a.filtrarPorBarra([{ id: 9 }], {})), [9]);
  });
});

describe('admin.js: vista de la lista (contadores, filtro de estado y páginas)', () => {
  const { contexto: a } = cargarAdminJs();
  const LISTA = [
    dataset({ id: 1 }),
    vencido({ id: 2 }),
    vencido({ id: 3, tipo_gestion: 'interna', estado: 'atrasado' }),
    eventual({ id: 4 }),
    dataset({ id: 5, estado: 'proximo', dias_para_vencer: 44 }),
    dataset({ id: 6, estado: 'sin-fecha', proxima_actualizacion: null, pedido: null, dias_para_vencer: null })
  ];
  const SIN_FILTROS = { filtro: '', busqueda: '', gestion: '', tipo: '', pagina: 1 };
  const vista = (estado, pendientes = []) => a.vistaDeLista(LISTA, { ...SIN_FILTROS, ...estado }, pendientes);
  const ids = (v) => Array.from(v.items, (d) => d.id);

  it('cuenta cada estado y "Todos" es el total', () => {
    assert.deepEqual(plano(vista({}).cuentas), { todos: 6, vencido: 2, proximo: 1, 'al-dia': 1, eventual: 1, pendiente: 0, 'sin-fecha': 1 });
    assert.deepEqual(ids(vista({})), [1, 2, 3, 4, 5, 6]);
  });

  it('el filtro de estado deja los de ese estado', () => {
    assert.deepEqual(ids(vista({ filtro: 'vencido' })), [2, 3]);
    assert.deepEqual(ids(vista({ filtro: 'al-dia' })), [1]);
    assert.deepEqual(ids(vista({ filtro: 'eventual' })), [4]);
    assert.deepEqual(ids(vista({ filtro: 'sin-fecha' })), [6]);
  });

  it('un dataset con cambio pendiente cuenta y se filtra solo como pendiente (Ruling 14)', () => {
    const v = vista({ filtro: 'vencido' }, [2]);
    assert.deepEqual(ids(v), [3]);
    assert.equal(v.cuentas.pendiente, 1);
    assert.equal(v.cuentas.vencido, 1);
    assert.deepEqual(ids(vista({ filtro: 'pendiente' }, ['2', 4])), [2, 4]);
    const c = vista({}, new Set([2, 4])).cuentas;
    assert.equal(c.vencido + c.proximo + c['al-dia'] + c.eventual + c.pendiente + c['sin-fecha'], c.todos);
  });

  it('los contadores cuentan lo que dejan la búsqueda, la gestión y el tipo, sin el filtro de estado', () => {
    const v = vista({ gestion: 'interna', filtro: 'eventual' });
    assert.deepEqual(plano(v.cuentas), { todos: 2, vencido: 1, proximo: 0, 'al-dia': 0, eventual: 1, pendiente: 0, 'sin-fecha': 0 });
    assert.deepEqual(ids(v), [4]);
  });

  it('25 por página; una página que ya no existe pasa a la última', () => {
    const muchos = Array.from({ length: 60 }, (_, i) => dataset({ id: i + 1 }));
    const de = (pagina) => a.vistaDeLista(muchos, { ...SIN_FILTROS, pagina }, []);
    assert.equal(de(1).items.length, 25);
    assert.deepEqual([de(1).desde, de(1).hasta, de(1).total, de(1).totalPaginas], [1, 25, 60, 3]);
    assert.deepEqual([de(2).desde, de(2).hasta], [26, 50]);
    assert.equal(de(3).items.length, 10);
    assert.equal(de(3).items[0].id, 51);
    assert.equal(de(9).pagina, 3);
    assert.equal(de(0).pagina, 1);
  });

  it('paginar una lista vacía da una sola página, sin filas', () => {
    assert.deepEqual(plano(a.paginar([], 4)), { total: 0, pagina: 1, totalPaginas: 1, desde: 0, hasta: 0, items: [] });
  });
});

describe('admin.js: pie de la lista (resumen y páginas)', () => {
  const { contexto: a } = cargarAdminJs();

  it('el resumen dice cuántos datasets hay y, con varias páginas, cuáles se muestran', () => {
    assert.equal(a.textoDelResumen({ total: 0, desde: 0, hasta: 0, totalPaginas: 1 }), '0 datasets');
    assert.equal(a.textoDelResumen({ total: 1, desde: 1, hasta: 1, totalPaginas: 1 }), '1 dataset');
    assert.equal(a.textoDelResumen({ total: 13, desde: 1, hasta: 13, totalPaginas: 1 }), '13 datasets');
    assert.equal(a.textoDelResumen({ total: 60, desde: 26, hasta: 50, totalPaginas: 3 }), 'Mostrando 26–50 de 60 datasets');
  });

  it('con una sola página no hay botones', () => {
    assert.equal(a.htmlDeControlesDePagina({ pagina: 1, totalPaginas: 1 }), '');
  });

  it('"Pág." con tilde, Anterior y Siguiente con data-pagina, deshabilitados en las puntas y sin onclick', () => {
    const primera = a.htmlDeControlesDePagina({ pagina: 1, totalPaginas: 3 });
    assert.match(primera, /<span class="pag-pagina">Pág\. 1 de 3<\/span>/);
    assert.doesNotMatch(primera, /Pag\./);
    assert.match(primera, /<button type="button" class="pag-btn" data-pagina="0" data-direccion="anterior" disabled>/);
    assert.match(primera, /<button type="button" class="pag-btn" data-pagina="2" data-direccion="siguiente">/);
    assert.doesNotMatch(primera, /onclick/i);
    const ultima = a.htmlDeControlesDePagina({ pagina: 3, totalPaginas: 3 });
    assert.match(ultima, /data-pagina="2" data-direccion="anterior">/);
    assert.match(ultima, /data-pagina="4" data-direccion="siguiente" disabled>/);
    // Las flechas son decorativas
    assert.equal(cantidad(ultima, 'aria-hidden="true"'), 2);
  });
});

describe('admin.js: botones de los filtros de estado', () => {
  const { contexto: a } = cargarAdminJs();
  const CUENTAS = { todos: 6, vencido: 2, proximo: 1, 'al-dia': 1, eventual: 1, pendiente: 0, 'sin-fecha': 1 };

  it('cada filtro lleva su contador y solo el elegido está presionado', () => {
    const filtros = plano(a.estadoDeFiltros(CUENTAS, 'vencido', true));
    assert.deepEqual(Object.keys(filtros), ['', 'vencido', 'proximo', 'al-dia', 'eventual', 'sin-fecha', 'pendiente']);
    assert.deepEqual(filtros[''], { cuenta: 6, presionado: false, visible: true });
    assert.deepEqual(filtros.vencido, { cuenta: 2, presionado: true, visible: true });
    assert.deepEqual(filtros.pendiente, { cuenta: 0, presionado: false, visible: true });
    assert.equal(Object.values(filtros).filter((f) => f.presionado).length, 1);
    assert.equal(a.estadoDeFiltros(CUENTAS, '', true)[''].presionado, true);
  });

  it('"Sin fecha" aparece solo si hay alguno, o si es el filtro elegido', () => {
    assert.equal(a.estadoDeFiltros(CUENTAS, '', true)['sin-fecha'].visible, true);
    assert.equal(a.estadoDeFiltros({ ...CUENTAS, 'sin-fecha': 0 }, '', true)['sin-fecha'].visible, false);
    assert.equal(a.estadoDeFiltros({ ...CUENTAS, 'sin-fecha': 0 }, 'sin-fecha', true)['sin-fecha'].visible, true);
  });

  it('"Con un cambio pendiente" solo lo ve quien administra (el lector no conoce los pendientes)', () => {
    assert.equal(a.estadoDeFiltros(CUENTAS, '', false).pendiente.visible, false);
    assert.equal(a.estadoDeFiltros(CUENTAS, '', true).pendiente.visible, true);
  });

  it('sin contadores no tira error: todo en cero', () => {
    const filtros = plano(a.estadoDeFiltros(undefined, undefined, true));
    assert.equal(filtros[''].cuenta, 0);
    assert.equal(filtros[''].presionado, true);
  });
});

describe('admin.js: selector de tipo de pedido', () => {
  const { contexto: a } = cargarAdminJs();
  const LISTA = [dataset({ id: 1 }), vencido({ id: 2 }), eventual({ id: 3 }), ejercicio({ id: 4 }),
    dataset({ id: 5, tipo_pedido: 'relevamiento', tipo_pedido_nombre: 'Relevamiento interno' }), { id: 6, titulo: 'Sin tipo' }];

  it('ofrece los tipos que tienen los datasets, una vez cada uno, ordenados por nombre, después de "Todos"', () => {
    const html = a.opcionesDeTipoPedido(LISTA, '');
    const opciones = [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(opciones, [['', 'Todos los tipos de pedido'], ['acumulado', 'Acumulado'], ['ejercicio', 'Ejercicio que empieza'],
      ['eventual', 'Eventual'], ['relevamiento', 'Relevamiento interno']]);
    assert.doesNotMatch(html, /selected/);
  });

  it('marca el elegido', () => {
    const html = a.opcionesDeTipoPedido(LISTA, 'ejercicio');
    assert.equal(cantidad(html, 'selected'), 1);
    assert.match(html, /<option value="ejercicio" selected>Ejercicio que empieza<\/option>/);
  });

  it('escapa el nombre y el valor', () => {
    const html = a.opcionesDeTipoPedido([dataset({ tipo_pedido: 'x"y', tipo_pedido_nombre: '<b>Raro</b>' })], '');
    assert.doesNotMatch(html, /<b>|value="x"y"/);
    assert.match(html, /value="x&quot;y">&lt;b&gt;Raro&lt;\/b&gt;</);
  });

  it('sin lista ofrece solo "Todos"', () => {
    assert.equal(a.opcionesDeTipoPedido(null, ''), '<option value="">Todos los tipos de pedido</option>');
  });
});

describe('admin.js: filas y tarjetas de una página', () => {
  const LISTA = [dataset({ id: 1 }), vencido({ id: 2 }), eventual({ id: 3 })];

  it('arma una fila y una tarjeta por dataset, con el bloqueo de los que tienen un cambio pendiente', () => {
    const { contexto: a } = cargarAdminJs();
    const { filas, tarjetas } = a.htmlDeLaLista(LISTA, { pendientes: new Set(['2']), esAdmin: true, hoy: HOY });
    assert.equal(cantidad(filas, '<tr'), 3);
    assert.equal(cantidad(tarjetas, '<article'), 3);
    assert.equal(cantidad(filas, 'class="bloqueada"'), 1);
    assert.equal(cantidad(filas, ' disabled'), 3);
    assert.equal(cantidad(tarjetas, ' disabled'), 3);
    assert.match(filas, /<tr class="bloqueada">(?:(?!<\/tr>)[\s\S])*data-registrar="2"/);
  });

  it('los pendientes pueden venir como lista de números', () => {
    const { contexto: a } = cargarAdminJs();
    assert.equal(cantidad(a.htmlDeLaLista(LISTA, { pendientes: [2, 3], esAdmin: true, hoy: HOY }).filas, 'class="bloqueada"'), 2);
  });

  it('usa el hoy que recibe para todas las filas y no vuelve a pedir la fecha', () => {
    const { contexto: a } = cargarAdminJs();
    a.hoyEnArgentina = () => { throw new Error('pidió la fecha otra vez'); };
    assert.match(a.htmlDeLaLista(LISTA, { pendientes: [], esAdmin: true, hoy: HOY }).filas, /Fecha sugerida de envío: 31\/01\/2027/);
    assert.doesNotMatch(a.htmlDeLaLista(LISTA, { pendientes: [], esAdmin: true, hoy: '2999-01-01' }).filas, /Fecha sugerida/);
  });

  it('el lector ve las filas sin botones', () => {
    const { contexto: a } = cargarAdminJs();
    const { filas, tarjetas } = a.htmlDeLaLista(LISTA, { pendientes: [], esAdmin: false, hoy: HOY });
    assert.doesNotMatch(filas + tarjetas, /<button/);
    assert.equal(cantidad(filas, '<tr'), 3);
  });

  it('sin datasets muestra el mensaje, escapado, en la tabla y en las tarjetas', () => {
    const { contexto: a } = cargarAdminJs();
    const { filas, tarjetas } = a.htmlDeLaLista([], { pendientes: [], esAdmin: true, hoy: HOY, mensajeVacio: 'Ningún <dataset>' });
    assert.equal(filas, '<tr><td colspan="5" class="ad-vacio">Ningún &lt;dataset&gt;</td></tr>');
    assert.equal(tarjetas, '<p class="ad-vacio">Ningún &lt;dataset&gt;</p>');
  });
});

describe('admin.js: catálogos', () => {
  const { contexto: a } = cargarAdminJs();

  it('faltan catálogos si alguno de temas, frecuencias o formatos viene vacío o no vino', () => {
    const uno = [{ id: 1 }];
    assert.equal(a.faltanCatalogos({ temas: uno, frecuencias: uno, formatos: uno }), false);
    assert.equal(a.faltanCatalogos({ temas: [], frecuencias: uno, formatos: uno }), true);
    assert.equal(a.faltanCatalogos({ temas: uno, frecuencias: undefined, formatos: uno }), true);
    assert.equal(a.faltanCatalogos({ temas: uno, frecuencias: uno, formatos: null }), true);
    assert.equal(a.faltanCatalogos(), true);
  });
});

describe('admin.html: la lista', () => {
  it('la barra: el buscador con su etiqueta, la gestión y el tipo de pedido', () => {
    assert.match(PAGINA_ADMIN, /<label class="ad-vh" for="buscar">[^<]+<\/label>\s*<input type="search" id="buscar"/);
    assert.match(PAGINA_ADMIN, /<label class="ad-vh" for="filtro-gestion">Gestión<\/label>\s*<select id="filtro-gestion">/);
    assert.match(PAGINA_ADMIN, /<label class="ad-vh" for="filtro-tipo">Tipo de pedido<\/label>\s*<select id="filtro-tipo">/);
    const gestion = PAGINA_ADMIN.match(/<select id="filtro-gestion">([\s\S]*?)<\/select>/)[1];
    assert.deepEqual([...gestion.matchAll(/<option value="([^"]*)">([^<]*)</g)].map((m) => [m[1], m[2]]),
      [['', 'Interna y externa'], ['interna', 'Interna'], ['externa', 'Externa']]);
  });

  it('los filtros de estado: un grupo con un botón por estado, con aria-pressed', () => {
    const grupo = PAGINA_ADMIN.match(/<div class="ad-estados" id="filtros-estado" role="group" aria-label="Filtrar por estado">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const botones = [...grupo.matchAll(/<button type="button" class="ad-estado-filtro" data-filtro="([^"]*)" aria-pressed="(true|false)"[^>]*>([^<]+)<b><\/b><\/button>/g)]
      .map((m) => [m[1], m[2], m[3].trim()]);
    assert.deepEqual(botones, [
      ['', 'true', 'Todos'], ['vencido', 'false', 'Vencidos'], ['proximo', 'false', 'Vencen en menos de 60 días'], ['al-dia', 'false', 'Al día'],
      ['eventual', 'false', 'Eventuales'], ['sin-fecha', 'false', 'Sin fecha'], ['pendiente', 'false', 'Con un cambio pendiente']]);
  });

  it('la tabla: las cinco columnas (la de acciones, con el título oculto a la vista) y #filas-datasets', () => {
    const cabecera = PAGINA_ADMIN.match(/<table class="ad-tabla" id="tabla-datasets">[\s\S]*?<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    assert.deepEqual([...cabecera.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1]),
      ['Dataset', 'Estado', 'Datos publicados', 'Próximo pedido', '<span class="ad-vh">Acciones</span>']);
    assert.match(cabecera, /<th scope="col" class="ocultable">Datos publicados<\/th>/);
    assert.match(PAGINA_ADMIN, /<tbody id="filas-datasets">/);
    assert.match(PAGINA_ADMIN, /<div class="ad-tarjetas" id="tarjetas-datasets">/);
    assert.match(PAGINA_ADMIN, /<span class="pag-info" id="resumen-lista" aria-live="polite"><\/span>/);
  });

  it('"Nuevo dataset" arranca oculto: lo muestra admin.js solo a quien administra', () => {
    assert.match(PAGINA_ADMIN, /<button[^>]*id="btn-nuevo-dataset"[^>]*hidden>/);
    assert.match(CODIGO_ADMIN, /getElementById\('btn-nuevo-dataset'\)\.hidden = false/);
  });

  it('el pie dice "RPAD v1.6.0"', () => {
    assert.match(PAGINA_ADMIN, /<span>RPAD v1\.6\.0<\/span>/);
    assert.doesNotMatch(PAGINA_ADMIN, /RPAD v1\.4\.0/);
  });

  it('no usa .text-small ni .mt-2, que no existen', () => {
    for (const texto of [PAGINA_ADMIN, CODIGO_ADMIN]) {
      assert.doesNotMatch(texto, /(^|[^\w-])(text-small|mt-2)($|[^\w-])/);
    }
  });
});

describe('admin.html: CSS sin uso (como correos.html)', () => {
  const ADMIN_FECHAS = fs.readFileSync(new URL('../public/js/admin-fechas.js', import.meta.url), 'utf8');
  const inicio = PAGINA_ADMIN.indexOf('<style>');
  const fin = PAGINA_ADMIN.indexOf('</style>');
  // La clase aparece como palabra entera: "ad-tarjeta" no cuenta dentro de "ad-tarjetas" ni "chip" dentro de "ad-chip"
  const aparece = (clase, texto) => new RegExp(`(^|[^\\w-])${clase}($|[^\\w-])`).test(texto);

  it('la comparación es por palabra entera, no por pedazo', () => {
    assert.equal(aparece('ad-tarjeta', 'class="ad-tarjetas"'), false);
    assert.equal(aparece('chip', 'class="ad-chip"'), false);
    assert.equal(aparece('ad-chip', 'class="ad-chip vencido"'), true);
    assert.equal(aparece('al-dia', "clase: 'al-dia'"), true);
    assert.equal(aparece('selected', "classList.add('selected')"), true);
  });

  it('cada clase del <style> de admin.html se usa en la página, en admin.js o en admin-fechas.js', () => {
    assert.ok(inicio !== -1 && fin > inicio, 'la página tiene su <style>');
    const estilo = PAGINA_ADMIN.slice(inicio + '<style>'.length, fin)
      .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const clases = [...new Set([...estilo.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
    assert.ok(clases.length > 20, `se encontraron las clases del <style> (${clases.length})`);
    const resto = PAGINA_ADMIN.slice(0, inicio) + PAGINA_ADMIN.slice(fin) + '\n' + CODIGO_ADMIN + '\n' + ADMIN_FECHAS;
    for (const clase of clases) {
      assert.ok(aparece(clase, resto), `la clase .${clase} del <style> no se usa en admin.html, admin.js ni admin-fechas.js`);
    }
  });

  it('las pastillas tienen todos los estados, también "sin fecha", y las tarjetas del celular tienen estilo', () => {
    const estilo = PAGINA_ADMIN.slice(inicio, fin);
    for (const estado of ['vencido', 'proximo', 'al-dia', 'eventual', 'pendiente', 'sin-fecha']) {
      assert.match(estilo, new RegExp(`\\.ad-chip\\.${estado} \\{[^}]*background:[^}]*color:`), estado);
    }
    for (const clase of ['ad-tarjetas', 'ad-tarjeta', 'ad-tarjeta-titulo', 'ad-tarjeta-estado', 'ad-tarjeta-datos']) {
      assert.match(estilo, new RegExp(`\\.${clase}[\\s{.,:]`), clase);
    }
  });

  it('el foco se ve en los botones de la paginación: el de main.css (sombra al 15 %) no alcanza sobre el pie', () => {
    const estilo = PAGINA_ADMIN.slice(inicio, fin).replace(/\/\*[\s\S]*?\*\//g, '');
    const regla = estilo.match(/([^{}]*\.ad-pie-tabla \.pag-btn:focus-visible[^{}]*)\{([^}]*)\}/);
    assert.ok(regla, 'hay una regla de foco para .ad-pie-tabla .pag-btn');
    assert.match(regla[2], /outline: 2px solid var\(--pf-acento\); outline-offset: 2px;/);
  });

  it('en el celular (hasta 760 px) la tabla pasa a tarjetas', () => {
    const estilo = PAGINA_ADMIN.slice(inicio, fin);
    assert.ok(estilo.includes('@media (max-width: 760px)'));
    const celular = estilo.slice(estilo.indexOf('@media (max-width: 760px)'));
    assert.match(celular, /table\.ad-tabla \{ display: none; \}/);
    assert.match(celular, /\.ad-tarjetas \{ display: grid;/);
  });
});

describe('main.css: las variables que usa están definidas', () => {
  // La paginación usaba --mcr-* y --radius-* sin definir (spec 8.6, arreglo 7): los colores y los bordes no se veían
  it('cada var(--x) de main.css tiene su definición en main.css', () => {
    const css = fs.readFileSync(new URL('../public/css/main.css', import.meta.url), 'utf8');
    const usadas = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
    const definidas = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    assert.deepEqual([...usadas].filter((variable) => !definidas.has(variable)), []);
  });
});

// =====================================================
// Registrar actualización (spec 2026-10-17-fechas-datasets, 8.3 y los arreglos 3 y 5 de 8.6)
// =====================================================

describe('admin-fechas.js: defectoDeDatosAl', () => {
  it('por defecto, lo que se pidió (Parque Automotor pide hasta el 31/12/2025)', () => {
    assert.equal(admin.defectoDeDatosAl(vencido(), HOY), '2025-12-31');
  });

  it('nunca después del fin del mes anterior al actual (Pauta pide hasta el 31/12/2026)', () => {
    assert.equal(admin.defectoDeDatosAl(dataset(), HOY), '2026-09-30');
  });

  it('el fin del mes anterior cruza el año y lleva febrero en 28, también en un año bisiesto', () => {
    // Pide hasta el 31/12/2028: el tope es el que manda
    const pideMucho = dataset({ pedido: { desde: '2028-01-01', hasta: '2028-12-31', texto: 'Del 01/01/2028 al 31/12/2028' } });
    assert.equal(admin.defectoDeDatosAl(pideMucho, '2027-01-15'), '2026-12-31');
    assert.equal(admin.defectoDeDatosAl(pideMucho, '2028-03-10'), '2028-02-28');
    assert.equal(admin.defectoDeDatosAl(pideMucho, '2026-03-01'), '2026-02-28');
  });

  it('un relevamiento arranca en el mes actual', () => {
    const relevamiento = dataset({ tipo_gestion: 'interna', tipo_pedido: 'relevamiento', pedido: { desde: null, hasta: null, texto: 'Relevamiento actualizado' } });
    assert.equal(admin.defectoDeDatosAl(relevamiento, HOY), '2026-10-31');
    assert.equal(admin.defectoDeDatosAl(relevamiento, '2028-02-29'), '2028-02-28');
  });

  it('un ejercicio arranca en el 31/12 de lo que se pidió, sin pasar del ejercicio del año siguiente', () => {
    assert.equal(admin.defectoDeDatosAl(ejercicio(), HOY), '2027-12-31');
    assert.equal(admin.defectoDeDatosAl(ejercicio({ pedido: { desde: '2026-01-01', hasta: '2026-12-31', texto: 'Presupuesto del ejercicio 2026' } }), HOY), '2026-12-31');
    assert.equal(admin.defectoDeDatosAl(ejercicio({ pedido: { desde: '2028-01-01', hasta: '2028-12-31', texto: 'x' } }), HOY), '2027-12-31');
  });

  it('un ejercicio sin pedido arranca en el 31/12 del año actual', () => {
    assert.equal(admin.defectoDeDatosAl(ejercicio({ pedido: null }), HOY), '2026-12-31');
  });

  it('sin hasta (próxima edición, eventual o sin próxima): el fin del mes anterior', () => {
    const edicion = dataset({ tipo_pedido: 'edicion', pedido: { desde: null, hasta: null, texto: 'Próxima edición disponible' } });
    assert.equal(admin.defectoDeDatosAl(edicion, HOY), '2026-09-30');
    assert.equal(admin.defectoDeDatosAl(eventual(), HOY), '2026-09-30');
    assert.equal(admin.defectoDeDatosAl(dataset({ pedido: null, proxima_actualizacion: null }), HOY), '2026-09-30');
  });

  it('una foto vencida arranca en el corte que se pide', () => {
    const foto = dataset({ tipo_pedido: 'foto', pedido: { desde: '2026-06-30', hasta: '2026-06-30', texto: 'Vigente al 30/06/2026' } });
    assert.equal(admin.defectoDeDatosAl(foto, HOY), '2026-06-30');
  });

  it('sin dataset, o con un hoy que no es una fecha, no tira error y da una fecha', () => {
    assert.equal(admin.defectoDeDatosAl(null, HOY), '2026-09-30');
    assert.equal(admin.defectoDeDatosAl(undefined, HOY), '2026-09-30');
    assert.match(admin.defectoDeDatosAl(dataset(), 'basura'), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('admin-fechas.js: errorDeDatosAl', () => {
  it('el mes actual se puede; el siguiente todavía no, con el texto del servidor y sin punto final', () => {
    assert.equal(admin.errorDeDatosAl('2026-10-31', 'acumulado', HOY), null);
    assert.equal(admin.errorDeDatosAl('2026-09-30', 'acumulado', HOY), null);
    assert.equal(admin.errorDeDatosAl('2026-11-30', 'acumulado', HOY), 'Todavía no puede haber datos al 30/11/2026');
    assert.equal(admin.errorDeDatosAl('2027-12-31', 'relevamiento', HOY), 'Todavía no puede haber datos al 31/12/2027');
  });

  it('en un ejercicio el tope es el 31/12 del año siguiente', () => {
    assert.equal(admin.errorDeDatosAl('2027-12-31', 'ejercicio', HOY), null);
    assert.equal(admin.errorDeDatosAl('2028-12-31', 'ejercicio', HOY), 'Todavía no puede haber datos al 31/12/2028');
  });

  it('el tope sale del hoy de Argentina que recibe: a fin de mes, el mes siguiente sigue sin poder', () => {
    assert.equal(admin.errorDeDatosAl('2026-11-30', 'acumulado', '2026-10-31'), 'Todavía no puede haber datos al 30/11/2026');
    assert.equal(admin.errorDeDatosAl('2026-11-30', 'acumulado', '2026-11-01'), null);
  });

  it('sin Datos al, el mismo texto que el servidor', () => {
    assert.equal(admin.errorDeDatosAl(null, 'acumulado', HOY), 'Falta Datos al: la fecha a la que son los datos que llegaron');
    assert.equal(admin.errorDeDatosAl('basura', 'acumulado', HOY), 'Falta Datos al: la fecha a la que son los datos que llegaron');
  });
});

describe('admin-fechas.js: textosDelPaso1 y datosAlDelPaso1', () => {
  it('la pregunta y la ayuda de cada tipo; el ejercicio se elige solo con el año', () => {
    assert.deepEqual(plano(admin.textosDelPaso1('acumulado')), {
      pregunta: '¿A qué fecha son los datos que llegaron?', ayuda: 'Siempre es fin de mes. Por defecto, lo que se pidió.', soloAnio: false
    });
    assert.deepEqual(plano(admin.textosDelPaso1('relevamiento')), {
      pregunta: '¿De qué mes es el relevamiento?', ayuda: 'El mes en que se hizo el relevamiento.', soloAnio: false
    });
    assert.deepEqual(plano(admin.textosDelPaso1('ejercicio')), {
      pregunta: '¿De qué ejercicio es el presupuesto que llegó?', ayuda: 'Se guarda el 31/12 de ese año. Por defecto, lo que se pidió.', soloAnio: true
    });
  });

  it('un tipo que no conoce, o ninguno, lleva la pregunta general', () => {
    for (const tipo of ['foto', 'edicion', 'eventual', undefined, null, 'otro']) {
      assert.equal(admin.textosDelPaso1(tipo).pregunta, '¿A qué fecha son los datos que llegaron?', String(tipo));
    }
  });

  it('Datos al es el fin del mes elegido, con febrero en 28', () => {
    assert.equal(admin.datosAlDelPaso1({ tipo: 'acumulado', mes: '9', anio: '2026' }), '2026-09-30');
    assert.equal(admin.datosAlDelPaso1({ tipo: 'foto', mes: 2, anio: 2028 }), '2028-02-28');
    assert.equal(admin.datosAlDelPaso1({ tipo: 'relevamiento', mes: '10', anio: '2026' }), '2026-10-31');
  });

  it('en un ejercicio es el 31/12 del año elegido, diga lo que diga el mes', () => {
    assert.equal(admin.datosAlDelPaso1({ tipo: 'ejercicio', mes: '3', anio: '2027' }), '2027-12-31');
    assert.equal(admin.datosAlDelPaso1({ tipo: 'ejercicio', mes: '', anio: '2026' }), '2026-12-31');
  });

  it('con un mes o un año que no sirven da null y no tira error', () => {
    assert.equal(admin.datosAlDelPaso1({ tipo: 'acumulado', mes: '', anio: '2026' }), null);
    assert.equal(admin.datosAlDelPaso1({ tipo: 'ejercicio', mes: '1', anio: '' }), null);
    assert.equal(admin.datosAlDelPaso1(), null);
  });
});

describe('admin-fechas.js: errorDeFechasDelRegistro', () => {
  it('sin recepción y con la carga de hoy no hay error', () => {
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '', cargado: HOY, hoy: HOY }), null);
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '2026-10-10', cargado: '2026-10-10', hoy: HOY }), null);
  });

  it('la carga es obligatoria y no puede ser posterior a hoy (el texto del servidor)', () => {
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '', cargado: '', hoy: HOY }), 'Falta la fecha de carga en el portal');
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '', cargado: '2026-10-18', hoy: HOY }),
      'La fecha de carga en el portal no puede ser posterior a hoy (17/10/2026)');
  });

  it('la recepción no puede ser posterior a hoy ni a la carga (los textos del servidor)', () => {
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '2026-10-18', cargado: HOY, hoy: HOY }),
      'La fecha de recepción no puede ser posterior a hoy (17/10/2026)');
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '2026-10-16', cargado: '2026-10-15', hoy: HOY }),
      'La fecha de recepción (16/10/2026) no puede ser posterior a la de carga en el portal (15/10/2026)');
  });

  it('sin argumentos no tira error', () => {
    assert.equal(admin.errorDeFechasDelRegistro(), 'Falta la fecha de carga en el portal');
  });
});

describe('admin-fechas.js: cuerpoDelRegistro (el JSON del POST /datasets/:id/actualizar)', () => {
  const OPCIONES = [
    { fecha: '2027-04-30', motivo: 'Siguiente período', sugerida: true, advertencia: null, pideDespues: 'Del 01/10/2026 al 31/03/2027' },
    { fecha: '2027-01-31', motivo: 'Mantener', sugerida: false, advertencia: null, pideDespues: 'Del 01/01/2026 al 31/12/2026' }
  ];
  const formulario = (extra = {}) => ({
    tipo: 'acumulado', eventual: false, mes: '9', anio: '2026', recibido: '', cargado: HOY,
    opcion: '0', opciones: OPCIONES, otraMes: '', otraAnio: '', ...extra
  });
  const cuerpo = (extra) => plano(admin.cuerpoDelRegistro(formulario(extra)));

  it('arma datos_al, cargado_el, recibido_el y proxima_actualizacion, y nada más (sin notas)', () => {
    assert.deepEqual(cuerpo(), { datos_al: '2026-09-30', cargado_el: HOY, recibido_el: null, proxima_actualizacion: '2027-04-30' });
  });

  it('"Recibido el" vacío da null; con fecha, la fecha', () => {
    assert.equal(cuerpo({ recibido: '' }).recibido_el, null);
    assert.equal(cuerpo({ recibido: undefined }).recibido_el, null);
    assert.equal(cuerpo({ recibido: '2026-10-15' }).recibido_el, '2026-10-15');
  });

  it('la próxima es la fecha de la opción elegida, leída por su texto', () => {
    assert.equal(cuerpo({ opcion: '1' }).proxima_actualizacion, '2027-01-31');
    assert.equal(cuerpo({ opcion: 1 }).proxima_actualizacion, '2027-01-31');
    assert.equal(cuerpo({ opciones: [{ fecha: '2027-04-30T03:00:00.000Z' }] }).proxima_actualizacion, '2027-04-30');
  });

  it('"Otra fecha" da el fin del mes elegido, con febrero en 28', () => {
    assert.equal(cuerpo({ opcion: 'otra', otraMes: '4', otraAnio: '2027' }).proxima_actualizacion, '2027-04-30');
    assert.equal(cuerpo({ opcion: 'otra', otraMes: '2', otraAnio: '2028' }).proxima_actualizacion, '2028-02-28');
  });

  it('"Otra fecha" sin el mes o sin el año no da próxima', () => {
    assert.equal(cuerpo({ opcion: 'otra', otraMes: '', otraAnio: '2027' }).proxima_actualizacion, null);
    assert.equal(cuerpo({ opcion: 'otra', otraMes: '4', otraAnio: '' }).proxima_actualizacion, null);
  });

  it('sin opción elegida, o con una que no está, no da próxima', () => {
    for (const opcion of [null, undefined, '', '7', '-1', 'x']) {
      assert.equal(cuerpo({ opcion }).proxima_actualizacion, null, String(opcion));
    }
    assert.equal(cuerpo({ opciones: null }).proxima_actualizacion, null);
  });

  it('en un ejercicio, datos_al es el 31/12 del año elegido', () => {
    assert.equal(cuerpo({ tipo: 'ejercicio', mes: '1', anio: '2027' }).datos_al, '2027-12-31');
  });

  it('en un eventual la próxima va vacía, aunque haya una opción', () => {
    assert.equal(cuerpo({ tipo: 'eventual', eventual: true }).proxima_actualizacion, null);
    assert.equal(cuerpo({ tipo: 'eventual', eventual: true, opcion: 'otra', otraMes: '4', otraAnio: '2027' }).proxima_actualizacion, null);
  });

  it('una carga vacía da null (el formulario no deja proponer sin ella)', () => {
    assert.equal(cuerpo({ cargado: '' }).cargado_el, null);
  });

  it('sin formulario no tira error', () => {
    assert.deepEqual(plano(admin.cuerpoDelRegistro()), { datos_al: null, cargado_el: null, recibido_el: null, proxima_actualizacion: null });
  });

  it('proximaDelRegistro es la próxima que lleva el cuerpo: lo que habilita "Proponer actualización"', () => {
    assert.equal(admin.proximaDelRegistro(formulario()), '2027-04-30');
    assert.equal(admin.proximaDelRegistro(formulario({ opcion: null })), null);
    assert.equal(admin.proximaDelRegistro(formulario({ opcion: 'otra' })), null);
    assert.equal(admin.puedeProponer({ opcionElegida: admin.proximaDelRegistro(formulario({ opcion: 'otra' })), errores: [], enviando: false }), false);
    assert.equal(admin.puedeProponer({ opcionElegida: admin.proximaDelRegistro(formulario({ opcion: 'otra', otraMes: '5', otraAnio: '2027' })), errores: [], enviando: false }), true);
  });
});

describe('admin-fechas.js: revisionDelRegistro (el error del paso 2 y si se puede proponer)', () => {
  const OPCIONES = [{ fecha: '2027-04-30', motivo: 'Siguiente período', sugerida: true }];
  const formulario = (extra = {}) => ({
    tipo: 'acumulado', eventual: false, mes: '9', anio: '2026', recibido: '', cargado: HOY,
    opcion: '0', opciones: OPCIONES, otraMes: '', otraAnio: '', ...extra
  });
  const revision = (extra = {}, formularioExtra = {}) => plano(admin.revisionDelRegistro({
    formulario: formulario(formularioExtra), errorDatosAl: null, cargando: false, enviando: false, hoy: HOY, ...extra
  }));

  it('con una opción elegida y sin errores se puede proponer (los errores vacíos no cuentan)', () => {
    assert.deepEqual(revision(), { errorFechas: null, puedeProponer: true });
  });

  it('sin opción elegida, o con "Otra fecha" incompleta, no', () => {
    assert.equal(revision({}, { opcion: null }).puedeProponer, false);
    assert.equal(revision({}, { opcion: 'otra' }).puedeProponer, false);
    assert.equal(revision({}, { opcion: 'otra', otraMes: '6', otraAnio: '2027' }).puedeProponer, true);
  });

  it('un error en "Datos al" o en las fechas lo frena, y el de las fechas se devuelve para mostrarlo', () => {
    assert.equal(revision({ errorDatosAl: 'Todavía no puede haber datos al 30/11/2026' }).puedeProponer, false);
    assert.deepEqual(revision({}, { cargado: '2026-10-18' }), {
      errorFechas: 'La fecha de carga en el portal no puede ser posterior a hoy (17/10/2026)', puedeProponer: false
    });
  });

  it('mientras llegan las opciones o mientras se envía, no', () => {
    assert.equal(revision({ cargando: true }).puedeProponer, false);
    assert.equal(revision({ enviando: true }).puedeProponer, false);
  });

  it('un eventual se propone sin próxima, pero los errores y el envío lo frenan igual', () => {
    assert.equal(revision({}, { eventual: true, opcion: null }).puedeProponer, true);
    assert.equal(revision({ enviando: true }, { eventual: true, opcion: null }).puedeProponer, false);
    assert.equal(revision({}, { eventual: true, opcion: null, recibido: '2026-10-18' }).puedeProponer, false);
  });

  it('sin argumentos no tira error y no deja proponer', () => {
    assert.equal(admin.revisionDelRegistro().puedeProponer, false);
  });
});

describe('admin-fechas.js: la cabecera "Datos solicitados" del registro', () => {
  it('el texto del pedido actual; un eventual no tiene pedido automático', () => {
    assert.equal(admin.textoDelPedidoActual(dataset()), 'Del 01/01/2026 al 31/12/2026');
    assert.equal(admin.textoDelPedidoActual(eventual()), 'Sin pedido automático');
    assert.equal(admin.textoDelPedidoActual(dataset({ pedido: null, proxima_actualizacion: null })), 'Sin pedido: no tiene próxima actualización');
    assert.equal(admin.textoDelPedidoActual(null), 'Sin pedido: no tiene próxima actualización');
  });

  it('frecuencia, tipo de pedido, fecha sugerida de envío y lo publicado hoy', () => {
    const html = admin.htmlDeDatosDelPedido(dataset(), HOY);
    assert.equal(html, '<div><dt>Frecuencia:</dt><dd>Trimestralmente</dd></div>'
      + '<div><dt>Tipo de pedido:</dt><dd>Acumulado</dd></div>'
      + '<div><dt>Fecha sugerida de envío:</dt><dd>31/01/2027</dd></div>'
      + '<div><dt>Publicado hoy:</dt><dd>datos al 31/07/2026</dd></div>');
  });

  it('si ya venció dice "Vencido desde" y no da una fecha sugerida', () => {
    const html = admin.htmlDeDatosDelPedido(vencido(), HOY);
    assert.match(html, /<dt>Vencido desde:<\/dt><dd>31\/01\/2024<\/dd>/);
    assert.doesNotMatch(html, /Fecha sugerida/);
  });

  it('un ejercicio publicado dice "ejercicio aaaa"; sin Datos al, una raya', () => {
    assert.match(admin.htmlDeDatosDelPedido(ejercicio(), HOY), /<dt>Publicado hoy:<\/dt><dd>ejercicio 2025<\/dd>/);
    assert.match(admin.htmlDeDatosDelPedido(dataset({ datos_al: null }), HOY), /<dt>Publicado hoy:<\/dt><dd>—<\/dd>/);
  });

  it('un eventual no tiene fecha de envío', () => {
    const html = admin.htmlDeDatosDelPedido(eventual(), HOY);
    assert.match(html, /<dt>Frecuencia:<\/dt><dd>Eventual<\/dd>/);
    assert.doesNotMatch(html, /Vencido desde|Fecha sugerida/);
  });

  it('escapa la frecuencia y el tipo de pedido, y sin datos no escribe "undefined"', () => {
    const html = admin.htmlDeDatosDelPedido(dataset({ frecuencia_nombre: '<b>f</b>', tipo_pedido_nombre: '<i>t</i>' }), HOY);
    assert.doesNotMatch(html, /<b>f|<i>t/);
    assert.match(html, /&lt;b&gt;f&lt;\/b&gt;/);
    assert.doesNotMatch(admin.htmlDeDatosDelPedido(null, HOY), /undefined|null/);
  });
});

describe('admin-fechas.js: esEventual y textoDeError', () => {
  it('es eventual el dataset sin frecuencia en meses (como el servidor)', () => {
    assert.equal(admin.esEventual(eventual()), true);
    assert.equal(admin.esEventual(dataset()), false);
    assert.equal(admin.esEventual(dataset({ frecuencia_meses: 0 })), true);
    assert.equal(admin.esEventual(null), true);
  });

  it('el error del servidor se muestra tal cual, sin agregarle un punto', () => {
    assert.equal(admin.textoDeError(new Error('Todavía no puede haber datos al 30/11/2026'), 'x'), 'Todavía no puede haber datos al 30/11/2026');
  });

  it('una falla de la red o una respuesta que no es JSON da el texto por defecto', () => {
    assert.equal(admin.textoDeError(new TypeError('Failed to fetch'), 'No se pudo.'), 'No se pudo.');
    assert.equal(admin.textoDeError(new SyntaxError('Unexpected token <'), 'No se pudo.'), 'No se pudo.');
    assert.equal(admin.textoDeError(new Error(''), 'No se pudo.'), 'No se pudo.');
    assert.equal(admin.textoDeError(null, 'No se pudo.'), 'No se pudo.');
    assert.equal(admin.textoDeError(undefined, 'No se pudo.'), 'No se pudo.');
  });
});

describe('admin.js: Registrar actualización', () => {
  const { contexto: a } = cargarAdminJs();
  const velo = { id: 'velo' };
  const adentro = { id: 'ventana' };

  it('ya no están el modal viejo ni sus funciones', () => {
    for (const nombre of ['abrirRegistrarActualizacion', 'confirmarRegistrarActualizacion', 'closeRegistrarActualizacionModal']) {
      assert.equal(typeof a[nombre], 'undefined', nombre);
    }
    assert.doesNotMatch(CODIGO_ADMIN, /registrar-ultima|registrar-proxima-group|btn-confirmar-actualizacion|registrarActualizacionId/);
    assert.doesNotMatch(PAGINA_ADMIN, /registrar-ultima|closeRegistrarActualizacionModal|confirmarRegistrarActualizacion/);
  });

  it('un clic afuera cierra solo si la presión empezó en el velo (como en Correos)', () => {
    a.presionEnVelo({ target: velo, currentTarget: velo });
    assert.equal(a.esClicAfuera({ target: velo, currentTarget: velo, detail: 1 }), true);
  });

  it('apretar adentro de la ventana y soltar sobre el velo no cierra (por ejemplo, al elegir texto)', () => {
    a.presionEnVelo({ target: adentro, currentTarget: velo });
    assert.equal(a.esClicAfuera({ target: velo, currentTarget: velo, detail: 1 }), false);
  });

  it('sin presión anotada, un clic sobre algo de adentro o el segundo clic de un doble clic no cierran', () => {
    assert.equal(a.esClicAfuera({ target: velo, currentTarget: velo, detail: 1 }), false);
    a.presionEnVelo({ target: velo, currentTarget: velo });
    assert.equal(a.esClicAfuera({ target: adentro, currentTarget: velo, detail: 1 }), false);
    a.presionEnVelo({ target: velo, currentTarget: velo });
    assert.equal(a.esClicAfuera({ target: velo, currentTarget: velo, detail: 2 }), false);
  });

  it('cada presión vale para un solo clic', () => {
    a.presionEnVelo({ target: velo, currentTarget: velo });
    assert.equal(a.esClicAfuera({ target: velo, currentTarget: velo, detail: 1 }), true);
    assert.equal(a.esClicAfuera({ target: velo, currentTarget: velo, detail: 1 }), false);
  });

  it('pide las opciones al servidor y propone con el cuerpo armado por cuerpoDelRegistro, si revisionDelRegistro lo deja', () => {
    assert.match(CODIGO_ADMIN, /API\.opcionesDeProxima\(/);
    assert.match(CODIGO_ADMIN, /API\.registrarActualizacion\([^)]*cuerpoDelRegistro\(/);
    assert.match(CODIGO_ADMIN, /revisionDelRegistro\(/);
  });

  it('el éxito avisa con showToast el texto de la spec', () => {
    assert.ok(CODIGO_ADMIN.includes("'Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.'"));
  });

  it('hoy se calcula con hoyEnArgentina, nunca con toISOString', () => {
    assert.doesNotMatch(CODIGO_ADMIN, /toISOString/);
    assert.match(CODIGO_ADMIN, /hoyEnArgentina\(\)/);
  });
});

describe('admin.html: la ventana de Registrar actualización', () => {
  const ventana = PAGINA_ADMIN.match(/<div class="ad-velo" id="modal-registrar-actualizacion" hidden>([\s\S]*?)<!-- Fin de Registrar actualización -->/)?.[1] ?? '';

  it('conserva el id, es un velo oculto y la ventana es un diálogo modal con su título', () => {
    assert.equal(cantidad(PAGINA_ADMIN, 'id="modal-registrar-actualizacion"'), 1);
    assert.ok(ventana, 'la ventana está y termina con su comentario');
    assert.match(ventana, /<div class="ad-ventana" role="dialog" aria-modal="true" aria-labelledby="registrar-titulo" aria-describedby="registrar-dataset">/);
    assert.match(ventana, /<h2 id="registrar-titulo">Registrar actualización<\/h2>/);
    assert.match(ventana, /<p id="registrar-dataset"><\/p>/);
    assert.match(ventana, /<button type="button" class="ad-cerrar" data-cerrar-registro aria-label="Cerrar">/);
  });

  it('no usa onclick: los oyentes los pone admin.js', () => {
    assert.doesNotMatch(ventana, /onclick|onchange/);
  });

  it('la cabecera "Datos solicitados" y la línea del ciclo, que es decorativa', () => {
    assert.match(ventana, /<p class="rotulo" id="registrar-rotulo">Datos solicitados<\/p>/);
    assert.match(ventana, /<p class="periodo" id="registrar-periodo"><\/p>/);
    assert.match(ventana, /<dl id="registrar-datos"><\/dl>/);
    assert.match(ventana, /<div class="ad-ciclo" id="registrar-ciclo" aria-hidden="true"><\/div>/);
    assert.match(ventana, /<div class="ad-leyenda" id="registrar-leyenda" aria-hidden="true">/);
    for (const texto of ['Ya publicado', 'Pedido, todavía no llegó', 'Llega con esta actualización']) assert.ok(ventana.includes(texto), texto);
  });

  it('paso 1: mes y año en un grupo con la pregunta, la ayuda y el error', () => {
    assert.match(ventana, /<h3 id="registrar-p1">¿A qué fecha son los datos que llegaron\?<\/h3>/);
    assert.match(ventana, /<div class="ad-mes" role="group" aria-labelledby="registrar-p1">\s*<select id="registrar-mes" aria-label="Mes"><\/select>\s*<select id="registrar-anio" aria-label="Año"><\/select>/);
    assert.match(ventana, /<p class="ad-ayuda" id="registrar-ayuda1">/);
    assert.match(ventana, /<p class="ad-error" id="registrar-error-datos" role="alert" hidden><\/p>/);
  });

  it('paso 2: "Recibido el (opcional)" y "Cargado en el portal el", con etiquetas con for', () => {
    assert.match(ventana, /<label for="registrar-recibido">Recibido el \(opcional\)<\/label>\s*<input type="date" id="registrar-recibido">/);
    assert.match(ventana, /<label for="registrar-cargado">Cargado en el portal el<\/label>\s*<input type="date" id="registrar-cargado" required>/);
    assert.match(ventana, /<p class="ad-error" id="registrar-error-fechas" role="alert" hidden><\/p>/);
  });

  it('paso 3: las opciones en un radiogroup y "Otra fecha" con mes y año', () => {
    assert.match(ventana, /<div class="ad-paso" id="registrar-paso3">/);
    assert.match(ventana, /<h3 id="registrar-p3">Próxima actualización<\/h3>/);
    assert.match(ventana, /<div class="ad-opciones" role="radiogroup" aria-labelledby="registrar-p3" id="registrar-opciones"><\/div>/);
    assert.match(ventana, /<div class="ad-otra" id="registrar-otra" hidden>/);
    assert.match(ventana, /<select id="registrar-otra-mes" aria-label="Mes de la otra fecha"><\/select>/);
    assert.match(ventana, /<select id="registrar-otra-anio" aria-label="Año de la otra fecha"><\/select>/);
  });

  it('el pie: el texto de la spec, "Cancelar" y "Proponer actualización" deshabilitado, y el error del envío', () => {
    assert.ok(ventana.includes('<p>Queda como propuesta: otra persona la aprueba en Mi Perfil. Hasta entonces, el dataset no se puede editar.</p>'));
    assert.match(ventana, /<button type="button" class="ad-btn" data-cerrar-registro>Cancelar<\/button>/);
    assert.match(ventana, /<button type="button" class="ad-btn primario" id="registrar-proponer" disabled>Proponer actualización<\/button>/);
    assert.match(ventana, /<p class="ad-error ad-error-envio" id="registrar-error" role="alert" hidden><\/p>/);
  });

  it('la lista puede recibir el foco al volver de proponer (el botón que abrió la ventana queda deshabilitado)', () => {
    assert.match(PAGINA_ADMIN, /<div class="ad-marco" id="lista-datasets" tabindex="-1">/);
  });
});

describe('admin.html: estilos de la ventana y del ciclo', () => {
  const inicio = PAGINA_ADMIN.indexOf('<style>');
  const fin = PAGINA_ADMIN.indexOf('</style>');
  const estilo = PAGINA_ADMIN.slice(inicio, fin).replace(/\/\*[\s\S]*?\*\//g, '');

  it('la banda verde se mueve, y no se mueve si se pide menos movimiento', () => {
    assert.match(estilo, /\.ad-ciclo \.llega \{[^}]*transition: width/);
    assert.ok(estilo.includes('@media (prefers-reduced-motion: reduce)'));
    const reducido = estilo.slice(estilo.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(reducido, /\.ad-ciclo \.llega \{ transition: none; \}/);
  });

  it('el velo va por debajo de los avisos (showToast usa z-index 1000 y se agrega después)', () => {
    assert.match(estilo, /\.ad-velo \{[^}]*z-index: 1000;/);
  });

  it('el foco se ve en los controles de la ventana', () => {
    for (const selector of ['.ad-cerrar:focus-visible', '.ad-mes select:focus-visible', '.ad-campos input:focus-visible', '.ad-opcion:focus-within']) {
      assert.ok(estilo.includes(selector), selector);
    }
  });
});
