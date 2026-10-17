// Lecturas de la auditoría de cambios pendientes (services/auditoriaService.js, spec
// 2026-10-15-dias-habiles-licencias-auditoria, 3, 9.1 y 9.3) sobre una base de prueba
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { limpiarBase, crearNota, crearArea, configurarNotas } from './notas-fixtures.js';
import { pngRgba } from './firma-fixtures.js';

const FIRMA = pngRgba({ ancho: 40, alto: 20 });
let base, servicio, dbReal, titular, auditor, editor;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_auditoria_datos');
  process.env.DB_NAME = base.nombre;
  servicio = await import('../services/auditoriaService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

const crearUsuario = async (rol, { activo = 1, contrasena = 'x', conFirma = false } = {}) => {
  const username = `t_${rol}_${crypto.randomBytes(3).toString('hex')}`;
  const r = await query(
    'INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo, cargo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, contrasena, `Persona ${rol}`, `${username}@rpad.test`, rol, activo, `Cargo ${rol}`]
  );
  if (conFirma) {
    await query("INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, 'image/png')",
      [r.insertId, `Firma ${rol}`, `Cargo de firma ${rol}`, FIRMA]);
  }
  return { id: r.insertId, username };
};

beforeEach(async () => {
  await limpiarBase();
  // Notas Digitales encendidas y completas, con Para de auditoría: sin eso ningún cambio llega al canal nota (spec 9.1)
  await configurarNotas({ para_auditoria: 'auditoria@rpad.test' });
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM usuarios');
  titular = await crearUsuario('superadmin', { conFirma: true });
  auditor = await crearUsuario('admin', { conFirma: true });
  editor = await crearUsuario('editor');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = ? WHERE id = 1', [titular.id]);
});

const licencia = (usuario, desde, hasta, autorizado = null) => query(
  'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id) VALUES (?, ?, ?, ?)',
  [usuario.id, desde, hasta, autorizado?.id ?? null]
);
// Instante de una fecha y hora de Argentina (UTC-3), en segundos: created_at se carga con FROM_UNIXTIME, que no depende
// de la zona horaria de la base
const instante = (texto) => Date.parse(`${texto.replace(' ', 'T')}-03:00`) / 1000;
const proponer = async (usuario, { creado = '2026-10-16 10:00:00', primer = null, titulo = 'Alta de prueba' } = {}) => (await query(
  `INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id, created_at, primer_recordatorio_at)
   VALUES ('crear', NULL, ?, ?, FROM_UNIXTIME(?), ?)`,
  [JSON.stringify({ titulo }), usuario.id, instante(creado), primer]
)).insertId;

describe('personasDeAuditoria (spec 3: disponible)', () => {
  it('superadmin, admins y editores; disponibles si están activos, con contraseña y sin licencia ese día', async () => {
    const inactivo = await crearUsuario('admin', { activo: 0 });
    const sinContrasena = await crearUsuario('admin', { contrasena: null });
    await crearUsuario('lector');
    await licencia(editor, '2026-10-19', '2026-10-23');
    const personas = await servicio.personasDeAuditoria('2026-10-19');
    const de = (u) => personas.find(p => p.id === u.id);
    assert.equal(personas.length, 5);
    assert.deepEqual([titular, auditor, inactivo, sinContrasena, editor].map(u => de(u).disponible), [true, true, false, false, false]);
    assert.deepEqual([de(editor).de_licencia, de(editor).ausente_por_licencia, de(inactivo).ausente_por_licencia, de(inactivo).activo, de(sinContrasena).tiene_contrasena], [true, true, false, false, false]);
    assert.equal((await servicio.personasDeAuditoria('2026-10-26')).find(p => p.id === editor.id).disponible, true);
  });

  it('cada persona trae exactamente estos datos (guarda de regresión de la forma)', async () => {
    await licencia(editor, '2026-10-19', '2026-10-23');
    const personas = await servicio.personasDeAuditoria('2026-10-19');
    assert.deepEqual(personas.find(p => p.id === editor.id), {
      id: editor.id, username: editor.username, nombre_completo: 'Persona editor', email: `${editor.username}@rpad.test`,
      rol: 'editor', activo: true, tiene_contrasena: true, de_licencia: true, ausente_por_licencia: true, disponible: false
    });
    assert.deepEqual(personas.find(p => p.id === titular.id), {
      id: titular.id, username: titular.username, nombre_completo: 'Persona superadmin', email: `${titular.username}@rpad.test`,
      rol: 'superadmin', activo: true, tiene_contrasena: true, de_licencia: false, ausente_por_licencia: false, disponible: true
    });
  });

  it('una licencia anulada no cuenta', async () => {
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, 1)', [auditor.id, '2026-10-19', '2026-10-23']);
    assert.equal((await servicio.personasDeAuditoria('2026-10-19')).find(p => p.id === auditor.id).disponible, true);
  });

  it('van ordenadas por nombre (de ahí sale el orden de los nombres del 403)', async () => {
    const otro = await crearUsuario('admin');
    await query('UPDATE usuarios SET nombre_completo = ? WHERE id = ?', ['Zulema Díaz', titular.id]);
    await query('UPDATE usuarios SET nombre_completo = ? WHERE id = ?', ['Ana Pérez', auditor.id]);
    await query('UPDATE usuarios SET nombre_completo = ? WHERE id = ?', ['Marta Gómez', editor.id]);
    await query('UPDATE usuarios SET nombre_completo = ? WHERE id = ?', ['Marta Gómez', otro.id]);
    const personas = await servicio.personasDeAuditoria('2026-10-19');
    // Con el mismo nombre, desempata el id
    assert.deepEqual(personas.map(p => p.id), [auditor.id, editor.id, otro.id, titular.id]);
  });
});

