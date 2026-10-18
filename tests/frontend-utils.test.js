// Utilidades de escape del frontend (public/js/api.js), ejecutadas en Node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { estadoDelDataset } from '../services/fechasDatasetReglas.js';
import { sumarDias } from '../services/notasDigitalesCalendario.js';

// api.js es un script de navegador: se ejecuta en un contexto aislado y se expone Utils
const cargarUtils = () => {
  const codigo = fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
  const contexto = vm.createContext({ CONFIG: { API_URL: '/api' }, console });
  vm.runInContext(`${codigo}\n;globalThis.Utils = Utils;`, contexto);
  return contexto.Utils;
};

const Utils = cargarUtils();

// Lo que hace el navegador con un atributo onclick="...": decodifica las entidades
// HTML y ejecuta el resultado como JavaScript
const decodificarAtributo = (valor) => valor
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const ejecutarOnclick = (htmlBoton) => {
  const atributo = htmlBoton.match(/onclick="([^"]*)"/)[1];
  const llamadas = [];
  const contexto = vm.createContext({
    abrir: (...args) => llamadas.push(args),
    alert: () => llamadas.push(['INYECCION'])
  });
  vm.runInContext(decodificarAtributo(atributo), contexto);
  return llamadas;
};

const NOMBRES_DIFICILES = [
  "Informe d'avance.pdf",
  'Planilla "final".xlsx',
  "');alert(1);//",
  '");alert(1);//',
  'A & B <script>alert(1)</script>',
  'barra \\ invertida'
];

describe('Utils.jsArg: valores dentro de onclick="..."', () => {
  for (const nombre of NOMBRES_DIFICILES) {
    it(`entrega exacto ${JSON.stringify(nombre)} y no ejecuta código`, () => {
      const boton = `<button onclick="abrir(7, ${Utils.jsArg(nombre)})">x</button>`;
      assert.deepEqual(ejecutarOnclick(boton), [[7, nombre]]);
    });
  }

  it('convierte null y undefined en texto vacío', () => {
    assert.deepEqual(ejecutarOnclick(`<b onclick="abrir(${Utils.jsArg(null)}, ${Utils.jsArg(undefined)})">`), [['', '']]);
  });
});

describe('Utils.escapeHtml', () => {
  it('neutraliza etiquetas', () => {
    assert.equal(Utils.escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapa comillas para poder usarse dentro de atributos', () => {
    assert.equal(Utils.escapeHtml(`a "b" 'c' & d`), 'a &quot;b&quot; &#39;c&#39; &amp; d');
  });

  it('mantiene el comportamiento con vacíos y números', () => {
    assert.equal(Utils.escapeHtml(null), '');
    assert.equal(Utils.escapeHtml(''), '');
    assert.equal(Utils.escapeHtml(42), '42');
  });
});

describe('Utils.esUrlSegura y Utils.safeUrl: links armados con datos', () => {
  for (const url of ['https://datos.comodoro.gov.ar/dataset/x', 'http://ejemplo.com/a?b=1&c=2', '  https://con-espacios.gov.ar  ']) {
    it(`acepta ${JSON.stringify(url)}`, () => {
      assert.equal(Utils.esUrlSegura(url), true);
    });
  }

  for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', '/ruta-relativa', '', null, undefined, 42]) {
    it(`rechaza ${JSON.stringify(url)}`, () => {
      assert.equal(Utils.esUrlSegura(url), false);
      assert.equal(Utils.safeUrl(url), null);
    });
  }

  it('safeUrl codifica la URL para un atributo href', () => {
    assert.equal(Utils.safeUrl('https://x.gov.ar/?a=1&b="2"'), 'https://x.gov.ar/?a=1&amp;b=&quot;2&quot;');
  });
});

describe('URLs de reportes', () => {
  it('no incluyen el token de sesión en la URL', () => {
    const codigo = fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api', TOKEN_KEY: 'rpad_token' },
      Auth: { getToken: () => 'TOKEN-SECRETO' },
      localStorage: { getItem: () => 'TOKEN-SECRETO' },
      URLSearchParams, console
    });
    vm.runInContext(`${codigo}\n;globalThis.API = API;`, contexto);
    const urls = Object.keys(contexto.API)
      .filter(nombre => /^getReporte.*Url$/.test(nombre))
      .map(nombre => contexto.API[nombre](1, '2026-01-01', '2026-12-31'));
    assert.ok(urls.length > 0, 'debe haber funciones getReporte*Url');
    for (const url of urls) {
      assert.doesNotMatch(String(url), /TOKEN-SECRETO|token=/);
    }
  });
});

