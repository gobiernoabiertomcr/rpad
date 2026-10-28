// Reglas de la auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2, 9.1, 9.3 y 9.4):
// funciones puras, con los ejemplos de la spec 9.4
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  quienesAuditan, permisoParaAuditar, mensajeNoCorresponde, avisoSinResponsabilidad, MENSAJE_SITUACION_CAMBIADA, canalDelCambio, entraEnRecordatorio, seccionDeAuditoria,
  ANTIGUEDAD_MINIMA_RECORDATORIO, RECORDATORIOS_ANTES_DE_LA_NOTA, disponibilidad, agruparDiasSinAuditor
} from '../services/auditoriaReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

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

// Spec 8.2 y spec 2026-10-20-editor-sin-responsabilidad: siempre las cuatro claves
describe('permiso para aprobar o rechazar (spec 8.2, Decisiones del plan 1 y 2; sin responsabilidad)', () => {
  const AUDITOR = { puede: true, respaldo: false, sin_responsabilidad: false, mensaje: null };
  const RESPALDO = { puede: true, respaldo: true, sin_responsabilidad: false, mensaje: null };
  const AVISO = 'Este cambio lo auditan Persona Auditora. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.';

  it('un auditor siempre puede, también si ese día está de licencia', () => {
    assert.deepEqual(permisoParaAuditar({ id: 2, rol: 'admin' }, 1, equipo()), AUDITOR);
    assert.deepEqual(permisoParaAuditar({ id: 2, rol: 'admin' }, 1, equipo({ 2: { disponible: false } })), AUDITOR);
    assert.deepEqual(permisoParaAuditar({ id: 1, rol: 'superadmin' }, 3, equipo()), AUDITOR);
  });

  it('un editor, con un auditor disponible, audita sin responsabilidad el cambio de un auditor, con el aviso que lo nombra', () => {
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo()),
      { puede: true, respaldo: false, sin_responsabilidad: true, mensaje: AVISO });
  });

  it('un editor sin auditores disponibles audita de respaldo, como siempre, también si él mismo está de licencia', () => {
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo({ 2: { disponible: false } })), RESPALDO);
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 1, equipo({ 2: { disponible: false }, 3: { disponible: false } })), RESPALDO);
  });

  it('el cambio de otro editor, con auditores disponibles, sigue siendo de los auditores', () => {
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 4, equipo()), {
      puede: false, respaldo: false, sin_responsabilidad: false,
      mensaje: 'Este cambio lo auditan Persona Titular y Persona Auditora. Podés auditarlo solo si ninguno está disponible.'
    });
  });

  it('si quien lo propuso ya no es superadmin, admin ni editor, no hay "sin responsabilidad" (falla cerrado)', () => {
    assert.deepEqual(permisoParaAuditar({ id: 3, rol: 'editor' }, 99, equipo()), {
      puede: false, respaldo: false, sin_responsabilidad: false, mensaje: mensajeNoCorresponde([EQUIPO[0], EQUIPO[1]])
    });
  });

  it('respaldo y sin responsabilidad nunca van juntos', () => {
    const dias = [{}, { 2: { disponible: false } }, { 1: { disponible: false }, 2: { disponible: false } },
      { 1: { disponible: false }, 2: { disponible: false }, 3: { disponible: false }, 4: { disponible: false } }];
    for (const revisor of [...EQUIPO, persona(9, 'lector', 'Persona Lectora')]) {
      for (const proponente of [1, 2, 3, 4, 99]) {
        for (const dia of dias) {
          const permiso = permisoParaAuditar(revisor, proponente, equipo(dia));
          assert.ok(!(permiso.respaldo && permiso.sin_responsabilidad), JSON.stringify({ revisor: revisor.id, proponente, dia, permiso }));
          assert.deepEqual(Object.keys(permiso).sort(), ['mensaje', 'puede', 'respaldo', 'sin_responsabilidad']);
        }
      }
    }
  });

  it('el aviso nombra a todos los auditores disponibles', () => {
    assert.equal(avisoSinResponsabilidad([EQUIPO[0], EQUIPO[1]]),
      'Este cambio lo auditan Persona Titular y Persona Auditora. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.');
  });

  it('el texto del 409 (la situación cambió entre que se vio y se confirmó)', () => {
    assert.equal(MENSAJE_SITUACION_CAMBIADA, 'La situación de este cambio cambió. Revisá el aviso y volvé a confirmar.');
  });

  it('el mensaje nombra a todos los auditores disponibles', () => {
    assert.equal(mensajeNoCorresponde([EQUIPO[0], EQUIPO[1]]),
      'Este cambio lo auditan Persona Titular y Persona Auditora. Podés auditarlo solo si ninguno está disponible.');
    assert.equal(mensajeNoCorresponde([EQUIPO[0], EQUIPO[1], persona(5, 'admin', 'Tercera Persona')]),
      'Este cambio lo auditan Persona Titular, Persona Auditora y Tercera Persona. Podés auditarlo solo si ninguno está disponible.');
  });

  it('un lector nunca', () => {
    assert.deepEqual(permisoParaAuditar({ id: 9, rol: 'lector' }, 1, equipo()), {
      puede: false, respaldo: false, sin_responsabilidad: false, mensaje: 'Solo pueden auditar cambios los auditores y los editores.'
    });
  });
});

