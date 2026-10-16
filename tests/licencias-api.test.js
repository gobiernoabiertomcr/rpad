// API de licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5 y 6.3), contra una base de prueba propia.
// La API usa la fecha real: las fechas de los tests se arman desde hoy.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, mailpit, paraCasilla
} from './helpers.js';
import {
  hoyArgentina, sumarDias, proximoDiaHabil, ultimoDiaHabilHasta, esDiaHabil, formatoCorto
} from '../services/notasDigitalesCalendario.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const SOLO_TITULAR = 'La autorización para presentar las notas la da solo el firmante titular.';
const CUBRE_TODA = 'La persona autorizada está de licencia todos los días hábiles de tu licencia: no podría presentar ninguna nota.';
const sinDiasComoAutorizada = (desde, hasta) => `Es la persona autorizada a presentar las notas durante la licencia de Test superadmin (del ${formatoCorto(desde)} al ${formatoCorto(hasta)}) y con esta licencia no le quedaría ningún día hábil para hacerlo: primero hay que cambiar esa autorización.`;
let base, servidor, api, usuarios, dbReal;
const hoy = hoyArgentina();
const dia = (n) => sumarDias(hoy, n);
// Las licencias superpuestas se arman sobre dos semanas sin feriados (el primer lunes desde dentro de 7 días cuyos diez
// días de semana son hábiles), para que los días hábiles no dependan de la fecha real: q(0) es ese lunes, q(4) el viernes,
// q(5) y q(6) el fin de semana, q(7) el lunes siguiente
const LUNES = (() => {
  const esLunes = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 1;
  const habiles = (lunes) => [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].every(n => esDiaHabil(sumarDias(lunes, n)));
  let lunes = dia(7);
  while (!esLunes(lunes) || !habiles(lunes)) lunes = sumarDias(lunes, 1);
  return lunes;
})();
const q = (n) => sumarDias(LUNES, n);

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_licencias_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api);
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await mailpit.vaciar();
  await query('DELETE FROM usuarios_licencias');
  await query('DELETE FROM usuarios_firmas');
  await query('UPDATE notas_digitales_config SET firmante_usuario_id = NULL');
});

const comoA = () => ({ token: usuarios.adminA.token });
const comoSuper = () => ({ token: usuarios.superadmin.token });
const conFirma = (usuario) => query(
  "INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, 'Firma', 'Cargo', ?, 'image/png')", [usuario.id, PNG]
);
const titular = (usuario) => query('UPDATE notas_digitales_config SET firmante_usuario_id = ?', [usuario.id]);
const cargar = (cuerpo, opciones = comoA()) => api.post('/usuarios/licencias', cuerpo, opciones);
const historial = (usuarioId, accion) =>
  query('SELECT actor_id, detalle FROM usuarios_auditoria WHERE usuario_id = ? AND accion = ? ORDER BY id', [usuarioId, accion]);

describe('alta', () => {
  it('carga la licencia de un admin, la lista y deja el historial', async () => {
    const res = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.estado, 'futura');
    assert.equal(res.body.data.usuario_id, usuarios.adminB.id);

    const lista = await api.get('/usuarios/licencias', comoA());
    assert.equal(lista.status, 200);
    assert.deepEqual(lista.body.data.licencias.map(l => [l.usuario_id, l.desde, l.hasta]), [[usuarios.adminB.id, dia(5), dia(10)]]);
    assert.ok(lista.body.data.usuarios.some(u => u.id === usuarios.superadmin.id));
    assert.ok(!lista.body.data.usuarios.some(u => u.id === usuarios.lector.id));

    const [fila] = await historial(usuarios.adminB.id, 'licencia_cargada');
    assert.equal(fila.actor_id, usuarios.adminA.id);
  });

  it('un lector no puede tener licencia', async () => {
    const res = await cargar({ usuario_id: usuarios.lector.id, desde: dia(1), hasta: dia(2) });
    assert.equal(res.status, 400);
    assert.equal(res.body.campo, 'usuario_id');
  });

  it('rechaza fechas inválidas y una licencia superpuesta con otra de la misma persona', async () => {
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(2) })).status, 400);
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(-10), hasta: dia(-1) })).status, 400);
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: dia(1), hasta: dia(5) })).status, 201);
    const repetida = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(8) });
    assert.equal(repetida.status, 409);
    assert.match(repetida.body.error, /Se superpone/);
  });

  it('dos cargas simultáneas superpuestas: se guarda una sola', async () => {
    const [r1, r2] = await Promise.all([
      cargar({ usuario_id: usuarios.adminB.id, desde: dia(20), hasta: dia(25) }),
      cargar({ usuario_id: usuarios.adminB.id, desde: dia(22), hasta: dia(28) }, comoSuper())
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [201, 409]);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_licencias WHERE usuario_id = ?', [usuarios.adminB.id]))[0].n, 1);
  });

  it('cualquier admin puede cargar la licencia del superadmin, y el superadmin recibe el aviso', async () => {
    const res = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(30), hasta: dia(40) });
    assert.equal(res.status, 201);
    const [aviso] = await mailpit.esperar(m => m.Subject === 'RPAD: cambio en los usuarios' && paraCasilla(usuarios.superadmin.email)(m));
    assert.match(await mailpit.html(aviso.ID), /Licencia cargada/);
  });
});

