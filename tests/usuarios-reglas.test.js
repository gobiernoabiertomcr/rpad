// Reglas de usuarios y roles (services/usuariosReglas.js): funciones puras, sin base
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esAdmin, esAuditor, estadoDeUsuario, esAprobadorActivo, violaMinimoAprobadores, emailValido,
  validarContrasena, validarDatosUsuario, camposCambiados, TEXTO_ROL,
  ROLES_ASIGNABLES, ROLES_DEL_EDITOR, rechazoParaEditor, puedeCargarNotasDgmit, MENSAJE_EDITOR_SOLO_LECTORES,
  MENSAJE_EDITOR_SIN_ROLES, superioresDe, quienesDependenDe, rechazoDeDependencia, dependenciaDe, MENSAJES_DEPENDENCIA
} from '../services/usuariosReglas.js';

const u = (id, rol, activo = 1, tieneContrasena = 1) => ({ id, rol, activo, tiene_contrasena: tieneContrasena });

describe('roles', () => {
  it('superadmin y admin son administradores; lector y nada, no', () => {
    assert.equal(esAdmin('superadmin'), true);
    assert.equal(esAdmin('admin'), true);
    assert.equal(esAdmin('lector'), false);
    assert.equal(esAdmin('colaborador'), false);
    assert.equal(esAdmin(undefined), false);
  });

  it('textos de los roles', () => {
    assert.deepEqual(TEXTO_ROL, {
      superadmin: 'Superadmin', admin: 'Administrador', editor: 'Editor', colaborador: 'Colaborador', lector: 'Lector'
    });
  });

  it('auditores: superadmin y admin (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)', () => {
    assert.equal(esAuditor('superadmin'), true);
    assert.equal(esAuditor('admin'), true);
    assert.equal(esAuditor('editor'), false);
    assert.equal(esAuditor('lector'), false);
    assert.equal(esAuditor('colaborador'), false);
    assert.equal(esAuditor(undefined), false);
  });
});

describe('estado del usuario', () => {
  it('desactivado, invitación pendiente o activo', () => {
    assert.equal(estadoDeUsuario({ activo: 0, tiene_contrasena: 1 }), 'desactivado');
    assert.equal(estadoDeUsuario({ activo: 0, tiene_contrasena: 0 }), 'desactivado');
    assert.equal(estadoDeUsuario({ activo: 1, tiene_contrasena: 0 }), 'invitacion_pendiente');
    assert.equal(estadoDeUsuario({ activo: 1, tiene_contrasena: 1 }), 'activo');
  });

  it('aprobador activo: admin o superadmin, activo y con contraseña', () => {
    assert.equal(esAprobadorActivo(u(1, 'superadmin')), true);
    assert.equal(esAprobadorActivo(u(1, 'admin')), true);
    assert.equal(esAprobadorActivo(u(1, 'lector')), false);
    assert.equal(esAprobadorActivo(u(1, 'colaborador')), false);
    assert.equal(esAprobadorActivo(u(1, 'admin', 0)), false);
    assert.equal(esAprobadorActivo(u(1, 'admin', 1, 0)), false);
  });
});

describe('mínimo de 2 aprobadores', () => {
  const dos = [u(1, 'superadmin'), u(2, 'admin'), u(3, 'lector')];

  it('con 2 aprobadores no se puede desactivar ni degradar a ninguno', () => {
    assert.equal(violaMinimoAprobadores(dos, 2, { activo: 0 }), true);
    assert.equal(violaMinimoAprobadores(dos, 2, { rol: 'lector' }), true);
    assert.equal(violaMinimoAprobadores(dos, 1, { activo: 0 }), true);
  });

  it('desactivar a un lector nunca viola la regla', () => {
    assert.equal(violaMinimoAprobadores(dos, 3, { activo: 0 }), false);
  });

  it('con 3 aprobadores se puede sacar a uno', () => {
    assert.equal(violaMinimoAprobadores([...dos, u(4, 'admin')], 2, { activo: 0 }), false);
  });

  it('un admin con la invitación pendiente no cuenta', () => {
    assert.equal(violaMinimoAprobadores([...dos, u(4, 'admin', 1, 0)], 2, { activo: 0 }), true);
  });

  it('si ya había menos de 2, una operación que no saca aprobadores sigue permitida', () => {
    const uno = [u(1, 'admin'), u(3, 'lector')];
    assert.equal(violaMinimoAprobadores(uno, 3, { activo: 0 }), false);
    assert.equal(violaMinimoAprobadores(uno, 3, { rol: 'admin' }), false);
  });

  it('un id que no está en la lista no viola nada', () => {
    assert.equal(violaMinimoAprobadores(dos, 99, { activo: 0 }), false);
  });
});