describe('canal de cada cambio (spec 9.1, ejemplos 9.4)', () => {
  const contexto = (cambios = {}, { titulares = [1], hayQuienFirme = true } = {}) => ({ personas: equipo(cambios), titulares, hayQuienFirme });
  const canal = (proponente, primer, hoy, ctx = contexto()) =>
    canalDelCambio({ cambio: { usuario_id: proponente, primer_recordatorio_fecha: primer }, hoy, ...ctx });

  // Dos recordatorios por email (el día del primero y el día hábil siguiente) y la nota recién al segundo día hábil después
  // del primero (pedido del usuario el 16/10/2026: antes la nota salía al día hábil siguiente)
  it('propone el titular el viernes y hay otro auditor: viernes y lunes, recordatorio; desde el martes, nota', () => {
    assert.equal(RECORDATORIOS_ANTES_DE_LA_NOTA, 2);
    assert.equal(canal(1, null, '2026-10-16'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-16'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-19'), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-20'), 'nota');
    assert.equal(canal(1, '2026-10-16', '2026-10-21'), 'nota');
  });

  it('los días no hábiles no cuentan: con el feriado del martes 08/12, el primer recordatorio del lunes 07/12 llega a nota el jueves 10/12', () => {
    assert.equal(canal(1, '2026-12-07', '2026-12-09'), 'recordatorio');
    assert.equal(canal(1, '2026-12-07', '2026-12-10'), 'nota');
  });

  it('propone un editor y el titular está disponible: siempre recordatorio', () => {
    assert.equal(canal(3, '2026-10-16', '2026-10-19'), 'recordatorio');
    assert.equal(canal(3, '2026-10-16', '2026-11-30'), 'recordatorio');
  });

  it('el titular de licencia con autorizado, propone un editor: nota desde el segundo día hábil después del primer recordatorio', () => {
    const deLicencia = contexto({ 1: { disponible: false } });
    assert.equal(canal(3, null, '2026-10-19', deLicencia), 'recordatorio');
    assert.equal(canal(3, '2026-10-19', '2026-10-20', deLicencia), 'recordatorio');
    assert.equal(canal(3, '2026-10-19', '2026-10-21', deLicencia), 'nota');
  });

  it('propone el titular y el único otro auditor está de licencia: respaldo, recordatorio', () => {
    assert.equal(canal(1, '2026-10-16', '2026-10-20', contexto({ 2: { disponible: false } })), 'recordatorio');
  });

  it('el titular de licencia sin autorizado: recordatorio; a la vuelta, lo que cumple las condiciones va a nota', () => {
    assert.equal(canal(1, '2026-10-16', '2026-10-20', contexto({ 1: { disponible: false } }, { hayQuienFirme: false })), 'recordatorio');
    assert.equal(canal(1, '2026-10-16', '2026-10-26'), 'nota');
  });

  it('sin firmante titular, la condición 2 mira a los superadmins; sin ninguno, se cumple siempre', () => {
    assert.equal(canal(3, '2026-10-16', '2026-10-20', contexto({}, { titulares: [1] })), 'recordatorio');
    assert.equal(canal(3, '2026-10-16', '2026-10-20', contexto({}, { titulares: [] })), 'nota');
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

describe('con el calendario de la tabla (spec 2026-10-27-feriados-en-notas, 3)', () => {
  // La precarga de producción: el lunes 02/11/2026 y el lunes 09/11 son feriados de la tabla (el 08/11, domingo, también). Sin
  // el calendario, las reglas cuentan solo los 9 fijos, como siempre
  const CAL = calendarioCon(FILAS_PRECARGA);
  const personas = [{ id: 1, rol: 'superadmin', disponible: true }, { id: 2, rol: 'admin', disponible: true }];
  const cambio = { usuario_id: 1, primer_recordatorio_fecha: '2026-10-30' };

  it('con el primer recordatorio el viernes 30/10, el 03/11 sigue por recordatorio y el 04/11 pasa a la nota', () => {
    const canal = (hoy, calendario) => canalDelCambio({ cambio, hoy, personas, titulares: [1], hayQuienFirme: true, calendario });
    // Con la tabla, el 02/11 no cuenta: el 03/11 es el segundo recordatorio y el 04/11, la nota
    assert.equal(canal('2026-11-03', CAL), 'recordatorio');
    assert.equal(canal('2026-11-04', CAL), 'nota');
    // Con los 9 fijos, el 02/11 es el segundo recordatorio y el 03/11 ya es la nota
    assert.equal(canal('2026-11-03'), 'nota');
  });

  it('la nota de auditoría se reitera a los 5 días hábiles, sin el 09/11', () => {
    assert.equal(seccionDeAuditoria('2026-11-04', '2026-11-11', CAL), null);
    assert.equal(seccionDeAuditoria('2026-11-04', '2026-11-12', CAL), 'reiterado');
    assert.equal(seccionDeAuditoria('2026-11-04', '2026-11-11'), 'reiterado');
  });

  it('el 09/11 no corta el período y la vuelta es el 10/11', () => {
    const dia = (fecha, conAuditor) => ({
      fecha,
      personas: [
        { id: 1, rol: 'superadmin', nombre_completo: 'Persona Titular', disponible: false },
        { id: 2, rol: 'admin', nombre_completo: 'Persona Auditora', disponible: conAuditor }
      ]
    });
    const dias = [dia('2026-11-06', false), dia('2026-11-09', true), dia('2026-11-10', true)];
    assert.deepEqual(agruparDiasSinAuditor(dias, '2026-11-06', CAL),
      [{ desde: '2026-11-06', hasta: '2026-11-06', vuelve: '2026-11-10', respaldo: [] }]);
    assert.deepEqual(agruparDiasSinAuditor(dias, '2026-11-06'),
      [{ desde: '2026-11-06', hasta: '2026-11-06', vuelve: '2026-11-09', respaldo: [] }]);
  });
});
