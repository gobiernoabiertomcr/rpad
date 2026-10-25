// Admin (public/js/admin-fechas.js y public/js/admin.js), ejecutado en Node: lo puro que arma la lista, el registro de una
// actualización y la línea del ciclo (spec 2026-10-17-fechas-datasets, sección 8). Los dos scripts, al cargarse, solo declaran.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import vm from 'vm';
import { NOMBRES_TIPO_PEDIDO, TIPOS_PEDIDO, frecuenciaEnNota, tipoSugerido } from '../services/fechasDatasetReglas.js';
import { MENSAJE_FALTA_REQUIERE_NOTA, textoRequiereNota } from '../services/requiereNotaReglas.js';
import {
  MENSAJE_EDICION_REGISTRA, MENSAJE_FALTA_ORIGEN, MENSAJE_FALTA_RECIBIDO, OPCIONES_ORIGEN, origenSugerido, rotuloDeLaFecha
} from '../services/registroReglas.js';

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
    assert.equal(cantidad(html, '<svg'), 4);
    assert.equal(cantidad(html, 'aria-hidden="true"'), 4);
  });

  it('Ver seguimiento: un link de ícono a seguimiento.html?id=, después de Registrar y antes de Editar, con aria-label con el título', () => {
    for (const armar of [fila, (d) => admin.htmlDeTarjeta(d, { pendiente: false, esAdmin: true, hoy: HOY })]) {
      const html = armar(dataset({ id: 1 }));
      assert.match(html, /<a class="ad-icono" href="seguimiento\.html\?id=1" aria-label="Ver seguimiento de Pauta Publicitaria"><svg[\s\S]*?<\/svg><\/a>/);
      assert.equal(cantidad(html, '<a '), 1);
      assert.ok(html.indexOf('data-registrar') < html.indexOf('seguimiento.html'), 'después de Registrar');
      assert.ok(html.indexOf('seguimiento.html') < html.indexOf('data-editar'), 'antes de Editar');
      assert.doesNotMatch(html, /<a [^>]*(target|onclick|data-)/i);
    }
  });

  it('Ver seguimiento sigue siendo un link común con un cambio pendiente: no se deshabilita ni lleva el aviso de bloqueo', () => {
    const html = fila(vencido(), { pendiente: true });
    const enlace = html.match(/<a [^>]*>/)?.[0] ?? '';
    assert.match(enlace, /href="seguimiento\.html\?id=\d+"/);
    assert.doesNotMatch(enlace, /disabled|title=|aria-disabled/);
    assert.equal(cantidad(html, '<button'), 3);
    assert.equal(cantidad(html, ' disabled'), 3);
  });

  it('Ver seguimiento: un id hostil va codificado y escapado, no abre otro atributo; y el título hostil queda escapado en el aria-label', () => {
    for (const armar of [fila, (d) => admin.htmlDeTarjeta(d, { pendiente: false, esAdmin: true, hoy: HOY })]) {
      const html = armar(dataset({ id: '1" onmouseover="x', titulo: 'Nómina "oficial" <x>' }));
      assert.doesNotMatch(html, /" onmouseover/);
      assert.match(html, /href="seguimiento\.html\?id=1%22%20onmouseover%3D%22x"/);
      assert.match(html, /aria-label="Ver seguimiento de Nómina &quot;oficial&quot; &lt;x&gt;"/);
      assert.doesNotMatch(html, /<x>/);
    }
  });

  it('Ver seguimiento: sin permiso de administración no hay link (ni en la fila ni en la tarjeta), y la fila conserva sus cinco columnas', () => {
    const html = fila(dataset(), { esAdmin: false });
    assert.doesNotMatch(html, /seguimiento\.html|Ver seguimiento|<a /);
    assert.equal(cantidad(html, '<td'), 5);
    assert.doesNotMatch(admin.htmlDeTarjeta(dataset(), { esAdmin: false, hoy: HOY }), /seguimiento\.html|Ver seguimiento|<a /);
    assert.doesNotMatch(admin.htmlDeFila(dataset(), null), /seguimiento\.html/);
  });

  it('un eventual lleva "Eventual", no tiene pedido y no dice cuándo vence', () => {
    const html = fila(eventual());
    assert.match(html, /ad-chip eventual/);
    assert.match(html, />Eventual</);
    assert.match(html, /Sin vencimiento/);
    assert.doesNotMatch(html, /Vence el|Fecha sugerida/);
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

  it('próximo pedido: debajo va el tipo y "Vence el dd/mm/aaaa" cuando la próxima es de hoy en adelante', () => {
    assert.match(fila(), /<span class="ad-sub">Acumulado\. Vence el 31\/01\/2027<\/span>/);
    assert.match(fila(dataset({ proxima_actualizacion: '2026-10-17T03:00:00.000Z' })), /Vence el 17\/10\/2026/);
    assert.doesNotMatch(fila(), /sugerida de envío/i);
  });

  it('próximo pedido: si ya venció no dice cuándo vence, solo el tipo', () => {
    const html = fila(vencido());
    assert.doesNotMatch(html, /Vence el|Fecha sugerida/);
    assert.match(html, /<span class="ad-sub">Acumulado<\/span>/);
  });

  it('próximo pedido: el día antes de hoy ya no dice "Vence el"', () => {
    assert.doesNotMatch(fila(dataset({ proxima_actualizacion: '2026-10-16T03:00:00.000Z' })), /Vence el/);
  });

  it('sin hoy explícito usa la fecha de Argentina (no rompe)', () => {
    const html = admin.htmlDeFila(dataset({ proxima_actualizacion: '2999-01-31T03:00:00.000Z' }), { pendiente: false, esAdmin: true });
    assert.match(html, /Vence el 31\/01\/2999/);
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
      'Cargado el 13/10/2026', 'Del 01/01/2026 al 31/12/2026', 'Acumulado. Vence el 31/01/2027']) {
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
    assert.doesNotMatch(tarjeta(eventual()), /Vence el|Fecha sugerida/);
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
    for (const rotulo of ['Publicado', 'Corte pedido', 'Vence', 'Hoy']) assert.ok(html.includes(`>${rotulo}</div>`), rotulo);
    assert.equal(cantidad(html, 'class="marca'), 4);
    assert.doesNotMatch(html, /Envío sugerido/);
  });

  it('las posiciones son porcentajes sobre el rango de meses (con un mes de margen a cada lado)', () => {
    const html = admin.htmlDeCiclo(PAUTA);
    // 15 meses de ancho: enero 2026 a enero 2027 y un mes de margen a cada lado
    assert.match(html, /<div class="banda publicado" style="left:0%;width:53\.33%"><\/div>/);
    assert.match(html, /<div class="banda falta" style="left:53\.33%;width:33\.33%"><\/div>/);
    assert.match(html, /<div class="marca" style="left:53\.33%"><\/div><div class="etiqueta abajo" style="left:53\.33%;transform:none">Publicado<\/div>/);
    assert.match(html, /<div class="marca" style="left:86\.67%"><\/div><div class="etiqueta abajo" style="left:86\.67%;transform:translateX\(-100%\)">Corte pedido<\/div>/);
    assert.match(html, /<div class="marca" style="left:93\.33%"><\/div><div class="etiqueta arriba" style="left:93\.33%;transform:translateX\(-100%\)">Vence<\/div>/);
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

  it('si ya venció no hay marca "Vence": el día de hoy sí cuenta como de hoy en adelante', () => {
    const vencida = admin.htmlDeCiclo({ datosAl: '2022-12-31', desde: '2023-01-01', hasta: '2025-12-31', proxima: '2024-01-31', hoy: HOY });
    assert.doesNotMatch(vencida, />Vence<\/div>/);
    for (const rotulo of ['Publicado', 'Corte pedido', 'Hoy']) assert.ok(vencida.includes(`>${rotulo}</div>`), rotulo);
    assert.match(admin.htmlDeCiclo({ ...PAUTA, proxima: HOY }), />Vence<\/div>/);
    assert.doesNotMatch(admin.htmlDeCiclo({ ...PAUTA, proxima: '2026-10-16' }), />Vence<\/div>/);
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
    assert.deepEqual(plano(vm.runInContext('estadoDeLista', contexto)), { filtro: '', busqueda: '', gestion: '', tipo: '', requiereNota: '', pagina: 1 });
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

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.4): Sí es 1 y No es 0 (el 0 es un valor, no
  // "falta"); un externo sin dato y toda la gestión interna quedan afuera de los dos
  describe('filtro «Requiere nota»', () => {
    const CON_NOTA = [
      dataset({ id: 1, requiere_nota: 1 }),
      dataset({ id: 2, requiere_nota: 0 }),
      dataset({ id: 3, requiere_nota: null }),
      dataset({ id: 4 }),
      eventual({ id: 5, requiere_nota: null }),
      dataset({ id: 6, requiere_nota: 1, tipo_gestion: 'interna' }),
      dataset({ id: 7, requiere_nota: 0, tipo_gestion: 'interna' }),
      dataset({ id: 8, requiere_nota: 1 })
    ];
    const conNota = (filtros) => ids(a.filtrarPorBarra(CON_NOTA, filtros));

    it('Sí deja solo externos con 1', () => {
      assert.deepEqual(conNota({ requiereNota: '1' }), [1, 8]);
    });

    it('No deja solo externos con 0 (el cero cuenta como valor)', () => {
      assert.deepEqual(conNota({ requiereNota: '0' }), [2]);
    });

    it('sin elegir (Todos) deja pasar a todos, también a los que no tienen el dato', () => {
      assert.deepEqual(conNota({ requiereNota: '' }), [1, 2, 3, 4, 5, 6, 7, 8]);
      assert.deepEqual(conNota({}), [1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('se combina con la gestión, el tipo y la búsqueda', () => {
      assert.deepEqual(conNota({ requiereNota: '1', gestion: 'externa' }), [1, 8]);
      assert.deepEqual(conNota({ requiereNota: '1', gestion: 'interna' }), []);
      assert.deepEqual(conNota({ requiereNota: '1', busqueda: 'pauta', tipo: 'acumulado' }), [1, 8]);
      assert.deepEqual(conNota({ requiereNota: '0', tipo: 'eventual' }), []);
    });

    it('la vista de la lista cuenta los estados con el filtro aplicado', () => {
      const lista = [dataset({ id: 1, requiere_nota: 1 }), dataset({ id: 2, requiere_nota: 0 }), vencido({ id: 3, requiere_nota: 0 })];
      const vista = plano(a.vistaDeLista(lista, { requiereNota: '0', pagina: 1 }, []));
      assert.deepEqual(vista.items.map((d) => d.id), [2, 3]);
      assert.equal(vista.cuentas.todos, 2);
      assert.equal(vista.cuentas.vencido, 1);
    });
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
    assert.match(a.htmlDeLaLista(LISTA, { pendientes: [], esAdmin: true, hoy: HOY }).filas, /Vence el 31\/01\/2027/);
    assert.doesNotMatch(a.htmlDeLaLista(LISTA, { pendientes: [], esAdmin: true, hoy: '2999-01-01' }).filas, /Vence el/);
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

  it('la barra suma el filtro «Requiere nota» (Todos, Sí, No), con su etiqueta y después del tipo de pedido', () => {
    assert.match(PAGINA_ADMIN, /<label class="ad-vh" for="filtro-requiere-nota">Requiere nota DGMIT<\/label>\s*<select id="filtro-requiere-nota">/);
    const filtro = PAGINA_ADMIN.match(/<select id="filtro-requiere-nota">([\s\S]*?)<\/select>/)[1];
    assert.deepEqual([...filtro.matchAll(/<option value="([^"]*)">([^<]*)</g)].map((m) => [m[1], m[2]]),
      [['', 'Requiere nota: todos'], ['1', 'Requiere nota: Sí'], ['0', 'Requiere nota: No']]);
    assert.ok(PAGINA_ADMIN.indexOf('id="filtro-requiere-nota"') > PAGINA_ADMIN.indexOf('id="filtro-tipo"'));
    assert.ok(PAGINA_ADMIN.indexOf('id="filtro-requiere-nota"') < PAGINA_ADMIN.indexOf('id="filtros-estado"'));
  });

  it('los filtros de estado: un grupo con un botón por estado, con aria-pressed', () => {
    const grupo = PAGINA_ADMIN.match(/<div class="ad-estados" id="filtros-estado" role="group" aria-label="Filtrar por estado">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const botones = [...grupo.matchAll(/<button type="button" class="ad-estado-filtro" data-filtro="([^"]*)" aria-pressed="(true|false)"[^>]*>([^<]+)<b><\/b><\/button>/g)]
      .map((m) => [m[1], m[2], m[3].trim()]);
    assert.deepEqual(botones, [
      ['', 'true', 'Todos'], ['vencido', 'false', 'Vencidos'], ['proximo', 'false', 'Vencen en menos de 60 días'], ['al-dia', 'false', 'Actualizados'],
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

  it('el pie dice "RPAD v2.0.0"', () => {
    assert.match(PAGINA_ADMIN, /<span>RPAD v2\.0\.0<\/span>/);
    assert.doesNotMatch(PAGINA_ADMIN, /RPAD v1\.\d\.0/);
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
  // Desde la spec 2026-10-24-metricas-y-reportes (4), «Recibido el» es obligatorio: sin recepción, el mensaje del servidor
  it('sin recepción, el mensaje del servidor; con la recepción y la carga de hoy no hay error', () => {
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: '', cargado: HOY, hoy: HOY }), 'Indicá cuándo se recibieron los datos.');
    assert.equal(admin.errorDeFechasDelRegistro({ recibido: HOY, cargado: HOY, hoy: HOY }), null);
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

// «Recibido el» obligatorio y el origen de los datos (spec 2026-10-24-metricas-y-reportes, 4): las copias mínimas del
// navegador, atadas a services/registroReglas.js, y el paso 2 con el mismo orden de errores que el servidor
describe('admin-fechas.js: «Recibido el» y el origen de los datos', () => {
  it('los mensajes son los del servidor, con el texto exacto', () => {
    const copia = (nombre) => vm.runInContext(nombre, admin);
    assert.equal(copia('MENSAJE_FALTA_RECIBIDO'), MENSAJE_FALTA_RECIBIDO);
    assert.equal(copia('MENSAJE_FALTA_ORIGEN'), MENSAJE_FALTA_ORIGEN);
    assert.equal(copia('MENSAJE_EDICION_REGISTRA'), MENSAJE_EDICION_REGISTRA);
    assert.equal(copia('MENSAJE_FALTA_RECIBIDO'), 'Indicá cuándo se recibieron los datos.');
    assert.equal(copia('MENSAJE_FALTA_ORIGEN'), 'Indicá quién entregó los datos.');
    assert.equal(copia('MENSAJE_EDICION_REGISTRA'), 'Para registrar una actualización, usá «Registrar actualización».');
  });

  it('OPCIONES_ORIGEN son las del servidor: las mismas claves, en el mismo orden, con los mismos textos', () => {
    const copia = plano(vm.runInContext('OPCIONES_ORIGEN', admin));
    assert.deepEqual(copia, { ...OPCIONES_ORIGEN });
    assert.deepEqual(Object.keys(copia), Object.keys(OPCIONES_ORIGEN));
  });

  it('origenSugeridoDe da lo mismo que origenSugerido del servidor (el 0 es un valor)', () => {
    for (const tipo_gestion of ['externa', 'interna', '', undefined, null]) {
      for (const requiere_nota of [0, 1, null, undefined, '0', '1', false, true, '']) {
        const dataset = { tipo_gestion, requiere_nota };
        assert.equal(admin.origenSugeridoDe(dataset), origenSugerido(dataset), JSON.stringify(dataset));
      }
    }
    assert.equal(admin.origenSugeridoDe({ tipo_gestion: 'externa', requiere_nota: 0 }), 'fuente_publica');
    assert.equal(admin.origenSugeridoDe({}), origenSugerido({}));
    assert.equal(admin.origenSugeridoDe(), origenSugerido());
    // Sin dataset no tira (como el resto de este archivo): no sugiere nada
    assert.equal(admin.origenSugeridoDe(null), null);
  });

  it('rotuloDeLaFechaDe da lo mismo que rotuloDeLaFecha del servidor', () => {
    for (const origen of ['area', 'fuente_publica', '', null, undefined, 'x']) {
      assert.equal(admin.rotuloDeLaFechaDe(origen), rotuloDeLaFecha(origen), String(origen));
    }
    assert.equal(admin.rotuloDeLaFechaDe('fuente_publica'), 'Obtenido el');
    assert.equal(admin.rotuloDeLaFechaDe('area'), 'Recibido el');
  });

  it('htmlDeOpcionesDeOrigen: "Elegí una opción" vacía y después las de OPCIONES_ORIGEN, en su orden', () => {
    assert.equal(admin.htmlDeOpcionesDeOrigen(), '<option value="">Elegí una opción</option>'
      + '<option value="area">Los entregó el área</option>'
      + '<option value="fuente_publica">Los obtuvo Datos Públicos de una fuente pública</option>');
  });

  describe('problemaDeFechasDelRegistro', () => {
    const problema = (extra = {}) => plano(admin.problemaDeFechasDelRegistro({ recibido: '2026-10-16', cargado: HOY, hoy: HOY, ...extra }));

    it('problemaDeFechasDelRegistro sin recibido devuelve el campo recibido con el mensaje', () => {
      for (const recibido of ['', undefined, null, '2026-02-31']) {
        assert.deepEqual(problema({ recibido }), { campo: 'recibido', mensaje: 'Indicá cuándo se recibieron los datos.' }, String(recibido));
      }
    });

    it('en externa sin origen devuelve el campo origen', () => {
      for (const origen of ['', undefined, null, 'x']) {
        assert.deepEqual(problema({ gestion: 'externa', origen }), { campo: 'origen', mensaje: 'Indicá quién entregó los datos.' }, String(origen));
      }
      assert.equal(problema({ gestion: 'externa', origen: 'area' }), null);
      assert.equal(problema({ gestion: 'externa', origen: 'fuente_publica' }), null);
      // En interna (o sin gestión) no se pregunta
      assert.equal(problema({ gestion: 'interna', origen: '' }), null);
      assert.equal(problema({ origen: '' }), null);
    });

    it('el orden es el del servidor: la carga, después la recepción y recién después el origen', () => {
      const externaSinNada = { gestion: 'externa', origen: '', recibido: '' };
      assert.deepEqual(problema({ ...externaSinNada, cargado: '' }), { campo: 'cargado', mensaje: 'Falta la fecha de carga en el portal' });
      assert.equal(problema({ ...externaSinNada, cargado: '2026-10-18' }).campo, 'cargado');
      assert.equal(problema(externaSinNada).campo, 'recibido');
      assert.deepEqual(problema({ ...externaSinNada, recibido: '2026-10-18' }), {
        campo: 'recibido', mensaje: 'La fecha de recepción no puede ser posterior a hoy (17/10/2026)'
      });
      assert.equal(problema({ ...externaSinNada, recibido: HOY, cargado: '2026-10-16' }).campo, 'recibido');
      assert.equal(problema({ ...externaSinNada, recibido: '2026-10-16' }).campo, 'origen');
    });

    it('sin argumentos no tira error', () => {
      assert.deepEqual(plano(admin.problemaDeFechasDelRegistro()), { campo: 'cargado', mensaje: 'Falta la fecha de carga en el portal' });
    });
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

  it('arma datos_al, cargado_el, recibido_el, origen_datos y proxima_actualizacion, y nada más (sin notas)', () => {
    assert.deepEqual(cuerpo(), { datos_al: '2026-09-30', cargado_el: HOY, recibido_el: null, origen_datos: null, proxima_actualizacion: '2027-04-30' });
    assert.deepEqual(cuerpo({ recibido: '2026-10-15', gestion: 'externa', origen: 'area' }), {
      datos_al: '2026-09-30', cargado_el: HOY, recibido_el: '2026-10-15', origen_datos: 'area', proxima_actualizacion: '2027-04-30'
    });
  });

  // Spec 2026-10-24-metricas-y-reportes, 4: el origen de los datos va solo en gestión externa
  it('cuerpoDelRegistro lleva origen_datos y en interna null', () => {
    assert.equal(cuerpo({ gestion: 'externa', origen: 'area' }).origen_datos, 'area');
    assert.equal(cuerpo({ gestion: 'externa', origen: 'fuente_publica' }).origen_datos, 'fuente_publica');
    // Sin elegir, o con algo que no es un origen, va null: el servidor responde con su mensaje
    for (const origen of ['', undefined, null, 'x', 'constructor', ['area']]) {
      assert.equal(cuerpo({ gestion: 'externa', origen }).origen_datos, null, String(origen));
    }
    // En gestión interna no se pregunta: null aunque el selector oculto conserve un valor
    for (const origen of ['area', 'fuente_publica', '']) assert.equal(cuerpo({ gestion: 'interna', origen }).origen_datos, null, origen);
    assert.equal(cuerpo({ gestion: undefined, origen: 'area' }).origen_datos, null);
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
    assert.deepEqual(plano(admin.cuerpoDelRegistro()), {
      datos_al: null, cargado_el: null, recibido_el: null, origen_datos: null, proxima_actualizacion: null
    });
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
  // «Recibido el» es obligatorio (spec 2026-10-24-metricas-y-reportes, 4): el formulario de base lo trae
  const formulario = (extra = {}) => ({
    tipo: 'acumulado', eventual: false, mes: '9', anio: '2026', recibido: '2026-10-16', cargado: HOY,
    opcion: '0', opciones: OPCIONES, otraMes: '', otraAnio: '', ...extra
  });
  const revision = (extra = {}, formularioExtra = {}) => plano(admin.revisionDelRegistro({
    formulario: formulario(formularioExtra), errorDatosAl: null, cargando: false, enviando: false, hoy: HOY, ...extra
  }));

  it('con una opción elegida y sin errores se puede proponer (los errores vacíos no cuentan)', () => {
    assert.deepEqual(revision(), { errorFechas: null, campoFechas: null, puedeProponer: true });
  });

  it('sin opción elegida, o con "Otra fecha" incompleta, no', () => {
    assert.equal(revision({}, { opcion: null }).puedeProponer, false);
    assert.equal(revision({}, { opcion: 'otra' }).puedeProponer, false);
    assert.equal(revision({}, { opcion: 'otra', otraMes: '6', otraAnio: '2027' }).puedeProponer, true);
  });

  it('un error en "Datos al" o en las fechas lo frena, y el de las fechas se devuelve para mostrarlo', () => {
    assert.equal(revision({ errorDatosAl: 'Todavía no puede haber datos al 30/11/2026' }).puedeProponer, false);
    assert.deepEqual(revision({}, { cargado: '2026-10-18' }), {
      errorFechas: 'La fecha de carga en el portal no puede ser posterior a hoy (17/10/2026)', campoFechas: 'cargado', puedeProponer: false
    });
  });

  it('campoFechas dice a qué campo del paso 2 se refiere el error (para aria-invalid)', () => {
    assert.equal(revision({}, { cargado: '' }).campoFechas, 'cargado');
    assert.equal(revision({}, { cargado: '2026-10-18' }).campoFechas, 'cargado');
    assert.equal(revision({}, { recibido: '2026-10-18' }).campoFechas, 'recibido');
    assert.equal(revision({}, { recibido: '2026-10-16', cargado: '2026-10-15' }).campoFechas, 'recibido');
    assert.equal(revision({}, { recibido: '2026-10-15', cargado: '2026-10-16' }).campoFechas, null);
  });

  // Lo que falta se avisa recién cuando la persona pasó por el campo (`tocados`), como la próxima del paso 3, que sin elegir
  // solo deja el botón deshabilitado: la ventana recién abierta no muestra errores
  it('sin «Recibido el», o en externa sin el origen, no se puede proponer; el error dice cuál falta solo si ya se tocó', () => {
    const SIN_MENSAJE = { errorFechas: null, campoFechas: null, puedeProponer: false };
    assert.deepEqual(revision({}, { recibido: '' }), SIN_MENSAJE);
    assert.deepEqual(revision({ tocados: ['origen'] }, { recibido: '' }), SIN_MENSAJE);
    assert.deepEqual(revision({ tocados: ['recibido'] }, { recibido: '' }), {
      errorFechas: 'Indicá cuándo se recibieron los datos.', campoFechas: 'recibido', puedeProponer: false
    });
    assert.deepEqual(revision({}, { gestion: 'externa', origen: '' }), SIN_MENSAJE);
    assert.deepEqual(revision({ tocados: ['recibido'] }, { gestion: 'externa', origen: '' }), SIN_MENSAJE);
    assert.deepEqual(revision({ tocados: ['origen'] }, { gestion: 'externa', origen: '' }), {
      errorFechas: 'Indicá quién entregó los datos.', campoFechas: 'origen', puedeProponer: false
    });
    // Con los dos sin completar y los dos tocados, el primero en el orden del servidor: la recepción
    assert.equal(revision({ tocados: ['origen', 'recibido'] }, { gestion: 'externa', origen: '', recibido: '' }).campoFechas, 'recibido');
    assert.equal(revision({}, { gestion: 'externa', origen: 'area' }).puedeProponer, true);
    assert.equal(revision({}, { gestion: 'externa', origen: 'fuente_publica' }).puedeProponer, true);
    assert.equal(revision({}, { gestion: 'interna', origen: '' }).puedeProponer, true);
    // Un eventual tampoco se propone sin la recepción
    assert.equal(revision({}, { eventual: true, opcion: null, recibido: '' }).puedeProponer, false);
    // Un `tocados` que no es una lista cuenta como ninguno
    assert.deepEqual(revision({ tocados: 'recibido' }, { recibido: '' }), SIN_MENSAJE);
  });

  it('los errores que no son "falta" se muestran aunque el campo no se haya tocado (como hasta ahora)', () => {
    assert.equal(revision({}, { recibido: '2026-10-18' }).errorFechas, 'La fecha de recepción no puede ser posterior a hoy (17/10/2026)');
    assert.equal(revision({}, { cargado: '' }).errorFechas, 'Falta la fecha de carga en el portal');
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

  it('frecuencia, tipo de pedido, cuándo vence y lo publicado hoy', () => {
    const html = admin.htmlDeDatosDelPedido(dataset(), HOY);
    assert.equal(html, '<div><dt>Frecuencia:</dt><dd>Trimestralmente</dd></div>'
      + '<div><dt>Tipo de pedido:</dt><dd>Acumulado</dd></div>'
      + '<div><dt>Vence:</dt><dd>31/01/2027</dd></div>'
      + '<div><dt>Publicado hoy:</dt><dd>datos al 31/07/2026</dd></div>');
  });

  it('si ya venció dice "Vencido desde", no "Vence"', () => {
    const html = admin.htmlDeDatosDelPedido(vencido(), HOY);
    assert.match(html, /<dt>Vencido desde:<\/dt><dd>31\/01\/2024<\/dd>/);
    assert.doesNotMatch(html, /<dt>Vence:|Fecha sugerida/);
  });

  it('el día del vencimiento todavía dice "Vence"; al día siguiente, "Vencido desde"', () => {
    assert.match(admin.htmlDeDatosDelPedido(dataset({ proxima_actualizacion: '2026-10-17T03:00:00.000Z' }), HOY), /<dt>Vence:<\/dt><dd>17\/10\/2026<\/dd>/);
    assert.match(admin.htmlDeDatosDelPedido(dataset({ proxima_actualizacion: '2026-10-16T03:00:00.000Z' }), HOY), /<dt>Vencido desde:<\/dt><dd>16\/10\/2026<\/dd>/);
  });

  it('un ejercicio publicado dice "ejercicio aaaa"; sin Datos al, una raya', () => {
    assert.match(admin.htmlDeDatosDelPedido(ejercicio(), HOY), /<dt>Publicado hoy:<\/dt><dd>ejercicio 2025<\/dd>/);
    assert.match(admin.htmlDeDatosDelPedido(dataset({ datos_al: null }), HOY), /<dt>Publicado hoy:<\/dt><dd>—<\/dd>/);
  });

  it('un eventual no tiene vencimiento', () => {
    const html = admin.htmlDeDatosDelPedido(eventual(), HOY);
    assert.match(html, /<dt>Frecuencia:<\/dt><dd>Eventual<\/dd>/);
    assert.doesNotMatch(html, /Vencido desde|<dt>Vence:|Fecha sugerida/);
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

  // «Recibido el» es obligatorio desde la spec 2026-10-24-metricas-y-reportes (4): ya no dice «(opcional)». Su rótulo cambia a
  // «Obtenido el» con la fuente pública (admin.js lo escribe, por eso tiene id)
  it('paso 2: "Recibido el" obligatorio y "Cargado en el portal el", con etiquetas con for', () => {
    assert.doesNotMatch(ventana, /\(opcional\)/);
    assert.match(ventana, /<label for="registrar-recibido" id="registrar-rotulo-recibido">Recibido el<\/label>\s*<input type="date" id="registrar-recibido" required>/);
    assert.match(ventana, /<label for="registrar-cargado">Cargado en el portal el<\/label>\s*<input type="date" id="registrar-cargado" required>/);
    assert.match(ventana, /<p class="ad-error" id="registrar-error-fechas" role="alert" hidden><\/p>/);
  });

  it('paso 2: «¿Quién entregó los datos?», un selector obligatorio que admin.js muestra solo en gestión externa, antes de la fecha', () => {
    assert.match(ventana, /<div class="ad-ancho" id="registrar-campo-origen" hidden>\s*<label for="registrar-origen">¿Quién entregó los datos\?<\/label>\s*<select id="registrar-origen" required><\/select>\s*<\/div>/);
    assert.ok(ventana.indexOf('id="registrar-origen"') < ventana.indexOf('id="registrar-recibido"'), 'el origen va antes de la fecha');
    assert.ok(ventana.indexOf('id="registrar-origen"') > ventana.indexOf('id="registrar-ayuda1"'), 'en el paso 2');
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
    // Con nombre: al recibir el foco, el lector de pantalla dice qué es (role="region", porque un div sin rol no lleva aria-label)
    assert.match(PAGINA_ADMIN, /<div class="ad-marco" id="lista-datasets" tabindex="-1" role="region" aria-label="Lista de datasets">/);
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

// =====================================================
// Registrar actualización: lo que toca el DOM, con una página de mentira (revisión de la Task 9, Ruling 17)
// =====================================================

// Una página mínima: getElementById arma el elemento la primera vez que se lo pide. Cada elemento cuenta cuántas veces se
// le escribió el texto, guarda sus atributos y anota si recibió el foco. querySelector da null y querySelectorAll, una lista
// vacía (la ventana sin tarjetas de opciones), salvo lo que se le indique en `consultas`
const paginaDeMentira = ({ valores = {}, consultas = {} } = {}) => {
  const elementos = new Map();
  const enfocados = [];
  const crear = (id) => {
    let texto = '';
    const atributos = new Map();
    const elemento = {
      id, hidden: false, disabled: false, value: valores[id] ?? '', innerHTML: '', isConnected: true, escrituras: 0, style: {},
      get textContent() { return texto; },
      set textContent(nuevo) { texto = String(nuevo); elemento.escrituras++; },
      getAttribute: (nombre) => (atributos.has(nombre) ? atributos.get(nombre) : null),
      setAttribute: (nombre, valor) => { atributos.set(nombre, String(valor)); },
      removeAttribute: (nombre) => { atributos.delete(nombre); },
      hasAttribute: (nombre) => atributos.has(nombre),
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
      getClientRects: () => [],
      focus: () => { enfocados.push(id); }
    };
    return elemento;
  };
  const documento = {
    activeElement: null,
    getElementById: (id) => { if (!elementos.has(id)) elementos.set(id, crear(id)); return elementos.get(id); },
    querySelector: (selector) => consultas[selector] ?? null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  return { documento, elemento: documento.getElementById, enfocados };
};

describe('admin.js: Registrar actualización, la ventana (con una página de mentira)', () => {
  // admin.js cargado en el vm; después de cargarse se le cambia el document por la página de mentira, y las funciones que
  // tocan la red o los avisos por registros de llamadas
  const armar = ({ valores = {}, consultas = {}, api = {} } = {}) => {
    const { contexto } = cargarAdminJs();
    // «Recibido el» es obligatorio (spec 2026-10-24-metricas-y-reportes, 4): la ventana de base ya lo tiene completo
    const pagina = paginaDeMentira({
      valores: { 'registrar-mes': '9', 'registrar-anio': '2026', 'registrar-cargado': HOY, 'registrar-recibido': '2026-10-16', ...valores },
      consultas
    });
    contexto.document = pagina.documento;
    const llamadas = { exito: [], error: [], recargas: 0, cierres: 0 };
    contexto.avisarExito = (texto) => { llamadas.exito.push(texto); };
    contexto.avisarError = (texto) => { llamadas.error.push(texto); };
    contexto.API = { opcionesDeProxima: async () => ({ opciones: [] }), ...api };
    contexto.recargarLista = async () => { llamadas.recargas++; };
    const registro = vm.runInContext('registro', contexto);
    return { contexto, pagina, llamadas, registro };
  };
  const PAUTA = { id: 10, titulo: 'Pauta Publicitaria', tipo_pedido: 'acumulado', frecuencia_meses: 3, pedido: null };
  // Un radio elegido (la primera opción) para formularioDelRegistro
  const ELEGIDA = { '#registrar-opciones input[name="proxima"]:checked:not(:disabled)': { value: '0' } };
  // La ventana abierta para Pauta, como la deja abrirRegistro
  const abierta = (armado, extra = {}) => {
    Object.assign(armado.registro, {
      dataset: PAUTA, hoy: HOY, opciones: [{ fecha: '2027-04-30' }], errorDatosAl: null, cargando: false, enviando: false,
      origen: armado.pagina.elemento('boton-de-la-fila'), apertura: 1, ...extra
    });
    armado.pagina.elemento('modal-registrar-actualizacion').hidden = false;
  };
  // Una promesa que el test resuelve cuando quiere (el POST en vuelo)
  const enVuelo = () => { let resolver; const promesa = new Promise((r) => { resolver = r; }); return { promesa, resolver }; };

  describe('mostrarError', () => {
    it('no vuelve a escribir el mismo texto: el lugar es role="alert" y el lector de pantalla lo anunciaría otra vez', () => {
      const { contexto, pagina } = armar();
      const lugar = pagina.elemento('registrar-error-fechas');
      contexto.mostrarError('registrar-error-fechas', 'Falta la fecha de carga en el portal');
      contexto.mostrarError('registrar-error-fechas', 'Falta la fecha de carga en el portal');
      assert.equal(lugar.escrituras, 1);
      assert.equal(lugar.hidden, false);
      contexto.mostrarError('registrar-error-fechas', null);
      contexto.mostrarError('registrar-error-fechas', null);
      assert.equal(lugar.escrituras, 2);
      assert.equal(lugar.hidden, true);
      assert.equal(lugar.textContent, '');
    });

    it('marca los campos del error con aria-invalid y aria-describedby, y los desmarca cuando el error se va', () => {
      const { contexto, pagina } = armar();
      const mes = pagina.elemento('registrar-mes');
      const anio = pagina.elemento('registrar-anio');
      const campos = ['registrar-mes', 'registrar-anio'];
      contexto.mostrarError('registrar-error-datos', 'Todavía no puede haber datos al 30/11/2026', { campos });
      for (const campo of [mes, anio]) {
        assert.equal(campo.getAttribute('aria-invalid'), 'true', campo.id);
        assert.equal(campo.getAttribute('aria-describedby'), 'registrar-error-datos', campo.id);
      }
      contexto.mostrarError('registrar-error-datos', null, { campos });
      for (const campo of [mes, anio]) {
        assert.equal(campo.hasAttribute('aria-invalid'), false, campo.id);
        assert.equal(campo.hasAttribute('aria-describedby'), false, campo.id);
      }
    });

    it('en el paso 2 marca solo el campo del error, y la marca pasa de uno a otro', () => {
      const { contexto, pagina } = armar();
      const campos = ['registrar-recibido', 'registrar-cargado'];
      const recibido = pagina.elemento('registrar-recibido');
      const cargado = pagina.elemento('registrar-cargado');
      contexto.mostrarError('registrar-error-fechas', 'Falta la fecha de carga en el portal', { campos, invalidos: ['registrar-cargado'] });
      assert.equal(cargado.getAttribute('aria-invalid'), 'true');
      assert.equal(recibido.hasAttribute('aria-invalid'), false);
      contexto.mostrarError('registrar-error-fechas', 'La fecha de recepción no puede ser posterior a hoy (17/10/2026)', { campos, invalidos: ['registrar-recibido'] });
      assert.equal(recibido.getAttribute('aria-invalid'), 'true');
      assert.equal(recibido.getAttribute('aria-describedby'), 'registrar-error-fechas');
      assert.equal(cargado.hasAttribute('aria-invalid'), false);
      assert.equal(cargado.hasAttribute('aria-describedby'), false);
    });

    it('describedbyCon suma o saca el id del error sin tocar los demás', () => {
      const { contexto } = armar();
      assert.equal(contexto.describedbyCon(null, 'e', true), 'e');
      assert.equal(contexto.describedbyCon('ayuda', 'e', true), 'ayuda e');
      assert.equal(contexto.describedbyCon('ayuda e', 'e', true), 'ayuda e');
      assert.equal(contexto.describedbyCon('ayuda e', 'e', false), 'ayuda');
      assert.equal(contexto.describedbyCon('e', 'e', false), null);
      assert.equal(contexto.describedbyCon('', 'e', false), null);
    });
  });

  // Spec 2026-10-24-metricas-y-reportes, 4: «¿Quién entregó los datos?» solo en gestión externa, con lo sugerido, y la fecha que
  // se llama «Recibido el» u «Obtenido el» según el origen
  describe('«Recibido el» y el origen de los datos', () => {
    const EXTERNO = { ...PAUTA, tipo_gestion: 'externa', requiere_nota: 1 };
    // abrirRegistro busca el dataset en la lista de la página
    const abrir = (armado, dataset) => {
      armado.contexto.__lista = [dataset];
      vm.runInContext('datasets = __lista', armado.contexto);
      armado.contexto.abrirRegistro(dataset.id, armado.pagina.elemento('boton-de-la-fila'));
    };
    const rotulo = (armado) => armado.pagina.elemento('registrar-rotulo-recibido').textContent;

    it('al abrir, «Recibido el» viene vacío', () => {
      const armado = armar();
      abrir(armado, EXTERNO);
      assert.equal(armado.pagina.elemento('registrar-recibido').value, '');
    });

    it('un externo con «Requiere nota DGMIT: No» viene con la fuente pública elegida, y la fecha se llama «Obtenido el»', () => {
      const armado = armar();
      abrir(armado, { ...EXTERNO, requiere_nota: 0 });
      assert.equal(armado.pagina.elemento('registrar-campo-origen').hidden, false);
      assert.equal(armado.pagina.elemento('registrar-origen').value, 'fuente_publica');
      assert.equal(rotulo(armado), 'Obtenido el');
    });

    it('un externo con «Sí» (o sin dato) viene sin elegir, y la fecha se llama «Recibido el»', () => {
      for (const requiere_nota of [1, null]) {
        const armado = armar({ valores: { 'registrar-origen': 'fuente_publica' } });
        abrir(armado, { ...EXTERNO, requiere_nota });
        assert.equal(armado.pagina.elemento('registrar-campo-origen').hidden, false);
        assert.equal(armado.pagina.elemento('registrar-origen').value, '', String(requiere_nota));
        assert.equal(rotulo(armado), 'Recibido el');
      }
    });

    it('una interna no pregunta el origen: el selector queda oculto y vacío, y la fecha es «Recibido el»', () => {
      const armado = armar({ valores: { 'registrar-origen': 'area' } });
      abrir(armado, { ...PAUTA, tipo_gestion: 'interna', requiere_nota: null });
      assert.equal(armado.pagina.elemento('registrar-campo-origen').hidden, true);
      assert.equal(armado.pagina.elemento('registrar-origen').value, '');
      assert.equal(rotulo(armado), 'Recibido el');
    });

    it('al cambiar el origen, el rótulo cambia, y el origen viaja en el cuerpo', () => {
      const armado = armar({ consultas: ELEGIDA });
      abrir(armado, EXTERNO);
      const origen = armado.pagina.elemento('registrar-origen');
      origen.value = 'fuente_publica';
      armado.contexto.alCambiarElFormulario();
      assert.equal(rotulo(armado), 'Obtenido el');
      origen.value = 'area';
      armado.contexto.alCambiarElFormulario();
      assert.equal(rotulo(armado), 'Recibido el');
      const formulario = armado.contexto.formularioDelRegistro();
      assert.equal(formulario.gestion, 'externa');
      assert.equal(armado.contexto.cuerpoDelRegistro(formulario).origen_datos, 'area');
    });

    // Lo que falta se avisa recién cuando la persona pasó por el campo: la ventana recién abierta no muestra errores (como la
    // próxima del paso 3, que sin elegir solo deja el botón deshabilitado)
    describe('lo que falta, recién cuando se tocó el campo', () => {
      // Con una opción de la próxima elegida: lo único que falta es lo del paso 2
      const OPCION = { opcionesDeProxima: async () => ({ opciones: [{ fecha: '2027-04-30' }] }) };
      const abrirYEsperar = async (armado, dataset) => {
        abrir(armado, dataset);
        await new Promise((listo) => setImmediate(listo)); // llegan las opciones
      };
      const estado = (armado) => ({
        mensaje: armado.pagina.elemento('registrar-error-fechas').hidden ? null : armado.pagina.elemento('registrar-error-fechas').textContent,
        recibidoInvalido: armado.pagina.elemento('registrar-recibido').getAttribute('aria-invalid'),
        origenInvalido: armado.pagina.elemento('registrar-origen').getAttribute('aria-invalid'),
        deshabilitado: armado.pagina.elemento('registrar-proponer').disabled
      });
      const SIN_NADA = { mensaje: null, recibidoInvalido: null, origenInvalido: null, deshabilitado: true };

      it('al abrir no hay mensaje ni aria-invalid, y «Proponer actualización» queda deshabilitado', async () => {
        for (const dataset of [EXTERNO, { ...PAUTA, tipo_gestion: 'interna', requiere_nota: null }]) {
          const armado = armar({ consultas: ELEGIDA, api: OPCION });
          await abrirYEsperar(armado, dataset);
          assert.deepEqual(estado(armado), SIN_NADA, dataset.tipo_gestion);
          assert.equal(armado.pagina.elemento('registrar-error-fechas').textContent, '');
        }
      });

      it('al pasar por «Recibido el» y dejarlo vacío, aparecen el mensaje y aria-invalid; con la fecha se van', async () => {
        const armado = armar({ consultas: ELEGIDA, api: OPCION });
        await abrirYEsperar(armado, { ...PAUTA, tipo_gestion: 'interna', requiere_nota: null });
        armado.contexto.tocarCampoDelRegistro('recibido');
        assert.deepEqual(estado(armado), { ...SIN_NADA, mensaje: 'Indicá cuándo se recibieron los datos.', recibidoInvalido: 'true' });
        assert.equal(armado.pagina.elemento('registrar-recibido').getAttribute('aria-describedby'), 'registrar-error-fechas');
        armado.pagina.elemento('registrar-recibido').value = '2026-10-16';
        armado.contexto.alCambiarElFormulario();
        assert.deepEqual(estado(armado), { ...SIN_NADA, deshabilitado: false });
      });

      it('en un externo, lo mismo con el origen: sin tocarlo no avisa, pero el botón sigue deshabilitado', async () => {
        const armado = armar({ consultas: ELEGIDA, api: OPCION });
        await abrirYEsperar(armado, EXTERNO);
        armado.pagina.elemento('registrar-recibido').value = '2026-10-16';
        armado.contexto.tocarCampoDelRegistro('recibido');
        assert.deepEqual(estado(armado), SIN_NADA, 'con la fecha y sin tocar el origen');
        armado.contexto.tocarCampoDelRegistro('origen');
        assert.deepEqual(estado(armado), { ...SIN_NADA, mensaje: 'Indicá quién entregó los datos.', origenInvalido: 'true' });
        armado.pagina.elemento('registrar-origen').value = 'area';
        armado.contexto.alCambiarElFormulario();
        assert.deepEqual(estado(armado), { ...SIN_NADA, deshabilitado: false });
      });

      it('con los dos tocados y vacíos avisa primero la fecha (el orden del servidor)', async () => {
        const armado = armar({ consultas: ELEGIDA, api: OPCION });
        await abrirYEsperar(armado, EXTERNO);
        armado.contexto.tocarCampoDelRegistro('origen');
        assert.deepEqual(estado(armado), SIN_NADA, 'la fecha falta y no se tocó: no hay mensaje');
        armado.contexto.tocarCampoDelRegistro('recibido');
        assert.deepEqual(estado(armado), { ...SIN_NADA, mensaje: 'Indicá cuándo se recibieron los datos.', recibidoInvalido: 'true' });
      });

      it('al cerrar se borra el error del paso 2, y al abrir otra vez no hay nada tocado', async () => {
        const armado = armar({ consultas: ELEGIDA, api: OPCION });
        await abrirYEsperar(armado, EXTERNO);
        armado.contexto.tocarCampoDelRegistro('recibido');
        assert.equal(estado(armado).mensaje, 'Indicá cuándo se recibieron los datos.');
        armado.contexto.cerrarRegistro();
        assert.equal(armado.pagina.elemento('registrar-error-fechas').hidden, true);
        assert.equal(armado.pagina.elemento('registrar-error-fechas').textContent, '');
        assert.equal(armado.pagina.elemento('registrar-recibido').hasAttribute('aria-invalid'), false);
        assert.deepEqual(plano(armado.registro.tocados), []);
        await abrirYEsperar(armado, EXTERNO);
        assert.deepEqual(estado(armado), SIN_NADA);
      });

      it('los campos se marcan como tocados al cambiarlos o al salir de ellos', () => {
        assert.match(CODIGO_ADMIN, /addEventListener\('change', \(\) => tocarCampoDelRegistro\(campo\)\)/);
        assert.match(CODIGO_ADMIN, /addEventListener\('blur', \(\) => tocarCampoDelRegistro\(campo\)\)/);
        assert.match(CODIGO_ADMIN, /\['registrar-recibido', 'recibido'\], \['registrar-origen', 'origen'\]/);
      });
    });
  });

  describe('revisarRegistro', () => {
    it('marca el campo del paso 2 que tiene el error', () => {
      const armado = armar({ valores: { 'registrar-recibido': '2026-10-18' }, consultas: ELEGIDA });
      abierta(armado);
      armado.contexto.revisarRegistro();
      assert.equal(armado.pagina.elemento('registrar-error-fechas').textContent, 'La fecha de recepción no puede ser posterior a hoy (17/10/2026)');
      assert.equal(armado.pagina.elemento('registrar-recibido').getAttribute('aria-invalid'), 'true');
      assert.equal(armado.pagina.elemento('registrar-cargado').hasAttribute('aria-invalid'), false);
      assert.equal(armado.pagina.elemento('registrar-proponer').disabled, true);
    });
  });

  describe('el error del envío se borra al cambiar el formulario', () => {
    const conErrorDeEnvio = (armado) => {
      armado.contexto.mostrarError('registrar-error', 'La próxima actualización tiene que ser el último día de un mes (febrero, el 28)');
      assert.equal(armado.pagina.elemento('registrar-error').hidden, false);
    };

    it('al cambiar "Datos al"', async () => {
      const armado = armar();
      abierta(armado);
      conErrorDeEnvio(armado);
      armado.contexto.alCambiarDatosAl();
      assert.equal(armado.pagina.elemento('registrar-error').hidden, true);
    });

    it('al elegir una opción', () => {
      const armado = armar({ consultas: ELEGIDA });
      abierta(armado);
      conErrorDeEnvio(armado);
      const radio = { value: '0', checked: true };
      armado.contexto.alElegirOpcion({ target: { closest: () => radio } });
      assert.equal(armado.pagina.elemento('registrar-error').hidden, true);
    });

    it('al cambiar las fechas o la otra fecha', () => {
      const armado = armar({ consultas: ELEGIDA });
      abierta(armado);
      conErrorDeEnvio(armado);
      armado.contexto.alCambiarElFormulario();
      assert.equal(armado.pagina.elemento('registrar-error').hidden, true);
    });

    it('pero no cuando revisarRegistro se llama solo (por ejemplo, después de mostrar el error del envío)', () => {
      const armado = armar({ consultas: ELEGIDA });
      abierta(armado);
      conErrorDeEnvio(armado);
      armado.contexto.revisarRegistro();
      assert.equal(armado.pagina.elemento('registrar-error').hidden, false);
    });
  });

  describe('proponerActualizacion', () => {
    it('sale bien con la misma ventana abierta: avisa, la cierra, recarga la lista y, si el botón ya no está, enfoca la lista', async () => {
      const post = enVuelo();
      const armado = armar({ consultas: ELEGIDA, api: { registrarActualizacion: () => post.promesa } });
      abierta(armado);
      const origen = armado.registro.origen;
      armado.contexto.recargarLista = async () => { armado.llamadas.recargas++; origen.isConnected = false; };
      const pedido = armado.contexto.proponerActualizacion();
      assert.equal(armado.pagina.elemento('registrar-proponer').disabled, true, 'deshabilitado mientras envía');
      post.resolver({ cambio_pendiente_id: 1 });
      await pedido;
      assert.deepEqual(armado.llamadas.exito, ['Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.']);
      assert.equal(armado.llamadas.recargas, 1);
      assert.equal(armado.pagina.elemento('modal-registrar-actualizacion').hidden, true);
      assert.equal(armado.pagina.enfocados.at(-1), 'lista-datasets');
      assert.deepEqual(armado.llamadas.error, []);
    });

    it('si mientras se enviaba se cerró y se abrió otra ventana, esa no se toca: igual avisa y recarga la lista', async () => {
      const post = enVuelo();
      const armado = armar({ consultas: ELEGIDA, api: { registrarActualizacion: () => post.promesa } });
      abierta(armado);
      const pedido = armado.contexto.proponerActualizacion();
      // Escape, y "Registrar actualización" de otro dataset (B)
      armado.contexto.cerrarRegistro();
      const botonB = armado.pagina.elemento('boton-de-B');
      abierta(armado, { dataset: { ...PAUTA, id: 11 }, apertura: 2, origen: botonB });
      armado.pagina.enfocados.length = 0;
      post.resolver({ cambio_pendiente_id: 1 });
      await pedido;
      assert.deepEqual(armado.llamadas.exito, ['Actualización propuesta. Queda pendiente de aprobación en Mi Perfil.']);
      assert.equal(armado.llamadas.recargas, 1);
      assert.equal(armado.pagina.elemento('modal-registrar-actualizacion').hidden, false, 'la ventana de B sigue abierta');
      assert.equal(armado.registro.dataset.id, 11);
      assert.equal(armado.registro.origen, botonB);
      assert.deepEqual(armado.pagina.enfocados, [], 'nadie le saca el foco a la ventana de B');
    });

    it('si se cerró mientras se enviaba (sin abrir otra), avisa y recarga, sin mover el foco', async () => {
      const post = enVuelo();
      const armado = armar({ consultas: ELEGIDA, api: { registrarActualizacion: () => post.promesa } });
      abierta(armado);
      const pedido = armado.contexto.proponerActualizacion();
      armado.contexto.cerrarRegistro();
      armado.pagina.enfocados.length = 0;
      post.resolver({});
      await pedido;
      assert.equal(armado.llamadas.exito.length, 1);
      assert.equal(armado.llamadas.recargas, 1);
      assert.deepEqual(armado.pagina.enfocados, []);
    });

    it('si falla la recarga de la lista no dice "No se pudo proponer": la propuesta se hizo', async () => {
      const armado = armar({ consultas: ELEGIDA, api: { registrarActualizacion: async () => ({}) } });
      abierta(armado);
      armado.contexto.recargarLista = async () => { throw new Error('sin conexión'); };
      await armado.contexto.proponerActualizacion();
      assert.equal(armado.llamadas.exito.length, 1);
      assert.deepEqual(armado.llamadas.error, ['La actualización quedó propuesta, pero no se pudo recargar la lista. Recargá la página.']);
      assert.equal(armado.pagina.elemento('registrar-error').hidden, true);
    });

    it('si el servidor la rechaza, el error queda en la ventana y el botón se vuelve a habilitar', async () => {
      const armado = armar({ consultas: ELEGIDA, api: { registrarActualizacion: async () => { throw new Error('Falta la próxima actualización: es obligatoria salvo con la frecuencia Eventual'); } } });
      abierta(armado);
      await armado.contexto.proponerActualizacion();
      const error = armado.pagina.elemento('registrar-error');
      assert.equal(error.hidden, false);
      assert.equal(error.textContent, 'Falta la próxima actualización: es obligatoria salvo con la frecuencia Eventual');
      assert.equal(armado.pagina.elemento('registrar-proponer').disabled, false);
      assert.equal(armado.llamadas.recargas, 0);
      assert.deepEqual(armado.llamadas.exito, []);
    });
  });
});

// =====================================================
// Formulario del dataset (spec 2026-10-17-fechas-datasets, 8.4): alta y edición, "Actualización y pedido" y la vista previa
// =====================================================

describe('admin-fechas.js: tipos de pedido del formulario', () => {
  it('los tipos y sus nombres son los del servidor (NOMBRES_TIPO_PEDIDO), en el mismo orden', () => {
    assert.deepEqual(plano(vm.runInContext('TIPOS_DE_PEDIDO', admin)), TIPOS_PEDIDO.map((tipo) => [tipo, NOMBRES_TIPO_PEDIDO[tipo]]));
  });

  it('tipoSugeridoDe: Eventual → eventual, interna → relevamiento, 12 meses o menos → acumulado, más → foto', () => {
    assert.equal(admin.tipoSugeridoDe('externa', null), 'eventual');
    assert.equal(admin.tipoSugeridoDe('interna', null), 'eventual');
    assert.equal(admin.tipoSugeridoDe('interna', 3), 'relevamiento');
    assert.equal(admin.tipoSugeridoDe('externa', 1), 'acumulado');
    assert.equal(admin.tipoSugeridoDe('externa', 12), 'acumulado');
    assert.equal(admin.tipoSugeridoDe('externa', 24), 'foto');
  });

  it('tipoSugeridoDe es una copia de tipoSugerido del servidor: dan lo mismo', () => {
    for (const gestion of ['externa', 'interna', '', undefined]) {
      for (const meses of [null, undefined, 0, -3, 1, 2, 3, 4, 6, 12, 13, 24, 36, 48, 120, 2.5, '3']) {
        assert.equal(admin.tipoSugeridoDe(gestion, meses), tipoSugerido(gestion, meses), `${gestion} ${meses}`);
      }
    }
  });

  it('frecuenciaEnNotaDe: un acumulado de menos de un año lleva "(Acumulado)"; lo demás, la frecuencia tal cual', () => {
    assert.equal(admin.frecuenciaEnNotaDe({ frecuencia: 'Trimestralmente', tipo: 'acumulado', meses: 3 }), 'Trimestralmente (Acumulado)');
    assert.equal(admin.frecuenciaEnNotaDe({ frecuencia: 'Cada medio año', tipo: 'acumulado', meses: 6 }), 'Cada medio año (Acumulado)');
    assert.equal(admin.frecuenciaEnNotaDe({ frecuencia: 'Anualmente', tipo: 'acumulado', meses: 12 }), 'Anualmente');
    assert.equal(admin.frecuenciaEnNotaDe({ frecuencia: 'Trimestralmente', tipo: 'foto', meses: 3 }), 'Trimestralmente');
    assert.equal(admin.frecuenciaEnNotaDe({ frecuencia: 'Eventual', tipo: 'eventual', meses: null }), 'Eventual');
  });

  it('frecuenciaEnNotaDe: sin nombre de frecuencia devuelve lo que recibió, y sin argumento no rompe', () => {
    for (const frecuencia of [null, undefined, '']) {
      assert.equal(admin.frecuenciaEnNotaDe({ frecuencia, tipo: 'acumulado', meses: 3 }), frecuencia);
    }
    assert.equal(admin.frecuenciaEnNotaDe(), undefined);
    assert.equal(admin.frecuenciaEnNotaDe(null), undefined);
  });

  it('frecuenciaEnNotaDe es una copia de frecuenciaEnNota del servidor: dan lo mismo', () => {
    for (const frecuencia of ['Trimestralmente', 'Anualmente', '', null, undefined]) {
      for (const tipo of [...TIPOS_PEDIDO, null, 'otro']) {
        for (const meses of [null, undefined, 0, -3, 1, 3, 4, 6, 11, 12, 24, 2.5, '3']) {
          assert.equal(admin.frecuenciaEnNotaDe({ frecuencia, tipo, meses }), frecuenciaEnNota({ frecuencia, tipo, meses }), `${frecuencia} ${tipo} ${meses}`);
        }
      }
    }
    for (const entrada of [null, undefined]) assert.equal(admin.frecuenciaEnNotaDe(entrada), frecuenciaEnNota(entrada));
    assert.equal(admin.frecuenciaEnNotaDe(), frecuenciaEnNota());
  });

  it('tiposPermitidos: con meses, todos menos eventual', () => {
    const conMeses = TIPOS_PEDIDO.filter((tipo) => tipo !== 'eventual');
    for (const meses of [1, 3, 12, 24, 120]) assert.deepEqual(plano(admin.tiposPermitidos(meses)), conMeses, String(meses));
  });

  it('tiposPermitidos: sin meses (la frecuencia Eventual) solo eventual', () => {
    assert.deepEqual(plano(admin.tiposPermitidos(null)), ['eventual']);
    assert.deepEqual(plano(admin.tiposPermitidos(0)), ['eventual']);
  });

  it('tiposPermitidos: sin frecuencia elegida (undefined) no ofrece eventual, que va solo con su frecuencia', () => {
    assert.equal(admin.tiposPermitidos(undefined).includes('eventual'), false);
    assert.equal(admin.tiposPermitidos(undefined).length, 6);
  });

  it('htmlDeTiposDePedido: una opción por tipo permitido, con su nombre, y marca el elegido', () => {
    const html = admin.htmlDeTiposDePedido(3, 'foto');
    assert.deepEqual([...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]), TIPOS_PEDIDO.filter((t) => t !== 'eventual'));
    assert.ok(html.includes('<option value="foto" selected>Foto al corte</option>'));
    assert.equal(cantidad(html, 'selected'), 1);
    assert.equal(admin.htmlDeTiposDePedido(null, 'eventual'), '<option value="eventual" selected>Eventual</option>');
  });

  it('tipoCoherente: con Eventual queda eventual; al dejar Eventual pasa al sugerido; un tipo permitido no cambia', () => {
    assert.equal(admin.tipoCoherente('acumulado', null, 'externa'), 'eventual');
    assert.equal(admin.tipoCoherente('eventual', 3, 'externa'), 'acumulado');
    assert.equal(admin.tipoCoherente('eventual', 24, 'externa'), 'foto');
    assert.equal(admin.tipoCoherente('eventual', 6, 'interna'), 'relevamiento');
    assert.equal(admin.tipoCoherente('ejercicio', 12, 'externa'), 'ejercicio');
    assert.equal(admin.tipoCoherente('edicion', 48, 'interna'), 'edicion');
  });

  it('tipoCoherente: sin tipo, o con uno que no existe, da el sugerido; sin frecuencia elegida, acumulado', () => {
    assert.equal(admin.tipoCoherente(null, 24, 'externa'), 'foto');
    assert.equal(admin.tipoCoherente('cualquiera', 3, 'interna'), 'relevamiento');
    assert.equal(admin.tipoCoherente(null, undefined, 'externa'), 'acumulado');
    assert.equal(admin.tipoCoherente('foto', undefined, 'externa'), 'foto');
  });

  it('htmlDeSugerencia: "Es el sugerido…" si coincide; si no, cuál se sugiere y el botón "Usar el sugerido"', () => {
    assert.equal(admin.htmlDeSugerencia('acumulado', 'acumulado'), 'Es el sugerido para esta gestión y frecuencia.');
    const otro = admin.htmlDeSugerencia('acumulado', 'foto');
    assert.ok(otro.startsWith('Para esta gestión y frecuencia se sugiere "Foto al corte". '));
    assert.match(otro, /<button type="button" data-usar-sugerido>Usar el sugerido<\/button>$/);
  });

  it('htmlDeSugerencia: con Eventual lo dice; sin sugerido (sin frecuencia) no dice nada', () => {
    assert.equal(admin.htmlDeSugerencia('eventual', 'eventual'), 'Con la frecuencia Eventual, el tipo de pedido es siempre Eventual.');
    assert.equal(admin.htmlDeSugerencia('acumulado', null), '');
  });
});

describe('admin-fechas.js: frases de período en "Qué se solicita"', () => {
  const FRASES = ['siguiente al último', 'nuevo período', 'nuevo ejercicio', 'fecha de corte', 'posterior al último', 'desde la última actualización'];

  it('frasesDePeriodo encuentra cada una de las 6 frases de la spec', () => {
    for (const frase of FRASES) {
      assert.deepEqual(plano(admin.frasesDePeriodo(`Los datos ${frase} publicado.`)), [frase], frase);
    }
  });

  it('frasesDePeriodo no distingue mayúsculas', () => {
    for (const frase of FRASES) {
      assert.deepEqual(plano(admin.frasesDePeriodo(frase.toUpperCase())), [frase], frase.toUpperCase());
    }
    assert.deepEqual(plano(admin.frasesDePeriodo('A la Fecha de Corte del Nuevo Período')), ['nuevo período', 'fecha de corte']);
  });

  it('frasesDePeriodo tampoco distingue tildes: "nuevo periodo" cuenta', () => {
    assert.deepEqual(plano(admin.frasesDePeriodo('en el nuevo periodo, siguiente al ultimo publicado')), ['siguiente al último', 'nuevo período']);
  });

  it('frasesDePeriodo da una lista vacía sin frases o sin texto', () => {
    assert.deepEqual(plano(admin.frasesDePeriodo('La planilla de pauta publicitaria, con el monto de cada orden.')), []);
    for (const valor of ['', null, undefined, 42]) assert.deepEqual(plano(admin.frasesDePeriodo(valor)), [], String(valor));
  });

  it('avisarFrases: solo en los tipos que ponen fechas en la nota', () => {
    for (const tipo of ['acumulado', 'foto', 'anio_anterior', 'ejercicio']) assert.equal(admin.avisarFrases(tipo), true, tipo);
    for (const tipo of ['relevamiento', 'edicion', 'eventual', '', null, undefined]) assert.equal(admin.avisarFrases(tipo), false, String(tipo));
  });

  it('textoDeAvisoDeFrases: una frase, varias, ninguna', () => {
    assert.equal(admin.textoDeAvisoDeFrases([]), null);
    assert.equal(admin.textoDeAvisoDeFrases(['nuevo período']),
      '"nuevo período" habla del período, y eso lo agrega el sistema en "Datos solicitados". Conviene sacarlo para que la nota no se contradiga.');
    assert.equal(admin.textoDeAvisoDeFrases(['nuevo período', 'fecha de corte']),
      '"nuevo período" y "fecha de corte" hablan del período, y eso lo agrega el sistema en "Datos solicitados". Conviene sacarlas para que la nota no se contradiga.');
    assert.equal(admin.textoDeAvisoDeFrases(['a', 'b', 'c']).slice(0, 18), '"a", "b" y "c" hab');
  });
});

describe('admin-fechas.js: fechaDeSelectores (Ruling 18: lo que no se toca va como está guardado)', () => {
  it('sin tocar el mes ni el año, va la fecha guardada tal cual, aunque no sea fin de mes', () => {
    assert.equal(admin.fechaDeSelectores({ mes: '1', anio: '2027', original: '2027-01-30T03:00:00.000Z' }), '2027-01-30');
    assert.equal(admin.fechaDeSelectores({ mes: '1', anio: '2027', original: '2027-01-31' }), '2027-01-31');
  });

  it('con el mes o el año cambiados, el fin de ese mes', () => {
    assert.equal(admin.fechaDeSelectores({ mes: '2', anio: '2027', original: '2027-01-30' }), '2027-02-28');
    assert.equal(admin.fechaDeSelectores({ mes: '1', anio: '2028', original: '2027-01-30' }), '2028-01-31');
    assert.equal(admin.fechaDeSelectores({ mes: '4', anio: '2027', original: null }), '2027-04-30');
  });

  it('febrero va en 28 también en un año bisiesto', () => {
    assert.equal(admin.fechaDeSelectores({ mes: '2', anio: '2028', original: null }), '2028-02-28');
  });

  it('sin mes o sin año (Sin dato) da null, y una fecha guardada nula sin tocar sigue nula', () => {
    assert.equal(admin.fechaDeSelectores({ mes: '', anio: '2026', original: '2026-07-31' }), null);
    assert.equal(admin.fechaDeSelectores({ mes: '', anio: '2026', original: null }), null);
    assert.equal(admin.fechaDeSelectores({ mes: '', anio: '', original: null }), null);
    assert.equal(admin.fechaDeSelectores({ mes: '7', anio: '', original: null }), null);
  });

  it('solo el año (ejercicio): sin tocar el año va la guardada si ya es un 31/12; con otro año, el 31/12', () => {
    assert.equal(admin.fechaDeSelectores({ soloAnio: true, mes: '12', anio: '2025', original: '2025-12-31' }), '2025-12-31');
    assert.equal(admin.fechaDeSelectores({ soloAnio: true, mes: '7', anio: '2025', original: '2026-07-31' }), '2025-12-31');
    assert.equal(admin.fechaDeSelectores({ soloAnio: true, mes: '', anio: '2025', original: null }), '2025-12-31');
    assert.equal(admin.fechaDeSelectores({ soloAnio: true, mes: '', anio: '', original: '2025-12-31' }), null);
  });

  it('solo el año (ejercicio): una guardada que no es 31/12 (un dataset que pasa a ejercicio) va como el 31/12 de su año', () => {
    assert.equal(admin.fechaDeSelectores({ soloAnio: true, mes: '7', anio: '2026', original: '2026-07-31' }), '2026-12-31');
    assert.equal(admin.fechaDeSelectores({ soloAnio: true, mes: '7', anio: '2026', original: '2026-07-31T03:00:00.000Z' }), '2026-12-31');
    // Con mes y año (otro tipo) sigue valiendo la guardada tal cual
    assert.equal(admin.fechaDeSelectores({ mes: '7', anio: '2026', original: '2026-07-31' }), '2026-07-31');
  });

  it('una guardada que no es una fecha cuenta como nula', () => {
    assert.equal(admin.fechaDeSelectores({ mes: '', anio: '2026', original: '0000-00-00' }), null);
    assert.equal(admin.fechaDeSelectores({ mes: '3', anio: '2026', original: '0000-00-00' }), '2026-03-31');
  });
});

describe('admin-fechas.js: selectores de "Datos al" y de la próxima del formulario', () => {
  const opcion = (html) => html.match(/<option value="([^"]*)" selected>/)?.[1] ?? null;
  const valores = (html) => [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);

  it('"Datos al" con mes y año: la primera opción del mes es "Sin dato" y los años llegan hasta el actual', () => {
    const s = admin.selectoresDeDatosAl({ mes: 7, anio: 2026, sinDato: false, soloAnio: false, hoy: HOY });
    assert.ok(s.mes.startsWith('<option value="">Sin dato</option>'));
    assert.equal(opcion(s.mes), '7');
    assert.equal(opcion(s.anio), '2026');
    assert.equal(valores(s.anio)[0], '2026');
    assert.equal(s.mesOculto, false);
    assert.equal(s.anioDeshabilitado, false);
  });

  it('"Datos al" en "Sin dato": el mes queda en "Sin dato" y el año, deshabilitado', () => {
    const s = admin.selectoresDeDatosAl({ mes: '', anio: '', sinDato: true, soloAnio: false, hoy: HOY });
    assert.equal(opcion(s.mes), null, 'ningún mes marcado: queda la primera opción, "Sin dato"');
    assert.equal(s.anioDeshabilitado, true);
    assert.equal(opcion(s.anio), '2026', 'el año muestra el actual');
  });

  it('"Datos al" de un ejercicio: solo el año, con "Sin dato" primero y hasta el año siguiente', () => {
    const s = admin.selectoresDeDatosAl({ mes: '', anio: 2025, sinDato: false, soloAnio: true, hoy: HOY });
    assert.equal(s.mesOculto, true);
    assert.equal(s.anioDeshabilitado, false);
    assert.deepEqual(valores(s.anio).slice(0, 3), ['', '2027', '2026']);
    assert.ok(s.anio.startsWith('<option value="">Sin dato</option>'));
    assert.equal(opcion(s.anio), '2025');
    const sinDato = admin.selectoresDeDatosAl({ mes: '', anio: 2025, sinDato: true, soloAnio: true, hoy: HOY });
    assert.equal(opcion(sinDato.anio), '');
  });

  it('al dejar de ser ejercicio, un año elegido sin mes pasa a diciembre', () => {
    const s = admin.selectoresDeDatosAl({ mes: '', anio: 2025, sinDato: false, soloAnio: false, hoy: HOY });
    assert.equal(opcion(s.mes), '12');
    assert.equal(opcion(s.anio), '2025');
  });

  it('un "Datos al" viejo amplía los años', () => {
    const s = admin.selectoresDeDatosAl({ mes: 12, anio: 2010, sinDato: false, soloAnio: false, hoy: HOY });
    assert.equal(valores(s.anio).at(-1), '2010');
  });

  it('la próxima: "Mes" y "Año" primero; con una fecha guardada (ISO con hora), su mes y su año', () => {
    const s = admin.selectoresDeProxima('2027-01-31T03:00:00.000Z', HOY);
    assert.ok(s.mes.startsWith('<option value="">Mes</option>'));
    assert.ok(s.anio.startsWith('<option value="">Año</option>'));
    assert.equal(opcion(s.mes), '1');
    assert.equal(opcion(s.anio), '2027');
    const vacia = admin.selectoresDeProxima(null, HOY);
    assert.equal(opcion(vacia.mes), null);
    assert.equal(opcion(vacia.anio), null);
    assert.ok(valores(vacia.anio).includes('2036'));
    assert.equal(valores(admin.selectoresDeProxima('2024-01-31', HOY).anio).at(-1), '2024', 'una próxima vencida amplía los años');
  });
});

describe('admin-fechas.js: cuerpoDelDataset (el JSON de POST y PUT /datasets)', () => {
  // La Pauta, como la devuelve GET /datasets/:id
  const PAUTA_GET = {
    id: 10, titulo: 'Pauta Publicitaria', frecuencia_id: 3, tipo_gestion: 'externa', requiere_nota: 1,
    ultima_actualizacion: '2026-10-13T03:00:00.000Z', proxima_actualizacion: '2027-01-31T03:00:00.000Z', datos_al: '2026-07-31',
    tipo_pedido: 'acumulado', tipo_pedido_guardado: 'acumulado', tipo_pedido_nombre: 'Acumulado', frecuencia_meses: 3
  };
  // Lo que dice el formulario recién abierto para la Pauta, sin tocar nada
  const formulario = (extra = {}) => ({
    titulo: 'Pauta Publicitaria', area_id: '4', descripcion: 'Órdenes de publicidad', tema_principal_id: '2', tema_secundario_id: '',
    frecuencia_id: '3', formatos: [1, 3], url_dataset: 'https://datos.comodoro.gov.ar/dataset/pauta', observaciones: '',
    que_se_solicita: '  La planilla de órdenes.  ', tipo_gestion: 'externa', requiere_nota: '1', tipo_pedido: 'acumulado', meses: 3,
    cargado: '2026-10-13', datosMes: '7', datosAnio: '2026', proxMes: '1', proxAnio: '2027', original: PAUTA_GET, ...extra
  });

  it('arma todo el cuerpo: números, nulos y textos como hoy, y las fechas', () => {
    assert.deepEqual(plano(admin.cuerpoDelDataset(formulario())), {
      titulo: 'Pauta Publicitaria', area_id: 4, descripcion: 'Órdenes de publicidad', tema_principal_id: 2, tema_secundario_id: null,
      frecuencia_id: 3, formatos: [1, 3], tipo_gestion: 'externa', requiere_nota: 1, tipo_pedido: 'acumulado',
      ultima_actualizacion: '2026-10-13', datos_al: '2026-07-31', proxima_actualizacion: '2027-01-31', url_dataset: 'https://datos.comodoro.gov.ar/dataset/pauta',
      observaciones: null, que_se_solicita: 'La planilla de órdenes.'
    });
  });

  it('cuerpoDelDataset manda requiere_nota 0 con «No», 1 con «Sí» y null con gestión interna', () => {
    const conNota = (extra) => admin.cuerpoDelDataset(formulario(extra)).requiere_nota;
    assert.strictEqual(conNota({ requiere_nota: '1' }), 1);
    // El 0 es un valor: no se pierde como si faltara (nunca `x || null`)
    assert.strictEqual(conNota({ requiere_nota: '0' }), 0);
    assert.strictEqual(conNota({ requiere_nota: 0 }), 0);
    assert.strictEqual(conNota({ requiere_nota: 1 }), 1);
    // Sin elegir, o con cualquier otra cosa, va null (el servidor responde 400 si el dataset es externo)
    assert.strictEqual(conNota({ requiere_nota: '' }), null);
    assert.strictEqual(conNota({ requiere_nota: undefined }), null);
    assert.strictEqual(conNota({ requiere_nota: 'x' }), null);
    // La gestión interna no lleva el dato, aunque el selector (oculto) conserve un valor
    assert.strictEqual(conNota({ tipo_gestion: 'interna', requiere_nota: '1' }), null);
    assert.strictEqual(conNota({ tipo_gestion: 'interna', requiere_nota: '0' }), null);
  });

  it('las fechas cambiadas van como fin de mes, con febrero en 28', () => {
    const cuerpo = admin.cuerpoDelDataset(formulario({ datosMes: '9', proxMes: '2', proxAnio: '2028' }));
    assert.equal(cuerpo.datos_al, '2026-09-30');
    assert.equal(cuerpo.proxima_actualizacion, '2028-02-28');
  });

  it('Ruling 18: una próxima vieja que no es fin de mes, sin tocar, va como está guardada', () => {
    const original = { ...PAUTA_GET, proxima_actualizacion: '2027-01-30T03:00:00.000Z', datos_al: '2026-07-30' };
    const cuerpo = admin.cuerpoDelDataset(formulario({ original }));
    assert.equal(cuerpo.proxima_actualizacion, '2027-01-30');
    assert.equal(cuerpo.datos_al, '2026-07-30');
  });

  it('"Datos al" en "Sin dato" va null; un dataset sin "Datos al" sin tocar sigue null', () => {
    assert.equal(admin.cuerpoDelDataset(formulario({ datosMes: '' })).datos_al, null);
    assert.equal(admin.cuerpoDelDataset(formulario({ original: { ...PAUTA_GET, datos_al: null }, datosMes: '', datosAnio: '2026' })).datos_al, null);
  });

  it('en un ejercicio, "Datos al" se elige por año y va el 31/12', () => {
    const presupuesto = { ...PAUTA_GET, tipo_pedido: 'ejercicio', tipo_pedido_guardado: 'ejercicio', datos_al: '2025-12-31', frecuencia_meses: 12 };
    const base = { tipo_pedido: 'ejercicio', meses: 12, original: presupuesto, datosMes: '12', datosAnio: '2025' };
    assert.equal(admin.cuerpoDelDataset(formulario(base)).datos_al, '2025-12-31');
    assert.equal(admin.cuerpoDelDataset(formulario({ ...base, datosAnio: '2026' })).datos_al, '2026-12-31');
  });

  it('con la frecuencia Eventual la próxima va vacía, aunque los selectores tengan una fecha', () => {
    const cuerpo = admin.cuerpoDelDataset(formulario({ frecuencia_id: '11', meses: null, tipo_pedido: 'eventual' }));
    assert.equal(cuerpo.proxima_actualizacion, null);
    assert.equal(cuerpo.tipo_pedido, 'eventual');
  });

  it('el tipo sin tocar va como está guardado; cambiado, el elegido', () => {
    assert.equal(admin.cuerpoDelDataset(formulario()).tipo_pedido, 'acumulado');
    assert.equal(admin.cuerpoDelDataset(formulario({ tipo_pedido: 'foto' })).tipo_pedido, 'foto');
  });

  it('sin tipo guardado: si no se toca y el sugerido es el que se ve, sigue sin tipo (null)', () => {
    const original = { ...PAUTA_GET, tipo_pedido_guardado: null };
    assert.equal(admin.cuerpoDelDataset(formulario({ original })).tipo_pedido, null);
  });

  it('sin tipo guardado: si cambió la gestión y el sugerido ya no es el que se ve, va el que se ve', () => {
    const original = { ...PAUTA_GET, tipo_pedido_guardado: null };
    assert.equal(admin.cuerpoDelDataset(formulario({ original, tipo_gestion: 'interna' })).tipo_pedido, 'acumulado');
  });

  it('un alta: sin original, las fechas elegidas como fin de mes y el tipo elegido', () => {
    const cuerpo = admin.cuerpoDelDataset(formulario({
      original: null, datosMes: '', datosAnio: '2026', proxMes: '3', proxAnio: '2027', cargado: '', tipo_pedido: 'acumulado'
    }));
    assert.equal(cuerpo.datos_al, null);
    assert.equal(cuerpo.proxima_actualizacion, '2027-03-31');
    assert.equal(cuerpo.ultima_actualizacion, null);
    assert.equal(cuerpo.tipo_pedido, 'acumulado');
  });

  it('"Cargado en el portal el" va como ultima_actualizacion', () => {
    assert.equal(admin.cuerpoDelDataset(formulario({ cargado: '2026-10-17' })).ultima_actualizacion, '2026-10-17');
  });

  it('"Qué se solicita" vacío va null; sin formulario no tira error', () => {
    assert.equal(admin.cuerpoDelDataset(formulario({ que_se_solicita: '   ' })).que_se_solicita, null);
    assert.doesNotThrow(() => admin.cuerpoDelDataset());
    assert.doesNotThrow(() => admin.cuerpoDelDataset(null));
  });
});

describe('admin-fechas.js: problemasDelFormulario (lo que se revisa antes de proponer)', () => {
  const base = (extra = {}) => ({ formatos: [1], meses: 3, tipo_pedido: 'acumulado', datosMes: '7', datosAnio: '2026', proxMes: '1', proxAnio: '2027', original: null, ...extra });
  const problemas = (extra) => plano(admin.problemasDelFormulario(base(extra), HOY));

  it('sin problemas da todo en null', () => {
    assert.deepEqual(problemas(), { formatos: null, requiereNota: null, datosAl: null, proxima: null, edicion: null });
  });

  // Spec 2026-10-24-metricas-y-reportes, 4: la edición no registra actualizaciones. Si contra lo guardado cambian a la vez
  // «Cargado en el portal» y la próxima, el servidor responde 400 con este mensaje: el formulario lo avisa antes
  it('problemasDelFormulario marca la edición que mueve carga y próxima', () => {
    const MENSAJE = 'Para registrar una actualización, usá «Registrar actualización».';
    // Como lo devuelve GET /datasets/:id: las fechas de MySQL con hora
    const original = { ultima_actualizacion: '2026-10-13T03:00:00.000Z', proxima_actualizacion: '2027-01-31T03:00:00.000Z', datos_al: '2026-07-31' };
    const edicion = (extra) => problemas({ original, cargado: '2026-10-13', proxMes: '1', proxAnio: '2027', ...extra }).edicion;
    assert.equal(edicion(), null, 'sin tocar nada');
    assert.equal(edicion({ cargado: HOY, proxMes: '4' }), MENSAJE, 'las dos');
    assert.equal(edicion({ cargado: HOY }), null, 'solo la carga');
    assert.equal(edicion({ proxMes: '4' }), null, 'solo la próxima');
    // Vaciar una de las dos también es cambiarla (como en el servidor, que compara lo que llega con lo guardado)
    assert.equal(edicion({ cargado: '', proxMes: '4' }), MENSAJE, 'carga vaciada y próxima movida');
    assert.equal(edicion({ cargado: HOY, meses: null, tipo_pedido: 'eventual', proxMes: '', proxAnio: '' }), MENSAJE, 'pasa a Eventual y cambia la carga');
    // Un dataset sin las dos fechas guardadas: completar las dos también es moverlas
    assert.equal(problemas({ original: { datos_al: null }, cargado: HOY }).edicion, MENSAJE);
    assert.equal(problemas({ original: { datos_al: null }, cargado: '', proxMes: '', proxAnio: '', meses: null, tipo_pedido: 'eventual' }).edicion, null);
  });

  it('en un alta no hay edición que avisar', () => {
    assert.equal(problemas({ original: null, cargado: HOY }).edicion, null);
  });

  it('un externo sin elegir «Requiere nota DGMIT» no pasa, con el mensaje del servidor', () => {
    assert.equal(problemas({ tipo_gestion: 'externa', requiere_nota: '' }).requiereNota, 'Indicá si el dataset requiere nota DGMIT.');
    assert.equal(problemas({ tipo_gestion: 'externa', requiere_nota: '1' }).requiereNota, null);
    assert.equal(problemas({ tipo_gestion: 'externa', requiere_nota: '0' }).requiereNota, null);
    assert.equal(problemas({ tipo_gestion: 'interna', requiere_nota: '' }).requiereNota, null);
  });

  it('sin formatos', () => {
    assert.equal(problemas({ formatos: [] }).formatos, 'Elegí al menos un formato');
  });

  it('fuera de Eventual la próxima es obligatoria, con las palabras del servidor', () => {
    assert.equal(problemas({ proxMes: '', proxAnio: '' }).proxima, 'Falta la próxima actualización: es obligatoria salvo con la frecuencia Eventual');
    assert.equal(problemas({ proxMes: '3', proxAnio: '' }).proxima, 'Elegí el mes y el año de la próxima actualización');
    assert.equal(problemas({ proxMes: '', proxAnio: '2027' }).proxima, 'Elegí el mes y el año de la próxima actualización');
  });

  it('con la frecuencia Eventual la próxima no hace falta', () => {
    assert.equal(problemas({ meses: null, tipo_pedido: 'eventual', proxMes: '', proxAnio: '' }).proxima, null);
  });

  it('un "Datos al" nuevo no puede pasar del fin del mes actual (en un ejercicio, del año siguiente)', () => {
    assert.equal(problemas({ datosMes: '11', datosAnio: '2026' }).datosAl, 'Todavía no puede haber datos al 30/11/2026');
    assert.equal(problemas({ datosMes: '10', datosAnio: '2026' }).datosAl, null);
    assert.equal(problemas({ tipo_pedido: 'ejercicio', datosMes: '', datosAnio: '2027' }).datosAl, null);
  });

  it('un "Datos al" guardado que no se tocó no se revisa', () => {
    assert.equal(problemas({ datosMes: '11', datosAnio: '2026', original: { datos_al: '2026-11-30' } }).datosAl, null);
  });
});

// «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.3): las copias mínimas del navegador
describe('admin-fechas.js: «Requiere nota DGMIT» (el mensaje y el aviso antes de proponer)', () => {
  it('MENSAJE_FALTA_REQUIERE_NOTA es el del servidor, con el texto exacto', () => {
    assert.equal(vm.runInContext('MENSAJE_FALTA_REQUIERE_NOTA', admin), MENSAJE_FALTA_REQUIERE_NOTA);
    assert.equal(vm.runInContext('MENSAJE_FALTA_REQUIERE_NOTA', admin), 'Indicá si el dataset requiere nota DGMIT.');
  });

  it('errorDeRequiereNota: externa sin elegir → mensaje exacto; interna → null', () => {
    const error = (gestion, valor) => admin.errorDeRequiereNota({ gestion, valor });
    for (const sinElegir of ['', undefined, null, 'x']) {
      assert.equal(error('externa', sinElegir), 'Indicá si el dataset requiere nota DGMIT.', String(sinElegir));
    }
    for (const elegido of ['1', '0', 1, 0]) assert.equal(error('externa', elegido), null, String(elegido));
    // La gestión interna no lleva el dato, y sin gestión elegida no hay nada que exigir todavía
    for (const valor of ['', '1', '0', undefined]) {
      assert.equal(error('interna', valor), null, `interna ${valor}`);
      assert.equal(error('', valor), null, `sin gestión ${valor}`);
    }
    assert.doesNotThrow(() => admin.errorDeRequiereNota());
    assert.equal(admin.errorDeRequiereNota(), null);
  });

  it('textoDeRequiereNota dice Sí, No o una raya, como el servidor (textoRequiereNota)', () => {
    for (const valor of ['1', '0', '', 1, 0, null, undefined, 'x']) {
      assert.equal(admin.textoDeRequiereNota(valor), textoRequiereNota(valor), String(valor));
    }
    assert.equal(admin.textoDeRequiereNota('1'), 'Sí');
    assert.equal(admin.textoDeRequiereNota('0'), 'No');
    assert.equal(admin.textoDeRequiereNota(''), '—');
  });
});

describe('admin-fechas.js: la vista previa "Así va a salir en la próxima nota"', () => {
  it('con todo cargado, la frecuencia sale como en la nota: con "(Acumulado)"', () => {
    assert.deepEqual(plano(admin.textosDeVistaPrevia({
      titulo: 'Pauta', gestion: 'externa', solicita: 'La planilla.', frecuencia: 'Trimestralmente', tipo: 'acumulado', meses: 3,
      requiereNota: '1'
    })), {
      cabecera: 'Nota Digital de gestión externa (vista previa)', titulo: 'Pauta', frecuencia: 'Trimestralmente (Acumulado)',
      conRequiereNota: true, requiereNota: 'Sí', solicita: 'La planilla.'
    });
  });

  it('un externo suma la columna «Requiere nota DGMIT» (Sí, No o una raya); una interna, no', () => {
    const textos = (extra) => plano(admin.textosDeVistaPrevia({ titulo: 'Pauta', frecuencia: 'Anualmente', tipo: 'foto', meses: 12, ...extra }));
    assert.deepEqual([textos({ gestion: 'externa', requiereNota: '1' }).conRequiereNota, textos({ gestion: 'externa', requiereNota: '1' }).requiereNota], [true, 'Sí']);
    assert.deepEqual([textos({ gestion: 'externa', requiereNota: '0' }).conRequiereNota, textos({ gestion: 'externa', requiereNota: '0' }).requiereNota], [true, 'No']);
    assert.deepEqual([textos({ gestion: 'externa', requiereNota: '' }).conRequiereNota, textos({ gestion: 'externa', requiereNota: '' }).requiereNota], [true, '—']);
    assert.equal(textos({ gestion: 'externa' }).requiereNota, '—');
    assert.equal(textos({ gestion: 'interna', requiereNota: '1' }).conRequiereNota, false);
    assert.equal(textos({ gestion: '', requiereNota: '1' }).conRequiereNota, false);
  });

  it('la frecuencia de la vista previa cambia con el tipo y los meses, sin pedirle nada al servidor', () => {
    const frecuenciaCon = (tipo, meses) => admin.textosDeVistaPrevia({ titulo: 'Pauta', frecuencia: 'Trimestralmente', tipo, meses }).frecuencia;
    assert.equal(frecuenciaCon('acumulado', 3), 'Trimestralmente (Acumulado)');
    assert.equal(frecuenciaCon('foto', 3), 'Trimestralmente');
    assert.equal(frecuenciaCon('acumulado', 12), 'Trimestralmente');
    assert.equal(frecuenciaCon('acumulado', null), 'Trimestralmente');
  });

  it('sin título, sin frecuencia, sin gestión y sin "Qué se solicita": lo que diría la nota', () => {
    assert.deepEqual(plano(admin.textosDeVistaPrevia({ titulo: '  ', gestion: '', frecuencia: '', tipo: 'acumulado', meses: 3, solicita: '' })), {
      cabecera: 'Nota Digital (vista previa)', titulo: 'Título del dataset', frecuencia: '—', conRequiereNota: false, requiereNota: '—',
      solicita: 'La versión actualizada del conjunto de datos publicado, con la misma estructura y el mismo nivel de detalle que el archivo disponible en el portal.'
    });
    assert.doesNotThrow(() => admin.textosDeVistaPrevia());
    assert.equal(admin.textosDeVistaPrevia().frecuencia, '—');
    assert.equal(admin.textosDeVistaPrevia({ frecuencia: null, tipo: 'acumulado', meses: 3 }).frecuencia, '—');
    assert.equal(Object.hasOwn(plano(admin.textosDeVistaPrevia({ titulo: 'Pauta', frecuencia: 'Anualmente' })), 'fecha'), false);
  });

  it('sin "Qué se solicita", el texto es el mismo que pone la nota (QUE_SE_SOLICITA_POR_DEFECTO del servicio)', () => {
    const servicio = fs.readFileSync(new URL('../services/notasDigitalesContenido.js', import.meta.url), 'utf8');
    const deLaNota = servicio.match(/const QUE_SE_SOLICITA_POR_DEFECTO = '([^']+)';/)?.[1];
    assert.ok(deLaNota, 'el servicio declara QUE_SE_SOLICITA_POR_DEFECTO');
    assert.equal(vm.runInContext('QUE_SE_SOLICITA_POR_DEFECTO', admin), deLaNota);
  });

  it('el aviso de la próxima con la frecuencia Eventual', () => {
    assert.equal(admin.textoDeProximaEventual('2027-01-31T03:00:00.000Z'), 'Con la frecuencia Eventual, la próxima actualización queda vacía.');
    assert.equal(admin.textoDeProximaEventual(null), 'Con la frecuencia Eventual no hay próxima actualización.');
  });
});

describe('admin.js: lo puro del formulario', () => {
  const { contexto: a } = cargarAdminJs();
  const CATALOGO = [
    { id: 1, nombre: 'CSV', habitual: 1 }, { id: 2, nombre: 'XLSX', habitual: 1 },
    { id: 7, nombre: 'ODS', habitual: 0 }, { id: 8, nombre: '<b>SHP</b>', habitual: 0 }
  ];

  it('el título de la ventana: "Nuevo dataset - Paso 2" después del paso 1, "Nuevo dataset" con carga manual, "Editar dataset"', () => {
    assert.deepEqual(plano(a.tituloDelFormulario({ dataset: null, importado: true })),
      { titulo: 'Nuevo dataset - Paso 2', subtitulo: 'Título, descripción y formatos importados del portal' });
    assert.deepEqual(plano(a.tituloDelFormulario({ dataset: null, importado: false })), { titulo: 'Nuevo dataset', subtitulo: 'Carga manual' });
    assert.deepEqual(plano(a.tituloDelFormulario({ dataset: { titulo: 'Pauta' } })), { titulo: 'Editar dataset', subtitulo: 'Pauta' });
    assert.deepEqual(plano(a.tituloDelFormulario()), { titulo: 'Nuevo dataset', subtitulo: 'Carga manual' });
  });

  it('los habituales son botones con aria-pressed; los otros aparecen solo elegidos, y su botón dice que los saca', () => {
    const { chips } = a.htmlDeFormatos(CATALOGO, new Set([2, 7]));
    const habituales = [...chips.matchAll(/<button type="button" class="ad-formato" data-formato="(\d+)" aria-pressed="(true|false)">/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(habituales, [['1', 'false'], ['2', 'true']]);
    // Al apretarlo desaparece: no es un botón que queda presionado, es "Sacar ODS"
    assert.match(chips, /<button type="button" class="ad-formato sacar" data-formato="7" aria-label="Sacar ODS">/);
    assert.equal(cantidad(chips, 'aria-pressed'), 2);
    assert.doesNotMatch(chips, /onclick|<span class="chip/);
  });

  it('el nombre del botón que saca un formato va escapado', () => {
    const { chips } = a.htmlDeFormatos(CATALOGO, [8]);
    assert.ok(chips.includes('aria-label="Sacar &lt;b&gt;SHP&lt;/b&gt;"'));
  });

  it('el desplegable ofrece los no habituales que no están elegidos, escapados', () => {
    const { opciones } = a.htmlDeFormatos(CATALOGO, [7]);
    assert.deepEqual([...opciones.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]),
      [['', '+ Agregar otro formato…'], ['8', '&lt;b&gt;SHP&lt;/b&gt;']]);
  });

  it('los nombres van escapados y el ícono es decorativo', () => {
    const { chips } = a.htmlDeFormatos(CATALOGO, [8]);
    assert.ok(chips.includes('&lt;b&gt;SHP&lt;/b&gt;'));
    assert.doesNotMatch(chips, /<b>SHP/);
    assert.match(chips, /<svg[^>]*aria-hidden="true"/);
  });

  it('sin catálogo no tira error', () => {
    assert.deepEqual(plano(a.htmlDeFormatos(undefined, undefined)), { chips: '', opciones: '<option value="">+ Agregar otro formato…</option>' });
  });

  it('mesesDeLaFrecuencia: los meses de la frecuencia elegida, null si es Eventual, undefined sin elegir', () => {
    const frecuencias = [{ id: 3, meses: 3 }, { id: 11, meses: null }];
    assert.equal(a.mesesDeLaFrecuencia(frecuencias, '3'), 3);
    assert.equal(a.mesesDeLaFrecuencia(frecuencias, 11), null);
    assert.equal(a.mesesDeLaFrecuencia(frecuencias, ''), undefined);
    assert.equal(a.mesesDeLaFrecuencia(frecuencias, '99'), undefined);
    assert.equal(a.mesesDeLaFrecuencia(undefined, '3'), undefined);
  });

  it('nombreDeLaFrecuencia: el nombre de la frecuencia elegida; vacío sin elegir o si no está en el catálogo', () => {
    const frecuencias = [{ id: 3, nombre: 'Trimestralmente', meses: 3 }, { id: 11, nombre: 'Eventual', meses: null }, { id: 12 }];
    assert.equal(a.nombreDeLaFrecuencia(frecuencias, '3'), 'Trimestralmente');
    assert.equal(a.nombreDeLaFrecuencia(frecuencias, 11), 'Eventual');
    assert.equal(a.nombreDeLaFrecuencia(frecuencias, ''), '');
    assert.equal(a.nombreDeLaFrecuencia(frecuencias, undefined), '');
    assert.equal(a.nombreDeLaFrecuencia(frecuencias, '99'), '');
    assert.equal(a.nombreDeLaFrecuencia(frecuencias, 12), '');
    assert.equal(a.nombreDeLaFrecuencia(undefined, '3'), '');
  });

  it('el error del portal dice que se puede seguir con la carga manual', () => {
    assert.equal(a.textoDeErrorDelPortal('Dataset no encontrado en el portal de datos abiertos'),
      'Dataset no encontrado en el portal de datos abiertos. Podés seguir con la carga manual.');
    assert.equal(a.textoDeErrorDelPortal('No se pudo conectar. Intente más tarde.'), 'No se pudo conectar. Intente más tarde. Podés seguir con la carga manual.');
    assert.equal(a.textoDeErrorDelPortal(''), 'No se pudo obtener información del portal. Podés seguir con la carga manual.');
  });
});

describe('admin.js: el mensaje de un envío del formulario', () => {
  const { contexto: a } = cargarAdminJs();

  it('"sin cambios" dice qué hacer; los demás errores del servidor van tal cual; una falla de red, el mensaje por defecto', () => {
    assert.equal(a.mensajeDelEnvio(new Error('No se detectaron cambios. El dataset no fue modificado.')),
      'No realizaste ningún cambio. Modificá al menos un campo para proponer.');
    assert.equal(a.mensajeDelEnvio(new Error('La próxima actualización tiene que ser el último día de un mes (febrero, el 28)')),
      'La próxima actualización tiene que ser el último día de un mes (febrero, el 28)');
    assert.equal(a.mensajeDelEnvio(new TypeError('Failed to fetch')), 'No se pudo proponer. Probá de nuevo.');
  });
});

describe('admin.html: las ventanas son diálogos (spec 8.6, arreglo 5)', () => {
  const velos = [...PAGINA_ADMIN.matchAll(/<div class="ad-velo" id="([^"]+)" hidden>\s*<(div|form) class="ad-ventana[^"]*"([^>]*)>/g)]
    .map((m) => ({ id: m[1], atributos: m[3] }));

  it('ya no quedan modales viejos (.modal-overlay): todas las ventanas son velos con un diálogo modal con título', () => {
    assert.doesNotMatch(PAGINA_ADMIN, /modal-overlay/);
    assert.deepEqual(velos.map((v) => v.id).sort(),
      ['modal-confirm-update', 'modal-dataset', 'modal-delete', 'modal-descartar', 'modal-quick-area', 'modal-registrar-actualizacion', 'modal-step1']);
    for (const { id, atributos } of velos) {
      // "¿Descartar los cambios?" es un alertdialog: pide una respuesta antes de seguir
      assert.match(atributos, /role="(alert)?dialog" aria-modal="true" aria-labelledby="([^"]+)"/, id);
      const titulo = atributos.match(/aria-labelledby="([^"]+)"/)[1];
      assert.match(PAGINA_ADMIN, new RegExp(`<h2 id="${titulo}">`), `${id}: su título`);
    }
  });

  it('cada ventana cierra con su cruz (data-cerrar) y admin.js sabe cerrarla', () => {
    for (const { id } of velos.filter((v) => v.id !== 'modal-registrar-actualizacion')) {
      assert.match(CODIGO_ADMIN, new RegExp(`'${id}': \\(\\) => `), id);
    }
    assert.ok(cantidad(PAGINA_ADMIN, 'class="ad-cerrar" data-cerrar aria-label="Cerrar"') >= 5);
  });

  it('sin onclick: los oyentes los pone admin.js', () => {
    assert.doesNotMatch(PAGINA_ADMIN, /\son(click|change|submit)=/);
  });

  it('sin emojis (íconos Lucide): ni el foco del paso 1, ni el pin del área, ni las advertencias', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    assert.doesNotMatch(PAGINA_ADMIN, emoji);
    assert.doesNotMatch(CODIGO_ADMIN, emoji);
  });

  it('todas las etiquetas llevan for, y apuntan a un campo de la página', () => {
    const etiquetas = [...PAGINA_ADMIN.matchAll(/<label\b([^>]*)>/g)].map((m) => m[1]);
    assert.ok(etiquetas.length > 15, `etiquetas: ${etiquetas.length}`);
    for (const atributos of etiquetas) {
      const para = atributos.match(/\bfor="([^"]+)"/)?.[1];
      assert.ok(para, `<label${atributos}> sin for`);
      assert.match(PAGINA_ADMIN, new RegExp(`<(input|select|textarea)\\b[^>]*\\bid="${para}"`), `for="${para}"`);
    }
  });

  it('cada id que admin.js busca con getElementById existe en la página', () => {
    const ids = new Set([...CODIGO_ADMIN.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));
    for (const id of ids) assert.equal(cantidad(PAGINA_ADMIN, `id="${id}"`), 1, id);
  });
});

describe('admin.html: el paso 1 (importar desde el portal: el flujo no cambia)', () => {
  const paso1 = PAGINA_ADMIN.match(/<div class="ad-velo" id="modal-step1" hidden>([\s\S]*?)<!-- Fin del paso 1 -->/)?.[1] ?? '';

  it('es un formulario de diálogo: Enter en la URL hace lo mismo que "Siguiente"', () => {
    assert.match(paso1, /<form class="ad-ventana chica" id="form-paso1" role="dialog" aria-modal="true" aria-labelledby="paso1-titulo" novalidate>/);
    assert.match(paso1, /<h2 id="paso1-titulo">Nuevo dataset - Paso 1<\/h2>/);
  });

  it('la URL con su etiqueta, el ejemplo, y el error en la ventana', () => {
    assert.match(paso1, /<label for="andino-url">URL del dataset en el portal<\/label>\s*<input type="url" id="andino-url"/);
    assert.ok(paso1.includes('Ejemplo: https://datos.comodoro.gov.ar/dataset/presupuesto-municipal'));
    assert.match(paso1, /<p class="ad-error ad-error-envio" id="step1-error" role="alert" hidden><\/p>/);
  });

  it('"Importar desde el Portal de Datos Abiertos" con un ícono Lucide decorativo', () => {
    assert.match(paso1, /<div class="ad-info">\s*<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*<div><b>Importar desde el Portal de Datos Abiertos<\/b>/);
  });

  it('"Carga manual" y "Siguiente"', () => {
    assert.match(paso1, /<button type="button" class="ad-btn" id="btn-carga-manual">Carga manual<\/button>/);
    assert.match(paso1, /<button type="submit" class="ad-btn primario" id="btn-siguiente">Siguiente<\/button>/);
  });

  it('admin.js sigue usando GET /andino/fetch, en el paso 1 y en "Actualizar desde portal"', () => {
    assert.equal(cantidad(CODIGO_ADMIN, '/andino/fetch?url=${encodeURIComponent(url)}'), 2);
  });
});

describe('admin.html: el formulario del dataset (spec 8.4)', () => {
  const formulario = PAGINA_ADMIN.match(/<div class="ad-velo" id="modal-dataset" hidden>([\s\S]*?)<!-- Fin del formulario -->/)?.[1] ?? '';
  const seccion = (leyenda) => formulario.match(new RegExp(`<fieldset>\\s*<legend>${leyenda}</legend>([\\s\\S]*?)</fieldset>`))?.[1] ?? '';

  it('es un formulario de diálogo con título y subtítulo', () => {
    assert.match(formulario, /<form class="ad-ventana ancha ad-form-dataset" id="dataset-form" role="dialog" aria-modal="true" aria-labelledby="form-titulo" aria-describedby="form-subtitulo">/);
    assert.match(formulario, /<h2 id="form-titulo"><\/h2><p id="form-subtitulo"><\/p>/);
  });

  it('dos fieldset: "Datos del dataset" y "Actualización y pedido"', () => {
    assert.deepEqual([...formulario.matchAll(/<legend>([^<]+)<\/legend>/g)].map((m) => m[1]), ['Datos del dataset', 'Actualización y pedido']);
  });

  it('"Datos del dataset": título, área, descripción, temas, formatos, URL y observaciones, con "Actualizar desde portal"', () => {
    const datos = seccion('Datos del dataset');
    for (const id of ['titulo', 'area_id', 'descripcion', 'tema_principal_id', 'tema_secundario_id', 'url_dataset', 'observaciones']) {
      assert.match(datos, new RegExp(`<label for="${id}">`), id);
    }
    assert.match(datos, /<button type="button" class="ad-btn" id="btn-actualizar-portal">[\s\S]*?Actualizar desde portal<\/button>/);
    assert.match(datos, /<div class="ad-formatos" id="chips-container" role="group" aria-labelledby="form-l-formatos"><\/div>/);
    assert.match(datos, /<select id="formato-dropdown" class="ad-agregar-formato" aria-label="Agregar otro formato"><\/select>/);
  });

  it('"Actualización y pedido": frecuencia, gestión, tipo de pedido, "Cargado en el portal el", "Datos al", la próxima y "Qué se solicita"', () => {
    const pedido = seccion('Actualización y pedido');
    assert.match(pedido, /<label for="frecuencia_id">Frecuencia/);
    assert.match(pedido, /<label for="tipo_gestion">Tipo de gestión/);
    assert.match(pedido, /<label for="tipo_pedido">Tipo de pedido<\/label>\s*<select id="tipo_pedido"><\/select>\s*<p class="ad-sugerencia" id="form-sugerencia"><\/p>/);
    assert.match(pedido, /<label for="ultima_actualizacion">Cargado en el portal el<\/label>\s*<input type="date" id="ultima_actualizacion">/);
    assert.match(pedido, /<label for="form-datos-mes" id="form-l-datos">Datos al<\/label>\s*<div class="ad-mes" role="group" aria-labelledby="form-l-datos">\s*<select id="form-datos-mes" aria-label="Mes"><\/select>\s*<select id="form-datos-anio" aria-label="Año"><\/select>/);
    assert.match(pedido, /<label for="form-prox-mes" id="form-l-prox">Próxima actualización/);
    assert.match(pedido, /<select id="form-prox-mes" aria-label="Mes"><\/select>\s*<select id="form-prox-anio" aria-label="Año"><\/select>/);
    assert.match(pedido, /<label for="que_se_solicita">Qué se solicita<\/label>/);
    assert.ok(pedido.includes('Describí qué tiene que mandar el área, sin fechas ni períodos: los agrega el sistema.'));
  });

  it('la gestión interna dice "Interna (relevamiento propio)", sin DGMIT', () => {
    assert.match(formulario, /<option value="externa">Externa \(la provee otra área\)<\/option>\s*<option value="interna">Interna \(relevamiento propio\)<\/option>/);
    // «DGMIT» solo aparece en el nombre del campo nuevo, «Requiere nota DGMIT»
    assert.doesNotMatch(PAGINA_ADMIN.replaceAll('Requiere nota DGMIT', ''), /DGMIT/);
  });

  it('el selector requiere_nota está en admin.html con Elegí una opción / Sí / No', () => {
    const pedido = seccion('Actualización y pedido');
    assert.match(pedido, /<label for="requiere_nota">Requiere nota DGMIT <span class="ad-obligatorio" aria-hidden="true">\*<\/span><\/label>/);
    const selector = pedido.match(/<select id="requiere_nota"([^>]*)>([\s\S]*?)<\/select>/);
    assert.ok(selector, 'el selector está en "Actualización y pedido"');
    assert.deepEqual([...selector[2].matchAll(/<option value="([^"]*)">([^<]*)</g)].map((m) => [m[1], m[2]]),
      [['', 'Elegí una opción'], ['1', 'Sí'], ['0', 'No']]);
    // No lleva required: con la gestión interna queda oculto, y un campo oculto y obligatorio frenaría el envío sin avisar
    assert.doesNotMatch(selector[1], /(^|\s)required(\s|=|$)/);
    // Lo obligatorio se dice a los lectores de pantalla con aria-required (el asterisco visible es aria-hidden)
    assert.match(selector[1], /\baria-required="true"/);
    assert.match(selector[1], /aria-describedby="form-ayuda-requiere-nota"/);
    assert.match(pedido, /<p class="ad-ayuda" id="form-ayuda-requiere-nota">[^<]+<\/p>/);
    assert.match(pedido, /<p class="ad-error" id="form-error-requiere-nota" role="alert" hidden><\/p>/);
  });

  it('el selector está en su propia fila, justo después de la de «Tipo de gestión», oculto hasta que la gestión sea externa', () => {
    const pedido = seccion('Actualización y pedido');
    assert.match(pedido, /<div class="fila" id="fila-requiere-nota" hidden>/);
    assert.ok(pedido.indexOf('id="tipo_gestion"') < pedido.indexOf('id="fila-requiere-nota"'));
    assert.ok(pedido.indexOf('id="fila-requiere-nota"') < pedido.indexOf('id="tipo_pedido"'));
    // Es la fila que sigue a la de Frecuencia y gestión: ningún otro campo entre las dos
    const entre = pedido.slice(pedido.indexOf('id="tipo_gestion"'), pedido.indexOf('id="fila-requiere-nota"'));
    assert.doesNotMatch(entre, /<(select|input|textarea)\b/);
  });

  it('el aviso por las frases de período es ámbar y está oculto hasta que hace falta', () => {
    assert.match(formulario, /<div class="ad-alerta" id="form-alerta-frases" hidden>/);
    assert.match(formulario, /<span id="form-alerta-texto" aria-live="polite"><\/span>/);
  });

  it('la vista previa "Así va a salir en la próxima nota", con las cuatro columnas de un externo y "Qué se solicita"', () => {
    assert.ok(formulario.includes('Así va a salir en la próxima nota'));
    const nota = formulario.match(/<div class="ad-nota"[^>]*>([\s\S]*?)<!-- Fin de la vista previa -->/)?.[1] ?? '';
    // «Requiere nota DGMIT» va entre Frecuencia y Datos solicitados; la interna la oculta y queda con tres
    assert.deepEqual([...nota.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]),
      ['Conjunto de datos', 'Frecuencia', 'Requiere nota DGMIT', 'Datos solicitados']);
    assert.deepEqual([...nota.matchAll(/<td id="([^"]+)"/g)].map((m) => m[1]),
      ['form-nota-titulo', 'form-nota-frecuencia', 'form-nota-requiere', 'form-nota-periodo']);
    assert.match(nota, /<th scope="col" id="form-nota-th-requiere">Requiere nota DGMIT<\/th>/);
    assert.match(nota, /<td id="form-nota-requiere"><\/td>/);
    assert.ok(!nota.includes('form-nota-fecha'), 'form-nota-fecha ya no existe');
    assert.match(nota, /<td id="form-nota-periodo" aria-live="polite"><\/td>/);
    assert.match(nota, /<b>Qué se solicita:<\/b> <span id="form-nota-solicita"><\/span>/);
    assert.match(nota, /<p class="ad-error" id="form-nota-error" hidden><\/p>/);
  });

  it('los errores del envío van en la ventana, y el botón de proponer es el submit', () => {
    assert.match(formulario, /<p class="ad-error ad-error-envio" id="form-error" role="alert" hidden><\/p>/);
    assert.match(formulario, /<button type="submit" class="ad-btn primario" id="submit-btn">/);
  });
});

describe('admin.html: "Actualizar desde portal" y las demás ventanas', () => {
  it('la confirmación dice que también se traen los formatos', () => {
    const confirmacion = PAGINA_ADMIN.match(/<div class="ad-velo" id="modal-confirm-update" hidden>([\s\S]*?)<!-- Fin de la confirmación -->/)?.[1] ?? '';
    assert.match(confirmacion, /formatos/);
    assert.match(confirmacion, /título/);
    assert.match(confirmacion, /descripción/);
  });

  it('"Nueva área" es un formulario con su etiqueta', () => {
    assert.match(PAGINA_ADMIN, /<form class="ad-ventana chica" id="form-area-rapida" role="dialog" aria-modal="true" aria-labelledby="area-rapida-titulo" novalidate>/);
    assert.match(PAGINA_ADMIN, /<label for="quick-area-nombre">/);
  });
});

describe('admin.html: estilos del formulario', () => {
  const inicio = PAGINA_ADMIN.indexOf('<style>');
  const fin = PAGINA_ADMIN.indexOf('</style>');
  const estilo = PAGINA_ADMIN.slice(inicio, fin).replace(/\/\*[\s\S]*?\*\//g, '');

  it('los formatos elegidos se distinguen por aria-pressed, y el foco se ve en los campos y los formatos', () => {
    assert.match(estilo, /\.ad-formato\[aria-pressed=true\], \.ad-formato\.sacar \{[^}]*background:/);
    for (const selector of ['.ad-form input:focus-visible', '.ad-form select:focus-visible', '.ad-form textarea:focus-visible', '.ad-formato:focus-visible', '.ad-sugerencia button:focus-visible']) {
      assert.ok(estilo.includes(selector), selector);
    }
  });

  it('el aviso por las frases es ámbar', () => {
    assert.match(estilo, /\.ad-alerta \{[^}]*background: var\(--pf-ambar-fondo\);[^}]*color: var\(--pf-ambar\);/);
  });
});

// =====================================================
// El formulario, lo que toca el DOM, con una página de mentira
// =====================================================

describe('admin.js: el formulario del dataset (con una página de mentira)', () => {
  const armar = ({ api = {} } = {}) => {
    const { contexto } = cargarAdminJs();
    const pagina = paginaDeMentira();
    pagina.elemento('dataset-form').reset = () => {};
    contexto.document = pagina.documento;
    // La vista previa espera un instante antes de pedir el pedido: el vm no trae los temporizadores
    Object.assign(contexto, { setTimeout, clearTimeout });
    const llamadas = { exito: [], error: [], recargas: 0, enviados: [] };
    contexto.avisarExito = (texto) => { llamadas.exito.push(texto); };
    contexto.avisarError = (texto) => { llamadas.error.push(texto); };
    contexto.API = {
      updateDataset: async (id, cuerpo) => { llamadas.enviados.push(['PUT', id, cuerpo]); },
      createDataset: async (cuerpo) => { llamadas.enviados.push(['POST', cuerpo]); },
      calculoPedido: async () => ({ pedido: null }),
      ...api
    };
    contexto.recargarLista = async () => { llamadas.recargas++; };
    return { contexto, pagina, llamadas };
  };
  const PAUTA = { id: 10, titulo: 'Pauta Publicitaria', tipo_pedido: 'acumulado', tipo_pedido_guardado: 'acumulado', formatos_array: [{ id: 1 }] };
  const evento = { preventDefault() {} };

  it('al abrir, el aviso de "sin cambios" del intento anterior se borra', () => {
    const { contexto, pagina } = armar();
    contexto.mostrarError('form-error', 'No realizaste ningún cambio. Modificá al menos un campo para proponer.');
    contexto.openModal(PAUTA);
    assert.equal(pagina.elemento('form-error').hidden, true);
    assert.equal(pagina.elemento('form-error').textContent, '');
    assert.equal(pagina.elemento('modal-dataset').hidden, false);
    assert.equal(pagina.elemento('form-titulo').textContent, 'Editar dataset');
  });

  it('el alta importada dice "Nuevo dataset - Paso 2"; la carga manual, "Nuevo dataset"', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(null, { titulo: 'Presupuesto Municipal', formatos: [] });
    assert.equal(pagina.elemento('form-titulo').textContent, 'Nuevo dataset - Paso 2');
    assert.equal(pagina.elemento('titulo').value, 'Presupuesto Municipal');
    contexto.closeModal();
    contexto.openModal(null);
    assert.equal(pagina.elemento('form-titulo').textContent, 'Nuevo dataset');
  });

  it('"sin cambios" queda en la ventana, no en un aviso, y el botón se vuelve a habilitar', async () => {
    const { contexto, pagina, llamadas } = armar({
      api: { updateDataset: async () => { throw new Error('No se detectaron cambios. El dataset no fue modificado.'); } }
    });
    contexto.openModal(PAUTA);
    await contexto.enviarFormulario(evento);
    assert.equal(pagina.elemento('form-error').hidden, false);
    assert.equal(pagina.elemento('form-error').textContent, 'No realizaste ningún cambio. Modificá al menos un campo para proponer.');
    assert.deepEqual(llamadas.error, []);
    assert.equal(pagina.elemento('submit-btn').disabled, false);
    assert.equal(pagina.elemento('modal-dataset').hidden, false);
  });

  it('sin formatos no se manda: el error queda junto a los formatos', async () => {
    const { contexto, pagina, llamadas } = armar();
    contexto.openModal({ ...PAUTA, formatos_array: [] });
    await contexto.enviarFormulario(evento);
    assert.equal(llamadas.enviados.length, 0);
    assert.equal(pagina.elemento('form-error-formatos').textContent, 'Elegí al menos un formato');
  });

  it('si sale bien: manda el PUT, avisa, cierra y recarga la lista', async () => {
    const { contexto, pagina, llamadas } = armar();
    contexto.openModal(PAUTA);
    await contexto.enviarFormulario(evento);
    assert.equal(llamadas.enviados.length, 1);
    assert.equal(llamadas.enviados[0][0], 'PUT');
    assert.equal(llamadas.enviados[0][1], 10);
    assert.deepEqual(llamadas.exito, ['Cambios propuestos. Quedan pendientes de aprobación en Mi Perfil.']);
    assert.equal(llamadas.recargas, 1);
    assert.equal(pagina.elemento('modal-dataset').hidden, true);
  });

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.3)
  describe('«Requiere nota DGMIT»', () => {
    const EXTERNA = { ...PAUTA, tipo_gestion: 'externa', requiere_nota: 1 };
    const INTERNA = { ...PAUTA, tipo_gestion: 'interna', requiere_nota: null };
    const MENSAJE = 'Indicá si el dataset requiere nota DGMIT.';
    // La persona cambia un campo: el formulario escucha change por delegación
    const cambiar = (contexto, pagina, id, valor) => {
      pagina.elemento(id).value = valor;
      contexto.alCambiarCampoDelFormulario({ target: pagina.elemento(id) });
    };

    it('al editar un externo viene con su valor guardado (también «No», que es 0) y el selector se ve', () => {
      for (const [guardado, esperado] of [[1, '1'], [0, '0']]) {
        const { contexto, pagina } = armar();
        contexto.openModal({ ...EXTERNA, requiere_nota: guardado });
        assert.strictEqual(pagina.elemento('requiere_nota').value, esperado);
        assert.equal(pagina.elemento('fila-requiere-nota').hidden, false);
      }
    });

    it('un externo sin dato (NULL) viene vacío, para elegir', () => {
      const { contexto, pagina } = armar();
      contexto.openModal({ ...EXTERNA, requiere_nota: null });
      assert.strictEqual(pagina.elemento('requiere_nota').value, '');
      assert.equal(pagina.elemento('fila-requiere-nota').hidden, false);
    });

    it('una interna y un alta sin gestión elegida no lo muestran', () => {
      const { contexto, pagina } = armar();
      contexto.openModal(INTERNA);
      assert.equal(pagina.elemento('fila-requiere-nota').hidden, true);
      assert.strictEqual(pagina.elemento('requiere_nota').value, '');
      contexto.closeModal();
      contexto.openModal(null);
      assert.equal(pagina.elemento('fila-requiere-nota').hidden, true);
    });

    it('al cambiar la gestión, el selector aparece o se oculta', () => {
      const { contexto, pagina } = armar();
      contexto.openModal(INTERNA);
      cambiar(contexto, pagina, 'tipo_gestion', 'externa');
      assert.equal(pagina.elemento('fila-requiere-nota').hidden, false);
      assert.strictEqual(pagina.elemento('requiere_nota').value, '', 'al pasar a externa viene vacío');
      cambiar(contexto, pagina, 'tipo_gestion', 'interna');
      assert.equal(pagina.elemento('fila-requiere-nota').hidden, true);
    });

    it('proponer un externo sin elegir no manda nada: el aviso queda junto al campo y el foco va ahí', async () => {
      const { contexto, pagina, llamadas } = armar();
      contexto.openModal({ ...EXTERNA, requiere_nota: null });
      await contexto.enviarFormulario(evento);
      assert.equal(llamadas.enviados.length, 0);
      const lugar = pagina.elemento('form-error-requiere-nota');
      assert.equal(lugar.textContent, MENSAJE);
      assert.equal(lugar.hidden, false);
      assert.equal(pagina.elemento('requiere_nota').getAttribute('aria-invalid'), 'true');
      assert.match(pagina.elemento('requiere_nota').getAttribute('aria-describedby'), /form-error-requiere-nota/);
      assert.ok(pagina.enfocados.includes('requiere_nota'));
      assert.equal(pagina.elemento('modal-dataset').hidden, false, 'el formulario sigue abierto');
    });

    it('el aviso del campo vacío no tapa al de los formatos, que está antes en el formulario', async () => {
      const { contexto, pagina, llamadas } = armar();
      contexto.openModal({ ...EXTERNA, requiere_nota: null, formatos_array: [] });
      await contexto.enviarFormulario(evento);
      assert.equal(llamadas.enviados.length, 0);
      assert.equal(pagina.elemento('form-error-formatos').textContent, 'Elegí al menos un formato');
      assert.equal(pagina.elemento('form-error-requiere-nota').textContent, MENSAJE);
      assert.equal(pagina.enfocados.at(-1), 'formato-dropdown');
    });

    it('elegir un valor borra el aviso, y lo que se elige viaja: «No» como 0 y «Sí» como 1', async () => {
      for (const [elegido, esperado] of [['0', 0], ['1', 1]]) {
        const { contexto, pagina, llamadas } = armar();
        contexto.openModal({ ...EXTERNA, requiere_nota: null });
        await contexto.enviarFormulario(evento);
        assert.equal(pagina.elemento('form-error-requiere-nota').hidden, false);
        cambiar(contexto, pagina, 'requiere_nota', elegido);
        assert.equal(pagina.elemento('form-error-requiere-nota').hidden, true);
        assert.equal(pagina.elemento('requiere_nota').hasAttribute('aria-invalid'), false);
        await contexto.enviarFormulario(evento);
        assert.equal(llamadas.enviados.length, 1);
        assert.strictEqual(llamadas.enviados[0][2].requiere_nota, esperado);
      }
    });

    it('un externo que ya tiene el dato lo manda como está (sin tocar el selector)', async () => {
      const { contexto, llamadas } = armar();
      contexto.openModal({ ...EXTERNA, requiere_nota: 0 });
      await contexto.enviarFormulario(evento);
      assert.strictEqual(llamadas.enviados[0][2].requiere_nota, 0);
    });

    it('una interna manda null y no pide el dato, aunque el selector oculto conserve un valor', async () => {
      const { contexto, pagina, llamadas } = armar();
      contexto.openModal(EXTERNA);
      cambiar(contexto, pagina, 'tipo_gestion', 'interna');
      assert.equal(pagina.elemento('requiere_nota').value, '1');
      await contexto.enviarFormulario(evento);
      assert.equal(llamadas.enviados.length, 1);
      assert.strictEqual(llamadas.enviados[0][2].requiere_nota, null);
    });

    it('pasar a interna borra un aviso que había quedado', async () => {
      const { contexto, pagina } = armar();
      contexto.openModal({ ...EXTERNA, requiere_nota: null });
      await contexto.enviarFormulario(evento);
      assert.equal(pagina.elemento('form-error-requiere-nota').hidden, false);
      cambiar(contexto, pagina, 'tipo_gestion', 'interna');
      assert.equal(pagina.elemento('form-error-requiere-nota').hidden, true);
    });

    it('al abrir otra vez, el aviso del intento anterior ya no está', async () => {
      const { contexto, pagina } = armar();
      contexto.openModal({ ...EXTERNA, requiere_nota: null });
      await contexto.enviarFormulario(evento);
      contexto.openModal(EXTERNA);
      assert.equal(pagina.elemento('form-error-requiere-nota').hidden, true);
    });

    it('cambiar el dato es un cambio sin guardar', () => {
      const { contexto, pagina } = armar();
      contexto.openModal(EXTERNA);
      assert.equal(vm.runInContext('hayCambiosSinGuardar(edicion.huella, formularioDelDataset())', contexto), false);
      pagina.elemento('requiere_nota').value = '0';
      assert.equal(vm.runInContext('hayCambiosSinGuardar(edicion.huella, formularioDelDataset())', contexto), true);
    });
  });

  // Spec 2026-10-24-metricas-y-reportes, 4: la edición no registra actualizaciones
  describe('la edición que mueve la carga y la próxima', () => {
    const MENSAJE = 'Para registrar una actualización, usá «Registrar actualización».';
    const GUARDADO = { ...PAUTA, ultima_actualizacion: '2026-10-13T03:00:00.000Z', proxima_actualizacion: '2027-01-31T03:00:00.000Z' };
    // Abre la edición de la Pauta y deja la carga y la próxima como pide el test (la página de mentira no elige la opción
    // guardada de los selectores: se escribe a mano)
    const editar = (armado, { cargado, proxMes = '1', proxAnio = '2027' }) => {
      armado.contexto.openModal(GUARDADO);
      armado.pagina.elemento('ultima_actualizacion').value = cargado;
      armado.pagina.elemento('form-prox-mes').value = proxMes;
      armado.pagina.elemento('form-prox-anio').value = proxAnio;
    };

    it('no se manda: el aviso queda junto a «Cargado en el portal el» y el foco va ahí', async () => {
      const { contexto, pagina, llamadas } = armar();
      editar({ contexto, pagina }, { cargado: HOY, proxMes: '4' });
      await contexto.enviarFormulario(evento);
      assert.equal(llamadas.enviados.length, 0);
      const lugar = pagina.elemento('form-error-edicion');
      assert.equal(lugar.textContent, MENSAJE);
      assert.equal(lugar.hidden, false);
      assert.equal(pagina.elemento('ultima_actualizacion').getAttribute('aria-invalid'), 'true');
      assert.match(pagina.elemento('ultima_actualizacion').getAttribute('aria-describedby'), /form-error-edicion/);
      assert.equal(pagina.enfocados.at(-1), 'ultima_actualizacion');
      assert.equal(pagina.elemento('modal-dataset').hidden, false, 'el formulario sigue abierto');
    });

    it('corregir una sola de las dos se manda', async () => {
      for (const cambio of [{ cargado: HOY }, { cargado: '2026-10-13', proxMes: '4' }]) {
        const { contexto, pagina, llamadas } = armar();
        editar({ contexto, pagina }, cambio);
        await contexto.enviarFormulario(evento);
        assert.equal(llamadas.enviados.length, 1, JSON.stringify(cambio));
        assert.equal(pagina.elemento('form-error-edicion').hidden, true);
      }
    });

    it('cambiar la carga o la próxima borra el aviso', async () => {
      for (const id of ['ultima_actualizacion', 'form-prox-mes', 'frecuencia_id']) {
        const { contexto, pagina } = armar();
        editar({ contexto, pagina }, { cargado: HOY, proxMes: '4' });
        await contexto.enviarFormulario(evento);
        assert.equal(pagina.elemento('form-error-edicion').hidden, false);
        contexto.alCambiarCampoDelFormulario({ target: pagina.elemento(id) });
        assert.equal(pagina.elemento('form-error-edicion').hidden, true, id);
        assert.equal(pagina.elemento('ultima_actualizacion').hasAttribute('aria-invalid'), false, id);
      }
    });

    it('al abrir otra vez, el aviso del intento anterior ya no está', async () => {
      const { contexto, pagina } = armar();
      editar({ contexto, pagina }, { cargado: HOY, proxMes: '4' });
      await contexto.enviarFormulario(evento);
      contexto.openModal(GUARDADO);
      assert.equal(pagina.elemento('form-error-edicion').hidden, true);
    });
  });

  it('si el formulario se cerró mientras se enviaba, el error va en un aviso', async () => {
    let rechazar;
    const { contexto, llamadas } = armar({ api: { updateDataset: () => new Promise((_, r) => { rechazar = r; }) } });
    contexto.openModal(PAUTA);
    const envio = contexto.enviarFormulario(evento);
    contexto.closeModal();
    rechazar(new Error('Este dataset tiene cambios pendientes de aprobación. No se puede editar hasta que sean revisados.'));
    await envio;
    assert.deepEqual(llamadas.error, ['Este dataset tiene cambios pendientes de aprobación. No se puede editar hasta que sean revisados.']);
  });
});

// =====================================================
// Revisión de la Task 10 (Rulings 19 y 20)
// =====================================================

describe('admin-fechas.js: cambios sin guardar en el formulario (Ruling 19)', () => {
  const base = (extra = {}) => ({
    titulo: 'Pauta', area_id: '4', descripcion: '', tema_principal_id: '2', tema_secundario_id: '', frecuencia_id: '3',
    formatos: [1, 3], url_dataset: '', observaciones: '', que_se_solicita: 'La planilla.', tipo_gestion: 'externa',
    tipo_pedido: 'acumulado', meses: 3, cargado: '2026-10-13', datosMes: '7', datosAnio: '2026', proxMes: '1', proxAnio: '2027',
    requiere_nota: '1',
    original: { id: 10, datos_al: '2026-07-31', proxima_actualizacion: '2027-01-31', tipo_pedido: 'acumulado', tipo_pedido_guardado: 'acumulado', requiere_nota: 1 },
    ...extra
  });

  it('el formulario como se abrió no tiene cambios', () => {
    const huella = admin.huellaDelFormulario(base());
    assert.equal(typeof huella, 'string');
    assert.equal(admin.hayCambiosSinGuardar(huella, base()), false);
  });

  it('cualquier campo que cambia lo que se mandaría cuenta como cambio', () => {
    const huella = admin.huellaDelFormulario(base());
    for (const extra of [{ titulo: 'Otra' }, { formatos: [1] }, { proxMes: '2' }, { datosMes: '' }, { tipo_pedido: 'foto' },
      { cargado: '2026-10-14' }, { que_se_solicita: 'Otra planilla.' }, { tipo_gestion: 'interna' }, { requiere_nota: '0' }, { requiere_nota: '' }]) {
      assert.equal(admin.hayCambiosSinGuardar(huella, base(extra)), true, JSON.stringify(extra));
    }
  });

  it('lo que no cambia lo que se manda no cuenta: los mismos formatos en otro orden, espacios en los extremos de "Qué se solicita"', () => {
    const huella = admin.huellaDelFormulario(base());
    assert.equal(admin.hayCambiosSinGuardar(huella, base({ formatos: [3, 1] })), false);
    assert.equal(admin.hayCambiosSinGuardar(huella, base({ que_se_solicita: '  La planilla.  ' })), false);
  });

  it('la huella cambia si cambia requiere_nota, pero solo en un externo: en una interna el selector oculto no cuenta', () => {
    const huella = admin.huellaDelFormulario(base());
    assert.notEqual(admin.huellaDelFormulario(base({ requiere_nota: '0' })), huella);
    assert.equal(admin.hayCambiosSinGuardar(huella, base({ requiere_nota: '0' })), true);
    const deInterna = admin.huellaDelFormulario(base({ tipo_gestion: 'interna', requiere_nota: '' }));
    assert.equal(admin.hayCambiosSinGuardar(deInterna, base({ tipo_gestion: 'interna', requiere_nota: '1' })), false);
  });

  it('volver a dejar un campo como estaba ya no es un cambio', () => {
    const huella = admin.huellaDelFormulario(base());
    assert.equal(admin.hayCambiosSinGuardar(huella, base({ proxMes: '2' })), true);
    assert.equal(admin.hayCambiosSinGuardar(huella, base({ proxMes: '1' })), false);
  });

  it('sin huella (el formulario no está abierto) no hay cambios; sin formulario no tira error', () => {
    assert.equal(admin.hayCambiosSinGuardar(null, base()), false);
    assert.doesNotThrow(() => admin.huellaDelFormulario());
  });
});

describe('admin.html: "¿Descartar los cambios?" y la baja (Rulings 19 y 20)', () => {
  const descartar = PAGINA_ADMIN.match(/<div class="ad-velo" id="modal-descartar" hidden>([\s\S]*?)<!-- Fin de descartar -->/)?.[1] ?? '';
  const eliminar = PAGINA_ADMIN.match(/<div class="ad-velo" id="modal-delete" hidden>([\s\S]*?)<!-- Fin de eliminar -->/)?.[1] ?? '';

  it('la confirmación propia, después del formulario (queda encima): "Seguir editando" y "Descartar"', () => {
    assert.match(descartar, /<div class="ad-ventana chica" role="alertdialog" aria-modal="true" aria-labelledby="descartar-titulo" aria-describedby="descartar-texto">/);
    assert.match(descartar, /<h2 id="descartar-titulo">¿Descartar los cambios\?<\/h2>/);
    assert.match(descartar, /<button type="button" class="ad-btn" id="btn-seguir-editando" data-cerrar>Seguir editando<\/button>/);
    assert.match(descartar, /<button type="button" class="ad-btn peligro" id="btn-descartar">Descartar<\/button>/);
    assert.ok(PAGINA_ADMIN.indexOf('id="modal-descartar"') > PAGINA_ADMIN.indexOf('id="modal-dataset"'));
  });

  it('admin.js no usa confirm() del navegador', () => {
    assert.doesNotMatch(CODIGO_ADMIN, /(^|[^\w.])confirm\(/m);
  });

  it('la baja dice lo que hace, con voseo: es una propuesta que otra persona aprueba', () => {
    assert.match(eliminar, /<p>¿Querés proponer la baja de «<strong id="delete-dataset-name"><\/strong>»\?<\/p>/);
    assert.ok(eliminar.includes('Otra persona la tiene que aprobar en Mi Perfil.'));
    assert.match(eliminar, /<button type="button" class="ad-btn peligro" id="btn-confirmar-eliminar">Proponer baja<\/button>/);
    assert.doesNotMatch(eliminar, /Está seguro|no se puede deshacer/);
  });
});

describe('admin.js: salir del formulario con cambios, ventanas apiladas y el error de los formatos (con una página de mentira)', () => {
  const VELOS = ['modal-step1', 'modal-dataset', 'modal-confirm-update', 'modal-quick-area', 'modal-delete', 'modal-descartar', 'modal-registrar-actualizacion'];
  const armar = () => {
    const { contexto } = cargarAdminJs();
    const pagina = paginaDeMentira();
    pagina.elemento('dataset-form').reset = () => {};
    for (const id of VELOS) pagina.elemento(id).hidden = true;
    contexto.document = pagina.documento;
    Object.assign(contexto, { setTimeout, clearTimeout });
    contexto.avisarExito = () => {};
    contexto.avisarError = () => {};
    contexto.API = { calculoPedido: async () => ({ pedido: null }), updateDataset: async () => ({}) };
    contexto.recargarLista = async () => {};
    return { contexto, pagina };
  };
  const PAUTA = { id: 10, titulo: 'Pauta Publicitaria', tipo_pedido: 'acumulado', tipo_pedido_guardado: 'acumulado', formatos_array: [{ id: 1 }] };
  const escape = (contexto) => contexto.teclaEnPagina({ key: 'Escape', preventDefault() {} });
  const abierta = (pagina, id) => !pagina.elemento(id).hidden;
  // Un clic que empieza y termina en el velo del formulario (afuera de la ventana)
  const clicAfuera = (contexto, pagina) => {
    const velo = pagina.elemento('modal-dataset');
    velo.closest = () => null;
    contexto.presionEnVelo({ target: velo, currentTarget: velo });
    contexto.alHacerClicEnVelo({ target: velo, currentTarget: velo, detail: 1 });
  };

  it('sin cambios, Escape y el clic afuera lo cierran como siempre', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    escape(contexto);
    assert.equal(abierta(pagina, 'modal-dataset'), false);
    contexto.openModal(PAUTA);
    clicAfuera(contexto, pagina);
    assert.equal(abierta(pagina, 'modal-dataset'), false);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
  });

  it('con cambios, el clic afuera no hace nada', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    pagina.elemento('titulo').value = 'Otro título';
    clicAfuera(contexto, pagina);
    assert.equal(abierta(pagina, 'modal-dataset'), true);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
  });

  it('con cambios, Escape pregunta "¿Descartar los cambios?" encima del formulario, que queda inerte', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    pagina.elemento('titulo').value = 'Otro título';
    escape(contexto);
    assert.equal(abierta(pagina, 'modal-dataset'), true);
    assert.equal(abierta(pagina, 'modal-descartar'), true);
    assert.equal(pagina.elemento('modal-dataset').inert, true);
    assert.equal(pagina.elemento('modal-descartar').inert, false);
    assert.equal(pagina.enfocados.at(-1), 'btn-seguir-editando');
  });

  it('"Seguir editando" (o Escape otra vez) vuelve al formulario con los cambios', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    pagina.elemento('titulo').value = 'Otro título';
    escape(contexto);
    escape(contexto);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
    assert.equal(abierta(pagina, 'modal-dataset'), true);
    assert.equal(pagina.elemento('modal-dataset').inert, false);
    assert.equal(pagina.elemento('titulo').value, 'Otro título');
  });

  it('"Descartar" cierra la pregunta y el formulario', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    pagina.elemento('titulo').value = 'Otro título';
    escape(contexto);
    contexto.descartarCambios();
    assert.equal(abierta(pagina, 'modal-descartar'), false);
    assert.equal(abierta(pagina, 'modal-dataset'), false);
  });

  it('la cruz y "Cancelar" (data-cerrar) cierran directamente, aunque haya cambios', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    pagina.elemento('titulo').value = 'Otro título';
    const velo = pagina.elemento('modal-dataset');
    contexto.alHacerClicEnVelo({ target: { closest: (selector) => (selector === '[data-cerrar]' ? {} : null) }, currentTarget: velo, detail: 1 });
    assert.equal(abierta(pagina, 'modal-dataset'), false);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
  });

  it('las otras ventanas siguen cerrando con Escape sin preguntar', () => {
    const { contexto, pagina } = armar();
    contexto.openStep1Modal();
    pagina.elemento('andino-url').value = 'https://datos.comodoro.gov.ar/dataset/algo';
    escape(contexto);
    assert.equal(abierta(pagina, 'modal-step1'), false);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
  });

  it('una ventana encima del formulario lo deja inerte, y al cerrarse vuelve', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    assert.equal(pagina.elemento('modal-dataset').inert, false);
    contexto.openQuickAreaModal();
    assert.equal(pagina.elemento('modal-dataset').inert, true);
    assert.equal(pagina.elemento('modal-quick-area').inert, false);
    contexto.closeQuickAreaModal();
    assert.equal(pagina.elemento('modal-dataset').inert, false);
  });

  // Final review M-8: al cerrarse una ventana se cierran también las que tiene encima, así ninguna queda abierta sobre la lista
  it('ventanasEncimaDe: las de arriba de una ventana, de arriba hacia abajo (ninguna si no está o es la de arriba)', () => {
    const { contexto } = cargarAdminJs();
    const pila = [{ id: 'modal-dataset', origen: null }, { id: 'modal-quick-area', origen: null }, { id: 'modal-descartar', origen: null }];
    assert.deepEqual(plano(contexto.ventanasEncimaDe(pila, 'modal-dataset')), ['modal-descartar', 'modal-quick-area']);
    assert.deepEqual(plano(contexto.ventanasEncimaDe(pila, 'modal-quick-area')), ['modal-descartar']);
    assert.deepEqual(plano(contexto.ventanasEncimaDe(pila, 'modal-descartar')), []);
    assert.deepEqual(plano(contexto.ventanasEncimaDe(pila, 'modal-delete')), []);
    assert.deepEqual(plano(contexto.ventanasEncimaDe([], 'modal-dataset')), []);
    assert.deepEqual(plano(contexto.ventanasEncimaDe(undefined, 'modal-dataset')), []);
    assert.equal(pila.length, 3, 'no toca la pila');
  });

  for (const [nombre, id, abrirEncima] of [
    ['"¿Descartar los cambios?"', 'modal-descartar', (contexto) => escape(contexto)],
    ['"Nueva área"', 'modal-quick-area', (contexto) => contexto.openQuickAreaModal()],
    ['la confirmación de "Actualizar desde portal"', 'modal-confirm-update', (contexto) => contexto.updateFromAndino()]
  ]) {
    it(`un envío que termina con ${nombre} abierta encima cierra las dos ventanas y el foco vuelve a la lista`, async () => {
      const { contexto, pagina } = armar();
      let terminar;
      contexto.API.updateDataset = () => new Promise((resolver) => { terminar = resolver; });
      contexto.openModal({ ...PAUTA, url_dataset: 'https://datos.comodoro.gov.ar/dataset/pauta' }, null, pagina.elemento('btn-editar-10'));
      pagina.elemento('titulo').value = 'Otro título';
      const envio = contexto.enviarFormulario({ preventDefault() {} });
      abrirEncima(contexto);
      assert.equal(abierta(pagina, id), true);
      assert.equal(pagina.elemento('modal-dataset').inert, true);
      terminar({});
      await envio;
      assert.equal(abierta(pagina, 'modal-dataset'), false);
      assert.equal(abierta(pagina, id), false, `${id} quedó abierta sobre la lista`);
      assert.equal(pagina.elemento('modal-dataset').inert, false);
      assert.equal(pagina.elemento(id).inert, false);
      assert.equal(contexto.ventanaDeArriba(), null);
      assert.equal(pagina.enfocados.at(-1), 'btn-editar-10');
    });
  }

  it('cerrar el formulario con dos ventanas encima las cierra a las dos (Escape después no hace nada)', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    contexto.openQuickAreaModal();
    pagina.elemento('titulo').value = 'Otro título';
    contexto.abrirVentana('modal-descartar', pagina.elemento('btn-seguir-editando'));
    contexto.closeModal();
    for (const id of ['modal-dataset', 'modal-quick-area', 'modal-descartar']) {
      assert.equal(abierta(pagina, id), false, id);
      assert.equal(pagina.elemento(id).inert, false, id);
    }
    assert.equal(contexto.ventanaDeArriba(), null);
    escape(contexto);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
  });

  it('cerrar una ventana de arriba no cierra la de abajo', () => {
    const { contexto, pagina } = armar();
    contexto.openModal(PAUTA);
    contexto.openQuickAreaModal();
    contexto.closeQuickAreaModal();
    assert.equal(abierta(pagina, 'modal-dataset'), true);
    assert.equal(contexto.ventanaDeArriba(), 'modal-dataset');
  });

  // Final review M-8: con la tecla sostenida, el navegador repite el keydown (repeat: true)
  it('Escape sostenido no abre y cierra "¿Descartar los cambios?": solo cuenta la primera pulsación', () => {
    const { contexto, pagina } = armar();
    let prevenidos = 0;
    const tecla = (repeat) => contexto.teclaEnPagina({ key: 'Escape', repeat, preventDefault() { prevenidos++; } });
    contexto.openModal(PAUTA);
    pagina.elemento('titulo').value = 'Otro título';
    tecla(false);
    assert.equal(abierta(pagina, 'modal-descartar'), true);
    for (let i = 0; i < 5; i++) tecla(true);
    assert.equal(abierta(pagina, 'modal-descartar'), true);
    assert.equal(abierta(pagina, 'modal-dataset'), true);
    // Soltar y volver a apretar sí cuenta: vuelve al formulario
    tecla(false);
    assert.equal(abierta(pagina, 'modal-descartar'), false);
    assert.equal(abierta(pagina, 'modal-dataset'), true);
    assert.equal(prevenidos, 7, 'con una ventana abierta, Escape no hace lo del navegador, tampoco al repetirse');
  });

  it('Escape sostenido sobre "Nueva área" la cierra a ella sola, no también al formulario', () => {
    const { contexto, pagina } = armar();
    const tecla = (repeat) => contexto.teclaEnPagina({ key: 'Escape', repeat, preventDefault() {} });
    contexto.openModal(PAUTA);
    contexto.openQuickAreaModal();
    tecla(false);
    for (let i = 0; i < 3; i++) tecla(true);
    assert.equal(abierta(pagina, 'modal-quick-area'), false);
    assert.equal(abierta(pagina, 'modal-dataset'), true);
  });

  it('el error de los formatos queda unido a su grupo, como el de "Datos al"', async () => {
    const { contexto, pagina } = armar();
    contexto.openModal({ ...PAUTA, formatos_array: [] });
    await contexto.enviarFormulario({ preventDefault() {} });
    const grupo = pagina.elemento('chips-container');
    assert.equal(grupo.getAttribute('aria-invalid'), 'true');
    assert.match(grupo.getAttribute('aria-describedby') ?? '', /form-error-formatos/);
  });
});

describe('admin: ya no dice "fecha sugerida de envío" ni "Envío sugerido" (spec 18)', () => {
  const VIEJO = /fecha sugerida|sugerida de envío|envío sugerido/i;

  it('ningún HTML de admin-fechas.js lo dice: la lista, la tarjeta, la cabecera, el ciclo y las opciones', () => {
    const casos = [dataset(), vencido(), eventual(), ejercicio(), dataset({ proxima_actualizacion: '2026-10-17T03:00:00.000Z' })];
    for (const d of casos) {
      const html = [
        admin.htmlDeFila(d, { pendiente: false, esAdmin: true, hoy: HOY }),
        admin.htmlDeTarjeta(d, { pendiente: false, esAdmin: true, hoy: HOY }),
        admin.htmlDeDatosDelPedido(d, HOY),
        admin.htmlDeCiclo({ datosAl: d.datos_al, desde: d.pedido?.desde, hasta: d.pedido?.hasta, proxima: d.proxima_actualizacion, hoy: HOY })
      ].join('');
      assert.doesNotMatch(html, VIEJO, d.titulo);
    }
  });

  it('el código y la página tampoco: ni en los textos ni en los comentarios', () => {
    const codigos = {
      'admin-fechas.js': fs.readFileSync(new URL('../public/js/admin-fechas.js', import.meta.url), 'utf8'),
      'admin.js': CODIGO_ADMIN,
      'admin.html': PAGINA_ADMIN
    };
    for (const [nombre, texto] of Object.entries(codigos)) assert.doesNotMatch(texto, VIEJO, nombre);
  });

  it('lo que sí se sugiere (el tipo de pedido y la opción de próxima) sigue', () => {
    assert.match(admin.htmlDeOpciones([{ fecha: '2027-04-30', motivo: 'Siguiente período', sugerida: true }]), /Sugerida/);
    assert.match(admin.htmlDeSugerencia('foto', 'acumulado'), /se sugiere "Acumulado"/);
  });
});

describe('admin.js: la vista previa de la nota, con una página de mentira', () => {
  const FRECUENCIAS = [
    { id: 3, nombre: 'Trimestralmente', meses: 3 }, { id: 4, nombre: 'Cada tres meses', meses: 3 },
    { id: 12, nombre: 'Anualmente', meses: 12 }, { id: 99, nombre: 'Eventual', meses: null }
  ];
  const armar = () => {
    const { contexto } = cargarAdminJs();
    const pagina = paginaDeMentira();
    // Sin próxima no hay pedido ni demora, pero pintarVistaPrevia limpia el temporizador anterior
    Object.assign(contexto, { document: pagina.documento, setTimeout, clearTimeout });
    vm.runInContext(`frecuencias = ${JSON.stringify(FRECUENCIAS)};`, contexto);
    const pintar = vm.runInContext('pintarVistaPrevia', contexto);
    return { pagina, pintar };
  };
  // El formulario como lo arma formularioDelDataset; sin próxima, la vista previa no le pide nada al servidor
  const formulario = (extra = {}) => ({
    titulo: 'Pauta', tipo_gestion: 'externa', tipo_pedido: 'acumulado', frecuencia_id: '3', meses: 3, que_se_solicita: 'La planilla.',
    datosMes: '', datosAnio: '', proxMes: '', proxAnio: '', original: null, ...extra
  });

  it('escribe la frecuencia como saldría en la nota, con "(Acumulado)" si corresponde', () => {
    const { pagina, pintar } = armar();
    pintar(formulario());
    assert.equal(pagina.elemento('form-nota-frecuencia').textContent, 'Trimestralmente (Acumulado)');
    assert.equal(pagina.elemento('form-nota-titulo').textContent, 'Pauta');
    assert.equal(pagina.elemento('form-nota-solicita').textContent, 'La planilla.');
    pintar(formulario({ tipo_pedido: 'foto' }));
    assert.equal(pagina.elemento('form-nota-frecuencia').textContent, 'Trimestralmente');
    pintar(formulario({ frecuencia_id: '12', meses: 12 }));
    assert.equal(pagina.elemento('form-nota-frecuencia').textContent, 'Anualmente');
  });

  it('sin frecuencia elegida, una raya', () => {
    const { pagina, pintar } = armar();
    pintar(formulario({ frecuencia_id: '', meses: undefined }));
    assert.equal(pagina.elemento('form-nota-frecuencia').textContent, '—');
  });

  it('la frecuencia cambia aunque el pedido no se vuelva a calcular (misma clave: mismo tipo y mismos meses)', () => {
    const { pagina, pintar } = armar();
    pintar(formulario());
    pintar(formulario({ frecuencia_id: '4' }));
    assert.equal(pagina.elemento('form-nota-frecuencia').textContent, 'Cada tres meses (Acumulado)');
  });

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.5): un externo tiene cuatro columnas
  it('la vista previa de un externo tiene 4 th con «Requiere nota DGMIT» entre Frecuencia y Datos solicitados', () => {
    const { pagina, pintar } = armar();
    pintar(formulario({ requiere_nota: '1' }));
    // La columna a la vista: ni el th ni el td ocultos (las otras tres no se tocan nunca)
    assert.equal(pagina.elemento('form-nota-th-requiere').hidden, false);
    assert.equal(pagina.elemento('form-nota-requiere').hidden, false);
    assert.equal(pagina.elemento('form-nota-requiere').textContent, 'Sí');
    // Entre la de Frecuencia y la de Datos solicitados: el orden está probado en "admin.html: el formulario del dataset"
  });

  it('la columna dice Sí, No o una raya según lo que se elige en el formulario', () => {
    const { pagina, pintar } = armar();
    for (const [valor, texto] of [['1', 'Sí'], ['0', 'No'], ['', '—'], [undefined, '—']]) {
      pintar(formulario({ requiere_nota: valor }));
      assert.equal(pagina.elemento('form-nota-requiere').textContent, texto, String(valor));
    }
  });

  it('cambiar solo el dato cambia la columna, aunque el pedido no se vuelva a calcular (misma clave)', () => {
    const { pagina, pintar } = armar();
    pintar(formulario({ requiere_nota: '1' }));
    pintar(formulario({ requiere_nota: '0' }));
    assert.equal(pagina.elemento('form-nota-requiere').textContent, 'No');
  });

  it('la vista previa de una interna sigue con 3 columnas: la de «Requiere nota DGMIT» se oculta', () => {
    const { pagina, pintar } = armar();
    pintar(formulario({ requiere_nota: '1' }));
    pintar(formulario({ tipo_gestion: 'interna', requiere_nota: '1' }));
    assert.equal(pagina.elemento('form-nota-th-requiere').hidden, true);
    assert.equal(pagina.elemento('form-nota-requiere').hidden, true);
    // Y vuelve cuando la gestión vuelve a ser externa
    pintar(formulario({ tipo_gestion: 'externa', requiere_nota: '0' }));
    assert.equal(pagina.elemento('form-nota-th-requiere').hidden, false);
    assert.equal(pagina.elemento('form-nota-requiere').hidden, false);
  });

  it('la vista previa ya no tiene la columna de la fecha', () => {
    const { pagina, pintar } = armar();
    pintar(formulario());
    assert.equal(pagina.elemento('form-nota-fecha').escrituras, 0);
  });
});