describe('edición y anulación (spec 5.2)', () => {
  it('una futura se edita y se anula', async () => {
    const { body } = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10) });
    const editada = await api.put(`/usuarios/licencias/${body.data.id}`, { desde: dia(6), hasta: dia(12) }, comoA());
    assert.equal(editada.status, 200);
    assert.deepEqual([editada.body.data.desde, editada.body.data.hasta], [dia(6), dia(12)]);
    const anulada = await api.post(`/usuarios/licencias/${body.data.id}/anular`, {}, comoA());
    assert.equal(anulada.status, 200);
    assert.equal(anulada.body.data.estado, 'anulada');
    assert.equal((await historial(usuarios.adminB.id, 'licencia_editada')).length, 1);
    assert.equal((await historial(usuarios.adminB.id, 'licencia_anulada')).length, 1);
  });

  it('una en curso solo cambia el fin, y no se anula', async () => {
    const { insertId: id } = await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminB.id, dia(-3), dia(5)]);
    assert.equal((await api.put(`/usuarios/licencias/${id}`, { desde: dia(-2), hasta: dia(5) }, comoA())).status, 400);
    const cortada = await api.put(`/usuarios/licencias/${id}`, { desde: dia(-3), hasta: dia(-1) }, comoA());
    assert.equal(cortada.status, 200);
    assert.equal(cortada.body.data.estado, 'pasada');
    const { insertId: otra } = await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminB.id, dia(-1), dia(5)]);
    assert.equal((await api.post(`/usuarios/licencias/${otra}/anular`, {}, comoA())).status, 409);
  });
});

