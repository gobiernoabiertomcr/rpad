// Los topes de la documentación (spec 2026-11-04-partir-claude-md, sección 10): CLAUDE.md, docs/temas/ y .claude/rules/ no vuelven a crecer
// ni a perder sus punteros. Puro: sin base, sin servidor y sin helpers. Los controles reciben copias en memoria ({ ruta: texto }),
// así se prueba que fallan de verdad; la lectura del repo va aparte, al final.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KB = 1024;
const TOPE_CLAUDE_MD = 30 * KB;
const TOPE_DOCUMENTO = 60 * KB;
const TOPE_REGLA = 4 * KB;
const TOPE_RENGLON = 600;

// ---------- Los controles (puros) ----------

const bytes = (texto) => Buffer.byteLength(texto, 'utf8');

// Los tres topes en bytes. claude es el texto de CLAUDE.md; temas y reglas, { ruta: texto }
export const controlarTamanios = ({ claude, temas, reglas }) => {
  const problemas = [];
  if (bytes(claude) > TOPE_CLAUDE_MD) problemas.push(`CLAUDE.md pesa ${bytes(claude)} bytes (tope ${TOPE_CLAUDE_MD})`);
  for (const [ruta, texto] of Object.entries(temas)) {
    if (bytes(texto) > TOPE_DOCUMENTO) problemas.push(`${ruta} pesa ${bytes(texto)} bytes (tope ${TOPE_DOCUMENTO})`);
  }
  for (const [ruta, texto] of Object.entries(reglas)) {
    if (bytes(texto) > TOPE_REGLA) problemas.push(`${ruta} pesa ${bytes(texto)} bytes (tope ${TOPE_REGLA})`);
  }
  return problemas;
};

// Ningún renglón de más de 600 caracteres (se cuentan caracteres, no unidades de UTF-16)
export const controlarRenglones = (archivos) => {
  const problemas = [];
  for (const [ruta, texto] of Object.entries(archivos)) {
    texto.split(/\r?\n/).forEach((renglon, i) => {
      const largo = Array.from(renglon).length;
      if (largo > TOPE_RENGLON) problemas.push(`${ruta}:${i + 1} tiene ${largo} caracteres (tope ${TOPE_RENGLON})`);
    });
  }
  return problemas;
};

// Lo que dice la sección «El mapa» de CLAUDE.md, hasta el próximo título de su nivel
const seccionDelMapa = (claude) => {
  const desde = claude.search(/^##\s+El mapa\s*$/m);
  if (desde === -1) return '';
  const resto = claude.slice(desde).replace(/^##\s+El mapa\s*$/m, '');
  const hasta = resto.search(/^##\s/m);
  return hasta === -1 ? resto : resto.slice(0, hasta);
};

// Los documentos que nombra un texto: `datasets.md` a secas, entre comillas invertidas, o con su ruta completa
const documentosNombrados = (texto) => {
  const nombres = new Set();
  for (const m of texto.matchAll(/`(?:docs\/temas\/)?([a-z0-9][a-z0-9-]*\.md)`/g)) nombres.add(m[1]);
  for (const m of texto.matchAll(/docs\/temas\/([a-z0-9][a-z0-9-]*\.md)/g)) nombres.add(m[1]);
  return nombres;
};

// Cada documento de docs/temas/ aparece en el mapa
export const controlarMapa = (claude, nombresDeTemas) => {
  const enElMapa = documentosNombrados(seccionDelMapa(claude));
  return nombresDeTemas.filter((nombre) => !enElMapa.has(nombre)).map((nombre) => `${nombre} no está en «El mapa» de CLAUDE.md`);
};

// Cada docs/temas/… citado existe. En una regla también cuentan los nombres a secas de las tablas
export const controlarCitas = ({ claude, temas, reglas }, nombresDeTemas) => {
  const existentes = new Set(nombresDeTemas);
  const problemas = [];
  const revisar = (ruta, texto, aSecas) => {
    const citados = new Set();
    for (const m of texto.matchAll(/docs\/temas\/([a-zA-Z0-9][\w.-]*\.md)/g)) citados.add(m[1]);
    if (aSecas) for (const nombre of documentosNombrados(texto)) citados.add(nombre);
    for (const nombre of citados) if (!existentes.has(nombre)) problemas.push(`${ruta} cita docs/temas/${nombre}, que no existe`);
  };
  revisar('CLAUDE.md', claude, false);
  for (const [ruta, texto] of Object.entries(temas)) revisar(ruta, texto, false);
  for (const [ruta, texto] of Object.entries(reglas)) revisar(ruta, texto, true);
  return problemas;
};

// Los globs de «paths:» de una regla (YAML en lista, un «  - "glob"» por renglón). null si no hay encabezado con paths
export const globsDeUnaRegla = (texto) => {
  const encabezado = texto.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!encabezado) return null;
  const renglones = encabezado[1].split(/\r?\n/);
  const inicio = renglones.findIndex((r) => /^paths:\s*$/.test(r));
  if (inicio === -1) return null;
  const globs = [];
  for (const renglon of renglones.slice(inicio + 1)) {
    const m = renglon.match(/^\s+-\s+(?:"([^"]*)"|'([^']*)'|(\S.*?))\s*$/);
    if (!m) break;
    globs.push(m[1] ?? m[2] ?? m[3]);
  }
  return globs;
};

// Un glob a expresión regular: entiende **, *, ?, {a,b} y [abc]
export const globARegex = (glob) => {
  let fuente = '';
  let llaves = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { fuente += '(?:.*/)?'; i += 2; } else { fuente += '.*'; i += 1; }
    } else if (c === '*') fuente += '[^/]*';
    else if (c === '?') fuente += '[^/]';
    else if (c === '{') { fuente += '(?:'; llaves++; }
    else if (c === '}' && llaves > 0) { fuente += ')'; llaves--; }
    else if (c === ',' && llaves > 0) fuente += '|';
    else if (c === '[') {
      const cierre = glob.indexOf(']', i + 1);
      if (cierre === -1) fuente += '\\[';
      else { fuente += `[${glob.slice(i + 1, cierre).replace(/^!/, '^').replace(/\\/g, '\\\\')}]`; i = cierre; }
    } else fuente += c.replace(/[.+^$()|\\\]}]/g, '\\$&');
  }
  return new RegExp(`^${fuente}$`);
};

