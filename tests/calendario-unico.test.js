// El calendario único (spec 2026-10-27-feriados-en-notas, 1): quien cuenta días hábiles recibe el calendario (CALENDARIO_FIJO,
// calendarioCon o leerCalendario) y no importa las derivadas fijas ni esDiaHabil de services/notasDigitalesCalendario.js, que
// solo saben de los 9 feriados fijos. Lee como texto los import del calendario de cada archivo de services/ y controllers/: un
// olvido falla con el archivo y la función.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// esDiaHabil y las siete derivadas fijas
const PROHIBIDOS = Object.freeze([
  'esDiaHabil', 'proximoDiaHabil', 'diaHabilAnterior', 'ultimoDiaHabilHasta', 'primerDiaHabilDelMes', 'rangoDeAviso',
  'diasHabilesTranscurridos', 'sumarDiasHabiles'
]);
// Los que arman los calendarios: el de los 9 fijos y calendarioCon
const SIEMPRE = Object.freeze(['services/notasDigitalesCalendario.js', 'services/feriadosReglas.js']);
// Métricas y la Agenda de pedidos siguen con los 9 fijos hasta la tanda 2 (spec, sección 5): la tanda 2 los saca
const HASTA_LA_TANDA_2 = Object.freeze(['services/metricasReglas.js', 'services/reportesAgenda.js']);
// Los que todavía no reciben el calendario: cada tarea de la tanda 1 que arregla un archivo lo saca de acá
const PENDIENTES_DE_LA_TANDA_1 = Object.freeze([
  'services/auditoriaReglas.js',
  'services/auditoriaService.js',
  'services/avisosDiariosService.js',
  'services/avisosSuperadminService.js',
  'services/licenciasOficialesService.js',
  'services/licenciasReglas.js',
  'services/miEspacioReglas.js',
  'services/notasDigitales.js',
  'services/notasDigitalesContenido.js',
  'services/notasDigitalesFirmas.js',
  'controllers/licenciasController.js',
  'controllers/notificacionesController.js'
]);

// El calendario, como lo nombra un archivo de services/ ('./') o de controllers/ ('../services/'), entre comillas simples o dobles
const DEL_CALENDARIO = String.raw`(?<comilla>['"])(?:\./|\.\./services/)notasDigitalesCalendario\.js\k<comilla>`;
// import { … } from y export { … } from, también de varias líneas
const CON_NOMBRES = new RegExp(String.raw`\b(?:import|export)\s*\{([^}]*)\}\s*from\s*${DEL_CALENDARIO}`, 'g');
// import * as x from y import(…): no se sabe qué usa del calendario
const DE_TODO = new RegExp(String.raw`\bimport\s*\*\s*as\s+[\w$]+\s+from\s*${DEL_CALENDARIO}`);
const DINAMICO = new RegExp(String.raw`\bimport\s*\(\s*${DEL_CALENDARIO}`);

// Lo que un archivo trae del calendario: los nombres de los import y export con llaves (de cada uno, lo de antes de ' as '), y si
// lo importa entero o con import()
const loQueImporta = (fuente) => {
  const nombres = [];
  for (const [, lista] of fuente.matchAll(CON_NOMBRES)) {
    for (const parte of lista.split(',')) {
      const nombre = parte.split(/\s+as\s+/)[0].trim();
      if (nombre !== '') nombres.push(nombre);
    }
  }
  return { nombres, deTodo: DE_TODO.test(fuente), dinamico: DINAMICO.test(fuente) };
};

// Lo que un archivo no puede importar del calendario, con el archivo y la función
const problemasDe = (archivo, fuente) => {
  const { nombres, deTodo, dinamico } = loQueImporta(fuente);
  const problemas = nombres.filter((nombre) => PROHIBIDOS.includes(nombre)).map((nombre) => `${archivo}: ${nombre}`);
  if (deTodo) problemas.push(`${archivo}: import * as (todo el calendario)`);
  if (dinamico) problemas.push(`${archivo}: import() del calendario`);
  return problemas;
};

// Cada .js de services/ y de controllers/, con su ruta desde la raíz ('services/x.js') y su texto
const ARCHIVOS = ['services', 'controllers'].flatMap((carpeta) => fs.readdirSync(path.join(RAIZ, carpeta))
  .filter((nombre) => nombre.endsWith('.js'))
  .map((nombre) => ({ archivo: `${carpeta}/${nombre}`, fuente: fs.readFileSync(path.join(RAIZ, carpeta, nombre), 'utf8') })));

describe('el calendario único: nadie cuenta días hábiles con los 9 fijos por su cuenta (spec 2026-10-27-feriados-en-notas, 1)', () => {
  it('ningún archivo de services/ ni controllers/ importa del calendario una derivada fija ni esDiaHabil, salvo las excepciones', () => {
    const excepciones = new Set([...SIEMPRE, ...HASTA_LA_TANDA_2, ...PENDIENTES_DE_LA_TANDA_1]);
    const problemas = ARCHIVOS.filter(({ archivo }) => !excepciones.has(archivo))
      .flatMap(({ archivo, fuente }) => problemasDe(archivo, fuente));
    assert.deepEqual(problemas, [], `Importan del calendario fijo (tienen que recibir el calendario): ${problemas.join('; ')}`);
  });

  it('las excepciones de la tanda 2 y las pendientes todavía las importan', () => {
    const porArchivo = new Map(ARCHIVOS.map(({ archivo, fuente }) => [archivo, fuente]));
    for (const archivo of [...SIEMPRE, ...HASTA_LA_TANDA_2, ...PENDIENTES_DE_LA_TANDA_1]) {
      assert.ok(porArchivo.has(archivo), `${archivo} no existe: sacalo de la lista`);
    }
    for (const archivo of [...HASTA_LA_TANDA_2, ...PENDIENTES_DE_LA_TANDA_1]) {
      assert.notDeepEqual(problemasDe(archivo, porArchivo.get(archivo)), [],
        `${archivo} ya no importa del calendario ninguna derivada fija ni esDiaHabil: sacalo de la lista`);
    }
  });

  it('lee los import de varias líneas, con alias, los export … from, import * as e import()', () => {
    const varias = `import {\n  formatoCorto,\n  esDiaHabil as habil, sumarDias,\n  rangoDeAviso\n} from './notasDigitalesCalendario.js';`;
    assert.deepEqual(problemasDe('services/x.js', varias), ['services/x.js: esDiaHabil', 'services/x.js: rangoDeAviso']);
    assert.deepEqual(problemasDe('controllers/y.js', 'import { hoyArgentina, proximoDiaHabil } from "../services/notasDigitalesCalendario.js";'),
      ['controllers/y.js: proximoDiaHabil']);
    assert.deepEqual(problemasDe('services/x.js', "export { diaHabilAnterior } from './notasDigitalesCalendario.js';"),
      ['services/x.js: diaHabilAnterior']);
    assert.deepEqual(problemasDe('services/x.js', "import * as cal from './notasDigitalesCalendario.js';"),
      ['services/x.js: import * as (todo el calendario)']);
    assert.deepEqual(problemasDe('services/x.js', "const cal = await import('./notasDigitalesCalendario.js');"),
      ['services/x.js: import() del calendario']);
    // Lo que no es una derivada fija, o es de otro archivo, no cuenta
    assert.deepEqual(problemasDe('services/x.js', "import { sumarDias, CALENDARIO_FIJO } from './notasDigitalesCalendario.js';"), []);
    assert.deepEqual(problemasDe('services/x.js', "import { esDiaHabilCon } from './feriadosReglas.js';"), []);
  });
});
