// El resguardo del 24/11 (plan 2026-11-18-dato-quincena-propuestas-datasets, tarea 1): lo que producía main 8784663 para una
// edición SIN `propuestas_datasets` (el mail, el mail de la prueba y las dos páginas del detalle), guardado como texto en
// tests/fixtures/dato-quincena-antes-de-v1-4.json. Las entregas siguientes no lo regeneran nunca: si esto falla, cambió lo que
// recibe la gente en la primera edición real. Los datos son inventados (tests/dato-quincena-fixtures.js).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';
import { detalleDeLaEdicion } from '../services/datoQuincenaReglas.js';
import { modeloDelMail } from '../services/datoQuincenaCorreoReglas.js';
import { datoQuincenaTemplate } from '../services/emailTemplates.js';
import { edicionDePrueba } from './dato-quincena-fixtures.js';

const leer = (ruta) => fs.readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');
const RESGUARDO = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-antes-de-v1-4.json', import.meta.url), 'utf8'));
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));

const URL_DE_PRUEBA = 'https://rpad.ejemplo.test/dato-quincena.html?id=12';
const fila = () => ({
  id: 12, clave: 'dq:regular:2026-11-02', tipo: 'regular', fecha_edicion: '2026-11-02', referencia_piloto: null,
  titulo: 'El dato de la quincena: edición de prueba', metadata: '{}', recibida_ts: 1793618040, numero: 1
});
const modelo = (cambios = {}) => modeloDelMail({
  detalle: detalleDeLaEdicion({
    fila: fila(), edicion: edicionDePrueba(), guardadas: [{ orden: 1, dataset_id: 1, dataset_activo: true }], adjuntos: []
  }),
  fecha_edicion: '2026-11-02', nombreCompleto: 'Persona Uno Ejemplo', url: URL_DE_PRUEBA, prueba: false, ...cambios
});

// La página, como en tests/dato-quincena-frontend.test.js: main.js y api.js de verdad y después dato-quincena.js
const cargar = () => {
  const contexto = vm.createContext({
    CONFIG: { API_URL: '/api' },
    console,
    document: {
      head: { appendChild() {} }, body: { appendChild() {} }, createElement: () => ({ textContent: '', remove() {} }),
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null
    },
    URLSearchParams,
    Intl,
    Date,
    setTimeout,
    Auth: { isAuthenticated: () => true, isAdmin: () => false },
    window: { location: { search: '', hash: '', pathname: '/dato-quincena.html', href: '' } }
  });
  vm.runInContext(leer('js/main.js'), contexto);
  vm.runInContext(`${leer('js/api.js')}\n;globalThis.Utils = Utils;`, contexto);
  vm.runInContext(leer('js/dato-quincena.js'), contexto);
  return contexto;
};

describe('el resguardo del 24/11: una edición sin propuestas_datasets da lo mismo que en 8784663', () => {
  it('el mail de la edición: asunto, HTML y texto', () => {
    const { subject, html, text } = datoQuincenaTemplate(modelo(), { conSvg: true });
    assert.equal(subject, RESGUARDO.mail.subject);
    assert.equal(html, RESGUARDO.mail.html);
    assert.equal(text, RESGUARDO.mail.text);
  });

  it('el mail de la prueba, sin nombre y sin SVG', () => {
    const { subject, html, text } = datoQuincenaTemplate(modelo({ prueba: true, nombreCompleto: null }), { conSvg: false });
    assert.equal(subject, RESGUARDO.mail_prueba.subject);
    assert.equal(html, RESGUARDO.mail_prueba.html);
    assert.equal(text, RESGUARDO.mail_prueba.text);
  });

  it('el detalle de la página, para todos y para administración', () => {
    const ctx = cargar();
    const detalle = () => structuredClone(RESPUESTAS.detalle.data);
    assert.equal(ctx.htmlDelDetalle(detalle()), RESGUARDO.pagina.detalle);
    assert.equal(ctx.htmlDelDetalle(detalle(), { admin: true }), RESGUARDO.pagina.detalle_admin);
  });
});