describe('validaciones', () => {
  it('email', () => {
    assert.equal(emailValido('persona@rpad.test'), true);
    for (const malo of ['', 'sin-arroba', 'a@b', 'con espacio@rpad.test', null, `${'x'.repeat(95)}@rpad.test`]) {
      assert.equal(emailValido(malo), false, String(malo));
    }
  });

  it('contraseña: mínimo 8 caracteres y máximo 72 bytes', () => {
    assert.equal(validarContrasena('corta'), 'La contraseña debe tener al menos 8 caracteres');
    assert.equal(validarContrasena(undefined), 'La contraseña debe tener al menos 8 caracteres');
    assert.equal(validarContrasena('a'.repeat(72)), null);
    assert.match(validarContrasena('ñ'.repeat(37)), /72 bytes/);
  });

  it('datos completos válidos se normalizan', () => {
    const { errores, datos } = validarDatosUsuario({
      nombre_completo: '  Laura Inés Fernández ', username: ' lifernandez ', email: ' LIF@RPAD.test ',
      rol: 'lector', cargo: '  ', vinculo: ''
    });
    assert.deepEqual(errores, []);
    assert.deepEqual(datos, {
      nombre_completo: 'Laura Inés Fernández', username: 'LIFERNANDEZ', email: 'lif@rpad.test',
      cargo: null, vinculo: null, rol: 'lector'
    });
  });

  it('cada dato inválido indica su campo', () => {
    const base = { nombre_completo: 'Persona', username: 'PERSONA', email: 'p@rpad.test', rol: 'lector' };
    for (const [cambio, campo] of [
      [{ nombre_completo: '' }, 'nombre_completo'],
      [{ nombre_completo: 'x'.repeat(101) }, 'nombre_completo'],
      [{ username: 'ab' }, 'username'],
      [{ username: 'con espacio' }, 'username'],
      [{ username: 'PEÑA' }, 'username'],
      [{ email: 'no' }, 'email'],
      [{ cargo: 'x'.repeat(201) }, 'cargo'],
      [{ vinculo: 'otro' }, 'vinculo'],
      [{ rol: 'superadmin' }, 'rol'],
      [{ rol: undefined }, 'rol']
    ]) {
      const { errores } = validarDatosUsuario({ ...base, ...cambio });
      assert.deepEqual(errores.map(e => e.campo), [campo], JSON.stringify(cambio));
    }
  });

  it('en la edición parcial solo valida lo que viene', () => {
    assert.deepEqual(validarDatosUsuario({ cargo: 'Nuevo' }, { parcial: true }), { errores: [], datos: { cargo: 'Nuevo' } });
    assert.deepEqual(validarDatosUsuario({ email: '' }, { parcial: true }).errores.map(e => e.campo), ['email']);
  });
});

describe('campos cambiados', () => {
  it('solo los que vienen y cambian, con el valor anterior y el nuevo', () => {
    const antes = { nombre_completo: 'A', email: 'a@rpad.test', cargo: null, vinculo: null };
    assert.deepEqual(camposCambiados(antes, { nombre_completo: 'A', cargo: 'Cargo', vinculo: null }, ['nombre_completo', 'email', 'cargo', 'vinculo']), {
      cargo: { antes: null, despues: 'Cargo' }
    });
  });
});

describe('editor (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1 y 8.3)', () => {
  it('entra al área de administración, pero no es auditor ni cuenta como aprobador', () => {
    assert.equal(esAdmin('editor'), true);
    assert.equal(esAuditor('editor'), false);
    assert.equal(esAprobadorActivo(u(1, 'editor')), false);
    assert.deepEqual(ROLES_ASIGNABLES, ['admin', 'editor', 'colaborador', 'lector']);
  });

  it('pasar a un admin a editor cuenta como quitar un aprobador', () => {
    const dos = [u(1, 'superadmin'), u(2, 'admin'), u(3, 'editor')];
    assert.equal(violaMinimoAprobadores(dos, 2, { rol: 'editor' }), true);
    assert.equal(violaMinimoAprobadores([...dos, u(4, 'admin')], 2, { rol: 'editor' }), false);
  });

  it('el formulario acepta el rol editor', () => {
    assert.equal(validarDatosUsuario({ rol: 'editor' }, { parcial: true }).datos.rol, 'editor');
    assert.equal(validarDatosUsuario({ rol: 'jefe' }, { parcial: true }).errores[0].error, 'El rol debe ser admin, editor, colaborador o lector');
  });

  it('lo que el editor no puede en el panel: tocar a quien no es lector ni colaborador, o cambiar un rol', () => {
    assert.equal(rechazoParaEditor({ objetivo: 'lector' }), null);
    for (const objetivo of ['admin', 'editor', 'superadmin']) {
      assert.equal(rechazoParaEditor({ objetivo }), MENSAJE_EDITOR_SOLO_LECTORES, objetivo);
    }
    assert.equal(rechazoParaEditor({ objetivo: 'lector', rolNuevo: 'admin' }), MENSAJE_EDITOR_SIN_ROLES);
    assert.equal(MENSAJE_EDITOR_SOLO_LECTORES, 'Un editor solo puede crear y modificar usuarios lectores y colaboradores.');
    assert.equal(MENSAJE_EDITOR_SIN_ROLES, 'Un editor no puede cambiar roles.');
  });
});

