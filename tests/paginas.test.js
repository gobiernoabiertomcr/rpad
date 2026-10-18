// Todas las páginas cargan las versiones nuevas de los scripts compartidos, y el menú de Administración tiene "Usuarios".
// Al cambiar alguno de estos scripts, subir la versión en todas las páginas y en VERSION.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const VERSION = '20261105';
// usuarios.js cambió después (persona autorizada con licencia superpuesta en parte): su versión es propia
const VERSION_PANTALLAS = '20261024';
// correos.js cambió después (Correos en pestañas; "Actualización" en el detalle del Libro): su versión es propia
const VERSION_CORREOS = '20261105';
// perfil.js cambió después (Mi Perfil en pestañas; "Datos al" y las actualizaciones registradas): su versión es propia
const VERSION_PERFIL = '20261103';
// admin.js y admin-fechas.js (la lista con filtros por estado, "Datos publicados" y "Próximo pedido"): su versión es propia
const VERSION_ADMIN = '20261103';
// Los scripts del sitio público ("Datos al", "Cargado en el portal" y la próxima prevista; el estado del servidor), que hasta
// ahora se cargaban sin ?v=: su versión es propia
const VERSION_PUBLICAS = '20261105';
// gestion.js (la tasa de cumplimiento y el ranking de áreas sin los eventuales): su versión es propia
const VERSION_GESTION = '20261105';
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

  // El script propio de esta pantalla cambió con los días sin auditor y, después, con la superposición parcial
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
  for (const [pagina, script] of [['datasets.html', 'datasets'], ['dataset.html', 'dataset-detail'], ['calendario.html', 'calendario'], ['index.html', 'dashboard']]) {
    it(`${pagina}: ${script}.js con la versión ${VERSION_PUBLICAS}, después de api.js`, () => {
      const scripts = [...leer(pagina).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
      assert.deepEqual(scripts.filter(src => src.startsWith(`js/${script}.js`)), [`js/${script}.js?v=${VERSION_PUBLICAS}`]);
      const posicion = (nombre) => scripts.findIndex(src => src.startsWith(`js/${nombre}.js`));
      assert.ok(posicion('api') !== -1 && posicion('api') < posicion(script), `${script}.js después de api.js`);
    });
  }

  it(`gestion.html: gestion.js con la versión ${VERSION_GESTION}`, () => {
    assert.ok(leer('gestion.html').includes(`js/gestion.js?v=${VERSION_GESTION}"`));
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
});
