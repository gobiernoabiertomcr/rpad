// Todas las páginas cargan las versiones nuevas de los scripts compartidos, y el menú de Administración tiene "Usuarios".
// Al cambiar alguno de estos scripts, subir la versión en todas las páginas y en VERSION.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

// main.js cambió con la carcasa nueva (spec 2026-10-18-rediseno-publico: el año del footer, la clase header--con-sesion y
// aria-expanded en el botón del menú); auth.js y api.js suben con él. api.js cambió después (previewNotaAnexo recibe el tipo: el
// anexo de la reiteración en Correos, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5). auth.js cambió después (el rol
// Colaborador en el encabezado y puedeCargarNotasDgmit, spec 2026-10-24-notas-dgmit, 1): main.js y api.js suben con él. api.js cambió
// después (salen getReporteHistorialUrl y getReporteCumplimientoUrl: Avisos del RPAD reemplaza al Historial y el Cumplimiento ya no
// está, spec 2026-10-24-metricas-y-reportes, 5): auth.js y main.js suben con él. main.js cambió después (el lector deja de ver
// «Notas» en Herramientas: updateSidebarAuth lo oculta si no se cumple Auth.puedeCargarNotasDgmit(), spec
// 2026-10-24-generador-de-notas, 1): auth.js y api.js suben con él
const VERSION = '20261204';
// usuarios.js cambió después (persona autorizada con licencia superpuesta en parte; con persona autorizada, cada aviso adelantado
// sale también en su fecha; el editor que audita sin responsabilidad, spec 2026-10-20-editor-sin-responsabilidad; el rol
// Colaborador, con su grupo y la ayuda de cada rol, spec 2026-10-24-notas-dgmit, 1; la ayuda del lector nombra «Métricas y
// Reportes», spec 2026-10-24-metricas-y-reportes; el lector ya no tiene Notas y el colaborador arma notas con el Generador de Notas,
// spec 2026-10-24-generador-de-notas, 1): su versión es propia (solo la usa usuarios.html)
const VERSION_PANTALLAS = '20261204';
// correos.js cambió después (Correos en pestañas; "Actualización" en el detalle del Libro; el aviso en su fecha en el texto de la
// licencia del firmante; la vista previa y la prueba como saldrían en la próxima corrida con notas; "Ver anexo" también para la
// reiteración, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5): su versión es propia
const VERSION_CORREOS = '20261116';
// perfil.js cambió después (Mi Perfil en pestañas; "Datos al" y las actualizaciones registradas; "Requiere nota DGMIT" en la
// comparación, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; el editor que audita sin responsabilidad, spec
// 2026-10-20-editor-sin-responsabilidad; la vista previa de la firma con el nombre en negrita y el cargo un punto menos; el
// rótulo «Origen de los datos», spec 2026-10-24-metricas-y-reportes): su versión es propia
const VERSION_PERFIL = '20261127';
// admin.js y admin-fechas.js (la lista con filtros por estado, "Datos publicados" y "Próximo pedido"; después, el ícono "Ver
// seguimiento" de cada fila, spec 2026-10-20-seguimiento-dataset; "Requiere nota DGMIT" en el formulario, el filtro y la vista
// previa, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; «Recibido el» obligatorio, el origen de los datos y el aviso de la
// edición que no registra actualizaciones, spec 2026-10-24-metricas-y-reportes): su versión es propia
const VERSION_ADMIN = '20261127';
// Los scripts del sitio público ("Datos al", "Cargado en el portal" y la próxima prevista; el estado del servidor), que hasta
// ahora se cargaban sin ?v=; después, el rediseño de las páginas públicas): su versión es propia
const VERSION_PUBLICAS = '20261109';
// dashboard.js cambió después (el índice de la portada con "Al día" y las leyendas con cantidades; spec
// 2026-10-19-indice-portada): su versión es propia
const VERSION_PORTADA = '20261110';
// main.css (la carcasa nueva y las fuentes Bricolage Grotesque y Figtree): hasta el rediseño se cargaba sin ?v=
const VERSION_CSS = '20261109';
// gestion.js (la tasa de cumplimiento y el ranking de áreas sin los eventuales; después, Gestión queda solo con Proyectos: la pestaña
// Métricas se mudó a «Métricas y Reportes», spec 2026-10-24-metricas-y-reportes, 6): su versión es propia
const VERSION_GESTION = '20261129';
// seguimiento.js (la página nueva de Seguimiento, spec 2026-10-20-seguimiento-dataset); cambió después ("Requiere nota DGMIT" en la
// ficha, spec 2026-10-20-requiere-nota-y-anexo-reiteracion; las últimas subidas, solo comentarios sobre requiere nota y el anexo
// de la reiteración; las notas DGMIT en la lista, el circuito, la cinta y los movimientos, y después cargar, corregir y anular notas
// DGMIT desde la página, spec 2026-10-24-notas-dgmit; después, #cargar-nota abre el formulario con el dataset, el link de «Para
// completar» de Métricas, spec 2026-10-24-metricas-y-reportes, 2.2): su versión es propia
const VERSION_SEGUIMIENTO = '20261129';
// reportes.js (la página pasa a ser «Métricas y Reportes», con la pestaña Métricas: spec 2026-10-24-metricas-y-reportes), que hasta
// ahora se cargaba sin ?v=; después, los resultados, el contexto, el trabajo, las áreas y «Para completar»; después, la tarjeta Avisos
// del RPAD en lugar del Historial y sin la del Cumplimiento; después, la pestaña Reportes con los siete reportes en dos grupos;
// después, la revisión final (el año de Datos para completar, la franja de lo destildado armada en el servidor y el foco de «Volver a
// todos»): su versión es propia
const VERSION_REPORTES = '20261203';
// notas.js (el Generador de Notas de la DGMIT en tres pasos, con la vista previa en la hoja membretada y la descarga del Word, spec
// 2026-10-24-generador-de-notas, 3), que hasta ahora se cargaba sin ?v=: cambió por completo y un notas.js viejo en la caché con el
// HTML nuevo rompería la página. Su versión es propia
const VERSION_NOTAS = '20261204';
const DIRECTORIO = new URL('../public/', import.meta.url);
const paginas = fs.readdirSync(DIRECTORIO).filter(nombre => nombre.endsWith('.html'));
const leer = (pagina) => fs.readFileSync(new URL(pagina, DIRECTORIO), 'utf8');