describe('colaborador (spec 2026-10-24-notas-dgmit, 1)', () => {
  it('puedeCargarNotasDgmit: superadmin, admin, editor y colaborador sí; lector y null no', () => {
    for (const rol of ['superadmin', 'admin', 'editor', 'colaborador']) assert.equal(puedeCargarNotasDgmit(rol), true, rol);
    for (const rol of ['lector', null, undefined, '', 'jefe']) assert.equal(puedeCargarNotasDgmit(rol), false, String(rol));
  });

  it('rechazoParaEditor: lector↔colaborador sí; a editor o admin no; sobre un editor o un admin no', () => {
    assert.deepEqual(ROLES_DEL_EDITOR, ['lector', 'colaborador']);
    for (const objetivo of ROLES_DEL_EDITOR) assert.equal(rechazoParaEditor({ objetivo }), null, objetivo);
    assert.equal(rechazoParaEditor({ objetivo: 'lector', rolNuevo: 'colaborador' }), null);
    assert.equal(rechazoParaEditor({ objetivo: 'colaborador', rolNuevo: 'lector' }), null);
    assert.equal(rechazoParaEditor({ objetivo: 'colaborador', rolNuevo: null }), null);
    for (const objetivo of ROLES_DEL_EDITOR) {
      for (const rolNuevo of ['editor', 'admin', 'superadmin']) {
        assert.equal(rechazoParaEditor({ objetivo, rolNuevo }), MENSAJE_EDITOR_SIN_ROLES, `${objetivo} → ${rolNuevo}`);
      }
    }
    for (const objetivo of ['editor', 'admin', 'superadmin']) {
      for (const rolNuevo of [null, 'lector', 'colaborador']) {
        assert.equal(rechazoParaEditor({ objetivo, rolNuevo }), MENSAJE_EDITOR_SOLO_LECTORES, `${objetivo} → ${rolNuevo}`);
      }
    }
  });

  it('validarUsuario acepta colaborador', () => {
    assert.equal(validarDatosUsuario({ rol: 'colaborador' }, { parcial: true }).datos.rol, 'colaborador');
    const { errores, datos } = validarDatosUsuario({
      nombre_completo: 'Persona Colaboradora', username: 'pcolab', email: 'pcolab@rpad.test', rol: 'colaborador'
    });
    assert.deepEqual(errores, []);
    assert.equal(datos.rol, 'colaborador');
    assert.ok(ROLES_ASIGNABLES.includes('colaborador'));
  });
});