// Cada regla: tiene paths:, lleva a un documento y cada glob coincide con algún archivo del repo. Lleva a un documento si lo cita o, en
// las que cruzan todos los temas (los emails, las rutas), si manda a «El mapa» de CLAUDE.md
export const controlarReglas = (reglas, nombresDeTemas, archivosDelRepo) => {
  const existentes = new Set(nombresDeTemas);
  const problemas = [];
  for (const [ruta, texto] of Object.entries(reglas)) {
    const globs = globsDeUnaRegla(texto);
    if (!globs || globs.length === 0) problemas.push(`${ruta} no tiene paths:`);
    else {
      for (const glob of globs) {
        const regex = globARegex(glob);
        if (!archivosDelRepo.some((archivo) => regex.test(archivo))) problemas.push(`${ruta}: el glob «${glob}» no coincide con ningún archivo`);
      }
    }
    const cuerpo = texto.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
    const citados = [...documentosNombrados(cuerpo)].filter((nombre) => existentes.has(nombre));
    const mandaAlMapa = cuerpo.includes('«El mapa» de `CLAUDE.md`');
    if (citados.length === 0 && !mandaAlMapa) problemas.push(`${ruta} no cita ningún documento de docs/temas/ ni manda a «El mapa»`);
  }
  return problemas;
};

