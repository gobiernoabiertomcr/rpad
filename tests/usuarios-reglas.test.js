// Reglas de usuarios y roles (services/usuariosReglas.js): funciones puras, sin base
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esAdmin, esAuditor, estadoDeUsuario, esAprobadorActivo, violaMinimoAprobadores, emailValido,
  validarContrasena, validarDatosUsuario, camposCambiados, TEXTO_ROL,
  ROLES_ASIGNABLES, ROLES_DEL_EDITOR, rechazoParaEditor, puedeCargarNotasDgmit, MENSAJE_EDITOR_SOLO_LECTORES,
  MENSAJE_EDITOR_SIN_ROLES
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
