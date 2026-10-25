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

// requestAnimationFrame: opcional (el vm no lo trae, como un navegador sin él)
const cargarCarcasa = ({ conSesion, requestAnimationFrame }) => {
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
  const contexto = vm.createContext({ document, window: { location: { pathname: '/admin.html' } }, Auth, API: {}, console, ...(requestAnimationFrame ? { requestAnimationFrame } : {}) });
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

// Las reglas de una hoja ({ selector, cuerpo }), sin comentarios: las de adentro de un @media también aparecen, con su selector
const reglasDe = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), cuerpo: m[2] }));
// El contenido de cada bloque @media con esa condición
const bloquesDeMedia = (css, condicion) => {
  const sinComentarios = css.replace(/\/\*[^]*?\*\//g, '');
  const bloques = [];
  for (let desde = sinComentarios.indexOf(condicion); desde !== -1; desde = sinComentarios.indexOf(condicion, desde + 1)) {
    let profundidad = 0;
    let hasta = sinComentarios.indexOf('{', desde);
    const inicio = hasta;
    for (; hasta < sinComentarios.length; hasta++) {
      if (sinComentarios[hasta] === '{') profundidad++;
      if (sinComentarios[hasta] === '}' && --profundidad === 0) break;
    }
    bloques.push(sinComentarios.slice(inicio + 1, hasta));
  }
  return bloques;
};
const MAIN_CSS = fs.readFileSync(new URL('../public/css/main.css', import.meta.url), 'utf8');

// Ruling 13: si Firefox calcula la página antes de que llegue main.css, al aplicarla corría la transición del menú y el menú se
// asomaba al pasar de una página a otra. Las transiciones se habilitan con una clase que main.js pone después del primer cuadro
describe('menú lateral: las transiciones, recién después de la carga', () => {
  const conLaClase = (piezas) => [piezas.sidebar, piezas.sidebarOverlay, piezas.sidebarToggle].map(p => p.clases.has('menu-animable'));

  it('initSidebar pone menu-animable en el menú, el velo y el botón en el segundo cuadro, no antes', () => {
    const cuadros = [];
    const { contexto, piezas } = cargarCarcasa({ conSesion: true, requestAnimationFrame: (fn) => { cuadros.push(fn); return cuadros.length; } });
    contexto.initSidebar();
    assert.deepEqual(conLaClase(piezas), [false, false, false], 'al inicializar, todavía no');
    assert.equal(cuadros.length, 1);
    cuadros.shift()();
    assert.deepEqual(conLaClase(piezas), [false, false, false], 'en el primer cuadro, todavía no');
    assert.equal(cuadros.length, 1);
    cuadros.shift()();
    assert.deepEqual(conLaClase(piezas), [true, true, true]);
    assert.equal(cuadros.length, 0);
  });

  it('sin requestAnimationFrame la pone enseguida, sin fallar', () => {
    const { contexto, piezas } = cargarCarcasa({ conSesion: false });
    contexto.initSidebar();
    assert.deepEqual(conLaClase(piezas), [true, true, true]);
  });

  it('al cargarse, main.js no toca el menú ni pide cuadros', () => {
    const cuadros = [];
    const { piezas } = cargarCarcasa({ conSesion: true, requestAnimationFrame: (fn) => cuadros.push(fn) });
    assert.equal(cuadros.length, 0);
    assert.deepEqual(conLaClase(piezas), [false, false, false]);
  });

  it('main.css: el menú, el velo y el botón se animan solo con menu-animable, y el movimiento reducido lo saca con el mismo selector', () => {
    const reglas = reglasDe(MAIN_CSS);
    for (const selector of ['.sidebar', '.sidebar-overlay', '.sidebar-toggle']) {
      const base = reglas.filter(r => r.selector === selector);
      assert.ok(base.length > 0, selector);
      for (const { cuerpo } of base) assert.doesNotMatch(cuerpo, /transition/, `${selector} sin transición propia`);
    }
    assert.match(reglas.find(r => r.selector === '.sidebar.menu-animable')?.cuerpo ?? '', /transition:\s*transform 0\.3s ease, visibility 0\.3s/);
    assert.match(reglas.find(r => /\.sidebar-overlay\.menu-animable/.test(r.selector) && /\.sidebar-toggle\.menu-animable/.test(r.selector))?.cuerpo ?? '', /transition:\s*var\(--transition\)/);
    const reducido = bloquesDeMedia(MAIN_CSS, '@media (prefers-reduced-motion: reduce)').join('\n');
    assert.match(reducido, /\.sidebar\.menu-animable,\s*\.sidebar-overlay\.menu-animable\s*\{\s*transition:\s*none;?\s*\}/);
  });
});

// Alto contraste (forced colors): el borde transparente de 56 px del footer se pintaba con el color del texto y los logos blancos
// del footer y del menú desaparecían sobre el fondo forzado
describe('main.css: alto contraste', () => {
  it('el borde de arriba del footer toma el color del fondo, y el footer y el menú conservan su azul', () => {
    const bloque = bloquesDeMedia(MAIN_CSS, '@media (forced-colors: active)').join('\n');
    assert.match(bloque, /\.footer\s*\{\s*border-top-color:\s*Canvas;?\s*\}/);
    assert.match(bloque, /\.footer,\s*\.sidebar\s*\{\s*forced-color-adjust:\s*none;?\s*\}/);
  });
});

// El generador de notas es de administración y del colaborador (spec 2026-10-24-generador-de-notas, 1): el lector deja de ver «Notas»
// en Herramientas. Con el auth.js de verdad (Auth.puedeCargarNotasDgmit) y el main.js de verdad; el marcado de las páginas no cambia
describe('menú lateral: «Notas» solo para quien usa el generador de notas', () => {
  const conRol = (rol) => {
    const almacen = new Map([['rpad_token', 'token-de-prueba'], ['rpad_user', JSON.stringify({ nombre_completo: 'Ana Pérez', rol })]]);
    const localStorage = {
      getItem: (clave) => almacen.get(clave) ?? null,
      setItem: (clave, valor) => almacen.set(clave, String(valor)),
      removeItem: (clave) => almacen.delete(clave)
    };
    const secciones = { sidebarPrincipal: elemento(), sidebarAdmin: elemento(), sidebarTools: elemento(), sidebarAccount: elemento() };
    const enlaceNotas = elemento();
    secciones.sidebarTools.querySelector = (selector) => (selector === 'a[href="notas.html"]' ? enlaceNotas : null);
    const document = {
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement: () => ({ textContent: '', remove() {} }),
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: (id) => secciones[id] ?? null
    };
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api', TOKEN_KEY: 'rpad_token', USER_KEY: 'rpad_user' }, localStorage, document,
      window: { location: { pathname: '/notas.html' } }, API: {}, console
    });
    vm.runInContext(`${fs.readFileSync(new URL('../public/js/auth.js', import.meta.url), 'utf8')}\n;globalThis.Auth = Auth;`, contexto);
    vm.runInContext(fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8'), contexto);
    const cambiarRol = (nuevo) => almacen.set('rpad_user', JSON.stringify({ nombre_completo: 'Ana Pérez', rol: nuevo }));
    return { contexto, enlaceNotas, secciones, cambiarRol };
  };

  it('con rol lector el enlace a notas.html queda oculto (clase hidden); Herramientas sigue visible', () => {
    const { contexto, enlaceNotas, secciones } = conRol('lector');
    contexto.updateSidebarAuth();
    assert.ok(enlaceNotas.clases.has('hidden'));
    assert.ok(!secciones.sidebarTools.clases.has('hidden'));
  });

  for (const rol of ['colaborador', 'editor', 'admin', 'superadmin']) {
    it(`con rol ${rol} el enlace a notas.html se ve`, () => {
      const { contexto, enlaceNotas } = conRol(rol);
      enlaceNotas.clases.add('hidden');
      contexto.updateSidebarAuth();
      assert.ok(!enlaceNotas.clases.has('hidden'));
    });
  }

  it('si el rol cambia (refrescarSesionGuardada vuelve a llamar a updateSidebarAuth), el enlace aparece o se oculta', () => {
    const { contexto, enlaceNotas, cambiarRol } = conRol('lector');
    contexto.updateSidebarAuth();
    assert.ok(enlaceNotas.clases.has('hidden'));
    cambiarRol('colaborador');
    contexto.updateSidebarAuth();
    assert.ok(!enlaceNotas.clases.has('hidden'));
    cambiarRol('lector');
    contexto.updateSidebarAuth();
    assert.ok(enlaceNotas.clases.has('hidden'));
  });
});
