// El resguardo del 24/11 (plan 2026-11-18-dato-quincena-propuestas-datasets, tarea 1): lo que producía main 8784663 para una
// edición SIN `propuestas_datasets` (el mail y el mail de la prueba), guardado como texto en
// tests/fixtures/dato-quincena-antes-de-v1-4.json. Las entregas siguientes no lo regeneran nunca: si esto falla, cambió lo que
// recibe la gente en la primera edición real. Los datos son inventados (tests/dato-quincena-fixtures.js).
// La página del detalle cambió a propósito (spec 2026-11-18-dato-quincena-detalle-pestanas, 8): la controla
// tests/dato-quincena-frontend.test.js.
// El mail cambió a propósito en dos lugares (spec 2026-11-21-dato-quincena-principal-equipo, 5): la frase de la principal, después
// de la bajada, y el recuadro con el botón al RPAD, después de la fila del saludo. Lo esperado es el fixture con exactamente esas
// dos inserciones, en el HTML y en el texto, cada una en un ancla que aparece una sola vez: el resto sigue igual byte por byte.
// Y el rótulo de `por_que_hoy` (spec 2026-11-23-dato-quincena-detalle-visual): «Por qué hoy» dice «Por qué es noticia», una vez por
// propuesta, en el HTML y en el texto.
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