describe('autorización del firmante titular (spec 6.3)', () => {
  it('solo la licencia del titular lleva autorizado, y solo la carga el titular', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    const ajena = await cargar({ usuario_id: usuarios.adminB.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal(ajena.status, 403);
    const porOtro = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id });
    assert.equal(porOtro.status, 403);
    assert.equal(porOtro.body.error, SOLO_TITULAR);

    const propia = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal(propia.status, 201, JSON.stringify(propia.body));
    assert.equal(propia.body.data.autorizado_id, usuarios.adminA.id);
    assert.match(propia.body.data.autorizado_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    const lista = await api.get('/usuarios/licencias', comoSuper());
    assert.equal(lista.body.data.soy_titular, true);
    assert.deepEqual(lista.body.data.autorizables.map(a => a.id), [usuarios.adminA.id]);
    assert.ok(lista.body.data.licencias[0].vispera);
  });

  it('no se puede autorizar a alguien sin firma', async () => {
    await titular(usuarios.superadmin);
    const sinFirma = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminB.id }, comoSuper());
    assert.equal(sinFirma.status, 400);
    assert.equal(sinFirma.body.campo, 'autorizado_id');
  });

  it('se puede autorizar a alguien con una licencia que se superpone en parte con la del titular', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminB);
    // adminB, de licencia del viernes anterior al martes: le quedan libres del miércoles al viernes
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: q(-3), hasta: q(1) })).status, 201);
    const res = await cargar({ usuario_id: usuarios.superadmin.id, desde: q(0), hasta: q(4), autorizado_id: usuarios.adminB.id }, comoSuper());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.autorizado_id, usuarios.adminB.id);
  });

  it('no se puede autorizar a alguien de licencia todos los días hábiles de la del titular (409), aunque le quede libre un fin de semana', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminB);
    const autorizar = (desde, hasta) =>
      cargar({ usuario_id: usuarios.superadmin.id, desde, hasta, autorizado_id: usuarios.adminB.id }, comoSuper());
    // La cubre entera: de licencia del domingo anterior al viernes
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: q(-1), hasta: q(4) })).status, 201);
    const entera = await autorizar(q(0), q(4));
    assert.equal(entera.status, 409);
    assert.deepEqual([entera.body.error, entera.body.campo], [CUBRE_TODA, 'autorizado_id']);
    // Del jueves al martes siguiente, de licencia jueves y viernes y lunes y martes: libres solo el sábado y el domingo
    assert.equal((await cargar({ usuario_id: usuarios.adminB.id, desde: q(7), hasta: q(8) })).status, 201);
    const finDeSemana = await autorizar(q(3), q(8));
    assert.equal(finDeSemana.status, 409);
    assert.deepEqual([finDeSemana.body.error, finDeSemana.body.campo], [CUBRE_TODA, 'autorizado_id']);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_licencias WHERE usuario_id = ?', [usuarios.superadmin.id]))[0].n, 0);
    // Con un día hábil libre (el miércoles), sí
    assert.equal((await autorizar(q(3), q(9))).status, 201);
    // Una licencia de solo un fin de semana no tiene días hábiles que cubrir: no la rechaza
    assert.equal((await autorizar(q(12), q(13))).status, 201);
  });

  it('al cambiar las fechas de la licencia del titular, la misma regla con las fechas nuevas', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    const { body } = await cargar({ usuario_id: usuarios.superadmin.id, desde: q(0), hasta: q(1), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal((await cargar({ usuario_id: usuarios.adminA.id, desde: q(2), hasta: q(4) })).status, 201);
    const tapada = await api.put(`/usuarios/licencias/${body.data.id}`, { desde: q(2), hasta: q(4) }, comoSuper());
    assert.equal(tapada.status, 409);
    assert.deepEqual([tapada.body.error, tapada.body.campo], [CUBRE_TODA, 'autorizado_id']);
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { desde: q(1), hasta: q(4) }, comoSuper())).status, 200);
  });

  it('cortar a ayer una licencia en curso del titular con autorizada no es "de licencia todos los días hábiles"', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    const { insertId: id } = await query(
      'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
      [usuarios.superadmin.id, dia(-3), dia(5), usuarios.adminA.id, `${dia(-4)} 10:00:00`]
    );
    const cortada = await api.put(`/usuarios/licencias/${id}`, { hasta: dia(-1) }, comoSuper());
    assert.equal(cortada.status, 200, JSON.stringify(cortada.body));
    assert.equal(cortada.body.data.estado, 'pasada');
  });

  it('con la persona autorizada de licencia hasta el final de una licencia en curso del titular, las dos se pueden acortar (cuentan todos sus días)', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    // Titular de licencia del día -10 al 10; adminA, del -2 al 12: le quedaron libres los días hábiles del -10 al -3
    const { insertId: delTitular } = await query(
      'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, autorizado_id, autorizado_at) VALUES (?, ?, ?, ?, ?)',
      [usuarios.superadmin.id, dia(-10), dia(10), usuarios.adminA.id, `${dia(-11)} 10:00:00`]
    );
    const { insertId: suya } = await query(
      'INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminA.id, dia(-2), dia(12)]
    );
    const suyaAcortada = await api.put(`/usuarios/licencias/${suya}`, { hasta: dia(11) }, comoA());
    assert.equal(suyaAcortada.status, 200, JSON.stringify(suyaAcortada.body));
    const delTitularAcortada = await api.put(`/usuarios/licencias/${delTitular}`, { hasta: dia(6) }, comoSuper());
    assert.equal(delTitularAcortada.status, 200, JSON.stringify(delTitularAcortada.body));
    assert.equal(delTitularAcortada.body.data.autorizado_id, usuarios.adminA.id);
    assert.equal((await api.put(`/usuarios/licencias/${delTitular}`, {}, comoSuper())).status, 200, 'un pedido sin cambios');
  });

  it('la persona autorizada puede tomarse una licencia superpuesta en parte, pero no una que la deje sin días hábiles (409)', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    await cargar({ usuario_id: usuarios.superadmin.id, desde: q(0), hasta: q(4), autorizado_id: usuarios.adminA.id }, comoSuper());
    const sinDias = sinDiasComoAutorizada(q(0), q(4));
    const entera = await cargar({ usuario_id: usuarios.adminA.id, desde: q(-1), hasta: q(4) });
    assert.equal(entera.status, 409);
    assert.deepEqual([entera.body.error, entera.body.campo], [sinDias, 'fechas']);

    const parcial = await cargar({ usuario_id: usuarios.adminA.id, desde: q(3), hasta: q(8) });
    assert.equal(parcial.status, 201, JSON.stringify(parcial.body));
    // Sumada a la que ya tiene (del jueves al martes siguiente), una del viernes anterior al miércoles no le deja ninguno
    const sumada = await cargar({ usuario_id: usuarios.adminA.id, desde: q(-3), hasta: q(2) });
    assert.equal(sumada.status, 409);
    assert.deepEqual([sumada.body.error, sumada.body.campo], [sinDias, 'fechas']);
  });

  it('al editar su licencia, la persona autorizada no cuenta la versión guardada', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    await cargar({ usuario_id: usuarios.superadmin.id, desde: q(0), hasta: q(4), autorizado_id: usuarios.adminA.id }, comoSuper());
    const { body } = await cargar({ usuario_id: usuarios.adminA.id, desde: q(0), hasta: q(3) });
    assert.equal(body.data?.desde, q(0), JSON.stringify(body));
    // Pasarla del martes al viernes le deja libre el lunes (la guardada, del lunes al jueves, ya no cuenta)
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { desde: q(1), hasta: q(4) }, comoA())).status, 200);
    const entera = await api.put(`/usuarios/licencias/${body.data.id}`, { desde: q(0), hasta: q(4) }, comoA());
    assert.equal(entera.status, 409);
    assert.deepEqual([entera.body.error, entera.body.campo], [sinDiasComoAutorizada(q(0), q(4)), 'fechas']);
  });

  it('autorizables trae las licencias en curso y futuras de cada persona (no las pasadas ni las anuladas)', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    await conFirma(usuarios.adminB);
    const guardar = (desde, hasta, anulada = 0) => query(
      'INSERT INTO usuarios_licencias (usuario_id, desde, hasta, anulada) VALUES (?, ?, ?, ?)', [usuarios.adminA.id, desde, hasta, anulada]
    );
    await guardar(dia(-10), dia(-6));
    await guardar(dia(-5), dia(0));
    await guardar(dia(20), dia(25));
    await guardar(dia(30), dia(31), 1);
    const lista = await api.get('/usuarios/licencias', comoSuper());
    assert.deepEqual(lista.body.data.autorizables, [
      { id: usuarios.adminA.id, nombre_completo: 'Test adminA', licencias: [{ desde: dia(-5), hasta: dia(0) }, { desde: dia(20), hasta: dia(25) }] },
      { id: usuarios.adminB.id, nombre_completo: 'Test adminB', licencias: [] }
    ]);
  });

  it('cambiar las fechas o la persona autorizada deja sin efecto la nota de autorización', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    await conFirma(usuarios.adminB);
    const { body } = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    const nota = async () => (await query('SELECT nota_autorizacion_id AS n FROM usuarios_licencias WHERE id = ?', [body.data.id]))[0].n;
    await query('UPDATE usuarios_licencias SET nota_autorizacion_id = 999 WHERE id = ?', [body.data.id]);
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { hasta: dia(12) }, comoSuper())).status, 200);
    assert.equal(await nota(), null);
    await query('UPDATE usuarios_licencias SET nota_autorizacion_id = 999 WHERE id = ?', [body.data.id]);
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { autorizado_id: usuarios.adminB.id }, comoSuper())).status, 200);
    assert.equal(await nota(), null);
  });

  it('otro admin puede cambiar las fechas de la licencia del titular, pero no la autorización', async () => {
    await titular(usuarios.superadmin);
    await conFirma(usuarios.adminA);
    const { body } = await cargar({ usuario_id: usuarios.superadmin.id, desde: dia(5), hasta: dia(10), autorizado_id: usuarios.adminA.id }, comoSuper());
    assert.equal((await api.put(`/usuarios/licencias/${body.data.id}`, { hasta: dia(11) }, comoA())).status, 200);
    const quitar = await api.put(`/usuarios/licencias/${body.data.id}`, { autorizado_id: null }, comoA());
    assert.equal(quitar.status, 403);
    assert.equal(quitar.body.error, SOLO_TITULAR);
  });
});