describe('páginas', () => {
  for (const pagina of paginas) {
    it(`${pagina}: auth.js, main.js y api.js con la versión ${VERSION}`, () => {
      const html = leer(pagina);
      for (const script of ['auth', 'main', 'api']) {
        for (const uso of html.match(new RegExp(`js/${script}\\.js[^"]*"`, 'g')) || []) {
          assert.equal(uso, `js/${script}.js?v=${VERSION}"`, `${pagina}: ${uso}`);
        }
      }
    });
  }

  // El script propio de esta pantalla cambió con los días sin auditor, después con la superposición parcial y, por último, con el
  // aviso en su fecha (el texto del efecto de la licencia en las notas, con persona autorizada)
  for (const [pagina, script] of [['usuarios.html', 'usuarios']]) {
    it(`${pagina}: ${script}.js con la versión ${VERSION_PANTALLAS}`, () => {
      assert.ok(leer(pagina).includes(`js/${script}.js?v=${VERSION_PANTALLAS}"`));
    });
  }

  // Correos pasó a pestañas (spec 2026-10-17-correos-pestanas)
  it(`correos.html: correos.js con la versión ${VERSION_CORREOS}`, () => {
    assert.ok(leer('correos.html').includes(`js/correos.js?v=${VERSION_CORREOS}"`));
  });

  // Mi Perfil pasó a pestañas (spec 2026-10-16-perfil-pestanas-gestion-cambios)
  it(`perfil.html: perfil.js con la versión ${VERSION_PERFIL}`, () => {
    assert.ok(leer('perfil.html').includes(`js/perfil.js?v=${VERSION_PERFIL}"`));
  });

  // Admin renovado (spec 2026-10-17-fechas-datasets, 8.1): admin-fechas.js declara lo puro que usa admin.js, así que va
  // antes, y los dos después de api.js (Utils)
  it(`admin.html: admin-fechas.js y admin.js con la versión ${VERSION_ADMIN}, en ese orden y después de api.js`, () => {
    const html = leer('admin.html');
    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    const posicion = (nombre) => scripts.findIndex(src => src.startsWith(`js/${nombre}.js`));
    assert.ok(scripts.includes(`js/admin-fechas.js?v=${VERSION_ADMIN}`), `admin-fechas.js?v=${VERSION_ADMIN}`);
    assert.ok(scripts.includes(`js/admin.js?v=${VERSION_ADMIN}`), `admin.js?v=${VERSION_ADMIN}`);
    assert.ok(posicion('api') !== -1 && posicion('api') < posicion('admin-fechas'), 'admin-fechas.js después de api.js');
    assert.ok(posicion('admin-fechas') < posicion('admin'), 'admin.js después de admin-fechas.js');
    assert.equal(scripts.filter(src => /^js\/admin(-fechas)?\.js/.test(src)).length, 2, 'cada uno una sola vez');
  });

  // Sitio público (spec 2026-10-17-fechas-datasets, 11): cada página carga su script con ?v=, una sola vez y después de api.js
  for (const [pagina, script, version] of [['datasets.html', 'datasets', VERSION_PUBLICAS], ['dataset.html', 'dataset-detail', VERSION_PUBLICAS],
    ['calendario.html', 'calendario', VERSION_PUBLICAS], ['index.html', 'dashboard', VERSION_PORTADA], ['seguimiento.html', 'seguimiento', VERSION_SEGUIMIENTO],
    ['reportes.html', 'reportes', VERSION_REPORTES], ['notas.html', 'notas', VERSION_NOTAS]]) {
    it(`${pagina}: ${script}.js con la versión ${version}, después de api.js`, () => {
      const scripts = [...leer(pagina).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
      assert.deepEqual(scripts.filter(src => src.startsWith(`js/${script}.js`)), [`js/${script}.js?v=${version}`]);
      const posicion = (nombre) => scripts.findIndex(src => src.startsWith(`js/${nombre}.js`));
      assert.ok(posicion('api') !== -1 && posicion('api') < posicion(script), `${script}.js después de api.js`);
    });
  }

  it(`gestion.html: gestion.js con la versión ${VERSION_GESTION}`, () => {
    assert.ok(leer('gestion.html').includes(`js/gestion.js?v=${VERSION_GESTION}"`));
  });

  // La pestaña Métricas de Gestión se mudó a «Métricas y Reportes» (spec 2026-10-24-metricas-y-reportes, 6): Gestión queda con
  // Proyectos, sin pestañas y sin Chart.js (Proyectos no lo usa)
  it('gestion.html ya no tiene Chart.js ni #tab-metricas', () => {
    const html = leer('gestion.html');
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
    assert.doesNotMatch(html, /id="tab-metricas"|data-tab=|switchTab|kpi-grid|ranking-container|metricas-manuales|metricas-periodo/);
    assert.match(html, /<div id="tab-proyectos">/);
    const gestion = fs.readFileSync(new URL('js/gestion.js', DIRECTORIO), 'utf8');
    assert.doesNotMatch(gestion, /new Chart|cargarMetricas|htmlDelRanking|textoPorcentaje|exportarCSV|switchTab|\/gestion\/metricas/);
  });

  // Gestión avisa adónde se mudaron las métricas (revisión final, B-8), arriba de Proyectos
  it('gestion.html avisa que las métricas están en Herramientas → Métricas y Reportes', () => {
    const html = leer('gestion.html');
    const aviso = html.indexOf('<p class="aviso-mudanza">Las métricas de Gestión ahora están en <a href="reportes.html#metricas">Herramientas → Métricas y Reportes</a>.</p>');
    assert.ok(aviso !== -1, 'falta el aviso');
    assert.ok(aviso < html.indexOf('<div id="tab-proyectos">'), 'el aviso va arriba de Proyectos');
  });

  // Con Chart.js fuera de Gestión, ninguna página carga nada de un CDN: la CSP ya no permite ningún CDN de scripts ni de hojas
  // (tests/publico.test.js). Si una página vuelve a cargar un script o una hoja de afuera, hay que sumarlo a la CSP de app.js.
  // Se mira cada <script> y cada <link> entero, con los atributos en cualquier orden (las páginas escriben href antes que rel)
  describe('nada de afuera del sitio, salvo las fuentes de Google', () => {
    const FUENTES_DE_GOOGLE = 'https://fonts.googleapis.com/';
    const atributo = (etiqueta, nombre) => new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(etiqueta)?.slice(1).find(v => v !== undefined) ?? null;
    const esDeAfuera = (url) => /^(https?:)?\/\//i.test(url ?? '');
    // Los href de las hojas de estilo (rel con la palabra stylesheet) y los src de los scripts, en el orden de la página
    const hojasDe = (html) => [...html.matchAll(/<link\b[^>]*>/gi)].map(([etiqueta]) => etiqueta)
      .filter(etiqueta => (atributo(etiqueta, 'rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet'))
      .map(etiqueta => atributo(etiqueta, 'href'));
    const scriptsDe = (html) => [...html.matchAll(/<script\b[^>]*>/gi)].map(([etiqueta]) => atributo(etiqueta, 'src')).filter(Boolean);
    // Lo que una página carga de afuera y no está permitido
    const deAfuera = (html) => [
      ...scriptsDe(html).filter(esDeAfuera).map(src => `script ${src}`),
      ...hojasDe(html).filter(href => esDeAfuera(href) && !href.startsWith(FUENTES_DE_GOOGLE)).map(href => `hoja ${href}`)
    ];

    for (const pagina of paginas) {
      it(`${pagina}: no carga un script ni una hoja de estilos de afuera del sitio`, () => {
        assert.deepEqual(deAfuera(leer(pagina)), []);
      });
    }

    it('la excepción se usa de verdad: cada página carga su hoja de las fuentes de Google (con href antes que rel), y la guarda la ve', () => {
      for (const pagina of paginas) {
        const deGoogle = hojasDe(leer(pagina)).filter(href => href.startsWith(FUENTES_DE_GOOGLE));
        assert.equal(deGoogle.length, 1, pagina);
      }
      // Y ve también las hojas del sitio (main.css), que no son de afuera
      assert.ok(hojasDe(leer('index.html')).some(href => href.startsWith('css/main.css')));
    });

    it('una página con un script o una hoja de un CDN no pasa, con los atributos en cualquier orden', () => {
      const casos = [
        '<link href="https://cdn.jsdelivr.net/npm/x@1.0.0/x.css" rel="stylesheet">',
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/x@1.0.0/x.css">',
        "<link rel='stylesheet' href='//cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.css'>",
        '<link\n  href="https://fonts.googleapis.com.ejemplo.test/x.css"\n  rel="stylesheet preload">',
        '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>',
        '<script defer src="//cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.js"></script>'
      ];
      for (const etiqueta of casos) {
        const pagina = `<!DOCTYPE html><html><head>${etiqueta}</head><body></body></html>`;
        assert.equal(deAfuera(pagina).length, 1, etiqueta);
      }
      // Lo del sitio, las fuentes de Google y los <link> que no son hojas (preconnect, ícono) pasan
      const permitido = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        + '<link href="https://fonts.googleapis.com/css2?family=Figtree&display=swap" rel="stylesheet">'
        + '<link rel="stylesheet" href="css/main.css?v=1"><link rel="icon" href="https://ejemplo.test/x.png"><script src="js/api.js?v=1"></script>';
      assert.deepEqual(deAfuera(permitido), []);
    });
  });

  for (const pagina of paginas.filter(p => leer(p).includes('id="sidebarAdmin"'))) {
    it(`${pagina}: el menú de Administración tiene un único enlace a Usuarios`, () => {
      assert.equal(leer(pagina).match(/href="usuarios\.html"/g)?.length, 1);
    });
  }

  // Si no hay a quién autorizar, la lista solo dice "Nadie": la aclaración explica quiénes pueden aparecer
  it('usuarios.html: debajo del selector de persona autorizada dice quiénes aparecen', () => {
    const grupo = leer('usuarios.html').match(/<div class="form-group" id="grupo-autorizado"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(grupo, /<select id="l-autorizado"[^>]*><\/select>\s*<p class="form-hint" id="l-autorizado-ayuda">Solo aparecen los admins y editores activos con su firma cargada en Mi Perfil\.<\/p>/);
  });

  // Carcasa compartida (spec 2026-10-18-rediseno-publico, 5): encabezado con el nav principal, menú lateral y footer nuevos,
  // copiados a mano en cada página (las 14, con la portada)
  const CON_CARCASA = paginas.filter(p => leer(p).includes('id="sidebar"'));
  const FUENTES = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Figtree:wght@400;500;600;700&display=swap';

  it('hay 14 páginas con carcasa', () => {
    assert.equal(CON_CARCASA.length, 14);
  });

  for (const pagina of CON_CARCASA) {
    it(`${pagina}: carga main.css con ?v=${VERSION_CSS} y las fuentes nuevas`, () => {
      const html = leer(pagina);
      assert.deepEqual(html.match(/css\/main\.css[^"]*"/g), [`css/main.css?v=${VERSION_CSS}"`]);
      // La misma hoja de Google Fonts en todas las páginas (el navegador la baja una sola vez)
      assert.deepEqual(html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]*/g), [FUENTES]);
      assert.doesNotMatch(html, /family=Inter/);
    });

    it(`${pagina}: encabezado con el nav principal y los ids que usa main.js`, () => {
      const html = leer(pagina);
      for (const id of ['header-actions', 'sidebarToggle', 'sidebar', 'sidebarOverlay', 'sidebarPrincipal', 'sidebarAdmin', 'sidebarTools', 'sidebarAccount', 'footer-anio']) {
        assert.match(html, new RegExp(`id="${id}"`), id);
      }
      assert.match(html, /<nav class="header-nav" aria-label="Principal">/);
      for (const destino of ['index.html', 'datasets.html', 'calendario.html', 'contacto.html', 'admin.html', 'areas.html', 'correos.html', 'reportes.html', 'notas.html', 'gestion.html', 'seguimiento.html', 'perfil.html']) {
        assert.ok(html.includes(`href="${destino}"`), destino);
      }
      assert.ok(!html.includes('verificar.html'), 'sin el link roto a verificar.html');
      assert.ok(!html.includes('logo-blanco.png'), 'sin el logo que no está en el repo');
    });

    it(`${pagina}: footer nuevo, RPAD v2.0.0`, () => {
      const html = leer(pagina);
      assert.ok(html.includes('<span>RPAD v2.0.0</span>'));
      assert.doesNotMatch(html, /RPAD v1\.\d\.0/);
      assert.ok(html.includes('D. G. de Modernización e Investigación Territorial'));
    });
  }

  // La marca va en el nav del encabezado (las migas del detalle llevan la suya en la última miga)
  const MARCAS_DEL_NAV = [['index.html', 'index.html'], ['datasets.html', 'datasets.html'], ['dataset.html', 'datasets.html'], ['calendario.html', 'calendario.html'], ['contacto.html', 'contacto.html']];
  const navDelEncabezado = (html) => html.match(/<nav class="header-nav" aria-label="Principal">[\s\S]*?<\/nav>/)?.[0] ?? '';
  for (const [pagina, actual] of MARCAS_DEL_NAV) {
    it(`${pagina}: el nav marca la página actual`, () => {
      const nav = navDelEncabezado(leer(pagina));
      assert.match(nav, new RegExp(`<a href="${actual.replace('.', '\\.')}" aria-current="page">`));
      assert.equal(nav.match(/aria-current=/g).length, 1, 'una sola página actual');
    });
  }

  for (const pagina of CON_CARCASA.filter(p => !MARCAS_DEL_NAV.some(([publica]) => publica === p))) {
    it(`${pagina}: las de administración no marcan ninguna página del nav`, () => {
      assert.doesNotMatch(leer(pagina), /aria-current=/);
    });
  }

  // Lo copiado a mano queda fijado (spec 5: el mismo markup en las 14): el encabezado, el velo, el menú lateral y el footer de cada
  // página son los de index.html, con sus atributos de accesibilidad. Solo cambian la marca de la página actual y la sangría
  const PIEZAS_DE_LA_CARCASA = {
    encabezado: /<header class="header">[\s\S]*?<\/header>/,
    velo: /<div class="sidebar-overlay"[^>]*><\/div>/,
    'menú lateral': /<aside class="sidebar"[\s\S]*?<\/aside>/,
    footer: /<footer class="footer">[\s\S]*?<\/footer>/
  };
  const normalizarPieza = (pieza) => pieza.replace(/\r/g, '').replace(/ aria-current="page"/g, '').split('\n').map(linea => linea.trim()).filter(Boolean).join('\n');
  const piezasDeLaCarcasa = (pagina) => Object.fromEntries(Object.entries(PIEZAS_DE_LA_CARCASA).map(([nombre, patron]) => [nombre, leer(pagina).match(patron)?.[0]]));
  const CARCASA_DE_LA_PORTADA = piezasDeLaCarcasa('index.html');

  it('index.html: la carcasa de referencia, con los atributos de accesibilidad', () => {
    const { encabezado, velo, 'menú lateral': menu, footer } = CARCASA_DE_LA_PORTADA;
    assert.match(encabezado ?? '', /<button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Abrir el menú" aria-controls="sidebar" aria-expanded="false">/);
    assert.match(encabezado, /<nav class="header-nav" aria-label="Principal">/);
    assert.equal(velo, '<div class="sidebar-overlay" id="sidebarOverlay"></div>');
    assert.match(menu ?? '', /^<aside class="sidebar" id="sidebar" aria-label="Menú">/);
    assert.match(footer ?? '', /<span>RPAD v2\.0\.0<\/span>/);
    // Los íconos son decorativos
    for (const pieza of [encabezado, menu]) {
      for (const svg of pieza.match(/<svg[^>]*>/g)) assert.match(svg, /aria-hidden="true"/, svg);
    }
  });

  for (const pagina of CON_CARCASA.filter(p => p !== 'index.html')) {
    it(`${pagina}: el encabezado, el velo, el menú lateral y el footer son los de index.html`, () => {
      const piezas = piezasDeLaCarcasa(pagina);
      for (const [nombre, pieza] of Object.entries(CARCASA_DE_LA_PORTADA)) {
        assert.ok(piezas[nombre], `${nombre}: está`);
        assert.equal(normalizarPieza(piezas[nombre]), normalizarPieza(pieza), nombre);
      }
    });
  }

  // publico.css (spec 2026-10-18-rediseno-publico, 5.4): solo en las 5 públicas, con la misma versión que main.css, así las
  // insignias pastel no llegan a administración
  const PUBLICAS = ['index.html', 'datasets.html', 'dataset.html', 'calendario.html', 'contacto.html'];
  for (const pagina of paginas) {
    it(`${pagina}: publico.css ${PUBLICAS.includes(pagina) ? 'con' : 'sin'} ?v=${VERSION_CSS}`, () => {
      const usos = leer(pagina).match(/css\/publico\.css[^"]*"/g) || [];
      assert.deepEqual(usos, PUBLICAS.includes(pagina) ? [`css/publico.css?v=${VERSION_CSS}"`] : []);
    });
  }

  it('index.html: sin <style> propio ni Chart.js', () => {
    const html = leer('index.html');
    assert.doesNotMatch(html, /<style/);
    assert.doesNotMatch(html, /chart\.js|chart\.umd/i);
  });

  // publico.css va después de main.css: pisa lo que haga falta solo en las públicas
  it('index.html: main.css y después publico.css', () => {
    const html = leer('index.html');
    assert.ok(html.indexOf('css/main.css?v=') !== -1 && html.indexOf('css/main.css?v=') < html.indexOf('css/publico.css?v='));
  });

  // Las otras cuatro públicas: su <style> se fue a publico.css, que va después de main.css
  for (const pagina of PUBLICAS.filter(p => p !== 'index.html')) {
    it(`${pagina}: sin <style> propio, main.css y después publico.css`, () => {
      const html = leer(pagina);
      assert.doesNotMatch(html, /<style/);
      assert.ok(html.indexOf('css/main.css?v=') !== -1 && html.indexOf('css/main.css?v=') < html.indexOf('css/publico.css?v='));
    });
  }

  // Vista previa al compartir un link (spec 2026-10-18-rediseno-publico, 12): metas Open Graph absolutas en las 5 públicas.
  // og:url, uno solo y el de su página, solo en las que no llevan parámetros: en datasets.html y dataset.html una URL fija sin
  // ?id= ni filtros haría que Facebook o LinkedIn mandaran a la página sin el dataset o sin los filtros (Ruling 15)
  const OG_URL = {
    'index.html': 'https://rpad.mcrmodernizacion.gob.ar/',
    'datasets.html': null,
    'dataset.html': null,
    'calendario.html': 'https://rpad.mcrmodernizacion.gob.ar/calendario.html',
    'contacto.html': 'https://rpad.mcrmodernizacion.gob.ar/contacto.html'
  };
  for (const [pagina, url] of Object.entries(OG_URL)) {
    it(`${pagina}: vista previa al compartir, ${url ? `con og:url ${url}` : 'sin og:url'}`, () => {
      const html = leer(pagina);
      for (const meta of ['og:title', 'og:description', 'og:image', 'og:type', 'og:locale', 'twitter:card']) {
        assert.match(html, new RegExp(`<meta (property|name)="${meta}" content="[^"]+">`), meta);
      }
      assert.ok(html.includes('content="https://rpad.mcrmodernizacion.gob.ar/img/compartir.png"'));
      assert.ok(html.includes('<meta name="theme-color" content="#1A365D">'));
      assert.equal(html.match(/og:url/g)?.length ?? 0, url ? 1 : 0, 'og:url');
      if (url) assert.ok(html.includes(`<meta property="og:url" content="${url}">`), url);
    });
  }

  // robots.txt: cerrado para todos (buscadores incluidos), salvo los robots que arman la vista previa, y solo en las públicas
  it('robots.txt: los buscadores siguen afuera y los robots de vista previa entran a las públicas', () => {
    const robots = fs.readFileSync(new URL('robots.txt', DIRECTORIO), 'utf8').replace(/\r/g, '');
    assert.match(robots, /User-agent: \*\nDisallow: \/\s*$/);
    for (const robot of ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'TelegramBot', 'WhatsApp']) assert.ok(robots.includes(`User-agent: ${robot}`), robot);
    assert.ok(robots.includes('Allow: /img/compartir.png'));
    assert.doesNotMatch(robots, /Allow: \/admin|Allow: \/api/);
  });

  // Contacto (spec 2026-10-18-rediseno-publico, 10): solo se restila, contacto.js no cambia
  it('contacto.html: los campos con su label y sin api.js', () => {
    const html = leer('contacto.html');
    for (const id of ['nombre', 'email', 'tipo', 'mensaje']) assert.match(html, new RegExp(`<label for="${id}"`), id);
    assert.doesNotMatch(html, /js\/api\.js/);
    assert.ok(html.includes('Belgrano'), 'conserva la dirección postal');
  });

  it('contacto.html: los ids, las opciones y los límites que usa contacto.js', () => {
    const html = leer('contacto.html');
    for (const id of ['contacto-form', 'nombre', 'email', 'tipo', 'mensaje', 'char-count', 'btn-enviar', 'message-container']) {
      assert.equal(html.match(new RegExp(`id="${id}"`, 'g'))?.length, 1, id);
    }
    const opciones = [...html.matchAll(/<option value="([^"]*)">/g)].map(m => m[1]);
    assert.deepEqual(opciones, ['', 'consulta-general', 'solicitud-datos', 'reporte-error', 'sugerencia-dataset', 'otro']);
    assert.match(html, /<input type="text" id="nombre"[^>]* maxlength="100"/);
    assert.match(html, /<textarea id="mensaje"[^>]* maxlength="2000"/);
    // contacto.js marca el contador (warning y danger) en el padre de #char-count
    assert.match(html, /class="char-counter"[^>]*><span id="char-count">0<\/span>/);
  });

  it('login.html: el logo es logo-2025-blanco.png', () => {
    assert.ok(leer('login.html').includes('src="img/logo-2025-blanco.png"'));
  });
});