// Ningún documento dice «pasó a» seguido de una versión: la historia queda en git
export const controlarPasoA = (archivos) => {
  const problemas = [];
  for (const [ruta, texto] of Object.entries(archivos)) {
    texto.split(/\r?\n/).forEach((renglon, i) => {
      if (/pasó a\s+(?:la\s+versión\s+|v\s*)?[`'"«]*\d/i.test(renglon)) problemas.push(`${ruta}:${i + 1} dice «pasó a» con una versión`);
    });
  }
  return problemas;
};

// .gitignore deja versionar .claude/rules/: «.claude/*» y después «!.claude/rules/», nunca un «.claude/» a secas
export const controlarGitignore = (texto) => {
  const renglones = texto.split(/\r?\n/).map((r) => r.trim());
  const problemas = [];
  const cierra = renglones.findIndex((r) => r === '.claude/*');
  const reabre = renglones.findIndex((r) => r === '!.claude/rules/');
  if (cierra === -1) problemas.push('.gitignore no tiene «.claude/*»');
  if (reabre === -1) problemas.push('.gitignore no tiene «!.claude/rules/»');
  if (cierra !== -1 && reabre !== -1 && reabre < cierra) problemas.push('.gitignore pone «!.claude/rules/» antes de «.claude/*»');
  if (renglones.some((r) => r === '.claude/' || r === '.claude' || r === '/.claude/' || r === '/.claude')) {
    problemas.push('.gitignore ignora .claude/ entero: no se puede reabrir una carpeta ignorada');
  }
  return problemas;
};

// ---------- La lectura del repo ----------

// La raíz sale de este archivo, no del directorio actual: el repo puede estar en un worktree
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALTEAR = new Set(['node_modules', '.git', '.claude', 'database/privado']);

const caminar = (relativa = '') => {
  const archivos = [];
  for (const entrada of fs.readdirSync(path.join(RAIZ, relativa), { withFileTypes: true })) {
    const rel = relativa ? `${relativa}/${entrada.name}` : entrada.name;
    if (SALTEAR.has(rel) || SALTEAR.has(entrada.name) && !relativa) continue;
    if (entrada.isDirectory()) archivos.push(...caminar(rel));
    else if (entrada.isFile()) archivos.push(rel);
  }
  return archivos;
};

const leerCarpeta = (carpeta) => {
  const resultado = {};
  for (const nombre of fs.readdirSync(path.join(RAIZ, carpeta)).filter((n) => n.endsWith('.md')).sort()) {
    resultado[`${carpeta}/${nombre}`] = fs.readFileSync(path.join(RAIZ, carpeta, nombre), 'utf8');
  }
  return resultado;
};

const claude = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8');
const temas = leerCarpeta('docs/temas');
const reglas = leerCarpeta('.claude/rules');
const nombresDeTemas = Object.keys(temas).map((ruta) => path.basename(ruta));
const tres = { 'CLAUDE.md': claude, ...temas, ...reglas };

// ---------- Contra el repo real ----------

describe('la documentación del repo', () => {
  it('hay documentos y reglas que controlar', () => {
    assert.ok(nombresDeTemas.length > 0);
    assert.ok(Object.keys(reglas).length > 0);
  });

  it('respeta los topes de tamaño en bytes', () => {
    assert.deepEqual(controlarTamanios({ claude, temas, reglas }), []);
  });

  it('no tiene renglones de más de 600 caracteres', () => {
    assert.deepEqual(controlarRenglones(tres), []);
  });

  it('cada documento de docs/temas/ está en el mapa de CLAUDE.md', () => {
    assert.deepEqual(controlarMapa(claude, nombresDeTemas), []);
  });

  it('cada documento citado existe', () => {
    assert.deepEqual(controlarCitas({ claude, temas, reglas }, nombresDeTemas), []);
  });

  it('cada regla tiene paths:, lleva a un documento y sus globs coinciden con archivos', () => {
    assert.deepEqual(controlarReglas(reglas, nombresDeTemas, caminar()), []);
  });

  it('ningún documento dice «pasó a» con una versión', () => {
    assert.deepEqual(controlarPasoA(tres), []);
  });

  it('.gitignore deja versionar .claude/rules/', () => {
    assert.deepEqual(controlarGitignore(fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8')), []);
  });
});

// ---------- Los controles fallan de verdad ----------

describe('los controles con copias en memoria', () => {
  const REGLA_BUENA = '---\npaths:\n  - "services/*.js"\n---\n# Una\n\nAntes de cambiarlo, leé `docs/temas/uno.md`.\n';
  const MAPA = '# T\n\n## El mapa\n\n| Tema | Documento |\n|---|---|\n| Uno | `uno.md` |\n| Dos | `dos.md` |\n\n## Otra\n\nTexto\n';
  const REPO = ['services/a.js', 'public/js/x.js', 'tests/b.test.js'];

  it('lo que está bien no da problemas', () => {
    assert.deepEqual(controlarTamanios({ claude: 'x', temas: { 'docs/temas/uno.md': 'x' }, reglas: { r: REGLA_BUENA } }), []);
    assert.deepEqual(controlarRenglones({ a: 'corto\notro' }), []);
    assert.deepEqual(controlarMapa(MAPA, ['uno.md', 'dos.md']), []);
    assert.deepEqual(controlarCitas({ claude: 'ver `docs/temas/uno.md`', temas: {}, reglas: { r: REGLA_BUENA } }, ['uno.md']), []);
    assert.deepEqual(controlarReglas({ r: REGLA_BUENA }, ['uno.md'], REPO), []);
    assert.deepEqual(controlarPasoA({ a: 'La versión pasó a ser otra cosa.' }), []);
    assert.deepEqual(controlarGitignore('node_modules/\n.claude/*\n!.claude/rules/\n'), []);
  });

  it('el tope de bytes: 30 KB, 60 KB y 4 KB justos pasan y uno más falla', () => {
    assert.deepEqual(controlarTamanios({ claude: 'a'.repeat(30 * KB), temas: { t: 'a'.repeat(60 * KB) }, reglas: { r: 'a'.repeat(4 * KB) } }), []);
    assert.equal(controlarTamanios({ claude: 'a'.repeat(30 * KB + 1), temas: {}, reglas: {} }).length, 1);
    assert.equal(controlarTamanios({ claude: '', temas: { t: 'a'.repeat(61 * KB) }, reglas: {} }).length, 1);
    assert.equal(controlarTamanios({ claude: '', temas: {}, reglas: { r: 'a'.repeat(4 * KB + 1) } }).length, 1);
  });

  it('el tope se mide en bytes, no en caracteres', () => {
    const casi = 'á'.repeat(2 * KB + 1); // 2049 caracteres, 4098 bytes
    assert.equal(controlarTamanios({ claude: '', temas: {}, reglas: { r: casi } }).length, 1);
  });

  it('un renglón de 600 caracteres pasa y uno de 601 falla, con su número', () => {
    assert.deepEqual(controlarRenglones({ a: 'x'.repeat(600) }), []);
    const problemas = controlarRenglones({ a: `corto\n${'x'.repeat(601)}` });
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /^a:2 /);
  });

  it('un emoji cuenta como un solo carácter en el renglón', () => {
    assert.deepEqual(controlarRenglones({ a: '😀'.repeat(600) }), []);
  });

  it('un documento fuera del mapa falla', () => {
    const problemas = controlarMapa(MAPA, ['uno.md', 'dos.md', 'tres.md']);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /tres\.md/);
  });

  it('un documento nombrado fuera de «El mapa» no cuenta como estar en el mapa', () => {
    const claudeMd = '# T\n\nVer `tres.md`.\n\n## El mapa\n\n| Uno | `uno.md` |\n\n## Otra\n\n| Tres | `tres.md` |\n';
    assert.deepEqual(controlarMapa(claudeMd, ['uno.md']), []);
    assert.equal(controlarMapa(claudeMd, ['uno.md', 'tres.md']).length, 1);
  });

  it('sin sección «El mapa», todos los documentos fallan', () => {
    assert.equal(controlarMapa('# Sin mapa\n', ['uno.md', 'dos.md']).length, 2);
  });

  it('una cita a un documento que no existe falla, en CLAUDE.md, en un documento y en una regla', () => {
    const cita = 'Ver `docs/temas/fantasma.md`.';
    assert.equal(controlarCitas({ claude: cita, temas: {}, reglas: {} }, ['uno.md']).length, 1);
    assert.equal(controlarCitas({ claude: '', temas: { 'docs/temas/uno.md': cita }, reglas: {} }, ['uno.md']).length, 1);
    assert.equal(controlarCitas({ claude: '', temas: {}, reglas: { r: cita } }, ['uno.md']).length, 1);
  });

  it('en una regla, un nombre a secas de una tabla que no existe falla', () => {
    const regla = '| Si cambiás | Leé |\n|---|---|\n| Algo | `uno.md` |\n| Otro | `fantasma.md` |\n';
    const problemas = controlarCitas({ claude: '', temas: {}, reglas: { r: regla } }, ['uno.md']);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /fantasma\.md/);
  });

  it('un marcador como docs/temas/<tema>.md no es una cita', () => {
    assert.deepEqual(controlarCitas({ claude: 'se actualiza `docs/temas/<tema>.md`', temas: {}, reglas: {} }, ['uno.md']), []);
  });

  it('una regla sin paths: falla, con o sin encabezado', () => {
    assert.equal(controlarReglas({ r: '---\ndescripcion: x\n---\nleé `docs/temas/uno.md`' }, ['uno.md'], REPO).length, 1);
    assert.equal(controlarReglas({ r: '# Sin encabezado\nleé `docs/temas/uno.md`' }, ['uno.md'], REPO).length, 1);
    assert.equal(controlarReglas({ r: '---\npaths:\n---\nleé `docs/temas/uno.md`' }, ['uno.md'], REPO).length, 1);
  });

  it('una regla con un glob sin archivos falla, y nombra el glob', () => {
    const regla = '---\npaths:\n  - "services/*.js"\n  - "nada/**"\n---\nleé `docs/temas/uno.md`';
    const problemas = controlarReglas({ r: regla }, ['uno.md'], REPO);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /nada\/\*\*/);
  });

  it('una regla que cruza todos los temas puede mandar a «El mapa» en lugar de citar un documento', () => {
    const regla = '---\npaths:\n  - "services/*.js"\n---\n# Una\n\nMirá «El mapa» de `CLAUDE.md`.\n';
    assert.deepEqual(controlarReglas({ r: regla }, ['uno.md'], ['services/a.js']), []);
  });

  it('una regla que no cita ningún documento falla', () => {
    const regla = '---\npaths:\n  - "services/*.js"\n---\nNo cita nada.';
    assert.equal(controlarReglas({ r: regla }, ['uno.md'], REPO).length, 1);
  });

  it('una regla que cita solo un documento que no existe también falla', () => {
    const regla = '---\npaths:\n  - "services/*.js"\n---\nleé `docs/temas/fantasma.md`';
    assert.equal(controlarReglas({ r: regla }, ['uno.md'], REPO).length, 1);
  });

  it('un «pasó a» con una versión falla, en sus formas', () => {
    for (const frase of ["`VERSION` pasó a '20261215'.", 'La constante pasó a `\'2026…`', 'Pasó a la versión 3.', 'pasó a v2', 'pasó a 20261215']) {
      assert.equal(controlarPasoA({ a: `antes\n${frase}` }).length, 1, frase);
    }
  });

  it('un «pasó a» sin versión no falla', () => {
    assert.deepEqual(controlarPasoA({ a: 'Pasó a Configuración. Lo que pasó a ser el estado.' }), []);
  });

  it('.gitignore falla si ignora .claude/ a secas, si falta una línea o si están al revés', () => {
    assert.equal(controlarGitignore('.claude/\n').length, 3);
    assert.ok(controlarGitignore('.claude/\n.claude/*\n!.claude/rules/\n').length > 0);
    assert.equal(controlarGitignore('.claude/*\n').length, 1);
    assert.equal(controlarGitignore('!.claude/rules/\n').length, 1);
    assert.equal(controlarGitignore('!.claude/rules/\n.claude/*\n').length, 1);
  });
});

