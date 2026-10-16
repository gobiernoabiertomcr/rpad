// Todas las páginas cargan las versiones nuevas de los scripts compartidos, y el menú de Administración tiene "Usuarios".
// Al cambiar alguno de estos scripts, subir la versión en todas las páginas y en VERSION.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const VERSION = '20261023';
// usuarios.js y correos.js cambiaron después (persona autorizada con licencia superpuesta en parte), y perfil.js con la muestra
// de la firma del personal contratado: su versión es propia
const VERSION_PANTALLAS = '20261024';
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

  // Los scripts propios de estas pantallas cambiaron con los días sin auditor y, después, con la superposición parcial (y el
  // de Mi Perfil, con la muestra de la firma del personal contratado)
  for (const [pagina, script] of [['usuarios.html', 'usuarios'], ['correos.html', 'correos'], ['perfil.html', 'perfil']]) {
    it(`${pagina}: ${script}.js con la versión ${VERSION_PANTALLAS}`, () => {
      assert.ok(leer(pagina).includes(`js/${script}.js?v=${VERSION_PANTALLAS}"`));
    });
  }

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
