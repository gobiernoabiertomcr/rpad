// Reglas de la auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2, 9.1, 9.3 y 9.4):
// funciones puras, con los ejemplos de la spec 9.4
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  quienesAuditan, permisoParaAuditar, mensajeNoCorresponde, canalDelCambio, entraEnRecordatorio, seccionDeAuditoria,
  ANTIGUEDAD_MINIMA_RECORDATORIO, disponibilidad, agruparDiasSinAuditor
} from '../services/auditoriaReglas.js';

// El firmante titular (1), otro auditor (2) y dos editores (3 y 4), todos disponibles salvo que se diga otra cosa
const persona = (id, rol, nombre) => ({ id, rol, nombre_completo: nombre, disponible: true });
const EQUIPO = [
  persona(1, 'superadmin', 'Persona Titular'), persona(2, 'admin', 'Persona Auditora'),
  persona(3, 'editor', 'Persona Editora'), persona(4, 'editor', 'Otra Editora')
];
// cambios: { id: { disponible: false } }
const equipo = (cambios = {}) => EQUIPO.map(p => ({ ...p, ...(cambios[p.id] ?? {}) }));
const ids = (lista) => lista.map(p => p.id);

describe('quién audita un cambio (spec 8.2)', () => {
  it('los auditores disponibles que no lo propusieron', () => {
    assert.deepEqual(ids(quienesAuditan(equipo(), 1).personas), [2]);
    assert.equal(quienesAuditan(equipo(), 1).respaldo, false);
    assert.deepEqual(ids(quienesAuditan(equipo(), 3).personas), [1, 2]);
  });

  it('sin auditores disponibles, los editores disponibles que no lo propusieron, de respaldo', () => {
    // Propone el titular y el otro auditor no está disponible
    assert.deepEqual(quienesAuditan(equipo({ 2: { disponible: false } }), 1), { personas: [EQUIPO[2], EQUIPO[3]], respaldo: true });
    // Propone un editor y ninguno de los dos auditores está disponible
    const sinAuditores = equipo({ 1: { disponible: false }, 2: { disponible: false } });
    assert.deepEqual(quienesAuditan(sinAuditores, 3), { personas: [EQUIPO[3]], respaldo: true });
  });

  it('sin nadie disponible: respaldo, sin personas', () => {
    const nadie = equipo({ 1: { disponible: false }, 2: { disponible: false }, 3: { disponible: false }, 4: { disponible: false } });
    assert.deepEqual(quienesAuditan(nadie, 1), { personas: [], respaldo: true });
  });
});

describe('permiso para aprobar o rechazar (spec 8.2, Decisiones del plan 1 y 2)', () => {
  const MENSAJE = 'Este cambio lo auditan Persona Auditora. Podés auditarlo solo si ninguno está disponible.';

  it('un auditor siempre puede, también si ese día está de licencia', () => {
    assert.deepEqual(permisoParaAuditar({ id: 2, rol: 'admin' }, 1, equipo()), { puede: true, respaldo: false });
    assert.deepEqual(permisoParaAuditar({ id: 2, rol: 'admin' }, 1, equipo({ 2: { disponible: false } })), { puede: true, respaldo: false });
    assert.deepEqual(permisoParaAuditar({ id: 1, rol: 'superadmin' }, 3, equipo()), { puede: true, respaldo: false });
  });

  it('un editor, solo de respaldo: con un auditor disponible recibe el mensaje con su nombre', () => {
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo()), { puede: false, mensaje: MENSAJE });
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo({ 2: { disponible: false } })), { puede: true, respaldo: true });
    // El editor de respaldo puede aunque él mismo esté de licencia
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo({ 2: { disponible: false }, 3: { disponible: false } })),
      { puede: true, respaldo: true });
  });

  it('el mensaje nombra a todos los auditores disponibles', () => {
    assert.equal(mensajeNoCorresponde([EQUIPO[0], EQUIPO[1]]),
      'Este cambio lo auditan Persona Titular y Persona Auditora. Podés auditarlo solo si ninguno está disponible.');
    assert.equal(mensajeNoCorresponde([EQUIPO[0], EQUIPO[1], persona(5, 'admin', 'Tercera Persona')]),
      'Este cambio lo auditan Persona Titular, Persona Auditora y Tercera Persona. Podés auditarlo solo si ninguno está disponible.');
  });

  it('un lector nunca', () => {
    assert.equal(permisoParaAuditar({ id: 9, rol: 'lector' }, 1, equipo()).puede, false);
  });
});

