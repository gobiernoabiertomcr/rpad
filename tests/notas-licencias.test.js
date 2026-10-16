// Notas Digitales durante la licencia del firmante titular (spec 2026-10-15-dias-habiles-licencias-auditoria, 7),
// con los ejemplos de la sección 7.4 como fechas fijas, sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, crearNota, limpiarBase, configurarNotas, conFallaSimulada, conCambioSimulado } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const PARRAFO = 'Asimismo, por medio de la presente autorizo expresamente a Firma admin, Cargo admin, a presentar en mi nombre las Notas Digitales durante mi licencia, del 26/11/2026 al 14/01/2027, con el objetivo de mantener el correcto flujo de trabajo.';
let base, motor, firmas, dbReal, titular, autorizado;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_licencias');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
  firmas = await import('../services/notasDigitalesFirmas.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol, { conFirma = true } = {}) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const email = `${username}@rpad.test`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)",
    [username, `Persona ${rol}`, email, rol]
  );
  if (conFirma) {
    await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
      [r.insertId, `Firma ${rol}`, `Cargo ${rol}`, FIRMA]);
  }
  return { id: r.insertId, email };
};

const licencia = async (usuario, desde, hasta, autorizadoDe = null) => (await query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizadoDe?.id ?? null, autorizadoDe ? '2026-11-20 10:00:00' : null]
)).insertId;

beforeEach(async () => {
  await limpiarBase();
  await configurarNotas();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin');
  autorizado = await crearUsuario('admin');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular.id]);
  await mailpit.vaciar();
});

const config = async () => (await query('SELECT * FROM notas_digitales_config WHERE id = 1'))[0];
const notas = () => query(
  `SELECT id, numero, anio, tipo, gestion, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, asunto, para, cc, html, firmante_id,
          presentada_por_id, pdf
   FROM notas_digitales WHERE es_prueba = 0 ORDER BY id`
);
const datasetsDe = (notaId) => query(
  "SELECT dataset_id, DATE_FORMAT(cuenta_desde, '%Y-%m-%d') AS cuenta_desde FROM notas_digitales_datasets WHERE nota_id = ? ORDER BY dataset_id",
  [notaId]
);
const notaDeAutorizacionDe = async (licenciaId) => (await query('SELECT nota_autorizacion_id AS id FROM usuarios_licencias WHERE id = ?', [licenciaId]))[0].id;
const correr = (hoy) => motor.ejecutarNotasDigitales({ hoy });
const ordenados = (lista) => [...lista].sort((a, b) => a - b);

describe('firmante titular sin licencia', () => {
  it('firma el titular: firmante_id es el suyo y no hay leyenda', async () => {
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [nota] = await notas();
    assert.equal(nota.firmante_id, titular.id);
    assert.equal(nota.presentada_por_id, null);
    assert.match(nota.html, /Firma superadmin<br>Cargo superadmin/);
    assert.doesNotMatch(nota.html, /Nota presentada por/);
  });

  it('sin firmante titular elegido, una licencia de un superadmin no frena nada y firma la configuración', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
    await licencia(titular, '2026-10-26', '2026-11-13');
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [nota] = await notas();
    assert.equal(nota.firmante_id, null);
    assert.match(nota.html, /Firma de Prueba<br>Cargo de Prueba/);
  });
});

