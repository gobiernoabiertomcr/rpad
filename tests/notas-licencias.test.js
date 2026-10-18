// Notas Digitales durante la licencia del firmante titular (spec 2026-10-15-dias-habiles-licencias-auditoria, 7),
// con los ejemplos de la sección 7.4 como fechas fijas, sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, crearNota, limpiarBase, configurarNotas, conFallaSimulada, conCambioSimulado } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { lineasPorHoja, textosPorHoja } from './pdf-lector.js';
import { esDiaHabil as esDiaHabilIso, sumarDias as sumarDiasIso } from '../services/notasDigitalesCalendario.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const PARRAFO = 'Asimismo, por medio de la presente autorizo expresamente a Firma admin, Cargo admin, a presentar en mi nombre las Notas Digitales durante mi licencia, del 26/11/2026 al 14/01/2027, con el objetivo de mantener el correcto flujo de trabajo.';
let base, motor, firmas, datos, dbReal, titular, autorizado;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_licencias');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
  firmas = await import('../services/notasDigitalesFirmas.js');
  datos = await import('../services/notasDigitalesDatos.js');
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

  // Spec 18, "Varios vencimientos en un aviso": el aviso de la víspera junta los vencimientos de varios meses. La nota guardada
  // (HTML, texto y PDF) los agrupa por vencimiento, con "Vence el …" o "Vencen el …", y el anexo sigue el orden de la tabla
  it('el aviso de la víspera agrupa las filas por vencimiento, en el HTML, el texto, el PDF y el orden del anexo', async () => {
    ids.marzo31bis = await crearDataset({ titulo: 'Otro de fin de marzo', vencimiento: '2027-03-31' });
    await correr('2026-11-25');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    const GRUPOS = ['Vence el 20/01/2027', 'Vence el 15/02/2027', 'Vence el 10/03/2027', 'Vencen el 31/03/2027'];
    const TITULOS = ['Vence en enero', 'Vence en febrero', 'Vence el 10 de marzo', 'Otro de fin de marzo', 'Vence el 31 de marzo'];

    // HTML: las filas de grupo a todo el ancho (4 columnas) y los datasets debajo, por vencimiento
    assert.deepEqual([...aviso.html.matchAll(/<td colspan="(\d+)" style="[^"]*">((?:Vence|Vencen) el [\d/]+)<\/td>/g)].map(m => [Number(m[1]), m[2]]),
      GRUPOS.map(g => [4, g]));
    const enHtml = [GRUPOS[0], TITULOS[0], GRUPOS[1], TITULOS[1], GRUPOS[2], TITULOS[2], GRUPOS[3], TITULOS[3], TITULOS[4]]
      .map(texto => aviso.html.indexOf(`>${texto}<`));
    assert.ok(enHtml.every(p => p > 0), JSON.stringify(enHtml));
    assert.deepEqual(enHtml, [...enHtml].sort((a, b) => a - b));

    // Texto plano (el guardado) y PDF
    const [{ texto }] = await query('SELECT texto FROM notas_digitales WHERE id = ?', [aviso.id]);
    assert.deepEqual(texto.split('\n').filter(l => /^(Vence|Vencen) el /.test(l)), GRUPOS);
    const lineas = lineasPorHoja(aviso.pdf).flat();
    assert.deepEqual(lineas.filter(l => /^(Vence|Vencen) el \d{2}\/\d{2}\/\d{4}$/.test(l)), GRUPOS);

    // El anexo: una hoja por dataset, en el orden de la tabla
    const [{ anexo_pdf: anexo }] = await query('SELECT anexo_pdf FROM notas_digitales WHERE id = ?', [aviso.id]);
    const hojas = lineasPorHoja(anexo).map(hoja => TITULOS.find(titulo => hoja.includes(titulo)));
    assert.deepEqual(hojas, TITULOS);
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

// Con persona autorizada, cada aviso adelantado en la víspera sale también en su fecha (spec 7.6, pedido del usuario el
// 18/10/2026). El dataset vence el 31/01/2027: su gestión externa lo avisa con 40 días de ventana, o sea el 22/12/2026.
describe('aviso en su fecha con persona autorizada (spec 7.6), licencia del 10/12/2026 al 08/01/2027', () => {
  const AUTORIZACION = 'Asimismo, por medio de la presente autorizo expresamente a Firma admin, Cargo admin, a presentar en mi nombre las Notas Digitales durante mi licencia, del 10/12/2026 al 08/01/2027, con el objetivo de mantener el correcto flujo de trabajo.';
  const asuntoExterno = (numero) => `Nota Digital N° ${numero}/26 – Ref.: Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal (gestión externa – diciembre 2026)`;
  const textoDe = async (notaId) => (await query('SELECT texto FROM notas_digitales WHERE id = ?', [notaId]))[0].texto;
  const delDia = async (fecha) => (await notas()).filter(n => n.fecha === fecha);
  let licenciaId, externo;
  beforeEach(async () => {
    licenciaId = await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    externo = await crearDataset({ titulo: 'Externo de enero', gestion: 'externa', vencimiento: '2027-01-31' });
  });

  // La víspera (09/12): un solo aviso externo, firmado por el titular, que anticipa el dataset (con su fecha normal, el
  // 22/12) y comunica la autorización
  const vispera = async () => {
    await correr('2026-12-09');
    const [aviso, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.deepEqual([aviso.tipo, aviso.gestion, aviso.fecha], ['aviso', 'externa', '2026-12-09']);
    assert.equal(aviso.firmante_id, titular.id);
    assert.equal(aviso.presentada_por_id, null);
    assert.ok(aviso.html.includes(AUTORIZACION));
    assert.deepEqual(await datasetsDe(aviso.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);
    return aviso;
  };

  it('el 22/12 la persona autorizada vuelve a presentar el aviso, con las dos firmas y el párrafo que cita la nota de la víspera', async () => {
    const anticipado = await vispera();
    const del21 = await correr('2026-12-21');
    assert.deepEqual(del21.generadas, []);
    assert.equal((await notas()).length, 1, 'el 21/12 no sale nada');

    const resumen = await correr('2026-12-22');
    assert.deepEqual(resumen.errores, []);
    const [, enSuFecha, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.deepEqual([enSuFecha.tipo, enSuFecha.gestion, enSuFecha.fecha], ['aviso', 'externa', '2026-12-22']);
    assert.equal(enSuFecha.firmante_id, titular.id);
    assert.equal(enSuFecha.presentada_por_id, autorizado.id);
    assert.equal(enSuFecha.asunto, asuntoExterno(enSuFecha.numero), 'el asunto lleva el mes de la nota, no el rango de vencimientos');
    assert.ok(enSuFecha.html.includes(`Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${anticipado.numero}/26 (licencia del 10/12/2026 al 08/01/2027).`));
    const adelanto = `Este pedido ya se había adelantado por Nota Digital N° ${anticipado.numero}/26 del 09/12/2026.`;
    assert.ok(enSuFecha.html.includes(adelanto));
    assert.ok(enSuFecha.html.indexOf(adelanto) < enSuFecha.html.indexOf('<table'), 'el párrafo va antes de las tablas');
    assert.ok((await textoDe(enSuFecha.id)).includes(adelanto));
    assert.ok(!enSuFecha.html.includes('Asimismo'), 'no repite el párrafo de autorización');
    assert.ok(!enSuFecha.cc.split(', ').includes(autorizado.email), 'la persona autorizada no va en CC');
    const ultima = lineasPorHoja(enSuFecha.pdf).at(-1).join(' ');
    assert.ok(ultima.includes('Firma admin') && ultima.includes('Firma superadmin'));
    // Guarda la fecha normal del aviso anticipado: los 20 días de la reiteración se siguen contando desde ahí
    assert.deepEqual(await datasetsDe(enSuFecha.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);
    assert.equal((await mailpit.esperar(m => m.Subject === enSuFecha.asunto)).length, 1);

    await correr('2026-12-23');
    assert.equal((await notas()).length, 2, 'el 23/12 no se repite');
  });

  it('la vista previa del aviso en su fecha coincide con la corrida (spec 7.7)', async () => {
    const anticipado = await vispera();
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'externa', hoy: '2026-12-22' });
    // Lo que elige avisoDelDia ese día, antes de que la corrida genere nada
    const { modo, licencia: delTitular } = await firmas.firmaParaFecha(await config(), '2026-12-22');
    const esperados = (await motor.avisoDelDia({ gestion: 'externa', fecha: '2026-12-22', modo, licencia: delTitular })).datasets.map(d => d.id);
    assert.deepEqual(esperados, [externo]);

    assert.deepEqual([vista.fecha, vista.motivo, vista.cantidad, vista.ejemplo], ['2026-12-22', null, 1, false]);
    assert.ok(vista.html.includes(`Este pedido ya se había adelantado por Nota Digital N° ${anticipado.numero}/26 del 09/12/2026.`));
    assert.ok(vista.html.includes(`Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${anticipado.numero}/26 (licencia del 10/12/2026 al 08/01/2027).`));
    assert.equal(vista.asunto, asuntoExterno(0).replace('N° 0/26', 'N° XX'), 'el asunto lleva el mes de la nota, no el rango de vencimientos');
    assert.ok(!vista.html.includes('Asimismo'), 'no repite el párrafo de autorización');
    assert.equal((await notas()).length, 1, 'la vista previa no genera nada');
    assert.deepEqual(await datasetsDe(anticipado.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);

    await correr('2026-12-22');
    const [, enSuFecha, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(enSuFecha.asunto.replace(/N° \S+/, 'N° XX'), vista.asunto);
    assert.deepEqual((await datasetsDe(enSuFecha.id)).map(d => d.dataset_id), esperados);
    // El HTML de la vista previa es el de la nota generada, salvo su número (el de la nota anticipada que cita no cambia)
    assert.equal(vista.html, enSuFecha.html.replace(/(Nota Digital N°(?:<\/b>)?) (\d+)\/26/g,
      (texto, prefijo, numero) => (Number(numero) === enSuFecha.numero ? `${prefijo} XX` : texto)));
  });

  it('la reiteración del 01/02/2027 muestra el dataset una sola vez, con las dos notas en "Informado en"', async () => {
    const anticipado = await vispera();
    await correr('2026-12-22');
    const enSuFecha = (await notas())[1];
    const del04 = await correr('2027-01-04');
    assert.deepEqual(del04.generadas, []);
    assert.equal((await notas()).filter(n => n.tipo === 'reiteracion' && n.gestion === 'externa').length, 0, 'el 04/01 no hay reiteración externa');

    const resumen = await correr('2027-02-01');
    assert.deepEqual(resumen.errores, []);
    const reiteraciones = (await notas()).filter(n => n.tipo === 'reiteracion' && n.gestion === 'externa');
    assert.equal(reiteraciones.length, 1);
    assert.deepEqual((await datasetsDe(reiteraciones[0].id)).map(d => d.dataset_id), [externo]);
    const informado = `Nota Digital N° ${anticipado.numero}/26 (09/12/2026) y N° ${enSuFecha.numero}/26 (22/12/2026)`;
    assert.ok(reiteraciones[0].html.includes(`>${informado}`));
    assert.ok((await textoDe(reiteraciones[0].id)).includes(informado));
  });

  it('con la persona autorizada de licencia del 21/12 al 23/12, sale el viernes 18/12', async () => {
    await licencia(autorizado, '2026-12-21', '2026-12-23');
    await vispera();
    const del17 = await correr('2026-12-17');
    assert.deepEqual(del17.generadas, []);
    assert.equal((await notas()).length, 1, 'el 17/12 no sale nada');

    await correr('2026-12-18');
    const [, enSuFecha, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.deepEqual([enSuFecha.tipo, enSuFecha.gestion, enSuFecha.fecha], ['aviso', 'externa', '2026-12-18']);
    assert.equal(enSuFecha.firmante_id, titular.id);
    assert.equal(enSuFecha.presentada_por_id, autorizado.id);
    assert.deepEqual(await datasetsDe(enSuFecha.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);

    // Los días en que ella falta no se genera ninguna nota
    const del22 = await correr('2026-12-22');
    assert.match(del22.licencia, /sin autorizado/);
    assert.equal((await notas()).length, 2);
  });

  it('no repite un dataset que ya se actualizó', async () => {
    await vispera();
    await query("UPDATE datasets SET proxima_actualizacion = '2028-01-31' WHERE id = ?", [externo]);
    const resumen = await correr('2026-12-22');
    assert.deepEqual(resumen.generadas, []);
    assert.equal((await notas()).length, 1);
  });

  it('si la corrida del 22/12 no se hizo, sale en la siguiente', async () => {
    await vispera();
    await correr('2026-12-23');
    const [, enSuFecha, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.deepEqual([enSuFecha.tipo, enSuFecha.gestion, enSuFecha.fecha], ['aviso', 'externa', '2026-12-23']);
    assert.equal(enSuFecha.presentada_por_id, autorizado.id);
    assert.deepEqual(await datasetsDe(enSuFecha.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);
  });

  it('una segunda corrida el mismo día no lo repite', async () => {
    await vispera();
    await correr('2026-12-22');
    const segunda = await correr('2026-12-22');
    assert.deepEqual(segunda.generadas, []);
    assert.equal((await notas()).filter(n => n.fecha === '2026-12-22').length, 1);
  });

  it('junto con un dataset nuevo del día, el párrafo nombra solo el adelantado', async () => {
    const anticipado = await vispera();
    const nuevo = await crearDataset({ titulo: 'Externo nuevo', gestion: 'externa', vencimiento: '2027-01-31' });
    await correr('2026-12-22');
    const [enSuFecha, ...otras] = await delDia('2026-12-22');
    assert.equal(otras.length, 0, 'un solo aviso con los dos');
    assert.equal(enSuFecha.asunto, asuntoExterno(enSuFecha.numero));
    // El adelantado guarda su fecha normal de aviso; el nuevo, que entra por la selección de siempre, no tiene
    assert.deepEqual(await datasetsDe(enSuFecha.id), [
      { dataset_id: externo, cuenta_desde: '2026-12-22' }, { dataset_id: nuevo, cuenta_desde: null }
    ]);
    const adelanto = `El conjunto de datos "Externo de enero" ya se había adelantado por Nota Digital N° ${anticipado.numero}/26 del 09/12/2026.`;
    assert.ok((await textoDe(enSuFecha.id)).includes(adelanto));
    assert.ok(enSuFecha.html.includes(adelanto.replaceAll('"', '&quot;')));
    assert.ok(!enSuFecha.html.includes('Este pedido ya se había adelantado'));
    // Vencen el mismo día: en la tabla salen por título
    const tabla = enSuFecha.html.slice(enSuFecha.html.indexOf('<table'));
    assert.ok(tabla.indexOf('Externo de enero') >= 0 && tabla.indexOf('Externo de enero') < tabla.indexOf('Externo nuevo'));
  });

  it('sin persona autorizada no hay aviso en su fecha, tampoco a la vuelta', async () => {
    await query('UPDATE usuarios_licencias SET autorizado_id = NULL, autorizado_at = NULL WHERE id = ?', [licenciaId]);
    await correr('2026-12-09');
    const [anticipado, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.equal(anticipado.tipo, 'aviso');
    assert.ok(!anticipado.html.includes('Asimismo'));
    assert.deepEqual(await datasetsDe(anticipado.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);

    const del22 = await correr('2026-12-22');
    assert.match(del22.licencia, /sin autorizado/);
    assert.equal((await notas()).length, 1, 'el 22/12 no hay notas nuevas');

    await correr('2027-01-11');
    const del11 = await delDia('2027-01-11');
    assert.deepEqual(del11.filter(n => n.tipo === 'aviso'), [], 'el 11/01 no sale ningún aviso');
    assert.ok(del11.length > 0 && del11.every(n => n.tipo === 'reiteracion'), 'el 11/01 solo salen reiteraciones');
  });

  // Correos → Estado (spec 7.5): el próximo aviso de la gestión durante la licencia
  it('Estado: durante la licencia, el próximo aviso externo es el en su fecha', async () => {
    // Antes de la víspera no hay nada adelantado: el próximo aviso es la víspera
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-02' })).proximas.externa.aviso, { fecha: '2026-12-09', cantidad: 1 });
    await vispera();
    // Ya adelantado, el dataset no es una novedad: el próximo aviso es el suyo, el 22/12, también con la licencia en curso
    const estado = await motor.estadoNotas({ hoy: '2026-12-14' });
    assert.deepEqual(estado.proximas.externa.aviso, { fecha: '2026-12-22', cantidad: 1 });
    assert.equal(estado.licencia_firmante.en_curso, true);
    // El objeto público de la licencia no cambia de forma
    assert.deepEqual(Object.keys(estado.licencia_firmante), [
      'desde', 'hasta', 'en_curso', 'autorizado', 'nota_autorizacion', 'autorizado_no_vigente', 'autorizado_de_licencia_hasta',
      'sin_dias_habiles', 'vispera', 'ultimo_habil', 'vuelta'
    ]);
    // El mismo día de la víspera, ya corrida, también
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-09' })).proximas.externa.aviso, { fecha: '2026-12-22', cantidad: 1 });
    // La gestión interna no tiene nada adelantado
    assert.equal(estado.proximas.interna.aviso, null);
    // El día en que sale, el próximo aviso es ese mismo día; después de la corrida, ya no queda ninguno
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-22' })).proximas.externa.aviso, { fecha: '2026-12-22', cantidad: 1 });
    await correr('2026-12-22');
    assert.equal((await motor.estadoNotas({ hoy: '2026-12-23' })).proximas.externa.aviso, null);
  });

  it('Estado: con la persona autorizada de licencia del 21/12 al 23/12, el próximo aviso externo es el viernes 18/12', async () => {
    await licencia(autorizado, '2026-12-21', '2026-12-23');
    await vispera();
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-14' })).proximas.externa.aviso, { fecha: '2026-12-18', cantidad: 1 });
    // El 18/12 es el día de la corrida; después de la corrida ya no queda ninguno
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-18' })).proximas.externa.aviso, { fecha: '2026-12-18', cantidad: 1 });
    await correr('2026-12-18');
    assert.equal((await motor.estadoNotas({ hoy: '2026-12-19' })).proximas.externa.aviso, null);
  });

  it('Estado: si el día de su fecha ya pasó sin salir, el próximo aviso es el primer día hábil en que ella no falta', async () => {
    // No falta el 22/12 (su día): corrida salteada, sale en la corrida siguiente
    await vispera();
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-23' })).proximas.externa.aviso, { fecha: '2026-12-23', cantidad: 1 });
    // Falta del 22/12 al 23/12: su día era el lunes 21/12; el 23/12, que sigue de licencia, el próximo es el 24/12
    await licencia(autorizado, '2026-12-22', '2026-12-23');
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-23' })).proximas.externa.aviso, { fecha: '2026-12-24', cantidad: 1 });
    // La corrida lo confirma: el 23/12 no sale nada y el 24/12 sí
    const del23 = await correr('2026-12-23');
    assert.match(del23.licencia, /sin autorizado/);
    assert.equal((await notas()).length, 1);
    await correr('2026-12-24');
    const [, enSuFecha, ...otras] = await notas();
    assert.equal(otras.length, 0);
    assert.deepEqual([enSuFecha.tipo, enSuFecha.gestion, enSuFecha.fecha], ['aviso', 'externa', '2026-12-24']);
  });

  it('Estado: el aviso en su fecha suma lo que sale el mismo día, y otro aviso más temprano sigue siendo el próximo', async () => {
    await vispera();
    // Un dataset nuevo cuyo mes se abre también el 22/12: salen juntos, 2
    await crearDataset({ titulo: 'Externo nuevo', gestion: 'externa', vencimiento: '2027-01-31' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-14' })).proximas.externa.aviso, { fecha: '2026-12-22', cantidad: 2 });
    // Uno que ya está en la ventana sale antes, en la próxima corrida: ese es el próximo aviso, con su cantidad
    await crearDataset({ titulo: 'Externo de diciembre', gestion: 'externa', vencimiento: '2026-12-31' });
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-14' })).proximas.externa.aviso, { fecha: '2026-12-14', cantidad: 1 });
  });

  it('Estado: sin persona autorizada no hay aviso en su fecha, tampoco con la licencia en curso', async () => {
    await query('UPDATE usuarios_licencias SET autorizado_id = NULL, autorizado_at = NULL WHERE id = ?', [licenciaId]);
    await correr('2026-12-09');
    assert.equal((await notas()).length, 1);
    const estado = await motor.estadoNotas({ hoy: '2026-12-14' });
    assert.equal(estado.licencia_firmante.autorizado, null);
    assert.equal(estado.proximas.externa.aviso, null);
  });

  // Una falla al buscar lo que sale en su fecha (la licencia de la persona autorizada o los datasets adelantados) no tira también el
  // aviso normal de esa gestión: queda el error y el aviso sale con la selección de siempre. Se simula con una falla en la consulta
  // de pendientesEnSuFecha, la única que cuenta los avisos de cada dataset con "otro.dataset_id"
  it('si falla la búsqueda del aviso en su fecha, el aviso normal del día sale igual y el adelantado sale en la corrida siguiente', async () => {
    await vispera();
    const nuevo = await crearDataset({ titulo: 'Externo nuevo', gestion: 'externa', vencimiento: '2027-01-31' });
    const pool = (await import('../config/database.js')).default;
    const consultaOriginal = pool.query;
    const falla = mock.method(pool, 'query', function (sql, params) {
      if (String(sql).includes('otro.dataset_id')) return Promise.reject(new Error('Falla simulada'));
      return consultaOriginal.call(this, sql, params);
    });
    let resumen;
    try {
      resumen = await correr('2026-12-22');
    } finally {
      falla.mock.restore();
    }
    // Cada gestión busca lo que sale en su fecha (primero la interna): las dos anotan el error y siguen con su selección normal
    assert.deepEqual(resumen.errores.map(e => [e.tipo, e.gestion, e.mensaje]), [
      ['aviso', 'interna', 'Falla simulada'], ['aviso', 'externa', 'Falla simulada']
    ]);
    const [, normal, ...otras] = await notas();
    assert.equal(otras.length, 0, 'la gestión interna, sin pendientes, no genera nada');
    assert.deepEqual([normal.tipo, normal.gestion, normal.fecha], ['aviso', 'externa', '2026-12-22']);
    assert.deepEqual(await datasetsDe(normal.id), [{ dataset_id: nuevo, cuenta_desde: null }], 'solo el dataset nuevo: el adelantado no se pudo buscar');
    assert.equal(normal.presentada_por_id, autorizado.id);
    assert.ok(!normal.html.includes('Este pedido ya se había adelantado'));

    // Sin la falla, la corrida siguiente lo presenta en su fecha
    const siguiente = await correr('2026-12-23');
    assert.deepEqual(siguiente.errores, []);
    const [, , enSuFecha, ...demas] = await notas();
    assert.equal(demas.length, 0);
    assert.deepEqual([enSuFecha.tipo, enSuFecha.gestion, enSuFecha.fecha], ['aviso', 'externa', '2026-12-23']);
    assert.deepEqual(await datasetsDe(enSuFecha.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);
  });

  it('Estado: un sábado, después de la víspera, el próximo aviso externo es el lunes 22/12', async () => {
    await vispera();
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-12-19' })).proximas.externa.aviso, { fecha: '2026-12-22', cantidad: 1 });
  });

  // Ruling 5 (ola de arreglos final): un dataset al que ese día ya le toca la reiteración (20 días corridos desde su
  // cuenta_desde, inclusive) no entra en el aviso en su fecha: lo informa la reiteración, citando la nota anticipada. Así nunca
  // sale el mismo día en un aviso y en una reiteración. La condición es permanente: no depende de que hoy corra la reiteración.
  describe('recuperación 20 días tarde o más (autorización cargada con la licencia avanzada, del 10/12/2026 al 29/01/2027)', () => {
    let interno;
    beforeEach(async () => {
      await query("UPDATE usuarios_licencias SET hasta = '2027-01-29', autorizado_id = NULL, autorizado_at = NULL WHERE id = ?", [licenciaId]);
      interno = await crearDataset({ titulo: 'Interno de febrero', gestion: 'interna', vencimiento: '2027-02-28' });
    });

    it('el 11/01 el externo (22/12 + 20) sale en la reiteración y el interno (30/12) en su fecha; el 12/01 el externo sigue afuera', async () => {
      // Víspera sin persona autorizada: dos avisos, el interno y el externo, cada uno con su dataset y sin autorización
      await correr('2026-12-09');
      const vispera = await notas();
      assert.equal(vispera.length, 2);
      const anticipadoInterno = vispera.find(n => n.gestion === 'interna');
      const anticipadoExterno = vispera.find(n => n.gestion === 'externa');
      assert.deepEqual(await datasetsDe(anticipadoInterno.id), [{ dataset_id: interno, cuenta_desde: '2026-12-30' }]);
      assert.deepEqual(await datasetsDe(anticipadoExterno.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);
      assert.ok(vispera.every(n => !n.html.includes('Asimismo')));

      // Sin persona autorizada no se genera nada
      const del04 = await correr('2027-01-04');
      assert.match(del04.licencia, /sin autorizado/);
      assert.deepEqual(del04.generadas, []);
      assert.equal((await notas()).length, 2);

      // La autorización se carga el 08/01, con la licencia avanzada
      await query("UPDATE usuarios_licencias SET autorizado_id = ?, autorizado_at = '2027-01-08 10:00:00' WHERE id = ?", [autorizado.id, licenciaId]);

      // El Estado coincide con lo que sale: el externo ya no tiene aviso (le toca la reiteración); el interno sí, el 11/01
      const estado = await motor.estadoNotas({ hoy: '2027-01-11' });
      assert.equal(estado.proximas.externa.aviso, null);
      assert.deepEqual(estado.proximas.interna.aviso, { fecha: '2027-01-11', cantidad: 1 });

      // El 11/01 (22/12 + 20, el borde exacto): autorización, aviso interno en su fecha y reiteración externa
      const resumen = await correr('2027-01-11');
      assert.deepEqual(resumen.errores, []);
      const del11 = await delDia('2027-01-11');
      assert.ok(del11.some(n => n.tipo === 'autorizacion'), 'sale la nota de autorización');

      const avisoInterno = del11.find(n => n.tipo === 'aviso' && n.gestion === 'interna');
      assert.ok(avisoInterno, 'hay aviso interno en su fecha');
      assert.deepEqual(await datasetsDe(avisoInterno.id), [{ dataset_id: interno, cuenta_desde: '2026-12-30' }]);
      assert.ok(avisoInterno.html.includes(`Este pedido ya se había adelantado por Nota Digital N° ${anticipadoInterno.numero}/26 del 09/12/2026.`));
      assert.equal(avisoInterno.presentada_por_id, autorizado.id);

      assert.equal(del11.filter(n => n.tipo === 'aviso' && n.gestion === 'externa').length, 0, 'no hay aviso externo: ya le toca la reiteración');

      const reiteraciones = del11.filter(n => n.tipo === 'reiteracion');
      assert.deepEqual(reiteraciones.map(n => n.gestion), ['externa'], 'solo hay reiteración externa');
      assert.deepEqual((await datasetsDe(reiteraciones[0].id)).map(d => d.dataset_id), [externo]);
      const informado = `Nota Digital N° ${anticipadoExterno.numero}/26 (09/12/2026)`;
      assert.ok(reiteraciones[0].html.includes(`>${informado}`));
      assert.ok(!reiteraciones[0].html.includes(`${informado} y N°`), 'cita una sola nota');
      assert.ok((await textoDe(reiteraciones[0].id)).includes(informado));
      assert.ok(!(await textoDe(reiteraciones[0].id)).includes(`${informado} y N°`));

      // El día siguiente tampoco vuelve como aviso: la condición es permanente, no depende de que hoy corra la reiteración
      await correr('2027-01-12');
      const del12 = await delDia('2027-01-12');
      assert.equal(del12.filter(n => n.tipo === 'aviso' && n.gestion === 'externa').length, 0, 'el 12/01 sigue sin aviso externo');
      assert.equal((await notas()).filter(n => n.tipo === 'aviso' && n.gestion === 'externa').length, 1, 'el externo tiene un solo aviso, el de la víspera');
    });

    // La reiteración solo toma avisos enviados (seleccionarParaReiteracion), y un dataset con un aviso en cualquier estado no
    // entra por "vencido sin aviso". Si el aviso adelantado no llegó a salir, excluir al dataset del aviso en su fecha lo dejaría
    // sin nada: solo se lo excluye cuando el adelantado se envió.
    const anticipadoExterno = async () => {
      await correr('2026-12-09');
      const anticipado = (await notas()).find(n => n.tipo === 'aviso' && n.gestion === 'externa');
      assert.deepEqual(await datasetsDe(anticipado.id), [{ dataset_id: externo, cuenta_desde: '2026-12-22' }]);
      return anticipado;
    };
    const cargarAutorizada = () => query(
      "UPDATE usuarios_licencias SET autorizado_id = ?, autorizado_at = '2027-01-08 10:00:00' WHERE id = ?", [autorizado.id, licenciaId]
    );
    const estadoDe = async (id) => (await query('SELECT estado, intentos FROM notas_digitales WHERE id = ?', [id]))[0];

    it('el aviso adelantado quedó fallido sin reintentos: el 11/01 el externo sale en su fecha y no se reitera ese día', async () => {
      const anticipado = await anticipadoExterno();
      await query("UPDATE notas_digitales SET estado = 'fallida', intentos = ?, ultimo_error = 'SMTP caído', enviada_at = NULL WHERE id = ?",
        [motor.MAX_INTENTOS, anticipado.id]);
      await cargarAutorizada();

      // El Estado coincide con lo que sale: el externo tiene su aviso en su fecha el 11/01
      assert.deepEqual((await motor.estadoNotas({ hoy: '2027-01-11' })).proximas.externa.aviso, { fecha: '2027-01-11', cantidad: 1 });

      const resumen = await correr('2027-01-11');
      assert.deepEqual(resumen.errores, []);
      const del11 = await delDia('2027-01-11');
      const avisos = del11.filter(n => n.tipo === 'aviso' && n.gestion === 'externa');
      assert.equal(avisos.length, 1, 'hay un aviso externo en su fecha');
      assert.equal(avisos[0].presentada_por_id, autorizado.id);
      // Sale sin cuenta_desde: si la guardara, los 20 días de la reiteración se contarían desde el 22/12 y se reiteraría el mismo día
      assert.deepEqual(await datasetsDe(avisos[0].id), [{ dataset_id: externo, cuenta_desde: null }]);
      // La nota anticipada nunca salió: el aviso en su fecha no la cita (el área no la recibió)
      assert.ok(!avisos[0].html.includes('ya se había adelantado'));
      assert.ok(!(await textoDe(avisos[0].id)).includes('ya se había adelantado'));
      assert.equal(del11.filter(n => n.tipo === 'reiteracion' && n.gestion === 'externa').length, 0, 'ese día no hay reiteración externa');
      assert.deepEqual(await estadoDe(anticipado.id), { estado: 'fallida', intentos: motor.MAX_INTENTOS });

      // El día siguiente no vuelve: el externo sigue con sus dos avisos
      await correr('2027-01-12');
      assert.equal((await notas()).filter(n => n.tipo === 'aviso' && n.gestion === 'externa').length, 2, 'el 12/01 los avisos externos siguen siendo 2');
    });

    it('el aviso adelantado quedó pendiente: se reintenta primero y el externo va a la reiteración', async () => {
      const anticipado = await anticipadoExterno();
      await query("UPDATE notas_digitales SET estado = 'pendiente', intentos = 0, enviada_at = NULL WHERE id = ?", [anticipado.id]);
      await cargarAutorizada();

      const resumen = await correr('2027-01-11');
      assert.deepEqual(resumen.errores, []);
      // El reintento del paso 1 lo envía antes de elegir los avisos: ya está enviado y le toca la reiteración
      assert.equal((await estadoDe(anticipado.id)).estado, 'enviada');
      const del11 = await delDia('2027-01-11');
      assert.equal(del11.filter(n => n.tipo === 'aviso' && n.gestion === 'externa').length, 0, 'no hay aviso externo con fecha 11/01');
      const reiteraciones = del11.filter(n => n.tipo === 'reiteracion' && n.gestion === 'externa');
      assert.equal(reiteraciones.length, 1);
      assert.deepEqual((await datasetsDe(reiteraciones[0].id)).map(d => d.dataset_id), [externo]);
      assert.ok(reiteraciones[0].html.includes(`>Nota Digital N° ${anticipado.numero}/26 (09/12/2026)`));
    });
  });
});

// El aviso del día de una gestión (avisoDelDia): lo que la corrida arma por gestión, sin escribir nada. Lo comparten la corrida
// y las vistas previas de Correos (spec 2026-10-15, 7.6 y 7.7). Acá se lo llama con el contexto que arma la corrida: el modo, la
// licencia y, en la víspera, el anticipo y la autorización.
describe('avisoDelDia: la selección del aviso de una gestión, sin escrituras', () => {
  const DATOS_DE_AUTORIZACION = { nombre: 'Firma admin', cargo: 'Cargo admin', contratado: false, email: 'admin@rpad.test', desde: '2026-11-26', hasta: '2027-01-14' };
  const ids = (lista) => lista.map(d => d.id);

  it('la víspera con persona autorizada: los dos datasets con su cuenta_desde, el rango de vencimientos y la autorización', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    const enero = await crearDataset({ titulo: 'Vence el 25 de enero', vencimiento: '2027-01-25' });
    const febrero = await crearDataset({ titulo: 'Vence el 15 de febrero', vencimiento: '2027-02-15' });
    const anticipo = await firmas.anticipoPorLicencia(await config(), '2026-11-25');
    assert.ok(anticipo, 'el 25/11 es la víspera');

    const aviso = await motor.avisoDelDia({
      gestion: 'interna', fecha: '2026-11-25', modo: 'titular', licencia: null, anticipo, autorizacion: DATOS_DE_AUTORIZACION
    });
    assert.deepEqual(ids(aviso.datasets), [enero, febrero]);
    // Los dos entran por el anticipo: guardan su fecha normal de aviso (la ventana de 60 días abre el 26/11 y el 17/12)
    assert.deepEqual(aviso.datasets.map(d => d.cuenta_desde), ['2026-11-26', '2026-12-17']);
    assert.deepEqual(aviso.rangoVencimientos, { desde: '2027-01-25', hasta: '2027-02-15' });
    assert.deepEqual(aviso.autorizacion, DATOS_DE_AUTORIZACION);
    assert.equal(aviso.errorEnSuFecha, null);
    assert.equal((await notas()).length, 0, 'no genera ninguna nota');
  });

  it('en su fecha, con persona autorizada: el adelantado sale con su nota, sin rango de vencimientos ni autorización', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    const externo = await crearDataset({ titulo: 'Externo de enero', gestion: 'externa', vencimiento: '2027-01-31' });
    await correr('2026-12-09');
    const [anticipada, ...otras] = await notas();
    assert.equal(otras.length, 0);
    const { modo, licencia: delTitular } = await firmas.firmaParaFecha(await config(), '2026-12-22');
    assert.equal(modo, 'autorizado');

    const aviso = await motor.avisoDelDia({
      gestion: 'externa', fecha: '2026-12-22', modo, licencia: delTitular, anticipo: null, autorizacion: DATOS_DE_AUTORIZACION
    });
    assert.deepEqual(ids(aviso.datasets), [externo]);
    assert.deepEqual(aviso.datasets[0].adelantado, { numero: anticipada.numero, anio: anticipada.anio, fecha: '2026-12-09' });
    assert.equal(aviso.datasets[0].cuenta_desde, '2026-12-22');
    assert.equal(aviso.rangoVencimientos, null);
    assert.equal(aviso.autorizacion, null, 'fuera de la víspera la autorización no se comunica');
    assert.equal(aviso.errorEnSuFecha, null);
    // La otra gestión no tiene nada adelantado
    assert.deepEqual((await motor.avisoDelDia({ gestion: 'interna', fecha: '2026-12-22', modo, licencia: delTitular })).datasets, []);
    assert.equal((await notas()).length, 1, 'no genera ninguna nota');
  });

  // Solo se cita la nota anticipada que se envió (spec 7.6): el dataset de una que quedó fallida entra igual, pero el párrafo no
  // la nombra. La corrida y la vista previa comparten la selección y el párrafo.
  it('en su fecha, un adelantado cuyo aviso no salió entra igual pero no se cita; el párrafo nombra solo al que se envió', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    const enviado = await crearDataset({ titulo: 'Externo enviado', gestion: 'externa', vencimiento: '2027-01-31' });
    await correr('2026-12-09');
    const [anticipada, ...otras] = await notas();
    assert.equal(otras.length, 0);
    const fallido = await crearDataset({ titulo: 'Externo fallido', gestion: 'externa', vencimiento: '2027-01-31' });
    await crearNota({
      gestion: 'externa', fecha: '2026-12-09', numero: 90, estado: 'fallida',
      datasets: [{ id: fallido, vencimiento: '2027-01-31', cuentaDesde: '2026-12-22' }]
    });
    const { modo, licencia: delTitular } = await firmas.firmaParaFecha(await config(), '2026-12-22');

    const aviso = await motor.avisoDelDia({ gestion: 'externa', fecha: '2026-12-22', modo, licencia: delTitular });
    assert.deepEqual(ids(aviso.datasets), [enviado, fallido], 'los dos entran, como siempre');
    assert.deepEqual(aviso.datasets.map(d => d.adelantado), [{ numero: anticipada.numero, anio: anticipada.anio, fecha: '2026-12-09' }, null]);
    assert.deepEqual(aviso.datasets.map(d => d.cuenta_desde), ['2026-12-22', '2026-12-22'], 'la selección no cambia');

    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'externa', hoy: '2026-12-22' });
    assert.equal(vista.cantidad, 2);
    assert.ok(vista.html.includes(`El conjunto de datos &quot;Externo enviado&quot; ya se había adelantado por Nota Digital N° ${anticipada.numero}/26 del 09/12/2026.`));
    assert.ok(!vista.html.includes('N° 90/26'), 'la nota fallida no se nombra');
    assert.equal((vista.html.match(/ya se había adelantado/g) ?? []).length, 1, 'un solo adelantado citado');
  });

  it('un día normal sin licencia: la selección de siempre', async () => {
    const proximo = await crearDataset({ titulo: 'Vence en diciembre', vencimiento: '2026-12-31' });
    await crearDataset({ titulo: 'Vence en abril', vencimiento: '2027-04-30' });
    const esperados = await datos.seleccionarParaAviso('interna', '2026-11-02');
    assert.deepEqual(ids(esperados), [proximo]);

    const aviso = await motor.avisoDelDia({ gestion: 'interna', fecha: '2026-11-02', modo: 'titular' });
    assert.deepEqual(ids(aviso.datasets), ids(esperados));
    assert.equal(aviso.rangoVencimientos, null);
    assert.equal(aviso.autorizacion, null);
    assert.equal(aviso.errorEnSuFecha, null);
  });

  it('si falla la búsqueda de lo que sale en su fecha, devuelve la selección normal y el error', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    await crearDataset({ titulo: 'Externo de enero', gestion: 'externa', vencimiento: '2027-01-31' });
    await correr('2026-12-09');
    const nuevo = await crearDataset({ titulo: 'Externo nuevo', gestion: 'externa', vencimiento: '2027-01-31' });
    const { modo, licencia: delTitular } = await firmas.firmaParaFecha(await config(), '2026-12-22');
    const pool = (await import('../config/database.js')).default;
    const consultaOriginal = pool.query;
    const falla = mock.method(pool, 'query', function (sql, params) {
      if (String(sql).includes('otro.dataset_id')) return Promise.reject(new Error('Falla simulada'));
      return consultaOriginal.call(this, sql, params);
    });
    let aviso;
    try {
      aviso = await motor.avisoDelDia({ gestion: 'externa', fecha: '2026-12-22', modo, licencia: delTitular });
    } finally {
      falla.mock.restore();
    }
    assert.deepEqual(ids(aviso.datasets), [nuevo], 'solo el dataset nuevo: el adelantado no se pudo buscar');
    assert.equal(aviso.errorEnSuFecha?.message, 'Falla simulada');
  });
});

// Personal contratado (usuarios.vinculo = 'contrato', pedido del usuario el 16/10/2026): las notas lo leen de la base
describe('persona autorizada contratada (pedido del usuario el 16/10/2026)', () => {
  const RENGLON = 'Personal contratado, cumpliendo funciones de';
  const CONTRATADA = 'Firma admin, personal contratado, cumpliendo funciones de Cargo admin';
  beforeEach(async () => {
    await query("UPDATE usuarios SET vinculo = 'contrato' WHERE id = ?", [autorizado.id]);
    await query("UPDATE usuarios SET vinculo = 'planta_permanente' WHERE id = ?", [titular.id]);
  });

  it('la víspera, el párrafo del aviso la presenta como personal contratado; la firma del titular, de planta, como siempre', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ vencimiento: '2027-01-25' });
    await correr('2026-11-25');
    const [aviso] = await notas();
    assert.equal(aviso.tipo, 'aviso');
    assert.ok(aviso.html.includes(`autorizo expresamente a ${CONTRATADA}, a presentar en mi nombre las Notas Digitales durante mi licencia`), aviso.html);
    assert.ok(aviso.html.includes('>Firma superadmin<br>Cargo superadmin</p>'));
    assert.ok(!aviso.html.includes(RENGLON));
  });

  it('la nota de autorización también', async () => {
    await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await correr('2026-11-25');
    const [nota] = await notas();
    assert.equal(nota.tipo, 'autorizacion');
    assert.ok(nota.html.includes(`autorizo expresamente a ${CONTRATADA}, a presentar en mi nombre las Notas Digitales de esta Dirección`));
  });

  it('durante la licencia, su firma lleva el renglón y la leyenda la presenta como personal contratado', async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    const vencido = await crearDataset({ vencimiento: '2026-11-30' });
    await crearNota({ tipo: 'aviso', fecha: '2026-10-01', numero: 50, anio: 2026, datasets: [{ id: vencido, vencimiento: '2026-11-30' }] });
    await correr('2026-11-25');
    const [autorizacion] = await query('SELECT numero FROM notas_digitales WHERE id = ?', [await notaDeAutorizacionDe(licenciaId)]);
    const { firma } = await firmas.firmaParaFecha(await config(), '2026-12-01');
    assert.deepEqual([firma.titular.contratado, firma.presentante.contratado], [false, true]);
    await correr('2026-12-01');
    const [reiteracion] = (await notas()).filter(n => n.tipo === 'reiteracion' && n.fecha === '2026-12-01');
    assert.equal(reiteracion.presentada_por_id, autorizado.id);
    assert.ok(reiteracion.html.includes(`Nota presentada por ${CONTRATADA}, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${autorizacion.numero}/26 (licencia del 26/11/2026 al 14/01/2027).`));
    assert.ok(reiteracion.html.includes(`>Firma admin<br><span style="font-size:12px">${RENGLON}</span><br>Cargo admin</td>`));
    assert.ok(reiteracion.html.includes('>Firma superadmin<br>Cargo superadmin</td>'));
    assert.ok(lineasPorHoja(reiteracion.pdf).at(-1).includes(RENGLON));
  });
});

describe('persona autorizada con una licencia que se superpone en parte (del 22/02 al 03/03/2027; el titular, del 01/03 al 31/03/2027)', () => {
  const PARRAFO_MARZO = 'Asimismo, por medio de la presente autorizo expresamente a Firma admin, Cargo admin, a presentar en mi nombre las Notas Digitales durante mi licencia, del 01/03/2027 al 31/03/2027, con el objetivo de mantener el correcto flujo de trabajo.';
  const ERROR_NO_VIGENTE = {
    tipo: 'autorizado-no-vigente', nivel: 'error',
    mensaje: 'La persona autorizada para la licencia del firmante (del 01/03/2027 al 31/03/2027) ya no está activa, no tiene su firma cargada o está de licencia todos los días hábiles de esa licencia: esos días no se generan notas.'
  };
  const advertencia = (hasta) => ({
    tipo: 'autorizado-de-licencia', nivel: 'advertencia',
    mensaje: `La persona autorizada está de licencia hasta el ${hasta}: hasta entonces no se generan notas.`
  });
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

  it('la víspera con dos avisos (interna y externa), los dos llevan el párrafo y la licencia guarda el primero', async () => {
    await crearDataset({ gestion: 'interna', vencimiento: '2027-05-10' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-04-20' });
    await correr('2027-02-26');
    const todas = await notas();
    assert.deepEqual(todas.map(n => [n.tipo, n.gestion]), [['aviso', 'interna'], ['aviso', 'externa']]);
    for (const aviso of todas) {
      assert.ok(aviso.html.includes(PARRAFO_MARZO), aviso.gestion);
      assert.ok(aviso.cc.split(', ').includes(autorizado.email), aviso.gestion);
      assert.equal(aviso.presentada_por_id, null, aviso.gestion);
    }
    assert.equal(await notaDeAutorizacionDe(licenciaId), todas[0].id);
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

  it('Estado: con la persona autorizada de licencia hasta el final de la del titular, la advertencia y no el error', async () => {
    // Del 15/03 al 31/03 otra vez de licencia: le quedan del 04/03 al 12/03
    await licencia(autorizado, '2027-03-15', '2027-03-31');
    for (const hoy of ['2027-03-15', '2027-03-22']) {
      const estado = await motor.estadoNotas({ hoy });
      assert.equal(estado.licencia_firmante.autorizado, 'Firma admin', hoy);
      assert.equal(estado.licencia_firmante.autorizado_no_vigente, false, hoy);
      assert.equal(estado.licencia_firmante.autorizado_de_licencia_hasta, '2027-03-31', hoy);
      assert.deepEqual(alertasDelAutorizado(estado), [advertencia('31/03/2027')], hoy);
    }
  });

  it('Estado: licencias seguidas o separadas solo por días no hábiles cuentan como una para el "hasta el"', async () => {
    // Del 22/02 al 03/03, del 04/03 al 05/03 y (después del fin de semana) del 08/03 al 10/03; el 11/03 está libre
    await licencia(autorizado, '2027-03-04', '2027-03-05');
    await licencia(autorizado, '2027-03-08', '2027-03-10');
    await licencia(autorizado, '2027-03-12', '2027-03-15');
    for (const hoy of ['2027-02-24', '2027-03-06']) {
      const estado = await motor.estadoNotas({ hoy });
      assert.equal(estado.licencia_firmante.autorizado_de_licencia_hasta, '2027-03-10', hoy);
      assert.deepEqual(alertasDelAutorizado(estado), [advertencia('10/03/2027')], hoy);
    }
    assert.equal((await motor.estadoNotas({ hoy: '2027-03-11' })).licencia_firmante.autorizado_de_licencia_hasta, null);
    assert.equal((await motor.estadoNotas({ hoy: '2027-03-13' })).licencia_firmante.autorizado_de_licencia_hasta, '2027-03-15');
  });

  it('Estado: si la licencia del titular empieza un día no hábil, se mira su primer día hábil', async () => {
    // El titular, desde el sábado 27/02; la persona autorizada, de licencia del lunes 01/03 al miércoles 03/03
    await query("UPDATE usuarios_licencias SET desde = '2027-02-27' WHERE id = ?", [licenciaId]);
    await query("UPDATE usuarios_licencias SET desde = '2027-03-01' WHERE id = ?", [licenciaDelAutorizado]);
    for (const hoy of ['2027-02-25', '2027-02-27']) {
      const estado = await motor.estadoNotas({ hoy });
      assert.equal(estado.licencia_firmante.autorizado_de_licencia_hasta, '2027-03-03', hoy);
      assert.deepEqual(alertasDelAutorizado(estado), [advertencia('03/03/2027')], hoy);
    }
    // Sin ningún día hábil hasta el fin de la licencia del titular, se mira el día de hoy: el titular, hasta el domingo
    // 07/03; la persona autorizada, también de licencia del viernes 05/03 al domingo 07/03
    await query("UPDATE usuarios_licencias SET hasta = '2027-03-07' WHERE id = ?", [licenciaId]);
    await licencia(autorizado, '2027-03-05', '2027-03-07');
    const sabado = await motor.estadoNotas({ hoy: '2027-03-06' });
    assert.equal(sabado.licencia_firmante.autorizado_de_licencia_hasta, '2027-03-07');
    assert.deepEqual(alertasDelAutorizado(sabado), [advertencia('07/03/2027')]);
  });

  it('persona autorizada contratada: la víspera, de licencia, el párrafo la presenta como personal contratado; el 04/03, de vuelta, también la leyenda y su firma', async () => {
    const RENGLON = 'Personal contratado, cumpliendo funciones de';
    const CONTRATADA = 'Firma admin, personal contratado, cumpliendo funciones de Cargo admin';
    await query("UPDATE usuarios SET vinculo = 'contrato' WHERE id = ?", [autorizado.id]);
    await conReiterable();
    await crearDataset({ vencimiento: '2027-05-10' });
    await correr('2027-02-26');
    const [aviso, ...otras] = (await notas()).filter(n => n.fecha === '2027-02-26');
    assert.equal(otras.length, 0);
    assert.equal(aviso.tipo, 'aviso');
    assert.ok(aviso.html.includes(`Asimismo, por medio de la presente autorizo expresamente a ${CONTRATADA}, a presentar en mi nombre las Notas Digitales durante mi licencia, del 01/03/2027 al 31/03/2027,`), aviso.html);
    assert.equal(await notaDeAutorizacionDe(licenciaId), aviso.id);
    for (const dia of ['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04']) await correr(dia);
    const [reiteracion, ...demas] = (await notas()).filter(n => n.fecha === '2027-03-04');
    assert.equal(demas.length, 0);
    assert.equal(reiteracion.tipo, 'reiteracion');
    assert.equal(reiteracion.presentada_por_id, autorizado.id);
    assert.ok(reiteracion.html.includes(`Nota presentada por ${CONTRATADA}, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° ${aviso.numero}/27 (licencia del 01/03/2027 al 31/03/2027).`));
    assert.ok(reiteracion.html.includes(`>Firma admin<br><span style="font-size:12px">${RENGLON}</span><br>Cargo admin</td>`));
    // En el PDF, el renglón chico va en su firma, entre su nombre y su cargo, más chico que el cargo
    const ultima = textosPorHoja(reiteracion.pdf).at(-1);
    const de = (texto) => {
      const encontrados = ultima.filter(t => t.texto === texto);
      assert.equal(encontrados.length, 1, `"${texto}": ${encontrados.length} veces`);
      return encontrados[0];
    };
    const [nombre, renglon, cargo] = [de('Firma admin'), de(RENGLON), de('Cargo admin')];
    assert.ok(renglon.tamano < cargo.tamano, `${renglon.tamano} pt contra ${cargo.tamano} pt`);
    assert.ok(nombre.base > renglon.base && renglon.base > cargo.base);
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

  it('las vistas previas durante una licencia sin autorizado muestran la vuelta, con la firma del titular (spec 7.7)', async () => {
    await licencia(titular, '2026-10-26', '2026-11-13');
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    // El 13/11 es viernes: la licencia termina y el primer día hábil siguiente es el lunes 16/11
    assert.equal(vista.fecha, '2026-11-16');
    assert.equal(vista.motivo, 'licencia del firmante sin persona autorizada');
    assert.match(vista.html, /Firma superadmin<br>Cargo superadmin/);
    assert.doesNotMatch(vista.html, /Nota presentada por/);
    assert.ok(vista.html.includes('16 de noviembre de 2026'));
  });
});

// La vista previa y la prueba de Correos muestran la nota como saldría en la próxima corrida que genera notas, con la misma
// selección que la corrida (spec 2026-10-15, 7.7, pedido del usuario el 18/10/2026)
describe('vista previa y prueba de Correos: la nota como saldría (spec 7.7)', () => {
  const PARRAFO_DE_LA_VISPERA = PARRAFO;
  const todasLasNotas = () => query('SELECT id, es_prueba FROM notas_digitales');
  const filasDeDatasets = async () => (await query('SELECT COUNT(*) AS n FROM notas_digitales_datasets'))[0].n;
  // Dos datasets internos que se anticipan en la víspera (25/11) de la licencia del 26/11 al 14/01
  const conLaVispera = async () => {
    const licenciaId = await licencia(titular, '2026-11-26', '2027-01-14', autorizado);
    await crearDataset({ titulo: 'Vence el 25 de enero', vencimiento: '2027-01-25' });
    await crearDataset({ titulo: 'Vence el 15 de febrero', vencimiento: '2027-02-15' });
    return licenciaId;
  };

  it('la víspera de una licencia con persona autorizada: los avisos anticipados con el párrafo de autorización, sin escribir nada', async () => {
    const licenciaId = await conLaVispera();
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-25' });
    assert.match(vista.asunto, /^Nota Digital N° XX – .*vencimientos de enero a febrero 2027/);
    assert.ok(vista.html.includes(PARRAFO_DE_LA_VISPERA));
    assert.deepEqual([vista.cantidad, vista.motivo, vista.fecha, vista.ejemplo], [2, null, '2026-11-25', false]);
    assert.ok(vista.html.includes('Vence el 25 de enero') && vista.html.includes('Vence el 15 de febrero'));
    assert.deepEqual(await todasLasNotas(), []);
    assert.equal(await filasDeDatasets(), 0);
    assert.equal(await notaDeAutorizacionDe(licenciaId), null);
  });

  it('el PDF y el anexo de la víspera son los del aviso anticipado: dos hojas, firma del titular', async () => {
    await conLaVispera();
    const pdf = await motor.previewPdf({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-25' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const texto = lineasPorHoja(pdf).flat().join(' ');
    assert.ok(texto.includes('Vence el 25 de enero') && texto.includes('Vence el 15 de febrero'), texto);
    assert.ok(texto.includes('Asimismo, por medio de la presente autorizo expresamente a Firma admin'), texto);
    assert.ok(texto.includes('25 de noviembre de 2026') && !texto.includes('Nota presentada por'), texto);
    const anexo = lineasPorHoja(await motor.previewAnexo({ gestion: 'interna', hoy: '2026-11-25' }));
    assert.equal(anexo.length, 2);
    assert.ok(anexo[0].includes('Anexo – Nota Digital N° XX · Hoja 1 de 2'), anexo[0].join(' | '));
    assert.deepEqual(await todasLasNotas(), []);
  });

  it('un sábado muestra el lunes: la fecha de la próxima corrida y el motivo "día no hábil"', async () => {
    await crearDataset({ titulo: 'Vence en enero', vencimiento: '2027-01-31' });
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-19' });
    assert.deepEqual([vista.fecha, vista.motivo, vista.cantidad, vista.ejemplo], ['2026-12-21', 'día no hábil', 1, false]);
    assert.ok(vista.html.includes('21 de diciembre de 2026'));
    assert.match(vista.asunto, /gestión interna – diciembre 2026\)$/);
    // La reiteración y la nota de auditoría usan la misma fecha
    for (const tipo of ['reiteracion', 'auditoria']) {
      const otra = await motor.previewNota({ tipo, gestion: 'interna', hoy: '2026-12-19' });
      assert.deepEqual([otra.fecha, otra.motivo], ['2026-12-21', 'día no hábil'], tipo);
      assert.ok(otra.html.includes('21 de diciembre de 2026'), tipo);
    }
    // Un día hábil sin licencia: hoy, sin motivo
    const habil = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-21' });
    assert.deepEqual([habil.fecha, habil.motivo], ['2026-12-21', null]);
  });

  it('un feriado muestra el día hábil siguiente', async () => {
    // El 08/12/2026 (martes) es feriado; el miércoles 09/12 se generan notas
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-08' });
    assert.deepEqual([vista.fecha, vista.motivo], ['2026-12-09', 'día no hábil']);
  });

  it('con la persona autorizada de licencia muestra el día en que vuelve', async () => {
    // Licencia del titular del 10/12/2026 al 08/01/2027; la persona autorizada falta del 14/12 al 31/12
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    await licencia(autorizado, '2026-12-14', '2026-12-31');
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-14' });
    // El 01/01 es feriado y el 02 y 03 son fin de semana: vuelve el lunes 04/01
    assert.deepEqual([vista.fecha, vista.motivo], ['2027-01-04', 'la persona autorizada está de licencia']);
    // Sale presentada por ella
    assert.ok(vista.html.includes('Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin'));
  });

  it('con la persona autorizada de licencia todos los días de la del titular muestra la vuelta del titular', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    await licencia(autorizado, '2026-12-08', '2027-01-10');
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-14' });
    // El 08/01 es viernes: el titular vuelve el lunes 11/01 y firma él
    assert.deepEqual([vista.fecha, vista.motivo], ['2027-01-11', 'la persona autorizada está de licencia']);
    assert.match(vista.html, /Firma superadmin<br>Cargo superadmin/);
    assert.doesNotMatch(vista.html, /Nota presentada por/);
  });

  it('con una persona autorizada que ya no sirve (inactiva) el motivo es la licencia sin persona autorizada', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [autorizado.id]);
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-14' });
    assert.deepEqual([vista.fecha, vista.motivo], ['2027-01-11', 'licencia del firmante sin persona autorizada']);
  });

  it('un día no hábil dentro de una licencia sin autorizado dice "día no hábil"', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08');
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-12' });
    assert.deepEqual([vista.fecha, vista.motivo], ['2027-01-11', 'día no hábil']);
  });

  it('fechaDeVistaPrevia: se busca hasta 366 días; sin ningún día con notas, hoy y sin motivo', async () => {
    await licencia(titular, '2026-11-01', '2028-12-31');
    const conf = await config();
    assert.deepEqual(await motor.fechaDeVistaPrevia(conf, '2026-11-02'), { fecha: '2026-11-02', motivo: null });
    // A 366 días todavía se encuentra; a 367 no
    await query('UPDATE usuarios_licencias SET hasta = ?', ['2027-11-02']);
    assert.deepEqual(await motor.fechaDeVistaPrevia(conf, '2026-11-02'), { fecha: '2027-11-03', motivo: 'licencia del firmante sin persona autorizada' });
    await query('UPDATE usuarios_licencias SET hasta = ?', ['2027-11-03']);
    assert.deepEqual(await motor.fechaDeVistaPrevia(conf, '2026-11-02'), { fecha: '2026-11-02', motivo: null });
  });

  // El primer día hábil desde hoy en que alguien presenta las notas, probando todos los días (hasta 366)
  const porDia = async (conf, hoy) => {
    for (let dia = hoy, i = 0; i <= 366; dia = sumarDiasIso(dia, 1), i++) {
      if (esDiaHabilIso(dia) && (await firmas.firmaParaFecha(conf, dia)).modo !== 'sin_autorizado') return dia;
    }
    return hoy;
  };

  it('fechaDeVistaPrevia da lo mismo que probar día por día, con la persona autorizada ausente algunos días o todos, o sin ella', async () => {
    const conf = await config();
    const escenarios = {
      'ausente algunos días': async () => {
        await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
        await licencia(autorizado, '2026-12-14', '2026-12-16');
        await licencia(autorizado, '2026-12-21', '2026-12-31');
      },
      'ausente todos los días': async () => {
        await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
        await licencia(autorizado, '2026-12-01', '2027-01-20');
      },
      'sin persona autorizada': async () => {
        await licencia(titular, '2026-12-10', '2027-01-08');
      },
      'dos licencias seguidas del titular, la segunda con persona autorizada': async () => {
        await licencia(titular, '2026-12-10', '2026-12-18');
        await licencia(titular, '2026-12-19', '2027-01-08', autorizado);
        await licencia(autorizado, '2026-12-21', '2026-12-23');
      }
    };
    for (const [nombre, preparar] of Object.entries(escenarios)) {
      await query('DELETE FROM usuarios_licencias');
      await preparar();
      // De a 3 días: recorre todos los días de la semana sin probar cada fecha
      for (let hoy = '2026-12-01'; hoy <= '2027-01-15'; hoy = sumarDiasIso(hoy, 3)) {
        const { fecha, motivo } = await motor.fechaDeVistaPrevia(conf, hoy);
        assert.equal(fecha, await porDia(conf, hoy), `${nombre}, hoy ${hoy}`);
        assert.equal(motivo === null, fecha === hoy, `${nombre}, hoy ${hoy}: el motivo solo falta si la fecha es hoy`);
      }
    }
  });

  // El caso medido: la persona autorizada solo está libre la primera semana de una licencia de un año. Con hoy después de esa
  // semana, buscar si le queda algún día libre desde el comienzo de la licencia da que sí y la búsqueda caminaba la licencia
  // día por día (1979 consultas y 2,6 s por llamada, tres veces por vista previa: HTML, PDF y anexo). Desde hoy no le queda
  // ninguno: salta hasta la vuelta del titular. El resultado es el mismo que probar día por día.
  it('fechaDeVistaPrevia no camina la licencia día por día cuando a la persona autorizada ya no le queda ningún día libre', async () => {
    await licencia(titular, '2026-12-10', '2027-12-10', autorizado);
    await licencia(autorizado, '2026-12-18', '2028-01-31');
    const conf = await config();
    const pool = (await import('../config/database.js')).default;
    const consultaOriginal = pool.query;
    for (const hoy of ['2026-12-09', '2026-12-14', '2026-12-17', '2026-12-18', '2026-12-21', '2027-03-01', '2027-12-10']) {
      const consultas = mock.method(pool, 'query', function (sql, params) { return consultaOriginal.call(this, sql, params); });
      let vista, cantidad;
      try {
        vista = await motor.fechaDeVistaPrevia(conf, hoy);
        cantidad = consultas.mock.callCount();
      } finally {
        consultas.mock.restore();
      }
      assert.equal(vista.fecha, await porDia(conf, hoy), `hoy ${hoy}`);
      // Unas pocas consultas: la vuelta de hoy y un salto hasta la vuelta del titular (caminándola eran más de mil)
      assert.ok(cantidad < 30, `hoy ${hoy}: ${cantidad} consultas`);
    }
    // Hoy 21/12 el titular vuelve el lunes 13/12/2027, después de la licencia (hasta el viernes 10/12/2027)
    assert.deepEqual(await motor.fechaDeVistaPrevia(conf, '2026-12-21'), { fecha: '2027-12-13', motivo: 'la persona autorizada está de licencia' });
    assert.deepEqual(await motor.fechaDeVistaPrevia(conf, '2026-12-14'), { fecha: '2026-12-14', motivo: null });
  });

  it('autorización tardía: la leyenda cita la Nota Digital N° XX y no se genera nada', async () => {
    // La licencia ya está en curso y la víspera pasó sin persona autorizada: no salió ninguna nota
    const licenciaId = await licencia(titular, '2026-10-26', '2026-11-13');
    await correr('2026-10-23');
    assert.deepEqual(await todasLasNotas(), []);
    await crearDataset({ titulo: 'Vence en diciembre', vencimiento: '2026-12-31' });
    // La persona autorizada se carga con la licencia en curso
    await query("UPDATE usuarios_licencias SET autorizado_id = ?, autorizado_at = '2026-11-01 10:00:00' WHERE id = ?", [autorizado.id, licenciaId]);

    const leyenda = 'Nota presentada por Firma admin, Cargo admin, en nombre de Firma superadmin, Cargo superadmin, conforme a la autorización conferida mediante Nota Digital N° XX (licencia del 26/10/2026 al 13/11/2026).';
    const vista = await motor.previewNota({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' });
    assert.deepEqual([vista.fecha, vista.motivo, vista.cantidad], ['2026-11-02', null, 1]);
    assert.ok(vista.html.includes(leyenda), 'la leyenda cita la nota de autorización que todavía no salió');
    // Las otras notas del día también salen con la leyenda
    for (const tipo of ['reiteracion', 'auditoria']) {
      assert.ok((await motor.previewNota({ tipo, gestion: 'interna', hoy: '2026-11-02' })).html.includes(leyenda), tipo);
    }
    assert.ok(lineasPorHoja(await motor.previewPdf({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-02' })).flat().join(' ').includes('Nota Digital N° XX (licencia'));

    // No genera la nota de autorización ni toca la licencia
    assert.deepEqual(await todasLasNotas(), []);
    assert.equal(await notaDeAutorizacionDe(licenciaId), null);
    // y la corrida de ese día confirma lo que mostraba: primero la nota de autorización y después el aviso, con la misma selección
    await correr('2026-11-02');
    const [autorizacion, aviso] = await notas();
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(aviso.tipo, 'aviso');
    assert.equal(aviso.asunto.replace(/N° \S+/, 'N° XX'), vista.asunto);
    assert.ok(aviso.html.includes(`mediante Nota Digital N° ${autorizacion.numero}/26 (licencia del 26/10/2026 al 13/11/2026)`));
  });

  it('si falla la búsqueda de lo que sale en su fecha, la vista previa falla (500) en vez de mostrar otra nota', async () => {
    await licencia(titular, '2026-12-10', '2027-01-08', autorizado);
    await crearDataset({ titulo: 'Externo de enero', gestion: 'externa', vencimiento: '2027-01-31' });
    await correr('2026-12-09');
    const pool = (await import('../config/database.js')).default;
    const consultaOriginal = pool.query;
    const falla = mock.method(pool, 'query', function (sql, params) {
      if (String(sql).includes('otro.dataset_id')) return Promise.reject(new Error('Falla simulada'));
      return consultaOriginal.call(this, sql, params);
    });
    try {
      await assert.rejects(motor.previewNota({ tipo: 'aviso', gestion: 'externa', hoy: '2026-12-22' }), /Falla simulada/);
      await assert.rejects(motor.previewAnexo({ gestion: 'externa', hoy: '2026-12-22' }), /Falla simulada/);
      await assert.rejects(motor.enviarPrueba({ tipo: 'aviso', gestion: 'externa', hoy: '2026-12-22' }), /Falla simulada/);
    } finally {
      falla.mock.restore();
    }
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales WHERE es_prueba = 1'))[0].n, 0);
  });

  it('la prueba de la víspera: una nota de prueba con los avisos anticipados, sin registrar datasets ni la autorización', async () => {
    const licenciaId = await conLaVispera();
    const prueba = await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-11-25' });
    assert.equal(prueba.success, true);
    assert.deepEqual([prueba.fecha, prueba.motivo, prueba.ejemplo], ['2026-11-25', null, false]);
    const [nota] = await query('SELECT es_prueba, asunto, para, cc, html FROM notas_digitales WHERE id = ?', [prueba.id]);
    assert.equal(nota.es_prueba, 1);
    assert.match(nota.asunto, /^\[PRUEBA\] Nota Digital N° PRUEBA – .*vencimientos de enero a febrero 2027/);
    assert.ok(nota.html.includes(PARRAFO_DE_LA_VISPERA));
    // Solo a las casillas de prueba: ni los destinatarios de la gestión ni la persona autorizada en CC
    assert.equal(nota.para, 'prueba@rpad.test');
    assert.equal(nota.cc, '');
    assert.equal(await filasDeDatasets(), 0);
    assert.equal((await todasLasNotas()).length, 1);
    assert.equal(await notaDeAutorizacionDe(licenciaId), null);
    assert.equal((await mailpit.esperar(m => m.Subject === nota.asunto)).length, 1);
  });

  it('la prueba de un día sin notas dice qué día muestra', async () => {
    const prueba = await motor.enviarPrueba({ tipo: 'aviso', gestion: 'interna', hoy: '2026-12-19' });
    assert.deepEqual([prueba.fecha, prueba.motivo, prueba.ejemplo], ['2026-12-21', 'día no hábil', true]);
    const [nota] = await query('SELECT html FROM notas_digitales WHERE id = ?', [prueba.id]);
    assert.ok(nota.html.includes('21 de diciembre de 2026'));
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
