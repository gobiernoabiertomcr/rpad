// Todas las páginas cargan las versiones nuevas de los scripts compartidos, y el menú de Administración tiene "Usuarios".
// Al cambiar alguno de estos scripts, subir la versión en todas las páginas y en VERSION.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const VERSION = '20261023';
// usuarios.js cambió después (persona autorizada con licencia superpuesta en parte): su versión es propia
const VERSION_PANTALLAS = '20261024';
// correos.js cambió después (Correos en pestañas): su versión es propia
const VERSION_CORREOS = '20261102';
// perfil.js cambió después (Mi Perfil en pestañas): su versión es propia
const VERSION_PERFIL = '20261101';
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