describe('licencia sin autorizado (spec 7.3), ejemplo del 26/11/2026 al 14/01/2027', () => {
  const ids = {};
  beforeEach(async () => {
    await licencia(titular, '2026-11-26', '2027-01-14');
    ids.enero = await crearDataset({ titulo: 'Vence en enero', vencimiento: '2027-01-20' });
    ids.febrero = await crearDataset({ titulo: 'Vence en febrero', vencimiento: '2027-02-15' });
    ids.marzo10 = await crearDataset({ titulo: 'Vence el 10 de marzo', vencimiento: '2027-03-10' });
    ids.marzo31 = await crearDataset({ titulo: 'Vence el 31 de marzo', vencimiento: '2027-03-31' });
    ids.abril = await crearDataset({ titulo: 'Vence en abril', vencimiento: '2027-04-10' });
  });

  it('la víspera (25/11) avisa en una sola nota todo lo que se habría avisado durante la licencia', async () => {
    await correr('2026-11-25');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.match(aviso.asunto, /\(gestión interna – vencimientos de enero a marzo 2027\)$/);
    assert.ok(!aviso.html.includes('Asimismo'), 'sin persona autorizada no hay párrafo de autorización');
    const incluidos = await datasetsDe(aviso.id);
    assert.deepEqual(ordenados(incluidos.map(d => d.dataset_id)), ordenados([ids.enero, ids.febrero, ids.marzo10, ids.marzo31]));
    const cuenta = Object.fromEntries(incluidos.map(d => [d.dataset_id, d.cuenta_desde]));
    // Enero ya entraba en la ventana el 25/11: sin cuenta_desde. Febrero se habría avisado el 17/12; marzo, el 11/01
    // (el 09/01 es sábado)
    assert.equal(cuenta[ids.enero], null);
    assert.equal(cuenta[ids.febrero], '2026-12-17');
    assert.equal(cuenta[ids.marzo10], '2027-01-11');
    assert.equal(cuenta[ids.marzo31], '2027-01-11');
  });

  it('durante la licencia no se generan notas; los reintentos sí siguen', async () => {
    await correr('2026-11-25');
    await crearNota({ fecha: '2026-11-20', numero: 99, anio: 2026, estado: 'fallida', intentos: 1 });
    for (const dia of ['2026-11-26', '2026-12-01', '2027-01-04', '2027-01-14']) {
      const resumen = await correr(dia);
      assert.match(resumen.licencia, /sin autorizado/, dia);
    }
    const todas = await notas();
    assert.equal(todas.filter(n => n.tipo === 'reiteracion').length, 0);
    // Solo el aviso de la víspera (la nota 99 del fixture también es un aviso)
    assert.equal(todas.filter(n => n.tipo === 'aviso' && n.numero !== 99).length, 1);
    assert.equal((await query('SELECT estado FROM notas_digitales WHERE numero = 99'))[0].estado, 'enviada');
  });

  it('a la vuelta (15/01) sale una sola reiteración, y lo anticipado de marzo todavía no se reitera', async () => {
    await correr('2026-11-25');
    await correr('2026-12-01');
    await correr('2027-01-15');
    const reiteraciones = (await notas()).filter(n => n.tipo === 'reiteracion');
    assert.equal(reiteraciones.length, 1);
    const reiterados = (await datasetsDe(reiteraciones[0].id)).map(d => d.dataset_id);
    assert.deepEqual(ordenados(reiterados), ordenados([ids.enero, ids.febrero]));
  });
});

