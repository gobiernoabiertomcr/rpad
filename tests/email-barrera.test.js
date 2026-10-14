// Barrera EMAIL_SOLO_A y opciones de envío del servicio de email (contra Mailpit)
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { verificarEntornoLocal, mailpit } from './helpers.js';

let email;

before(async () => {
  await verificarEntornoLocal();
  email = await import('../services/emailService.js');
});

beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await mailpit.vaciar();
});

const direcciones = (lista) => (lista || []).map(d => d.Address);

describe('listaDeCorreos', () => {
  it('separa por coma o punto y coma y quita espacios', () => {
    assert.deepEqual(email.listaDeCorreos(' a@x.gov.ar, b@y.gov.ar;c@z.gov.ar '), ['a@x.gov.ar', 'b@y.gov.ar', 'c@z.gov.ar']);
  });

  it('acepta arrays y valores vacíos', () => {
    assert.deepEqual(email.listaDeCorreos([' a@x.gov.ar ', '']), ['a@x.gov.ar']);
    assert.deepEqual(email.listaDeCorreos(null), []);
    assert.deepEqual(email.listaDeCorreos(''), []);
  });
});

describe('filtrarDestinatarios', () => {
  it('sin barrera deja pasar todo', () => {
    assert.deepEqual(email.filtrarDestinatarios('a@x.gov.ar, b@y.gov.ar', ''), ['a@x.gov.ar', 'b@y.gov.ar']);
  });

  it('con barrera deja solo las casillas permitidas, sin distinguir mayúsculas', () => {
    assert.deepEqual(
      email.filtrarDestinatarios(['Permitida@Rpad.test', 'otra@rpad.test'], 'permitida@rpad.test, segunda@rpad.test'),
      ['Permitida@Rpad.test']
    );
  });
});

describe('sendEmail', () => {
  it('envía con CC, CCO, Reply-To, texto plano y adjunto', async () => {
    const resultado = await email.sendEmail({
      subject: 'Prueba de opciones',
      html: '<p>hola</p>',
      text: 'hola',
      to: 'para@rpad.test',
      cc: ['cc@rpad.test'],
      bcc: 'cco@rpad.test',
      replyTo: 'responder@rpad.test',
      attachments: [{ filename: 'nota.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }]
    });
    assert.equal(resultado.success, true);
    assert.match(resultado.response, /^250/);
    assert.ok(resultado.messageId);

    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['para@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), ['cc@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Bcc), ['cco@rpad.test']);
    assert.equal(mensaje.Attachments, 1);
    const detalle = await (await fetch(`http://localhost:8025/api/v1/message/${mensaje.ID}`)).json();
    assert.deepEqual(direcciones(detalle.ReplyTo), ['responder@rpad.test']);
    assert.equal(detalle.Text.trim(), 'hola');
  });

  it('con EMAIL_SOLO_A quita de Para, CC y CCO las casillas no permitidas', async () => {
    process.env.EMAIL_SOLO_A = 'permitida@rpad.test,segunda@rpad.test';
    const resultado = await email.sendEmail({
      subject: 'Barrera', html: '<p>x</p>',
      to: ['permitida@rpad.test', 'real@ejemplo.gov.ar'], cc: 'otra@ejemplo.gov.ar', bcc: 'segunda@rpad.test'
    });
    assert.equal(resultado.success, true);
    const [mensaje] = await mailpit.mensajes();
    assert.deepEqual(direcciones(mensaje.To), ['permitida@rpad.test']);
    assert.deepEqual(direcciones(mensaje.Cc), []);
    assert.deepEqual(direcciones(mensaje.Bcc), ['segunda@rpad.test']);
  });

  it('con EMAIL_SOLO_A no envía nada si ningún destinatario está permitido', async () => {
    process.env.EMAIL_SOLO_A = 'permitida@rpad.test';
    const resultado = await email.sendEmail({ subject: 'Bloqueado', html: '<p>x</p>', to: 'real@ejemplo.gov.ar' });
    assert.deepEqual(resultado, { success: false, error: 'Bloqueado por EMAIL_SOLO_A', bloqueado: true });
    assert.equal((await mailpit.mensajes()).length, 0);
  });

  it('también filtra los emails a áreas', async () => {
    process.env.EMAIL_SOLO_A = 'permitida@rpad.test';
    const resultado = await email.sendEmailToArea({ subject: 'Área', html: '<p>x</p>', to: ['area@ejemplo.gov.ar'] });
    assert.equal(resultado.success, false);
    assert.equal((await mailpit.mensajes()).length, 0);
  });
});