describe('usuarios', () => {
  it('sugiere el usuario con las iniciales de los nombres y el último apellido, sin tildes', () => {
    assert.equal(Utils.sugerirUsername('Laura Inés Fernández'), 'LIFERNANDEZ');
    assert.equal(Utils.sugerirUsername('María de los Ángeles Ruiz'), 'MARUIZ');
    assert.equal(Utils.sugerirUsername('Juan Peña'), 'JPENA');
    assert.equal(Utils.sugerirUsername('  laura   fernández '), 'LFERNANDEZ');
    assert.equal(Utils.sugerirUsername(''), '');
  });

  it('si el usuario sugerido ya existe, le agrega un número', () => {
    assert.equal(Utils.sugerirUsername('Laura Inés Fernández', ['lifernandez']), 'LIFERNANDEZ2');
    assert.equal(Utils.sugerirUsername('Laura Inés Fernández', ['LIFERNANDEZ', 'LIFERNANDEZ2']), 'LIFERNANDEZ3');
  });

  it('el cargo de alguien con contrato se muestra sin designación formal', () => {
    assert.equal(Utils.textoCargo('Jefa de Departamento', 'contrato'), 'Cumple funciones de Jefa de Departamento (sin designación formal)');
    assert.equal(Utils.textoCargo('Directora', 'planta_permanente'), 'Directora');
    assert.equal(Utils.textoCargo(null, 'contrato'), '');
  });

  it('texto del vínculo', () => {
    assert.equal(Utils.textoVinculo('planta_permanente'), 'Planta permanente');
    assert.equal(Utils.textoVinculo('planta_politica'), 'Planta política');
    assert.equal(Utils.textoVinculo('contrato'), 'Contrato');
    assert.equal(Utils.textoVinculo(null), '');
  });
});

describe('API.pedirJson', () => {
  it('el error trae el status y el campo del servidor', async () => {
    const codigo = fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api' },
      Auth: { getAuthHeaders: () => ({}) },
      fetch: async () => ({ ok: false, status: 409, json: async () => ({ success: false, error: 'Ese usuario ya existe', campo: 'username' }) }),
      console
    });
    vm.runInContext(`${codigo}\n;globalThis.API = API;`, contexto);
    await assert.rejects(() => contexto.API.pedirJson('POST', '/usuarios', {}), (error) =>
      error.message === 'Ese usuario ya existe' && error.status === 409 && error.campo === 'username');
  });
});