describe('licencia con autorizado (spec 7.2)', () => {
  it('la víspera anticipa los avisos con el párrafo de autorización, en CC la persona autorizada, y la licencia guarda la nota', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    // El 25/01 entra en la ventana el 26/11 (ya de licencia): el 24/11 todavía no se avisa nada
    await crearDataset({ vencimiento: '2027-01-25' });
    await crearDataset({ vencimiento: '2027-02-15' });
    await correr('2026-11-24');
    assert.equal((await notas()).length, 0, 'antes de la víspera no sale nada');
    await correr('2026-11-25');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.match(aviso.asunto, /vencimientos de enero a febrero 2027/);
    assert.ok(aviso.html.includes(PARRAFO));
    assert.ok(aviso.cc.split(', ').includes(autorizado.email));
    assert.equal(aviso.firmante_id, titular.id);
    assert.equal(aviso.presentada_por_id, null);
    assert.equal(await notaDeAutorizacionDe(licenciaId), aviso.id);
  });

  it('si la víspera no hay avisos, sale la nota de autorización sola', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const [nota, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(nota.tipo, 'autorizacion');
    assert.equal(nota.gestion, null);
    assert.equal(nota.asunto, `Nota Digital N° ${nota.numero}/26 – Ref.: Autorización para la presentación de Notas Digitales (licencia del 26/11/2026 al 14/01/2027)`);
    assert.equal(nota.para, 'mit@rpad.test');
    assert.equal(nota.cc, autorizado.email);
    assert.ok(nota.html.includes('Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Firma admin, Cargo admin'));
    assert.ok(!nota.html.includes('Justificación'));
    assert.equal(await notaDeAutorizacionDe(licenciaId), nota.id);
    assert.equal((await mailpit.esperar(m => m.Subject === nota.asunto)).length, 1);
  });

  it('durante la licencia, la persona autorizada presenta las reiteraciones con las dos firmas y la cita de la nota', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    const vencido = await crearDataset({ vencimiento: '2026-11-30' });
    await crearNota({ tipo: 'aviso', fecha: '2026-10-01', numero: 50, anio: 2026, datasets: [{ id: vencido, vencimiento: '2026-11-30' }] });
    await correr('2026-11-25');
    const [autorizacion] = await query('SELECT numero FROM notas_digitales WHERE id = ?', [await notaDeAutorizacionDe(licenciaId)]);
    await correr('2026-12-01');
    const [reiteracion] = (await notas()).filter(n => n.tipo === 'reiteracion' && n.fecha === '2026-12-01');
    assert.equal(reiteracion.firmante_id, titular.id);
    assert.equal(reiteracion.presentada_por_id, autorizado.id);
    assert.ok(reiteracion.html.includes(`Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${autorizacion.numero}/26 (licencia del 26/11/2026 al 14/01/2027).`));
    const ultima = lineasPorHoja(reiteracion.pdf).at(-1).join(' ');
    assert.ok(ultima.includes('Firma admin') && ultima.includes('Firma superadmin'));
  });

  it('autorización tardía: la primera corrida genera la nota de autorización (firma solo el titular) y después las demás, que la citan', async () => {
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await crearDataset({ vencimiento: '2026-12-31' });
    await correr('2026-11-02');
    const [autorizacion, aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(autorizacion.presentada_por_id, null);
    assert.equal(await notaDeAutorizacionDe(licenciaId), autorizacion.id);
    assert.equal(aviso.tipo, 'aviso');
    assert.equal(aviso.presentada_por_id, autorizado.id);
    assert.ok(aviso.html.includes(`mediante Nota Digital N° ${autorizacion.numero}/26 (licencia del 26/10/2026 al 13/11/2026)`));
    assert.ok(!aviso.html.includes('Asimismo'), 'el aviso de un día de licencia no repite el párrafo');
  });

  it('si se vacía la nota de autorización (cambiaron las fechas o la persona), la corrida siguiente genera otra', async () => {
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await correr('2026-11-02');
    await query('UPDATE usuarios_licencias SET nota_autorizacion_id = NULL WHERE id = ?', [licenciaId]);
    await correr('2026-11-03');
    assert.equal((await notas()).filter(n => n.tipo === 'autorizacion').length, 2);
  });

  it('si el autorizado ya no tiene firma, ese día se comporta como sin autorizado', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await query('UPDATE usuarios_firmas SET imagen = NULL WHERE usuario_id = ?', [autorizado.id]);
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await correr('2026-11-02');
    assert.equal((await notas()).length, 0);
    assert.match(resumen.licencia, /sin autorizado/);
  });
});

