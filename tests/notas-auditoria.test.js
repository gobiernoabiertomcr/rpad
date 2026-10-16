// La nota de auditoría en la corrida diaria de Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, 9 y 10),
// con los ejemplos de la spec 9.4 como fechas fijas, sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearDataset, limpiarBase, configurarNotas, conFallaSimulada } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';
import { lineasPorHoja } from './pdf-lector.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
const REF = 'Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets';
let base, motor, dbReal, titular, auditor, editor;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_auditoria');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  motor = await import('../services/notasDigitales.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

// Cada persona con su firma cargada: "Firma {rol}" / "Cargo de firma {rol}"
const crearUsuario = async (rol) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const r = await query(
    "INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, cargo) VALUES (?, 'x', ?, ?, ?, 1, ?)",
    [username, `Persona ${rol}`, `${username}@rpad.test`, rol, `Cargo ${rol}`]
  );
  await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
    [r.insertId, `Firma ${rol}`, `Cargo de firma ${rol}`, FIRMA]);
  return { id: r.insertId, email: `${username}@rpad.test` };
};

// El firmante titular (superadmin), otro auditor (admin) y un editor
beforeEach(async () => {
  process.env.EMAIL_SOLO_A = '';
  await limpiarBase();
  await configurarNotas({ para_auditoria: 'auditoria@rpad.test', cc_auditoria: 'cc-auditoria@rpad.test' });
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin');
  auditor = await crearUsuario('admin');
  editor = await crearUsuario('editor');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [titular.id]);
  await mailpit.vaciar();
});

