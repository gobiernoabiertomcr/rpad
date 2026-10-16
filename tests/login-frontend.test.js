// Pantalla de ingreso (public/login.html), con su script en línea ejecutado en Node y un DOM mínimo:
// el aviso de "contraseña guardada" se muestra aunque ya haya una sesión abierta
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

// El script en línea es el último <script> sin src de la página
const scriptDelLogin = (() => {
  const html = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return scripts[scripts.length - 1][1];
})();

const cargarLogin = ({ search = '', autenticado = false, login = async () => {} } = {}) => {
  const elementos = new Map();
  const elemento = (id) => {
    if (!elementos.has(id)) elementos.set(id, { id, value: '', textContent: '', innerHTML: '', disabled: false, style: { display: 'none' }, addEventListener() {} });
    return elementos.get(id);
  };
  const escuchas = {};
  elemento('loginForm').addEventListener = (tipo, fn) => { escuchas[tipo] = fn; };
  const document = {
    addEventListener: (tipo, fn) => { escuchas[`document:${tipo}`] = fn; },
    getElementById: elemento
  };
  const ubicacion = { search, href: 'login.html' };
  const historial = [];
  const contexto = vm.createContext({
    document,
    window: { location: ubicacion },
    history: { replaceState: (...args) => historial.push(args) },
    URLSearchParams,
    Auth: { isAuthenticated: () => autenticado, login },
    console
  });
  vm.runInContext(scriptDelLogin, contexto);
  return {
    ubicacion, historial, elemento,
    abrir: () => escuchas['document:DOMContentLoaded'](),
    enviar: () => escuchas.submit({ preventDefault() {} })
  };
};

describe('aviso de contraseña guardada', () => {
  it('con ?contrasena=ok muestra el aviso y limpia la URL', () => {
    const pantalla = cargarLogin({ search: '?contrasena=ok' });
    pantalla.abrir();
    assert.equal(pantalla.elemento('alertExito').style.display, 'flex');
    assert.deepEqual(pantalla.historial, [[null, '', 'login.html']]);
    assert.equal(pantalla.ubicacion.href, 'login.html');
  });

  it('con ?contrasena=ok y una sesión abierta no redirige: la persona ingresa con su contraseña nueva', () => {
    const pantalla = cargarLogin({ search: '?contrasena=ok', autenticado: true });
    pantalla.abrir();
    assert.equal(pantalla.elemento('alertExito').style.display, 'flex');
    assert.equal(pantalla.ubicacion.href, 'login.html');
  });

  it('sin el parámetro, una sesión abierta sigue yendo al inicio y el aviso no se muestra', () => {
    const pantalla = cargarLogin({ autenticado: true });
    pantalla.abrir();
    assert.equal(pantalla.ubicacion.href, 'index.html');
    assert.equal(pantalla.elemento('alertExito').style.display, 'none');
  });

  it('sin el parámetro y sin sesión no pasa nada', () => {
    const pantalla = cargarLogin();
    pantalla.abrir();
    assert.equal(pantalla.ubicacion.href, 'login.html');
    assert.equal(pantalla.elemento('alertExito').style.display, 'none');
    assert.deepEqual(pantalla.historial, []);
  });

  it('otro valor del parámetro no cuenta', () => {
    const pantalla = cargarLogin({ search: '?contrasena=no' });
    pantalla.abrir();
    assert.equal(pantalla.elemento('alertExito').style.display, 'none');
  });

  it('al enviar el formulario de ingreso, el aviso se oculta', async () => {
    const pantalla = cargarLogin({ search: '?contrasena=ok', login: async () => { throw new Error('Credenciales inválidas'); } });
    pantalla.abrir();
    assert.equal(pantalla.elemento('alertExito').style.display, 'flex');
    await pantalla.enviar();
    assert.equal(pantalla.elemento('alertExito').style.display, 'none');
    assert.equal(pantalla.elemento('alertError').style.display, 'flex');
    assert.equal(pantalla.elemento('alertErrorText').textContent, 'Credenciales inválidas');
  });

  it('un ingreso correcto va al inicio', async () => {
    const pantalla = cargarLogin();
    pantalla.abrir();
    await pantalla.enviar();
    assert.equal(pantalla.ubicacion.href, 'index.html');
  });
});