describe('persona autorizada con una licencia que se superpone en parte (del 22/02 al 03/03/2027; el titular, del 01/03 al 31/03/2027)', () => {
  const PARRAFO_MARZO = 'Asimismo, por medio de la presente autorizo expresamente a Firma admin, Cargo admin, a presentar en mi nombre las Notas Digitales durante mi licencia, del 01/03/2027 al 31/03/2027, con el objetivo de mantener el correcto flujo de trabajo.';
  const ERROR_NO_VIGENTE = {
    tipo: 'autorizado-no-vigente', nivel: 'error',
    mensaje: 'La persona autorizada para la licencia del firmante (del 01/03/2027 al 31/03/2027) ya no está activa, no tiene su firma cargada o está de licencia: esos días no se generan notas.'
  };
  const alertasDelAutorizado = (estado) => estado.alertas.filter(a => a.tipo.startsWith('autorizado-'));
  let licenciaId, licenciaDelAutorizado;
  beforeEach(async () => {
    licenciaId = await licencia(titular, '2027-03-01', '2027-03-31', autorizado);
    licenciaDelAutorizado = await licencia(autorizado, '2027-02-22', '2027-03-03');
    // La reiteración de febrero ya se evaluó (el 01/02): la víspera no saca ninguna
    await query("UPDATE notas_digitales_config SET reiteracion_evaluada_interna = '2027-02', reiteracion_evaluada_externa = '2027-02'");
  });
  // Un dataset avisado el 15/01, que vence el 15/02: se reitera en marzo
  const conReiterable = async () => {
    const id = await crearDataset({ titulo: 'Reiterable', vencimiento: '2027-02-15' });
    await crearNota({ tipo: 'aviso', fecha: '2027-01-15', numero: 50, anio: 2027, datasets: [{ id, vencimiento: '2027-02-15' }] });
  };

  it('la víspera (26/02), aunque la persona autorizada esté de licencia, el aviso anticipado comunica la autorización y firma solo el titular', async () => {
    await crearDataset({ vencimiento: '2027-05-10' });
    await correr('2027-02-26');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.match(aviso.asunto, /vencimientos de mayo 2027/);
    assert.ok(aviso.html.includes(PARRAFO_MARZO));
    assert.ok(aviso.cc.split(', ').includes(autorizado.email));
    assert.equal(aviso.firmante_id, titular.id);
    assert.equal(aviso.presentada_por_id, null);
    assert.doesNotMatch(aviso.html, /Nota presentada por/);
    assert.equal(await notaDeAutorizacionDe(licenciaId), aviso.id);
  });

  it('sin avisos esa víspera, la nota de autorización sale el 26/02', async () => {
    await correr('2027-02-26');
    const [nota, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(nota.tipo, 'autorizacion');
    assert.equal(nota.fecha, '2027-02-26');
    assert.equal(nota.cc, autorizado.email);
    assert.equal(nota.firmante_id, titular.id);
    assert.equal(nota.presentada_por_id, null);
    assert.ok(nota.html.includes('Por medio de la presente informo que, durante mi licencia del 01/03/2027 al 31/03/2027, autorizo expresamente a Firma admin, Cargo admin'));
    assert.equal(await notaDeAutorizacionDe(licenciaId), nota.id);
  });

  it('del 01/03 al 03/03 (faltan los dos) no se genera ninguna nota', async () => {
    await conReiterable();
    await correr('2027-02-26');
    const antes = (await notas()).length;
    // Un dataset nuevo que desde el 01/03 ya entra en la ventana del aviso
    await crearDataset({ vencimiento: '2027-04-20' });
    for (const dia of ['2027-03-01', '2027-03-02', '2027-03-03']) {
      const resumen = await correr(dia);
      assert.equal(resumen.ejecutado, true, dia);
      assert.match(resumen.licencia, /sin autorizado/, dia);
      assert.deepEqual(resumen.generadas, [], dia);
    }
    assert.equal((await notas()).length, antes);
    assert.equal((await config()).reiteracion_evaluada_interna, '2027-02');
  });

  it('el 04/03, de vuelta la persona autorizada, la reiteración sale con las dos firmas y cita la nota de la víspera, sin otra nota de autorización', async () => {
    await conReiterable();
    for (const dia of ['2027-02-26', '2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04']) await correr(dia);
    const autorizaciones = (await notas()).filter(n => n.tipo === 'autorizacion');
    assert.deepEqual(autorizaciones.map(n => n.fecha), ['2027-02-26']);
    assert.equal(await notaDeAutorizacionDe(licenciaId), autorizaciones[0].id);
    const del04 = (await notas()).filter(n => n.fecha === '2027-03-04');
    assert.deepEqual(del04.map(n => n.tipo), ['reiteracion']);
    const [reiteracion] = del04;
    assert.equal(reiteracion.firmante_id, titular.id);
    assert.equal(reiteracion.presentada_por_id, autorizado.id);
    assert.ok(reiteracion.html.includes(`Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${autorizaciones[0].numero}/27 (licencia del 01/03/2027 al 31/03/2027).`));
    const ultima = lineasPorHoja(reiteracion.pdf).at(-1).join(' ');
    assert.ok(ultima.includes('Firma admin') && ultima.includes('Firma superadmin'));
  });

  it('autorización tardía: si se da durante la licencia, la nota de autorización sale el primer día en que vuelve la persona autorizada', async () => {
    await query('UPDATE usuarios_licencias SET autorizado_id = NULL, autorizado_at = NULL WHERE id = ?', [licenciaId]);
    await conReiterable();
    await correr('2027-02-26');
    await query("UPDATE usuarios_licencias SET autorizado_id = ?, autorizado_at = '2027-03-01 09:00:00' WHERE id = ?", [autorizado.id, licenciaId]);
    for (const dia of ['2027-03-01', '2027-03-02', '2027-03-03']) await correr(dia);
    assert.deepEqual((await notas()).filter(n => n.fecha >= '2027-02-26').map(n => n.tipo), []);
    await correr('2027-03-04');
    const [autorizacion, reiteracion, ...otras] = (await notas()).filter(n => n.fecha === '2027-03-04');
    assert.equal(otras.length, 0);
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(autorizacion.presentada_por_id, null);
    assert.equal(await notaDeAutorizacionDe(licenciaId), autorizacion.id);
    assert.equal(reiteracion.tipo, 'reiteracion');
    assert.equal(reiteracion.presentada_por_id, autorizado.id);
  });

  it('Estado: mientras la persona autorizada está de licencia, una advertencia con la fecha en que vuelve, sin el error', async () => {
    for (const hoy of ['2027-02-24', '2027-03-02']) {
      const estado = await motor.estadoNotas({ hoy });
      assert.equal(estado.licencia_firmante.autorizado, 'Firma admin', hoy);
      assert.equal(estado.licencia_firmante.autorizado_no_vigente, false, hoy);
      assert.equal(estado.licencia_firmante.autorizado_de_licencia_hasta, '2027-03-03', hoy);
      assert.deepEqual(alertasDelAutorizado(estado), [{
        tipo: 'autorizado-de-licencia', nivel: 'advertencia',
        mensaje: 'La persona autorizada está de licencia hasta el 03/03/2027: hasta entonces no se generan notas.'
      }], hoy);
    }
    const deVuelta = await motor.estadoNotas({ hoy: '2027-03-04' });
    assert.equal(deVuelta.licencia_firmante.autorizado, 'Firma admin');
    assert.equal(deVuelta.licencia_firmante.autorizado_de_licencia_hasta, null);
    assert.deepEqual(alertasDelAutorizado(deVuelta), []);
  });

  it('Estado: desactivada, sin firma o de licencia todos los días hábiles, el error de siempre', async () => {
    const conError = async (motivo) => {
      const estado = await motor.estadoNotas({ hoy: '2027-02-24' });
      assert.equal(estado.licencia_firmante.autorizado, null, motivo);
      assert.equal(estado.licencia_firmante.autorizado_no_vigente, true, motivo);
      assert.equal(estado.licencia_firmante.autorizado_de_licencia_hasta, null, motivo);
      assert.deepEqual(alertasDelAutorizado(estado), [ERROR_NO_VIGENTE], motivo);
    };
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [autorizado.id]);
    await conError('desactivada');
    await query('UPDATE usuarios SET activo = 1 WHERE id = ?', [autorizado.id]);
    await query('UPDATE usuarios_firmas SET imagen = NULL WHERE usuario_id = ?', [autorizado.id]);
    await conError('sin firma');
    await query('UPDATE usuarios_firmas SET imagen = ? WHERE usuario_id = ?', [FIRMA, autorizado.id]);
    await query("UPDATE usuarios_licencias SET hasta = '2027-04-02' WHERE id = ?", [licenciaDelAutorizado]);
    await conError('de licencia todos los días hábiles');
  });
});