// Las dos inserciones (spec 2026-11-21-dato-quincena-principal-equipo, 5), tal como salen
const FRASE = 'La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.';
const FRASE_HTML = `<p style="margin: 6px 0 0 0; color: #5A7391; font-size: 14px;">${FRASE}</p>`;
// Una fila más del marco, con el recuadro en el celeste del encabezado y el mismo botón del final
const RECUADRO_HTML = `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #E3EEF8; border: 1px solid #CFE0F0; border-radius: 6px; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td align="center" style="padding: 16px 20px;">
                    <p style="margin: 0; color: #1F3A5F; font-size: 16px; font-weight: 700;">Esta edición se lee mejor en el RPAD</p>
                    <p style="margin: 6px 0 4px 0; color: #2B3A4A; font-size: 14px; line-height: 1.5;">Las propuestas de a una, la agenda y los datasets nuevos, con todo listo para copiar.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 0 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0;">
                      <tr>
                        <td align="center" bgcolor="#3E6B96" style="background-color: #3E6B96; border-radius: 6px; padding: 10px 20px; font-size: 14px;">
                          <a href="${URL_DE_PRUEBA}" style="display: inline-block; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none;">Ver la edición en el RPAD</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
const RECUADRO_TEXTO = `Esta edición se lee mejor en el RPAD: ${URL_DE_PRUEBA}\n\n`;

// El rótulo de `por_que_hoy` (spec 2026-11-23-dato-quincena-detalle-visual): una vez por propuesta (el fixture tiene dos), en el
// HTML y en el texto
const ROTULO_ANTES = 'Por qué hoy';
const ROTULO = 'Por qué es noticia';
const conElRotulo = (texto) => {
  assert.equal(texto.split(ROTULO_ANTES).length - 1, 2, 'el rótulo de antes, una vez por propuesta');
  return texto.split(ROTULO_ANTES).join(ROTULO);
};

// Lo esperado: el fixture con una inserción justo después (o justo antes) de un ancla que aparece una sola vez en él
const unaVez = (texto, ancla) => assert.equal(texto.split(ancla).length - 1, 1, `el ancla aparece una sola vez: ${JSON.stringify(ancla)}`);
const despuesDe = (texto, ancla, insercion) => {
  unaVez(texto, ancla);
  return texto.replace(ancla, () => ancla + insercion);
};
const antesDe = (texto, ancla, insercion) => {
  unaVez(texto, ancla);
  return texto.replace(ancla, () => insercion + ancla);
};

// El mail del fixture con la frase y el recuadro. El HTML: la frase, después de la bajada; el recuadro, después de la fila del
// saludo (`saludo`: «Buen día, Persona.» o, en la prueba, «Buen día.»). El texto: la frase, en el bloque del título, debajo de
// la bajada; el recuadro, en su bloque, después del del título (justo antes del pie de la infografía). Y el rótulo nuevo
const conLaPrincipal = ({ subject, html, text }, saludo) => ({
  subject,
  html: conElRotulo(despuesDe(despuesDe(html, 'ni publicadas.</p>', FRASE_HTML), `${saludo}</p>\n            </td>\n          </tr>`, RECUADRO_HTML)),
  text: conElRotulo(antesDe(despuesDe(text, 'ni publicadas.\n', `${FRASE}\n`), 'La infografía de la propuesta principal.', RECUADRO_TEXTO))
});

describe('el resguardo del 24/11: una edición sin propuestas_datasets da lo mismo que en 8784663, con la frase, el recuadro y el rótulo', () => {
  it('el mail de la edición: asunto, HTML y texto', () => {
    const esperado = conLaPrincipal(RESGUARDO.mail, 'Buen día, Persona.');
    const { subject, html, text } = datoQuincenaTemplate(modelo(), { conSvg: true });
    assert.equal(subject, esperado.subject);
    assert.equal(html, esperado.html);
    assert.equal(text, esperado.text);
  });

  it('el mail de la prueba, sin nombre y sin SVG', () => {
    const esperado = conLaPrincipal(RESGUARDO.mail_prueba, 'Buen día.');
    const { subject, html, text } = datoQuincenaTemplate(modelo({ prueba: true, nombreCompleto: null }), { conSvg: false });
    assert.equal(subject, esperado.subject);
    assert.equal(html, esperado.html);
    assert.equal(text, esperado.text);
  });

  // Lo que sale de la plantilla, sin pasar por conLaPrincipal: cada inserción una sola vez y en su lugar
  it('la plantilla pone la frase pegada a la bajada y el recuadro entre el saludo y la infografía, una vez cada uno', () => {
    const { html, text } = datoQuincenaTemplate(modelo(), { conSvg: true });
    const RECUADRO = 'Esta edición se lee mejor en el RPAD';
    for (const [nombre, mail] of [['html', html], ['text', text]]) {
      assert.equal(mail.split(FRASE).length - 1, 1, `la frase, una vez en ${nombre}`);
      assert.equal(mail.split(RECUADRO).length - 1, 1, `el recuadro, una vez en ${nombre}`);
      // El rótulo de `por_que_hoy`, el nuevo una vez por propuesta y el de antes, ninguna
      assert.equal(mail.split(ROTULO).length - 1, 2, `el rótulo nuevo, una vez por propuesta en ${nombre}`);
      assert.equal(mail.split(ROTULO_ANTES).length - 1, 0, `el rótulo de antes, en ninguna parte de ${nombre}`);
    }
    assert.ok(html.includes(`ni publicadas.</p>${FRASE_HTML}`));
    const lugares = ['Buen día, Persona.', RECUADRO, 'src="cid:infografia-dato-quincena"'].map((parte) => html.indexOf(parte));
    assert.ok(lugares.every((lugar, i) => lugar > (lugares[i - 1] ?? -1)), lugares.join(' < '));
    assert.ok(text.includes(`ni publicadas.\n${FRASE}\n\n${RECUADRO}: ${URL_DE_PRUEBA}\n\n`
      + 'La infografía de la propuesta principal.'));
  });

  it('sin la frase ni el recuadro en el modelo, el mail es el de 8784663 byte por byte, con el rótulo nuevo', () => {
    for (const [caso, cambios, opciones] of [
      ['mail', {}, { conSvg: true }], ['mail_prueba', { prueba: true, nombreCompleto: null }, { conSvg: false }]
    ]) {
      const sinLaPrincipal = modelo(cambios);
      delete sinLaPrincipal.aclaracion;
      delete sinLaPrincipal.recuadro;
      const { subject, html, text } = RESGUARDO[caso];
      assert.deepEqual(datoQuincenaTemplate(sinLaPrincipal, opciones), { subject, html: conElRotulo(html), text: conElRotulo(text) }, caso);
    }
  });
});