describe('contextoDeCanal (spec 9.1)', () => {
  it('con firmante titular: es el único titular; durante su licencia sin autorizado no hay quién firme', async () => {
    let contexto = await servicio.contextoDeCanal('2026-10-19');
    assert.deepEqual(contexto.titulares, [titular.id]);
    assert.equal(contexto.hayQuienFirme, true);
    await licencia(titular, '2026-10-19', '2026-10-23');
    contexto = await servicio.contextoDeCanal('2026-10-19');
    assert.equal(contexto.hayQuienFirme, false);
    assert.equal(contexto.personas.find(p => p.id === titular.id).disponible, false);
  });

  it('durante la licencia con un autorizado vigente sí hay quién firme', async () => {
    await licencia(titular, '2026-10-19', '2026-10-23', auditor);
    assert.equal((await servicio.contextoDeCanal('2026-10-19')).hayQuienFirme, true);
  });

  it('sin firmante titular: los superadmins son los titulares y siempre hay quién firme (la configuración de Correos)', async () => {
    await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL WHERE id = 1');
    await licencia(titular, '2026-10-19', '2026-10-23');
    const contexto = await servicio.contextoDeCanal('2026-10-19');
    assert.deepEqual(contexto.titulares, [titular.id]);
    assert.equal(contexto.hayQuienFirme, true);
  });
});

describe('contextoDeCanal: la nota de auditoría puede salir (spec 9.1, condición 4)', () => {
  it('hay quién firme solo con el envío automático activo, la configuración completa y un Para de auditoría', async () => {
    assert.equal((await servicio.contextoDeCanal('2026-10-19')).hayQuienFirme, true);
    const faltas = [
      ['el envío automático desactivado', { envio_activo: 0 }],
      ['sin Para de auditoría', { para_auditoria: '' }],
      ['sin Para de auditoría, solo espacios y separadores', { para_auditoria: ' , ; ' }],
      ['la configuración incompleta (sin Para de la gestión externa)', { para_externa: '' }]
    ];
    for (const [descripcion, cambios] of faltas) {
      await configurarNotas({ para_auditoria: 'auditoria@rpad.test', ...cambios });
      assert.equal((await servicio.contextoDeCanal('2026-10-19')).hayQuienFirme, false, descripcion);
    }
    // La firma del titular elegido también es parte de la configuración: sin su nombre y cargo no hay quién firme
    await configurarNotas({ para_auditoria: 'auditoria@rpad.test' });
    await query('UPDATE usuarios_firmas SET cargo = ? WHERE usuario_id = ?', ['', titular.id]);
    assert.equal((await servicio.contextoDeCanal('2026-10-19')).hayQuienFirme, false, 'sin cargo en la firma del titular');
  });

  it('sin el envío activo el cambio queda en el canal recordatorio, aunque se cumplan las otras condiciones', async () => {
    await proponer(titular, { primer: '2026-10-16 14:00:00' });
    assert.equal((await servicio.cambiosConCanal('2026-10-20'))[0].canal, 'nota');
    await configurarNotas({ envio_activo: 0, para_auditoria: 'auditoria@rpad.test' });
    assert.equal((await servicio.cambiosConCanal('2026-10-20'))[0].canal, 'recordatorio');
  });
});

