// Header compartido (public/js/main.js), ejecutado en Node: el nombre del usuario viene de la base y
// lo puede cambiar otro administrador, así que nunca se inserta en el HTML sin escapar
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

// main.js es un script de navegador: se ejecuta en un contexto aislado con un DOM mínimo
const renderizarHeader = (usuario, rolTexto = 'Administrador') => {
  const headerActions = { innerHTML: '' };
  const elementoVacio = () => ({ textContent: '', remove() {} });
  const document = {
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement: elementoVacio,
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'header-actions' ? headerActions : null)
  };
  const Auth = {
    isAuthenticated: () => true,
    getUser: () => usuario,
    getRoleText: () => rolTexto,
    isAdmin: () => usuario.rol === 'admin'
  };
  const API = { getContadorPendientes: async () => ({ cantidad: 0 }) };
  const contexto = vm.createContext({ document, window: { location: { pathname: '/index.html' } }, Auth, API, console });
  vm.runInContext(`${fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8')}\n;globalThis.initHeader = initHeader;`, contexto);
  contexto.initHeader();
  return headerActions.innerHTML;
};

describe('header: datos del usuario', () => {
  it('un nombre normal se muestra tal cual, con sus iniciales', () => {
    const html = renderizarHeader({ nombre_completo: 'Ana Pérez', rol: 'admin' });
    assert.match(html, /<div class="header-user-name">Ana Pérez<\/div>/);
    assert.match(html, /<div class="header-user-avatar">AP<\/div>/);
    assert.match(html, /<div class="header-user-role">Administrador<\/div>/);
  });

  it('el nombre con HTML se escapa: no se puede inyectar código en la sesión de otro usuario', () => {
    const html = renderizarHeader({ nombre_completo: '<img src=x onerror=alert(1)> Ana', rol: 'admin' });
    assert.ok(html.includes('&lt;img'), 'el nombre debe salir escapado');
    assert.ok(!html.includes('<img src=x'), 'no debe haber una etiqueta img inyectada');
    // las iniciales salen de las primeras letras del nombre, también escapadas
    assert.match(html, /<div class="header-user-avatar">&lt;S<\/div>/);
  });

  it('escapa también comillas y ampersands, y el texto del rol', () => {
    const html = renderizarHeader({ nombre_completo: `Ana "O'Brien" & Co`, rol: 'admin' }, '<b>Rol</b>');
    assert.ok(html.includes('Ana &quot;O&#39;Brien&quot; &amp; Co'));
    assert.ok(html.includes('&lt;b&gt;Rol&lt;/b&gt;'));
    assert.ok(!html.includes('<b>Rol</b>'));
  });

  it('sin nombre completo usa el usuario, también escapado', () => {
    const html = renderizarHeader({ username: '<script>x</script>', rol: 'lector' }, 'Lector');
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
  });
});