// De quién depende cada uno (spec 2026-11-04-agenda-aviso-y-dependencia, 3 y 5.1). Micaela depende de Federico, que depende de Graciela
describe('la cadena', () => {
  const fila = (id, nombre, dependeDe = null, activo = 1) => ({ id, nombre_completo: nombre, depende_de: dependeDe, activo });
  const CADENA = [fila(1, 'Graciela Paz'), fila(2, 'Federico Ríos', 1), fila(3, 'Micaela Ojeda', 2), fila(4, 'Lucía Ortiz', 1)];
  const ids = (filas) => filas.map((persona) => persona.id);

  it('superioresDe: del más cercano al más lejano', () => {
    assert.deepEqual(ids(superioresDe(3, CADENA)), [2, 1]);
    assert.deepEqual(ids(superioresDe(2, CADENA)), [1]);
    assert.deepEqual(ids(superioresDe(1, CADENA)), []);
    assert.deepEqual(superioresDe(99, CADENA), []);
    assert.deepEqual(superioresDe(3, null), []);
  });

  it('superioresDe: una persona desactivada no corta la cadena, y lo suyo sube a la siguiente', () => {
    const conDesactivada = CADENA.map((persona) => (persona.id === 2 ? { ...persona, activo: 0 } : persona));
    assert.deepEqual(ids(superioresDe(3, conDesactivada)), [1]);
    // Quien está arriba de todo y desactivada no aparece: lo suyo no le llega a nadie
    assert.deepEqual(ids(superioresDe(4, CADENA.map((persona) => (persona.id === 1 ? { ...persona, activo: false } : persona)))), []);
  });

  it('superioresDe: se corta ante un ciclo, sin repetir y sin la persona', () => {
    const ciclo = [fila(1, 'A', 2), fila(2, 'B', 3), fila(3, 'C', 1)];
    assert.deepEqual(ids(superioresDe(1, ciclo)), [2, 3]);
    assert.deepEqual(ids(superioresDe(5, [fila(5, 'Sola', 5)])), []);
  });

  it('quienesDependenDe: directa e indirectamente, también las desactivadas, y se corta ante un ciclo', () => {
    assert.deepEqual(ids(quienesDependenDe(1, CADENA)).sort(), [2, 3, 4]);
    assert.deepEqual(ids(quienesDependenDe(2, CADENA)), [3]);
    assert.deepEqual(ids(quienesDependenDe(3, CADENA)), []);
    assert.deepEqual(ids(quienesDependenDe(1, [fila(1, 'A'), fila(2, 'B', 1, 0), fila(3, 'C', 2)])).sort(), [2, 3]);
    assert.deepEqual(ids(quienesDependenDe(1, [fila(1, 'A', 2), fila(2, 'B', 1)])), [2]);
  });

  it('rechazoDeDependencia: cada caso, con su mensaje', () => {
    const usuarios = [...CADENA, fila(5, 'Tomás Vera', null, 0)];
    assert.equal(rechazoDeDependencia({ id: 3, dependeDe: null, usuarios }), null);
    assert.equal(rechazoDeDependencia({ id: 3, dependeDe: 1, usuarios }), null);
    assert.equal(rechazoDeDependencia({ dependeDe: 1, usuarios }), null, 'en un alta');
    assert.equal(rechazoDeDependencia({ id: 3, dependeDe: 3, usuarios }), MENSAJES_DEPENDENCIA.ellaMisma);
    assert.equal(rechazoDeDependencia({ id: 3, dependeDe: 99, usuarios }), MENSAJES_DEPENDENCIA.invalida);
    assert.equal(rechazoDeDependencia({ id: 3, dependeDe: 5, usuarios }), MENSAJES_DEPENDENCIA.invalida, 'una desactivada no se elige');
    assert.equal(rechazoDeDependencia({ id: 3, dependeDe: 5, antes: 5, usuarios }), null, 'la que ya estaba se deja');
    assert.equal(rechazoDeDependencia({ id: 1, dependeDe: 3, usuarios }), MENSAJES_DEPENDENCIA.ciclo, 'directa o indirectamente');
    assert.equal(rechazoDeDependencia({ id: 2, dependeDe: 3, usuarios }), MENSAJES_DEPENDENCIA.ciclo);
  });

  it('los mensajes, al pie de la letra', () => {
    assert.deepEqual({ ...MENSAJES_DEPENDENCIA }, {
      invalida: 'Elegí una persona de la lista.',
      ellaMisma: 'No puede depender de sí misma.',
      ciclo: 'Esa persona ya depende de quien estás editando.'
    });
  });

  it('dependenciaDe: el nombre, a quiénes no se ofrece y lo que se dice al desactivar', () => {
    assert.deepEqual(dependenciaDe(2, CADENA), {
      depende_de_nombre: 'Graciela Paz',
      no_elegibles: [2, 3],
      al_desactivar: { dependen: ['Micaela Ojeda'], suben_a: 'Graciela Paz' }
    });
    const arriba = dependenciaDe(1, CADENA);
    assert.equal(arriba.depende_de_nombre, null);
    assert.equal(arriba.al_desactivar.suben_a, null);
    assert.deepEqual(arriba.al_desactivar.dependen, ['Federico Ríos', 'Lucía Ortiz']);
    // Solo quienes están activas, y sin filas no se rompe
    const conDesactivada = CADENA.map((persona) => (persona.id === 3 ? { ...persona, activo: 0 } : persona));
    assert.deepEqual(dependenciaDe(2, conDesactivada).al_desactivar.dependen, []);
    assert.deepEqual(dependenciaDe(7, []), { depende_de_nombre: null, no_elegibles: [7], al_desactivar: { dependen: [], suben_a: null } });
  });

  it('validarDatosUsuario: vacío o null, nadie; un entero positivo, esa persona; otra cosa, error; sin el campo, no lo toca', () => {
    const conDepende = (valor) => validarDatosUsuario({ depende_de: valor }, { parcial: true });
    assert.equal(conDepende('').datos.depende_de, null);
    assert.equal(conDepende(null).datos.depende_de, null);
    assert.equal(conDepende(7).datos.depende_de, 7);
    for (const valor of [0, -1, 1.5, '7', true, {}, []]) {
      assert.deepEqual(conDepende(valor).errores, [{ campo: 'depende_de', error: MENSAJES_DEPENDENCIA.invalida }], JSON.stringify(valor));
    }
    assert.equal('depende_de' in validarDatosUsuario({ cargo: 'x' }, { parcial: true }).datos, false);
  });
});