describe('cambiosConCanal (spec 9.1 y Decisiones del plan 3)', () => {
  it('la fecha de la propuesta es la de Argentina aunque la base esté en UTC (el 16/10 a las 22:30 ya es 17/10 en UTC)', async () => {
    await proponer(editor, { creado: '2026-10-16 22:30:00' });
    const [cambio] = await servicio.cambiosConCanal('2026-10-19');
    assert.equal(cambio.fecha_propuesta, '2026-10-16');
    assert.deepEqual(cambio.datos_nuevos, { titulo: 'Alta de prueba' });
    assert.deepEqual([cambio.usuario_nombre, cambio.usuario_cargo, cambio.dataset_titulo], ['Persona editor', 'Cargo editor', null]);
  });

  // "Propuesto por" de la nota de auditoría presenta al personal contratado (pedido del usuario el 16/10/2026)
  it('dice si quien propuso es personal contratado (usuarios.vinculo = contrato)', async () => {
    await query("UPDATE usuarios SET vinculo = 'contrato' WHERE id = ?", [editor.id]);
    await query("UPDATE usuarios SET vinculo = 'planta_permanente' WHERE id = ?", [titular.id]);
    await proponer(editor, { titulo: 'Del editor' });
    await proponer(titular, { titulo: 'Del titular', creado: '2026-10-16 11:00:00' });
    await proponer(auditor, { titulo: 'Del auditor', creado: '2026-10-16 12:00:00' });
    const cambios = await servicio.cambiosConCanal('2026-10-19');
    assert.deepEqual(cambios.map(c => [c.datos_nuevos.titulo, c.usuario_cargo, c.usuario_contratado]), [
      ['Del editor', 'Cargo editor', true], ['Del titular', 'Cargo superadmin', false], ['Del auditor', 'Cargo admin', false]
    ]);
  });

  it('la antigüedad se mide con el reloj de la base: 61 minutos son 61 minutos, en UTC o en hora argentina', async () => {
    const id = await proponer(editor);
    await query('UPDATE cambios_pendientes SET created_at = NOW() - INTERVAL 61 MINUTE WHERE id = ?', [id]);
    const [cambio] = await servicio.cambiosConCanal('2026-10-19');
    assert.ok(cambio.antiguedad_segundos >= 61 * 60 && cambio.antiguedad_segundos < 63 * 60, String(cambio.antiguedad_segundos));
  });

  it('el canal: nota con las cuatro condiciones, recordatorio si falta una; los ya auditados no aparecen', async () => {
    await proponer(titular, { primer: '2026-10-16 14:00:00', titulo: 'Del titular' });
    await proponer(editor, { primer: '2026-10-16 14:00:00', titulo: 'Del editor' });
    const canales = async (fecha) => Object.fromEntries((await servicio.cambiosConCanal(fecha)).map(c => [c.datos_nuevos.titulo, c.canal]));
    // Dos recordatorios (viernes y lunes) antes de la nota: el primero fue el viernes, la nota sale desde el martes
    assert.deepEqual(await canales('2026-10-16'), { 'Del titular': 'recordatorio', 'Del editor': 'recordatorio' });
    assert.deepEqual(await canales('2026-10-19'), { 'Del titular': 'recordatorio', 'Del editor': 'recordatorio' });
    assert.deepEqual(await canales('2026-10-20'), { 'Del titular': 'nota', 'Del editor': 'recordatorio' });
    const [fila] = await query("SELECT DATE_FORMAT(primer_recordatorio_at, '%Y-%m-%d') AS f FROM cambios_pendientes LIMIT 1");
    assert.equal(fila.f, '2026-10-16');
    await query("UPDATE cambios_pendientes SET estado = 'aprobado'");
    assert.deepEqual(await servicio.cambiosConCanal('2026-10-19'), []);
  });
});