// Instante de una fecha y hora de Argentina (UTC-3), en segundos
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
// Un alta propuesta el viernes 16/10/2026 a las 10:00, con su primer recordatorio ese día a las 14:00
const proponer = async (usuario, { titulo = 'Dataset nuevo auditado', creado = '2026-10-16 10:00:00', primer = '2026-10-16 14:00:00' } = {}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at, primer_recordatorio_at)
   VALUES ('crear', NULL, ?, ?, FROM_UNIXTIME(?), ?)`,
  [JSON.stringify({ titulo, tipo_gestion: 'interna' }), usuario.id, instante(creado), primer]
)).insertId;
const licencia = (usuario, desde, hasta, autorizado = null) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizado?.id ?? null, autorizado ? '2026-10-15 10:00:00' : null]
);
const correr = (hoy) => motor.ejecutarNotasDigitales({ hoy });
const auditorias = () => query(
  `SELECT id, numero, anio, gestion, estado, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, asunto, para, cc, cco, html, pdf,
          firmante_id, presentada_por_id
   FROM notas_digitales WHERE tipo = 'auditoria' AND es_prueba = 0 ORDER BY id`
);
const incluidos = (notaId) => query('SELECT cambio_id, seccion FROM notas_digitales_cambios WHERE nota_id = ? ORDER BY cambio_id', [notaId]);
const libro = () => query('SELECT numero, tipo FROM notas_digitales WHERE es_prueba = 0 ORDER BY id');

describe('ejemplo 9.4: propone el titular el viernes y hay otro auditor disponible', () => {
  it('el lunes sale la nota con el cambio nuevo, a los destinatarios de auditoría, firmada por el titular', async () => {
    const id = await proponer(titular);
    await correr('2026-10-19');
    const [nota, ...otras] = await auditorias();
    assert.equal(otras.length, 0);
    assert.equal(nota.asunto, `Nota Digital N° ${nota.numero}/26 – Ref.: ${REF}`);
    assert.deepEqual([nota.gestion, nota.estado, nota.fecha], [null, 'enviada', '2026-10-19']);
    assert.deepEqual([nota.para, nota.cc, nota.cco], ['auditoria@rpad.test', 'cc-auditoria@rpad.test', 'respaldo@rpad.test']);
    assert.deepEqual([nota.firmante_id, nota.presentada_por_id], [titular.id, null]);
    assert.deepEqual(await incluidos(nota.id), [{ cambio_id: id, seccion: 'nuevo' }]);
    assert.ok(nota.html.includes('Dataset nuevo auditado'));
    assert.ok(nota.html.includes('Persona superadmin, Cargo superadmin'));
    assert.ok(nota.html.includes('Firma superadmin<br>Cargo de firma superadmin'));
    assert.ok(lineasPorHoja(nota.pdf).flat().join(' ').includes('Detalle de cada cambio'));
    const [mensaje] = await mailpit.esperar(m => m.Subject === nota.asunto);
    assert.deepEqual(mensaje.To.map(t => t.Address), ['auditoria@rpad.test']);
    assert.deepEqual(mensaje.Cc.map(t => t.Address), ['cc-auditoria@rpad.test']);
  });

  it('no se repite en los días siguientes; a los 5 días hábiles se reitera citando la primera nota, y cuenta las reiteraciones', async () => {
    const id = await proponer(titular);
    for (const dia of ['2026-10-19', '2026-10-20', '2026-10-23']) await correr(dia);
    assert.equal((await auditorias()).length, 1);
    await correr('2026-10-26');
    const [primera, reiteracion] = await auditorias();
    assert.equal(reiteracion.asunto, `Nota Digital N° ${reiteracion.numero}/26 – Ref.: Reiteración – ${REF}`);
    assert.deepEqual(await incluidos(reiteracion.id), [{ cambio_id: id, seccion: 'reiterado' }]);
    assert.ok(reiteracion.html.includes(`Nota Digital N° ${primera.numero}/26 (19/10/2026)`));
    assert.ok(!reiteracion.html.includes('– reiterado'));
    await correr('2026-11-02');
    const segunda = (await auditorias())[2];
    assert.ok(segunda.html.includes(`Nota Digital N° ${primera.numero}/26 (19/10/2026) – reiterado 1 vez`));
  });
});

describe('canal de cada cambio en la corrida (spec 9.1 y 9.4)', () => {
  it('propone un editor y el titular está disponible: nunca sale nota', async () => {
    await proponer(editor);
    await correr('2026-10-19');
    await correr('2026-10-26');
    assert.equal((await auditorias()).length, 0);
  });

  it('sin el primer recordatorio en un día hábil anterior no va: ni sin recordatorio ni con el de hoy', async () => {
    await proponer(titular, { primer: null });
    await proponer(titular, { titulo: 'Recordado hoy', primer: '2026-10-19 14:00:00' });
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
  });

  it('propone el titular y el único otro auditor está de licencia: respaldo, no sale nota', async () => {
    await proponer(titular);
    await licencia(auditor, '2026-10-19', '2026-10-23');
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
  });

  it('el titular de licencia sin autorizado: no sale nota; el primer día hábil posterior, sí', async () => {
    const id = await proponer(titular);
    await licencia(titular, '2026-10-19', '2026-10-23');
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
    await correr('2026-10-26');
    const [nota] = await auditorias();
    assert.equal(nota.fecha, '2026-10-26');
    assert.deepEqual(await incluidos(nota.id), [{ cambio_id: id, seccion: 'nuevo' }]);
  });

  it('el titular de licencia con autorizado, propone un editor: sale después de la nota de autorización, con las dos firmas', async () => {
    await proponer(editor);
    await licencia(titular, '2026-10-19', '2026-10-30', auditor);
    await correr('2026-10-19');
    const notas = await libro();
    assert.deepEqual(notas.map(n => n.tipo), ['autorizacion', 'auditoria']);
    assert.equal(notas[1].numero, notas[0].numero + 1);
    const [nota] = await auditorias();
    assert.deepEqual([nota.firmante_id, nota.presentada_por_id], [titular.id, auditor.id]);
    assert.ok(nota.html.includes(`Nota presentada por Firma admin, Cargo de firma admin, en nombre de Firma superadmin, Cargo de firma superadmin, conforme a la autorización conferida mediante Nota Digital N° ${notas[0].numero}/26 (licencia del 19/10/2026 al 30/10/2026).`));
  });

  it('sin firmante titular, la condición 2 mira al superadmin y firma la configuración de Correos', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
    await proponer(titular);
    await correr('2026-10-19');
    const [nota] = await auditorias();
    assert.equal(nota.firmante_id, null);
    assert.ok(nota.html.includes('Firma de Prueba<br>Cargo de Prueba'));
  });
});

describe('una por día, numeración del libro, reintentos, autorización e interruptor', () => {
  it('la numeración es la del libro: el aviso del día y después la nota de auditoría', async () => {
    await crearDataset({ vencimiento: '2026-12-15' });
    await proponer(titular);
    await correr('2026-10-19');
    assert.deepEqual((await libro()).map(n => [n.tipo, n.numero]), [['aviso', 1], ['auditoria', 2]]);
  });

  it('un cambio que entra al canal después de la nota del día sale al día hábil siguiente, sin repetir el anterior', async () => {
    await proponer(titular);
    await correr('2026-10-19');
    const tarde = await proponer(titular, { titulo: 'Llegó más tarde' });
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 1);
    await correr('2026-10-20');
    const [, siguiente] = await auditorias();
    assert.deepEqual(await incluidos(siguiente.id), [{ cambio_id: tarde, seccion: 'nuevo' }]);
  });

  it('si el envío falla, la misma nota se reintenta en la corrida siguiente y no se genera otra', async () => {
    await proponer(titular);
    process.env.EMAIL_SOLO_A = 'nadie@rpad.test';
    await correr('2026-10-19');
    process.env.EMAIL_SOLO_A = '';
    assert.equal((await auditorias())[0].estado, 'fallida');
    await correr('2026-10-20');
    const todas = await auditorias();
    assert.equal(todas.length, 1);
    assert.equal(todas[0].estado, 'enviada');
  });

  it('si la nota de autorización no se pudo generar ese día, tampoco sale la de auditoría', async () => {
    await proponer(editor);
    await licencia(titular, '2026-10-19', '2026-10-30', auditor);
    const resumen = await conFallaSimulada('INSERT', "NEW.tipo = 'autorizacion'", () => correr('2026-10-19'));
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['autorizacion']);
    assert.equal((await auditorias()).length, 0);
    await correr('2026-10-20');
    assert.deepEqual((await libro()).map(n => n.tipo), ['autorizacion', 'auditoria']);
  });

  it('con el envío automático desactivado no sale nada', async () => {
    await configurarNotas({ envio_activo: 0, para_auditoria: 'auditoria@rpad.test' });
    await proponer(titular);
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 0);
  });

  it('sin Para de auditoría, el paso queda como error y las demás notas salen igual', async () => {
    await query("UPDATE notas_digitales_config SET para_auditoria = ''");
    await crearDataset({ vencimiento: '2026-12-15' });
    await proponer(titular);
    const resumen = await correr('2026-10-19');
    assert.deepEqual(resumen.errores.map(e => e.tipo), ['auditoria']);
    assert.deepEqual((await libro()).map(n => n.tipo), ['aviso']);
  });
});

describe('Correos: Estado, vista previa y prueba (spec 10.4)', () => {
  it('el Estado cuenta los cambios del canal nota y da la fecha de la próxima nota de auditoría', async () => {
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-19' })).auditoria, { canal_nota: 0, proxima: null });
    await proponer(titular);
    await proponer(editor);
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-19' })).auditoria, { canal_nota: 1, proxima: '2026-10-19' });
    await correr('2026-10-19');
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-19' })).auditoria, { canal_nota: 1, proxima: '2026-10-26' });
    // Un sábado mira la corrida del lunes
    assert.deepEqual((await motor.estadoNotas({ hoy: '2026-10-24' })).auditoria, { canal_nota: 1, proxima: '2026-10-26' });
  });

  it('la vista previa usa los cambios de hoy o, si no hay, un ejemplo; no escribe nada', async () => {
    const ejemplo = await motor.previewNota({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.equal(ejemplo.ejemplo, true);
    assert.equal(ejemplo.asunto, `Nota Digital N° XX – Ref.: ${REF}`);
    assert.match(ejemplo.html, /Dataset de ejemplo/);
    await proponer(titular);
    const real = await motor.previewNota({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.deepEqual([real.ejemplo, real.cantidad], [false, 1]);
    assert.ok(real.html.includes('Dataset nuevo auditado'));
    const pdf = await motor.previewPdf({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.equal(pdf.subarray(0, 4).toString('latin1'), '%PDF');
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales'))[0].n, 0);
  });

  it('la prueba va a las casillas de prueba y no registra cambios: el cambio sigue siendo nuevo para la corrida', async () => {
    await proponer(titular);
    const resultado = await motor.enviarPrueba({ tipo: 'auditoria', gestion: null, hoy: '2026-10-19' });
    assert.equal(resultado.success, true);
    const [nota] = await query('SELECT tipo, es_prueba, para, asunto, html FROM notas_digitales WHERE id = ?', [resultado.id]);
    assert.deepEqual([nota.tipo, nota.es_prueba, nota.para], ['auditoria', 1, 'prueba@rpad.test']);
    assert.match(nota.asunto, /^\[PRUEBA\] Nota Digital N° PRUEBA – Ref\.: /);
    // Lleva el cambio de hoy (no un cuerpo vacío ni el de otro tipo de nota)
    assert.ok(nota.html.includes('Dataset nuevo auditado'));
    assert.equal((await query('SELECT COUNT(*) AS n FROM notas_digitales_cambios'))[0].n, 0);
    await correr('2026-10-19');
    assert.equal((await auditorias()).length, 1);
  });
});