describe('el glob y el encabezado de una regla', () => {
  const coincide = (glob, archivo) => globARegex(glob).test(archivo);

  it('* no cruza carpetas y ** sí', () => {
    assert.ok(coincide('services/*.js', 'services/a.js'));
    assert.ok(!coincide('services/*.js', 'services/sub/a.js'));
    assert.ok(coincide('public/**', 'public/js/a.js'));
    assert.ok(coincide('public/**', 'public/a.html'));
    assert.ok(!coincide('public/**', 'otra/a.html'));
    assert.ok(coincide('**/*.md', 'a.md'));
    assert.ok(coincide('**/*.md', 'docs/temas/a.md'));
    assert.ok(coincide('middleware/**', 'middleware/auth.js'));
  });

  it('{a,b} elige entre alternativas, también en el medio de un nombre', () => {
    assert.ok(coincide('services/feriados{Reglas,Datos}.js', 'services/feriadosReglas.js'));
    assert.ok(coincide('services/feriados{Reglas,Datos}.js', 'services/feriadosDatos.js'));
    assert.ok(!coincide('services/feriados{Reglas,Datos}.js', 'services/feriadosOtro.js'));
    assert.ok(coincide('tests/{a,b-c}.test.js', 'tests/b-c.test.js'));
  });

  it('[abc] elige un carácter y el punto se toma literal', () => {
    assert.ok(coincide('tests/[ab].js', 'tests/a.js'));
    assert.ok(!coincide('tests/[ab].js', 'tests/c.js'));
    assert.ok(!coincide('tests/a.js', 'tests/aXjs'));
  });

  it('un prefijo con * a secas (tests/proyectos-*)', () => {
    assert.ok(coincide('tests/proyectos-*', 'tests/proyectos-api.test.js'));
    assert.ok(!coincide('tests/proyectos-*', 'tests/otros-api.test.js'));
  });

  it('lee la lista de paths: del encabezado', () => {
    assert.deepEqual(globsDeUnaRegla('---\npaths:\n  - "a/*.js"\n  - \'b/**\'\n  - c.js\n---\n# T'), ['a/*.js', 'b/**', 'c.js']);
    assert.equal(globsDeUnaRegla('# sin encabezado'), null);
  });
});

describe('la caminata del repo', () => {
  it('parte de la raíz del repo y saltea node_modules, .git, .claude y database/privado', () => {
    const archivos = caminar();
    assert.ok(archivos.includes('CLAUDE.md'));
    assert.ok(archivos.some((a) => a.startsWith('tests/')));
    assert.ok(!archivos.some((a) => a.startsWith('node_modules/') || a.startsWith('.git/') || a.startsWith('.claude/') || a.startsWith('database/privado/')));
  });
});