describe('cambios y fallas mientras se comunica la autorización (spec 7.2)', () => {
  const tipos = async () => (await notas()).map(n => n.tipo);
  const cambiarAutorizado = (licenciaId, usuario) =>
    `UPDATE usuarios_licencias SET autorizado_id = ${Number(usuario.id)} WHERE id = ${Number(licenciaId)}`;

  it('si la licencia cambia mientras se genera la nota de autorización tardía, no la registra y ese día no salen otras notas', async () => {
    const otro = await crearUsuario('admin');
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await conCambioSimulado("NEW.tipo = 'autorizacion'", cambiarAutorizado(licenciaId, otro), () => correr('2026-11-02'));
    assert.deepEqual(await tipos(), ['autorizacion']);
    assert.equal(await notaDeAutorizacionDe(licenciaId), null);
    assert.ok(resumen.errores.some(e => e.tipo === 'autorizacion' && /cambió/.test(e.mensaje)));
    // La corrida siguiente comunica la autorización con los datos nuevos y después genera lo demás, que la cita
    await correr('2026-11-03');
    const [, nueva, aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(nueva.tipo, 'autorizacion');
    assert.equal(nueva.cc, otro.email);
    assert.equal(await notaDeAutorizacionDe(licenciaId), nueva.id);
    assert.equal(aviso.tipo, 'aviso');
    assert.equal(aviso.presentada_por_id, otro.id);
  });

  it('víspera: si la licencia cambia mientras se genera el aviso con la autorización, no lo registra ni saca otra nota con los datos viejos', async () => {
    const otro = await crearUsuario('admin');
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ vencimiento: '2027-01-25' });
    const resumen = await conCambioSimulado("NEW.tipo = 'aviso'", cambiarAutorizado(licenciaId, otro), () => correr('2026-11-25'));
    assert.deepEqual(await tipos(), ['aviso']);
    assert.equal(await notaDeAutorizacionDe(licenciaId), null);
    assert.ok(resumen.errores.some(e => e.tipo === 'autorizacion'));
  });

  it('si la persona autorizada deja de cumplir las condiciones justo después de la nota de autorización tardía, ese día no salen otras notas', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await crearDataset({ vencimiento: '2026-12-31' });
    const resumen = await conCambioSimulado(
      "NEW.tipo = 'autorizacion'", `UPDATE usuarios SET activo = 0 WHERE id = ${Number(autorizado.id)}`, () => correr('2026-11-02')
    );
    assert.deepEqual(await tipos(), ['autorizacion']);
    assert.match(resumen.licencia, /sin autorizado/);
  });

  it('si la nota de autorización no se pudo generar, ese día no se genera ninguna otra nota y sale en la corrida siguiente', async () => {
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13', autorizado);
    await crearDataset({ vencimiento: '2026-12-31' });
    await crearDataset({ vencimiento: '2026-10-20' });
    const resumen = await conFallaSimulada('INSERT', "NEW.tipo = 'autorizacion'", () => correr('2026-11-02'));
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['autorizacion']);
    assert.deepEqual(await tipos(), []);
    assert.equal((await config()).reiteracion_evaluada_interna, null);
    await correr('2026-11-03');
    assert.deepEqual(await tipos(), ['autorizacion', 'aviso', 'reiteracion']);
    assert.equal(await notaDeAutorizacionDe(licenciaId), (await notas())[0].id);
  });

  it('si falla el registro de la nota en la licencia, el aviso de la víspera sale igual y la autorización se comunica al día siguiente', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ vencimiento: '2027-01-25' });
    const resumen = await conFallaSimulada(
      'UPDATE', 'NEW.nota_autorizacion_id IS NOT NULL', () => correr('2026-11-25'), 'usuarios_licencias'
    );
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['autorizacion']);
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.equal((await query('SELECT estado FROM notas_digitales WHERE id = ?', [aviso.id]))[0].estado, 'enviada');
    assert.equal((await mailpit.esperar(m => m.Subject === aviso.asunto)).length, 1);
    assert.equal(await notaDeAutorizacionDe(licenciaId), null);
    await correr('2026-11-26');
    const nueva = (await notas()).find(n => n.tipo === 'autorizacion');
    assert.equal(await notaDeAutorizacionDe(licenciaId), nueva.id);
  });

  it('la nota de autorización la firma solo el titular aunque se le pase la firma con la persona autorizada', async () => {
    const firma = {
      titular: { nombre: 'Firma superadmin', cargo: 'Cargo superadmin', imagen: null },
      presentante: { nombre: 'Firma admin', cargo: 'Cargo admin', imagen: null },
      leyenda: 'Nota presentada por Firma admin', firmanteId: titular.id, presentanteId: autorizado.id
    };
    const autorizacion = { nombre: 'Firma admin', cargo: 'Cargo admin', email: autorizado.email, desde: '2026-11-26', hasta: '2027-01-14' };
    const id = await motor.generarNota({ tipo: 'autorizacion', gestion: null, fecha: '2026-11-25', datasets: [], config: await config(), firma, autorizacion });
    const [nota] = (await notas()).filter(n => n.id === id);
    assert.equal(nota.firmante_id, titular.id);
    assert.equal(nota.presentada_por_id, null);
    assert.ok(!nota.html.includes('Nota presentada por'));
  });

  it('el email de la persona autorizada va en CC solo si es válido', async () => {
    await query("UPDATE usuarios SET email = 'sin-arroba' WHERE id = ?", [autorizado.id]);
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const [nota] = await notas();
    assert.equal(nota.tipo, 'autorizacion');
    assert.equal(nota.cc, '');
  });
});

