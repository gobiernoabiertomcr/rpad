// El resguardo del 24/11 (plan 2026-11-18-dato-quincena-propuestas-datasets, tarea 1): lo que producía main 8784663 para una
// edición SIN `propuestas_datasets` (el mail y el mail de la prueba), guardado como texto en
// tests/fixtures/dato-quincena-antes-de-v1-4.json. Las entregas siguientes no lo regeneran nunca: si esto falla, cambió lo que
// recibe la gente en la primera edición real. Los datos son inventados (tests/dato-quincena-fixtures.js).
// La página del detalle cambió a propósito (spec 2026-11-18-dato-quincena-detalle-pestanas, 8): la controla
// tests/dato-quincena-frontend.test.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { detalleDeLaEdicion } from '../services/datoQuincenaReglas.js';
import { modeloDelMail } from '../services/datoQuincenaCorreoReglas.js';
import { datoQuincenaTemplate } from '../services/emailTemplates.js';
import { edicionDePrueba } from './dato-quincena-fixtures.js';

const RESGUARDO = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-antes-de-v1-4.json', import.meta.url), 'utf8'));

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
});
