// Utilidades de escape del frontend (public/js/api.js), ejecutadas en Node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

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