describe('otros casos', () => {
  it('ejemplo del 25/01 al 05/03/2027: la víspera es el viernes 22/01 y la reiteración sale el lunes 08/03', async () => {
    await licencia(titular, '2027-01-25', '2027-03-05');
    assert.equal(await firmas.anticipoPorLicencia(await config(), '2027-01-21'), null);
    assert.equal((await firmas.anticipoPorLicencia(await config(), '2027-01-22')).hasta, '2027-03-05');
    await crearDataset({ vencimiento: '2027-02-20' });
    for (const dia of ['2027-01-22', '2027-02-01', '2027-03-01', '2027-03-08']) await correr(dia);
    assert.equal((await config()).reiteracion_evaluada_interna, '2027-03');
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion' && n.fecha === '2027-03-08').length, 1);
  });

  it('una licencia sin días hábiles (un fin de semana) no anticipa ni frena', async () => {
    await licencia(titular, '2026-11-28', '2026-11-29', autorizado);
    assert.equal(await firmas.anticipoPorLicencia(await config(), '2026-11-27'), null);
    assert.equal(await firmas.autorizacionPendiente(await config(), '2026-11-27'), null);
    assert.equal((await firmas.firmaParaFecha(await config(), '2026-11-30')).modo, 'titular');
  });

  it('licencia cargada tarde (sin víspera): lo pendiente sale el primer día hábil de la vuelta', async () => {
    await licencia(titular, '2026-11-26', '2026-12-04');
    const id = await crearDataset({ vencimiento: '2027-01-30' });
    await correr('2026-11-26');
    await correr('2026-12-01');
    assert.equal((await notas()).length, 0);
    await correr('2026-12-07');
    const [aviso] = await notas();
    assert.equal(aviso.fecha, '2026-12-07');
    assert.deepEqual((await datasetsDe(aviso.id)).map(d => d.dataset_id), [id]);
    assert.doesNotMatch(aviso.asunto, /vencimientos de/);
  });

  it('las vistas previas durante una licencia sin autorizado muestran la firma del titular', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13');
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.match(vista.html, /Firma superadmin<br>Cargo superadmin/);
  });
});

