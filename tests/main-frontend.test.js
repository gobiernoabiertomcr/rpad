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

describe('footer: el año del ©', () => {
  const cargar = () => {
    const contexto = vm.createContext({ document: { head: { appendChild() {} }, body: { appendChild() {} }, createElement: () => ({ textContent: '', remove() {} }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null }, window: { location: { pathname: '/index.html' } }, console, Intl, Date });
    vm.runInContext(`${fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8')}\n;globalThis.anioEnArgentina = anioEnArgentina;`, contexto);
    return contexto;
  };

  it('es el año en Argentina, aunque en UTC ya sea el año siguiente', () => {
    const { anioEnArgentina } = cargar();
    assert.equal(anioEnArgentina(new Date('2026-10-18T12:00:00Z')), '2026');
    assert.equal(anioEnArgentina(new Date('2027-01-01T02:30:00Z')), '2026');
    assert.equal(anioEnArgentina(new Date('2027-01-01T03:00:00Z')), '2027');
  });
});

// Un elemento mínimo con clases, atributos y oyentes, para el encabezado y el menú lateral
const elemento = () => {
  const clases = new Set();
  const atributos = {};
  const oyentes = {};
  return {
    clases,
    atributos,
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c),
      toggle: (c, forzar) => {
        const poner = forzar === undefined ? !clases.has(c) : Boolean(forzar);
        if (poner) clases.add(c); else clases.delete(c);
        return poner;
      }
    },
    setAttribute: (nombre, valor) => { atributos[nombre] = String(valor); },
    getAttribute: (nombre) => atributos[nombre] ?? null,
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    contains: () => false,
    focus() {},
    disparar: (tipo, evento = {}) => oyentes[tipo]?.(evento),
    innerHTML: ''
  };
};

const cargarCarcasa = ({ conSesion }) => {
  const piezas = { header: elemento(), headerActions: elemento(), sidebar: elemento(), sidebarOverlay: elemento(), sidebarToggle: elemento() };
  const oyentesDocumento = {};
  const document = {
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement: () => ({ textContent: '', remove() {} }),
    addEventListener: (tipo, fn) => { oyentesDocumento[tipo] = fn; },
    querySelector: (selector) => (selector === '.header' ? piezas.header : null),
    querySelectorAll: () => [],
    getElementById: (id) => ({ 'header-actions': piezas.headerActions, sidebar: piezas.sidebar, sidebarOverlay: piezas.sidebarOverlay, sidebarToggle: piezas.sidebarToggle })[id] ?? null
  };
  const Auth = {
    isAuthenticated: () => conSesion,
    getUser: () => ({ nombre_completo: 'Ana Pérez', rol: 'lector' }),
    getRoleText: () => 'Lector',
    isAdmin: () => false
  };
  const contexto = vm.createContext({ document, window: { location: { pathname: '/admin.html' } }, Auth, API: {}, console });
  vm.runInContext(`${fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8')}\n;globalThis.initHeader = initHeader; globalThis.initSidebar = initSidebar;`, contexto);
  return { contexto, piezas, teclado: (evento) => oyentesDocumento.keydown?.(evento) };
};

describe('header: la clase header--con-sesion (el CSS muestra el botón del menú)', () => {
  it('con sesión la pone y sin sesión la saca', () => {
    const { contexto, piezas } = cargarCarcasa({ conSesion: true });
    contexto.initHeader();
    assert.ok(piezas.header.clases.has('header--con-sesion'));

    const sinSesion = cargarCarcasa({ conSesion: false });
    sinSesion.piezas.header.clases.add('header--con-sesion');
    sinSesion.contexto.initHeader();
    assert.ok(!sinSesion.piezas.header.clases.has('header--con-sesion'));
  });
});

describe('menú lateral: aria-expanded', () => {
  it('el botón dice si el menú está abierto: al abrir y al cerrar con el botón, con el velo y con Escape', () => {
    const { contexto, piezas, teclado } = cargarCarcasa({ conSesion: true });
    contexto.initSidebar();
    const boton = piezas.sidebarToggle;
    const estado = () => [boton.getAttribute('aria-expanded'), piezas.sidebar.clases.has('open'), piezas.sidebarOverlay.clases.has('visible')];

    boton.disparar('click');
    assert.deepEqual(estado(), ['true', true, true]);
    boton.disparar('click');
    assert.deepEqual(estado(), ['false', false, false]);

    boton.disparar('click');
    piezas.sidebarOverlay.disparar('click');
    assert.deepEqual(estado(), ['false', false, false]);

    boton.disparar('click');
    teclado({ key: 'Enter' });
    assert.deepEqual(estado(), ['true', true, true]);
    teclado({ key: 'Escape' });
    assert.deepEqual(estado(), ['false', false, false]);
  });
});