// El estado y las fechas del sitio público (spec 2026-10-17-fechas-datasets, sección 11). Las páginas usan el estado que
// calcula el servidor (d.estado); Utils.calcularEstado queda solo de respaldo y da lo mismo que estadoDelDataset. Las fechas
// 'AAAA-MM-DD' (o el ISO con hora de mysql2) se leen por su texto: nunca con new Date, que en un navegador argentino las
// corre un día
describe('Utils.calcularEstado: el respaldo da lo mismo que el servidor', () => {
  const HOY = '2026-10-17';

  it('un Eventual da eventual, no actualizado, tenga o no próxima', () => {
    assert.equal(Utils.calcularEstado(null, null, 'externa', HOY), 'eventual');
    assert.equal(Utils.calcularEstado('2027-01-31T03:00:00.000Z', null, 'interna', HOY), 'eventual');
    assert.equal(Utils.calcularEstado(null, undefined, 'externa', HOY), 'eventual');
  });

  it('los demás casos, como antes', () => {
    assert.equal(Utils.calcularEstado(null, 30, 'externa', HOY), 'sin-fecha');
    assert.equal(Utils.calcularEstado('0000-00-00', 30, 'externa', HOY), 'sin-fecha');
    assert.equal(Utils.calcularEstado('2026-10-16', 30, 'interna', HOY), 'atrasado');
    assert.equal(Utils.calcularEstado('2026-10-16', 30, 'externa', HOY), 'sin-respuesta');
    assert.equal(Utils.calcularEstado('2026-10-16', 30, undefined, HOY), 'sin-respuesta');
    assert.equal(Utils.calcularEstado('2026-10-17', 30, 'externa', HOY), 'proximo');
    assert.equal(Utils.calcularEstado(sumarDias(HOY, 60), 30, 'externa', HOY), 'proximo');
    assert.equal(Utils.calcularEstado(sumarDias(HOY, 61), 30, 'externa', HOY), 'actualizado');
  });

  it('lee la próxima por su texto: con la hora de mysql2 o sin ella, el día del vencimiento todavía es próximo', () => {
    assert.equal(Utils.calcularEstado('2026-10-17T03:00:00.000Z', 30, 'externa', HOY), 'proximo');
    assert.equal(Utils.calcularEstado('2026-10-17', 30, 'externa', HOY), 'proximo');
    assert.equal(Utils.getDiasRestantes('2026-10-17', HOY), 0);
    assert.equal(Utils.getDiasRestantes('2026-10-31T03:00:00.000Z', HOY), 14);
    assert.equal(Utils.getDiasRestantes('2026-10-10', HOY), -7);
    assert.equal(Utils.getDiasRestantes(null, HOY), null);
  });

  it('da el mismo estado que estadoDelDataset, día por día, en las dos gestiones', () => {
    for (let dias = -400; dias <= 400; dias++) {
      const proxima = sumarDias(HOY, dias);
      for (const gestion of ['interna', 'externa']) {
        const servidor = estadoDelDataset({ proxima, meses: 3, tipoGestion: gestion, hoy: HOY });
        assert.equal(Utils.calcularEstado(proxima, 90, gestion, HOY), servidor.estado, `${proxima} ${gestion}`);
        assert.equal(Utils.getDiasRestantes(proxima, HOY), servidor.dias, proxima);
      }
    }
    assert.equal(Utils.calcularEstado(null, null, 'externa', HOY), estadoDelDataset({ proxima: null, meses: null, hoy: HOY }).estado);
  });

  it('sin hoy, usa la fecha de Argentina', () => {
    const hoy = Utils.hoyEnArgentina();
    assert.equal(Utils.calcularEstado(hoy, 30, 'externa'), 'proximo');
    assert.equal(Utils.calcularEstado(sumarDias(hoy, -1), 30, 'externa'), 'sin-respuesta');
    assert.equal(Utils.getDiasRestantes(sumarDias(hoy, 5)), 5);
  });

  it('estadoDe usa el estado que manda el servidor y solo calcula si no viene', () => {
    assert.equal(Utils.estadoDe({ estado: 'eventual', proxima_actualizacion: '2020-01-31', frecuencia_dias: 30 }), 'eventual');
    assert.equal(Utils.estadoDe({ estado: 'actualizado', proxima_actualizacion: '2020-01-31', frecuencia_dias: 30 }), 'actualizado');
    assert.equal(Utils.estadoDe({ proxima_actualizacion: '2020-01-31', frecuencia_meses: 1, frecuencia_dias: 30, tipo_gestion: 'interna' }), 'atrasado');
    assert.equal(Utils.estadoDe({ proxima_actualizacion: null, frecuencia_meses: null, frecuencia_dias: null }), 'eventual');
  });

  it('estadoDe decide Eventual con frecuencia_meses, como el servidor, y usa frecuencia_dias solo si faltan los meses', () => {
    const proxima = '2020-01-31T03:00:00.000Z';
    // Manda frecuencia_meses: sin meses es eventual aunque tenga días, y con meses no lo es aunque no tenga días
    assert.equal(Utils.estadoDe({ proxima_actualizacion: proxima, frecuencia_meses: null, frecuencia_dias: 30 }), 'eventual');
    assert.equal(Utils.estadoDe({ proxima_actualizacion: proxima, frecuencia_meses: 3, frecuencia_dias: null }), 'sin-respuesta');
    // Una respuesta sin frecuencia_meses (vieja) usa los días
    assert.equal(Utils.estadoDe({ proxima_actualizacion: proxima, frecuencia_dias: 30 }), 'sin-respuesta');
    assert.equal(Utils.estadoDe({ proxima_actualizacion: proxima, frecuencia_dias: null }), 'eventual');
    // Y da lo mismo que estadoDelDataset con los meses
    for (const meses of [null, 1, 3, 12]) {
      for (const proximaIso of [null, '2020-01-31', sumarDias(Utils.hoyEnArgentina(), 30), '2099-12-31']) {
        assert.equal(
          Utils.estadoDe({ proxima_actualizacion: proximaIso, frecuencia_meses: meses, frecuencia_dias: 999, tipo_gestion: 'externa' }),
          estadoDelDataset({ proxima: proximaIso, meses, tipoGestion: 'externa', hoy: Utils.hoyEnArgentina() }).estado,
          `${meses} ${proximaIso}`
        );
      }
    }
  });
});