describe('seleccionarParaAuditoria (spec 9.3 y Decisiones del plan 5)', () => {
  const incluir = (notaId, cambioId, seccion) =>
    query('INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, ?)', [notaId, cambioId, seccion]);

  it('nuevos; nada en los 5 días hábiles siguientes; después, reiterados con la primera nota y las reiteraciones', async () => {
    // Primer recordatorio el jueves 15/10: la nota (la primera) sale el lunes 19/10, a los dos días hábiles
    const id = await proponer(titular, { creado: '2026-10-15 10:00:00', primer: '2026-10-15 14:00:00' });
    await proponer(editor, { creado: '2026-10-15 10:00:00', primer: '2026-10-15 14:00:00', titulo: 'Del editor' });
    let seleccion = await servicio.seleccionarParaAuditoria('2026-10-19');
    assert.deepEqual([seleccion.nuevos.map(c => c.id), seleccion.reiterados], [[id], []]);

    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-19', numero: 3 }), id, 'nuevo');
    seleccion = await servicio.seleccionarParaAuditoria('2026-10-23');
    assert.deepEqual([seleccion.nuevos, seleccion.reiterados], [[], []]);

    seleccion = await servicio.seleccionarParaAuditoria('2026-10-26');
    assert.deepEqual(seleccion.reiterados.map(c => [c.id, c.solicitado]),
      [[id, { numero: 3, anio: 2026, fecha: '2026-10-19', reiteraciones: 0 }]]);

    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-26', numero: 5, estado: 'fallida' }), id, 'reiterado');
    // Una nota de prueba no cuenta, aunque tuviera filas
    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-30', esPrueba: 1 }), id, 'nuevo');
    seleccion = await servicio.seleccionarParaAuditoria('2026-11-02');
    assert.deepEqual(seleccion.reiterados[0].solicitado, { numero: 3, anio: 2026, fecha: '2026-10-19', reiteraciones: 1 });
    assert.deepEqual((await servicio.notasDeAuditoriaDe([id])).get(id).map(n => n.fecha), ['2026-10-19', '2026-10-26']);
  });

  it('notasDeAuditoriaDe cuenta solo las notas de auditoría, aunque otra clase de nota hubiera registrado el cambio', async () => {
    const id = await proponer(titular, { primer: '2026-10-16 14:00:00' });
    await incluir(await crearNota({ tipo: 'auditoria', gestion: null, fecha: '2026-10-19', numero: 3 }), id, 'nuevo');
    await incluir(await crearNota({ tipo: 'aviso', gestion: 'interna', fecha: '2026-10-20', numero: 4 }), id, 'nuevo');
    await incluir(await crearNota({ tipo: 'autorizacion', gestion: null, fecha: '2026-10-21', numero: 5 }), id, 'nuevo');
    assert.deepEqual((await servicio.notasDeAuditoriaDe([id])).get(id), [{ numero: 3, anio: 2026, fecha: '2026-10-19' }]);
  });

  it('catalogosParaAuditoria: los nombres por id', async () => {
    const [tema] = await query('SELECT id, nombre FROM temas ORDER BY id LIMIT 1');
    const areaId = await crearArea({ nombre: 'Área de catálogo' });
    const catalogos = await servicio.catalogosParaAuditoria();
    assert.equal(catalogos.temas[tema.id], tema.nombre);
    assert.equal(catalogos.areas[areaId], 'Área de catálogo');
    assert.ok(Object.values(catalogos.formatos).includes('CSV'));
    assert.ok(Object.values(catalogos.frecuencias).includes('Anualmente'));
  });
});

describe('personasPorDia: la disponibilidad de personasDeAuditoria, para un rango', () => {
  it('solo los días hábiles, cada uno con lo mismo que daría personasDeAuditoria ese día', async () => {
    await licencia(auditor, '2026-12-30', '2027-01-05');
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, 1)', [editor.id, '2026-12-29', '2027-01-06']);
    const porDia = await servicio.personasPorDia('2026-12-29', '2027-01-06');
    assert.deepEqual([...porDia.keys()], ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-04', '2027-01-05', '2027-01-06']);
    for (const [fecha, personas] of porDia) assert.deepEqual(personas, await servicio.personasDeAuditoria(fecha), fecha);
    assert.deepEqual(['2026-12-29', '2026-12-30', '2027-01-06'].map(f => porDia.get(f).find(p => p.id === auditor.id).disponible), [true, false, true]);
  });
});