describe('marca en la lista de usuarios (spec 5.5)', () => {
  it('en curso y próxima (dentro de 30 días); más lejos no', async () => {
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminB.id, dia(-1), dia(3)]);
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.adminA.id, dia(10), dia(12)]);
    await query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuarios.superadmin.id, dia(45), dia(50)]);
    const { body } = await api.get('/usuarios', comoA());
    const de = (u) => body.data.usuarios.find(x => x.id === u.id).licencia;
    assert.deepEqual(de(usuarios.adminB), { desde: dia(-1), hasta: dia(3), en_curso: true });
    assert.deepEqual(de(usuarios.adminA), { desde: dia(10), hasta: dia(12), en_curso: false });
    assert.equal(de(usuarios.superadmin), null);
    assert.deepEqual((await api.get(`/usuarios/${usuarios.adminB.id}`, comoA())).body.data.licencia, { desde: dia(-1), hasta: dia(3), en_curso: true });
  });
});

describe('días sin auditor (GET /usuarios/licencias/sin-auditor)', () => {
  const ruta = (consulta = '') => `/usuarios/licencias/sin-auditor${consulta}`;
  const guardar = (usuario, desde, hasta) =>
    query('INSERT INTO usuarios_licencias (usuario_id, desde, hasta) VALUES (?, ?, ?)', [usuario.id, desde, hasta]);
  // Sin auditor de un día a otro: del primer día hábil al último, y vuelve el primer día hábil después de fin
  const periodo = (inicio, fin, vuelveDesde = sumarDias(fin, 1)) =>
    ({ desde: proximoDiaHabil(inicio), hasta: ultimoDiaHabilHasta(fin), vuelve: proximoDiaHabil(vuelveDesde), respaldo: [] });

  it('los períodos del rango; sin fechas, de hoy a hoy + 60 días', async () => {
    // Los tres auditores (superadmin, adminA y adminB) de licencia del día 10 al 20
    for (const u of [usuarios.superadmin, usuarios.adminA, usuarios.adminB]) await guardar(u, dia(10), dia(20));
    const res = await api.get(ruta(`?desde=${dia(1)}&hasta=${dia(30)}`), comoA());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, data: { periodos: [periodo(dia(10), dia(20))] } });
    assert.deepEqual((await api.get(ruta(), comoA())).body.data.periodos, [periodo(dia(10), dia(20))]);
    assert.deepEqual((await api.get(ruta(`?desde=${dia(21)}&hasta=${dia(30)}`), comoA())).body.data.periodos, []);
  });

  it('simula la licencia que se carga (usuario_id) y, al editar, no cuenta la guardada (excluir)', async () => {
    for (const u of [usuarios.adminA, usuarios.adminB]) await guardar(u, dia(10), dia(20));
    const consulta = `?desde=${dia(10)}&hasta=${dia(20)}`;
    assert.deepEqual((await api.get(ruta(consulta), comoA())).body.data.periodos, []);
    const simulada = await api.get(ruta(`${consulta}&usuario_id=${usuarios.superadmin.id}`), comoA());
    assert.deepEqual(simulada.body.data.periodos, [periodo(dia(10), dia(20))]);
    assert.equal((await query('SELECT COUNT(*) AS n FROM usuarios_licencias'))[0].n, 2);

    // La licencia del superadmin, guardada del 10 al 20, se acorta al 15: sin excluirla, vuelve recién después del 20
    const { insertId } = await guardar(usuarios.superadmin, dia(10), dia(20));
    const acortada = `?desde=${dia(10)}&hasta=${dia(15)}&usuario_id=${usuarios.superadmin.id}`;
    assert.deepEqual((await api.get(ruta(acortada), comoA())).body.data.periodos, [periodo(dia(10), dia(15), dia(21))]);
    assert.deepEqual((await api.get(ruta(`${acortada}&excluir=${insertId}`), comoA())).body.data.periodos, [periodo(dia(10), dia(15))]);
  });

  it('400 con campo si las fechas no sirven, el rango supera los 366 días o un id no es válido', async () => {
    const casos = [
      ['?desde=2027-02-30&hasta=2027-03-10', 'fechas'],
      [`?desde=${dia(1)}`, 'fechas'],
      [`?desde=${dia(5)}&hasta=${dia(1)}`, 'fechas'],
      [`?desde=${dia(0)}&hasta=${dia(366)}`, 'fechas'],
      [`?desde=${dia(0)}&hasta=${dia(1)}&usuario_id=abc`, 'usuario_id'],
      [`?desde=${dia(0)}&hasta=${dia(1)}&excluir=0`, 'excluir'],
      // Simular o excluir una licencia necesita sus dos fechas: sin ellas no se toma hoy a hoy + 60
      [`?usuario_id=${usuarios.superadmin.id}`, 'fechas'],
      ['?excluir=1', 'fechas'],
      [`?usuario_id=${usuarios.superadmin.id}&excluir=1`, 'fechas']
    ];
    for (const [consulta, campo] of casos) {
      const res = await api.get(ruta(consulta), comoA());
      assert.equal(res.status, 400, consulta);
      assert.deepEqual([res.body.success, res.body.campo], [false, campo], consulta);
      assert.ok(res.body.error, consulta);
    }
    // 366 días justos, sí
    assert.equal((await api.get(ruta(`?desde=${dia(0)}&hasta=${dia(365)}`), comoA())).status, 200);
  });
});