describe('Utils: fechas por su texto', () => {
  it('hoyEnArgentina: a las 22:30 de Argentina en UTC ya es el día siguiente, pero da el 17', () => {
    assert.equal(Utils.hoyEnArgentina(new Date('2026-10-18T01:30:00Z')), '2026-10-17');
    assert.equal(Utils.hoyEnArgentina(new Date('2026-10-17T03:00:00Z')), '2026-10-17');
    assert.equal(Utils.hoyEnArgentina(new Date('2026-10-17T02:59:00Z')), '2026-10-16');
  });

  it('soloFecha: los primeros 10 caracteres, o null si no es una fecha que existe', () => {
    assert.equal(Utils.soloFecha('2027-01-31T03:00:00.000Z'), '2027-01-31');
    assert.equal(Utils.soloFecha('2028-02-29'), '2028-02-29');
    for (const valor of [null, undefined, '', 'abc', '0000-00-00', '2026-02-30', '2026-04-31', '2027-02-29', 20261017, '2026-1-5']) {
      assert.equal(Utils.soloFecha(valor), null, String(valor));
    }
  });

  it('fechaCorta, mesAnio y mesDeAnio cortan el texto: el 31/01 sigue siendo el 31/01', () => {
    assert.equal(Utils.fechaCorta('2027-01-31T03:00:00.000Z'), '31/01/2027');
    assert.equal(Utils.fechaCorta('2025-12-31'), '31/12/2025');
    assert.equal(Utils.mesAnio('2025-12-31'), 'dic 2025');
    assert.equal(Utils.mesAnio('2027-01-31T03:00:00.000Z'), 'ene 2027');
    assert.equal(Utils.mesAnio('2026-09-30'), 'sep 2026');
    assert.equal(Utils.mesDeAnio('2027-01-31T03:00:00.000Z'), 'enero de 2027');
    assert.equal(Utils.mesDeAnio('2026-09-30'), 'septiembre de 2026');
    for (const valor of [null, '', '0000-00-00', 'abc']) {
      assert.equal(Utils.fechaCorta(valor), '—');
      assert.equal(Utils.mesAnio(valor), '—');
      assert.equal(Utils.mesDeAnio(valor), '—');
    }
  });

  it('nombreDeMes: el mes en minúscula, del 1 al 12', () => {
    assert.equal(Utils.nombreDeMes(1), 'enero');
    assert.equal(Utils.nombreDeMes(6), 'junio');
    assert.equal(Utils.nombreDeMes(12), 'diciembre');
    assert.equal(Utils.nombreDeMes(13), '');
  });

  it('mesDeVencimiento: el AAAA-MM de la próxima, y null para un eventual o sin fecha', () => {
    assert.equal(Utils.mesDeVencimiento({ estado: 'actualizado', proxima_actualizacion: '2027-01-31T03:00:00.000Z' }), '2027-01');
    assert.equal(Utils.mesDeVencimiento({ estado: 'proximo', proxima_actualizacion: '2026-10-31' }), '2026-10');
    assert.equal(Utils.mesDeVencimiento({ estado: 'eventual', proxima_actualizacion: '2027-01-31' }), null);
    assert.equal(Utils.mesDeVencimiento({ estado: 'sin-fecha', proxima_actualizacion: null }), null);
    assert.equal(Utils.mesDeVencimiento({ estado: 'sin-fecha', proxima_actualizacion: '0000-00-00' }), null);
  });

  it('los textos del estado tienen el de eventual, y los de siempre no cambian', () => {
    assert.equal(Utils.getEstadoTexto('eventual'), 'Eventual');
    assert.equal(Utils.getEstadoTextoLargo('eventual'), 'Actualización eventual');
    assert.equal(Utils.getEstadoClase('eventual'), 'badge-secondary');
    assert.equal(Utils.getEstadoTexto('proximo'), 'Próximo a vencer');
    assert.equal(Utils.getEstadoTextoLargo('sin-respuesta'), 'Sin respuesta del área responsable');
    assert.equal(Utils.getEstadoClase('actualizado'), 'badge-success');
    assert.equal(Utils.getEstadoClase('sin-respuesta'), 'badge-sin-respuesta');
  });
});