describe('periodosSinAuditor: días hábiles seguidos sin ningún auditor disponible', () => {
  // El caso de la simulación, con fechas inventadas: el titular de licencia del 09/12 al 08/01 y el otro auditor del 28/12
  // al 13/01
  const licenciasDelCaso = async () => {
    await licencia(titular, '2026-12-09', '2027-01-08');
    return (await licencia(auditor, '2026-12-28', '2027-01-13')).insertId;
  };
  const PERIODO_DEL_CASO = { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: ['Persona editor'] };

  it('del 28/12 al 08/01 (el feriado y el fin de semana no lo cortan), vuelve el 11/01, con la editora de respaldo', async () => {
    await licenciasDelCaso();
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-01', '2027-01-31'), [PERIODO_DEL_CASO]);
    // Un rango que termina en el medio: el período llega hasta el último día hábil del rango y vuelve se busca después
    assert.deepEqual(await servicio.periodosSinAuditor('2026-11-02', '2027-01-03'),
      [{ ...PERIODO_DEL_CASO, hasta: '2026-12-31' }]);
  });

  it('respaldo: la editora cuenta si está disponible al menos un día del período', async () => {
    await licenciasDelCaso();
    await licencia(editor, '2026-12-28', '2027-01-07');
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-01', '2027-01-31'), [PERIODO_DEL_CASO]);
    await query('UPDATE usuarios_licencias SET hasta = ? WHERE usuario_id = ?', ['2027-01-08', editor.id]);
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-01', '2027-01-31'), [{ ...PERIODO_DEL_CASO, respaldo: [] }]);
  });

  it('licenciaSimulada cuenta como una licencia más, sin guardarla', async () => {
    await licencia(titular, '2026-12-09', '2027-01-08');
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-28', '2027-01-13'), []);
    const licenciaSimulada = { usuario_id: auditor.id, desde: '2026-12-28', hasta: '2027-01-13' };
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-28', '2027-01-13', { licenciaSimulada }), [PERIODO_DEL_CASO]);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_licencias'))[0].n, 1);
  });

  it('excluirLicenciaId ignora esa licencia guardada: al editarla no se cuenta dos veces', async () => {
    const id = await licenciasDelCaso();
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-01', '2027-01-31', { excluirLicenciaId: id }), []);
    // La misma licencia, editada para que empiece el 04/01: el período se achica
    const licenciaSimulada = { usuario_id: auditor.id, desde: '2027-01-04', hasta: '2027-01-13' };
    assert.deepEqual(await servicio.periodosSinAuditor('2026-12-01', '2027-01-31', { excluirLicenciaId: id, licenciaSimulada }),
      [{ ...PERIODO_DEL_CASO, desde: '2027-01-04' }]);
  });

  it('sin ningún auditor activo, vuelve es null', async () => {
    await query("UPDATE usuarios SET activo = 0 WHERE rol IN ('superadmin', 'admin')");
    assert.deepEqual(await servicio.periodosSinAuditor('2027-01-04', '2027-01-15'),
      [{ desde: '2027-01-04', hasta: '2027-01-15', vuelve: null, respaldo: ['Persona editor'] }]);
  });
});

describe('proximoDiaConQuienAudite: el primer día hábil en que alguien que no lo propuso puede auditar el cambio', () => {
  it('cuentan los auditores y los editores de respaldo, nunca quien lo propuso', async () => {
    await licencia(titular, '2026-12-09', '2027-01-08');
    await licencia(auditor, '2026-12-28', '2027-01-13');
    // Lo propuso la editora: nadie hasta que vuelve el titular, el lunes 11/01
    assert.equal(await servicio.proximoDiaConQuienAudite(editor.id, '2026-12-29'), '2027-01-11');
    // Lo propuso el auditor: la editora, de respaldo; desde un sábado, el lunes
    assert.equal(await servicio.proximoDiaConQuienAudite(auditor.id, '2026-12-29'), '2026-12-29');
    assert.equal(await servicio.proximoDiaConQuienAudite(auditor.id, '2027-01-02'), '2027-01-04');
  });

  it('si en 366 días no hay nadie, null', async () => {
    await query('UPDATE usuarios SET activo = 0 WHERE id <> ?', [editor.id]);
    assert.equal(await servicio.proximoDiaConQuienAudite(editor.id, '2026-12-29'), null);
  });
});