describe('canal de cada cambio (spec 9.1, ejemplos 9.4)', () => {
  const contexto = (cambios = {}, { titulares = [1], hayQuienFirme = true } = {}) => ({ personas: equipo(cambios), titulares, hayQuienFirme });
  const canal = (proponente, primer, hoy, ctx = contexto()) =>
    canalDelCambio({ cambio: { usuario_id: proponente, primer_recordatorio_fecha: primer }, hoy, ...ctx });

  it('propone el titular el viernes y hay otro auditor: el viernes, recordatorio; desde el lunes, nota', () => {
    assert.equal(canal(1, null, '2026-10-16'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-16'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-19'), 'nota');
  });

  it('propone un editor y el titular está disponible: siempre recordatorio', () => {
    assert.equal(canal(3, '2026-10-16', '2026-10-19'), 'recordatorio');
    assert.equal(canal(3, '2026-10-16', '2026-11-30'), 'recordatorio');
  });

  it('el titular de licencia con autorizado, propone un editor: nota desde el día hábil siguiente al primer recordatorio', () => {
    const deLicencia = contexto({ 1: { disponible: false } });
    assert.equal(canal(3, null, '2026-10-19', deLicencia), 'recordatorio');
    assert.equal(canal(3, '2026-10-19', '2026-10-20', deLicencia), 'nota');
  });

  it('propone el titular y el único otro auditor está de licencia: respaldo, recordatorio', () => {
    assert.equal(canal(1, '2026-10-16', '2026-10-19', contexto({ 2: { disponible: false } })), 'recordatorio');
  });

  it('el titular de licencia sin autorizado: recordatorio; a la vuelta, lo que cumple las condiciones va a nota', () => {
    assert.equal(canal(1, '2026-10-16', '2026-10-19', contexto({ 1: { disponible: false } }, { hayQuienFirme: false })), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-26'), 'nota');
  });

  it('sin firmante titular, la condición 2 mira a los superadmins; sin ninguno, se cumple siempre', () => {
    assert.equal(canal(3, '2026-10-16', '2026-10-19', contexto({}, { titulares: [1] })), 'recordatorio');
    assert.equal(canal(3, '2026-10-16', '2026-10-19', contexto({}, { titulares: [] })), 'nota');
  });
});

describe('recordatorio y sección de la nota (spec 9.2 y 9.3)', () => {
  it('el recordatorio lleva lo del canal recordatorio propuesto hace una hora o más', () => {
    assert.equal(ANTIGUEDAD_MINIMA_RECORDATORIO, 3600);
    assert.equal(entraEnRecordatorio({ canal: 'recordatorio', antiguedad_segundos: 3600 }), true);
    assert.equal(entraEnRecordatorio({ canal: 'recordatorio', antiguedad_segundos: 3599 }), false);
    assert.equal(entraEnRecordatorio({ canal: 'nota', antiguedad_segundos: 999999 }), false);
  });

  it('nuevo si nunca estuvo en una nota; reiterado a los 5 días hábiles de la última; si no, nada', () => {
    assert.equal(seccionDeAuditoria(null, '2026-10-19'), 'nuevo');
    assert.equal(seccionDeAuditoria('2026-10-19', '2026-10-23'), null);
    assert.equal(seccionDeAuditoria('2026-10-19', '2026-10-26'), 'reiterado');
    // el martes 08/12 es feriado: del lunes 07/12, el 14/12 son 4 días hábiles y el 15/12, 5
    assert.equal(seccionDeAuditoria('2026-12-07', '2026-12-14'), null);
    assert.equal(seccionDeAuditoria('2026-12-07', '2026-12-15'), 'reiterado');
  });
});

describe('disponible un día (spec 3): la única definición', () => {
  const LICENCIAS = [{ desde: '2026-12-09', hasta: '2027-01-08' }];
  const habilitada = { activo: true, tiene_contrasena: true };

  it('activa, con contraseña y sin licencia ese día; los dos extremos de la licencia son de licencia', () => {
    assert.deepEqual(disponibilidad(habilitada, LICENCIAS, '2026-12-08'), { de_licencia: false, ausente_por_licencia: false, disponible: true });
    for (const fecha of ['2026-12-09', '2026-12-25', '2027-01-08']) {
      assert.deepEqual(disponibilidad(habilitada, LICENCIAS, fecha), { de_licencia: true, ausente_por_licencia: true, disponible: false }, fecha);
    }
    assert.equal(disponibilidad(habilitada, LICENCIAS, '2027-01-09').disponible, true);
    assert.equal(disponibilidad(habilitada, [], '2026-12-25').disponible, true);
  });

  it('inactiva o sin contraseña: no está disponible ni ausente por licencia, tenga licencia o no', () => {
    for (const usuario of [{ activo: false, tiene_contrasena: true }, { activo: true, tiene_contrasena: false }]) {
      assert.deepEqual(disponibilidad(usuario, LICENCIAS, '2026-12-10'), { de_licencia: true, ausente_por_licencia: false, disponible: false });
      assert.deepEqual(disponibilidad(usuario, [], '2026-12-10'), { de_licencia: false, ausente_por_licencia: false, disponible: false });
    }
  });
});

describe('períodos sin auditor: días hábiles seguidos sin ningún auditor disponible', () => {
  // Un día con el auditor (2) disponible o no y con las editoras disponibles que se indiquen; el titular (1), nunca
  const dia = (fecha, { auditor = false, editoras = [] } = {}) => ({
    fecha,
    personas: [
      { id: 1, rol: 'superadmin', nombre_completo: 'Persona Titular', disponible: false },
      { id: 2, rol: 'admin', nombre_completo: 'Persona Auditora', disponible: auditor },
      { id: 3, rol: 'editor', nombre_completo: 'Zulema Editora', disponible: editoras.includes(3) },
      { id: 4, rol: 'editor', nombre_completo: 'Ana Editora', disponible: editoras.includes(4) }
    ]
  });

  it('un feriado y un fin de semana en el medio no cortan el período; un día hábil con auditor lo corta', () => {
    const dias = [
      dia('2026-12-29', { auditor: true }),
      dia('2026-12-30', { editoras: [3] }),
      dia('2026-12-31'),
      // feriado, sábado y domingo: no cuentan, aunque tengan auditor
      dia('2027-01-01', { auditor: true }), dia('2027-01-02', { auditor: true }), dia('2027-01-03', { auditor: true }),
      dia('2027-01-04', { editoras: [4, 3] }),
      dia('2027-01-05', { auditor: true }),
      dia('2027-01-06')
    ];
    // Los editores disponibles no evitan el día sin auditor: son el respaldo, del nombre a la Z y sin repetir
    assert.deepEqual(agruparDiasSinAuditor(dias, '2027-01-06'), [
      { desde: '2026-12-30', hasta: '2027-01-04', vuelve: '2027-01-05', respaldo: ['Ana Editora', 'Zulema Editora'] },
      { desde: '2027-01-06', hasta: '2027-01-06', vuelve: null, respaldo: [] }
    ]);
  });

  it('el período termina en hasta; los días que siguen solo sirven para encontrar vuelve', () => {
    const dias = [dia('2027-01-04'), dia('2027-01-05'), dia('2027-01-06', { editoras: [3] }), dia('2027-01-07', { auditor: true }), dia('2027-01-08')];
    assert.deepEqual(agruparDiasSinAuditor(dias, '2027-01-05'),
      [{ desde: '2027-01-04', hasta: '2027-01-05', vuelve: '2027-01-07', respaldo: [] }]);
    // Un período que empieza después de hasta no aparece
    assert.deepEqual(agruparDiasSinAuditor([dia('2027-01-04', { auditor: true }), dia('2027-01-05')], '2027-01-04'), []);
    // Sin ningún día con auditor después, vuelve es null
    assert.deepEqual(agruparDiasSinAuditor([dia('2027-01-04'), dia('2027-01-05')], '2027-01-04'),
      [{ desde: '2027-01-04', hasta: '2027-01-04', vuelve: null, respaldo: [] }]);
  });

  it('con un auditor disponible todos los días hábiles no hay períodos', () => {
    assert.deepEqual(agruparDiasSinAuditor([dia('2027-01-04', { auditor: true }), dia('2027-01-09'), dia('2027-01-11', { auditor: true })], '2027-01-11'), []);
  });
});