describe('Estado de Correos (spec 7.5)', () => {
  it('sin licencia: licencia_firmante es null', async () => {
    assert.equal((await motor.estadoNotas({ hoy: '2026-11-02' })).licencia_firmante, null);
  });

  it('licencia próxima sin autorizado: víspera y vuelta, y el próximo aviso pasa a la víspera', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14');
    await crearDataset({ vencimiento: '2027-01-31' });
    const estado = await motor.estadoNotas({ hoy: '2026-11-10' });
    assert.deepEqual(estado.licencia_firmante, {
      desde: '2026-11-26', hasta: '2027-01-14', en_curso: false, autorizado: null, nota_autorizacion: null,
      autorizado_no_vigente: false, autorizado_de_licencia_hasta: null, sin_dias_habiles: false, vispera: '2026-11-25',
      ultimo_habil: '2027-01-14', vuelta: '2027-01-15'
    });
    assert.equal(estado.proximas.interna.aviso.fecha, '2026-11-25');
  });

  it('licencia en curso sin autorizado: la próxima reiteración es a la vuelta', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14');
    const estado = await motor.estadoNotas({ hoy: '2026-12-02' });
    assert.equal(estado.licencia_firmante.en_curso, true);
    assert.equal(estado.proximas.interna.reiteracion.fecha, '2027-01-15');
  });

  it('licencia en curso con autorizado: la reiteración queda en su fecha y se informa la nota de autorización', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const estado = await motor.estadoNotas({ hoy: '2026-12-02' });
    assert.equal(estado.licencia_firmante.autorizado, 'Firma admin');
    const [nota] = await query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [await notaDeAutorizacionDe(licenciaId)]);
    assert.deepEqual(estado.licencia_firmante.nota_autorizacion, { numero: nota.numero, anio: nota.anio });
    assert.equal(estado.proximas.interna.reiteracion.fecha, '2026-12-02');
  });

  it('autorizado que ya no cumple las condiciones: alerta de error', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [autorizado.id]);
    const estado = await motor.estadoNotas({ hoy: '2026-11-10' });
    assert.equal(estado.licencia_firmante.autorizado_no_vigente, true);
    assert.ok(estado.alertas.some(a => a.tipo === 'autorizado-no-vigente' && a.nivel === 'error'));
  });

  it('licencia futura con la persona autorizada de licencia hoy (sin superposición): se la evalúa desde el inicio, sin alerta', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await licencia(autorizado, '2026-11-09', '2026-11-13');
    const estado = await motor.estadoNotas({ hoy: '2026-11-10' });
    assert.equal(estado.licencia_firmante.autorizado, 'Firma admin');
    assert.equal(estado.licencia_firmante.autorizado_no_vigente, false);
    assert.ok(!estado.alertas.some(a => a.tipo === 'autorizado-no-vigente'));
  });

  it('titular sin imagen de firma: la advertencia sin-firma mira la suya', async () => {
    await query('UPDATE usuarios_firmas SET imagen = NULL WHERE usuario_id = ?', [titular.id]);
    assert.ok((await motor.estadoNotas({ hoy: '2026-11-02' })).alertas.some(a => a.tipo === 'sin-firma'));
  });

  it('titular con imagen de firma: no hay advertencia sin-firma aunque la configuración no tenga imagen', async () => {
    assert.ok(!(await motor.estadoNotas({ hoy: '2026-11-02' })).alertas.some(a => a.tipo === 'sin-firma'));
  });
});
