// Roles y sesión en el frontend (public/js/auth.js), ejecutado en Node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const cargarAuth = (usuario, fetch = async () => ({ ok: true, status: 200, json: async () => ({}) })) => {
  const almacen = new Map([['rpad_token', 'token-de-prueba'], ['rpad_user', JSON.stringify(usuario)]]);
  const localStorage = {
    getItem: (clave) => almacen.get(clave) ?? null,
    setItem: (clave, valor) => almacen.set(clave, String(valor)),
    removeItem: (clave) => almacen.delete(clave)
  };
  const contexto = vm.createContext({ CONFIG: { API_URL: '/api', TOKEN_KEY: 'rpad_token', USER_KEY: 'rpad_user' }, localStorage, fetch, console });
  vm.runInContext(`${fs.readFileSync(new URL('../public/js/auth.js', import.meta.url), 'utf8')}\n;globalThis.Auth = Auth;`, contexto);
  return { Auth: contexto.Auth, almacen };
};

describe('roles', () => {
  it('superadmin y admin son administradores; lector no', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.isAdmin(), true);
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.isAdmin(), true);
    assert.equal(cargarAuth({ rol: 'lector' }).Auth.isAdmin(), false);
    assert.equal(cargarAuth(null).Auth.isAdmin(), false);
  });

  it('solo el superadmin es superadmin', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.isSuperadmin(), true);
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.isSuperadmin(), false);
  });

  it('texto del rol en el header', () => {
    assert.equal(cargarAuth({ rol: 'superadmin' }).Auth.getRoleText(), 'Superadmin');
    assert.equal(cargarAuth({ rol: 'admin' }).Auth.getRoleText(), 'Administrador');
    assert.equal(cargarAuth({ rol: 'lector' }).Auth.getRoleText(), 'Lector');
  });
});

describe('refrescarSesion', () => {
  it('actualiza el usuario guardado con lo que dice el servidor y conserva lo demás', async () => {
    const fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { user: { rol: 'superadmin', cargo: 'Cargo' } } }) });
    const { Auth } = cargarAuth({ id: 1, rol: 'admin', nombre_completo: 'Persona' }, fetch);
    assert.equal(await Auth.refrescarSesion(), 'ok');
    assert.equal(Auth.getUser().rol, 'superadmin');
    assert.equal(Auth.getUser().cargo, 'Cargo');
    assert.equal(Auth.getUser().nombre_completo, 'Persona');
  });

  it('401: sesión inválida, sin tocar lo guardado', async () => {
    const { Auth } = cargarAuth({ rol: 'admin' }, async () => ({ ok: false, status: 401, json: async () => ({}) }));
    assert.equal(await Auth.refrescarSesion(), 'invalida');
    assert.equal(Auth.getUser().rol, 'admin');
  });

  it('error del servidor o sin red: no cierra la sesión', async () => {
    assert.equal(await cargarAuth({ rol: 'admin' }, async () => ({ ok: false, status: 500, json: async () => ({}) })).Auth.refrescarSesion(), 'sin-conexion');
    assert.equal(await cargarAuth({ rol: 'admin' }, async () => { throw new Error('sin red'); }).Auth.refrescarSesion(), 'sin-conexion');
  });
});
