// Las huellas de lo que no cambia (plan 2026-11-07-metricas-cajones-y-ciclos, tarea 0): el sha256 de lo que el Ciclo de vida del dato
// lee de Métricas, tomado sobre el código de antes del plan. Tienen que seguir iguales durante todo el plan, sin tocar este archivo:
// etapasDe (services/metricasReglas.js) arma cada etapa con tramoDelCircuito (el vacío, los pendientes, el orientativo y el en curso) y
// con aclaracionesDe (las aclaraciones de cada etapa y la de la hoja), y el PDF del Ciclo de vida imprime lo que da etapasDe. Los tramos
// de vista.circuito pueden sumar claves, pero las de hoy no cambian de forma ni de contenido; las aclaraciones, lo mismo.
// Puro: los casos reales de tests/metricas-casos.js, sin base de datos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { casosDe, vistaDe, etapasDe, conAnterior, ESTADISTICOS, DIAS, GESTIONES } from '../services/metricasReglas.js';
import { renderCicloDeVida } from '../services/reportesCicloDeVidaPdf.js';
import { contenidoPorHoja } from './pdf-lector.js';
import { mapaDeLosCasos, HOY_DE_LAS_METRICAS } from './metricas-casos.js';

const sha = (valor) => createHash('sha256').update(JSON.stringify(valor)).digest('hex');

const CASOS = casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS });

// Un dataset de los casos para destildar: el 52, de gestión externa, cuyos ciclos cuentan en el aviso y en la carga del año (sin él,
// esas cifras cambian), así la huella también cubre la vista con un destildado
const DESTILDADO = 52;

// Las claves que tiene hoy un tramo de vista.circuito, en su orden
const CLAVES_DE_HOY = ['clave', 'nombre', 'desde_hasta', 'responsable', 'dgmit', 'cifra', 'vacio', 'en_curso', 'pendientes', 'pendientes_texto', 'anticipacion_texto'];
const deHoy = (tramo) => Object.fromEntries(CLAVES_DE_HOY.map((k) => [k, tramo[k]]));
const tramosDeHoy = (v) => GESTIONES.map((g) => v.circuito[g].map(deHoy));

// Las aclaraciones que hay hoy (las de aclaracionesDe): la interna solo tiene ya_vencidos, y las otras dos quedan en null
const ACLARACIONES_DE_HOY = ['ya_vencidos', 'fuente_publica', 'no_requieren_nota'];
const aclaracionesDeHoy = (v) => GESTIONES.map((g) => Object.fromEntries(ACLARACIONES_DE_HOY.map((k) => [k, v.circuito.aclaraciones[g][k] ?? null])));

// Las vistas de las cuatro combinaciones de estadístico y días, con todos y con un destildado
const vistas = () => {
  const todas = [];
  for (const estadistico of ESTADISTICOS) for (const dias of DIAS) for (const sin of [[], [DESTILDADO]]) {
    todas.push(vistaDe(CASOS, { anio: 2026, al: HOY_DE_LAS_METRICAS, estadistico, dias, sin }));
  }
  return todas;
};

// El Ciclo de vida como lo arma tests/reportes-pdf.test.js (cicloDeLosCasos y renderCiclo), con el mismo «Generado el»
const GENERADO_CICLO = { momento: '2026-10-24 15:24:10', por: 'Usuario Ejemplo' };
const cicloDeLosCasos = () => ({
  anio: 2026, al: HOY_DE_LAS_METRICAS, en_vivo: true, aviso_foto: null,
  etapas: conAnterior(etapasDe(casosDe(mapaDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS }), { anio: 2026, al: HOY_DE_LAS_METRICAS }), null)
});

const HUELLAS = {
  tramos: '2617ea5c2a98141bdc6dba9912c6c985a8b6f95cb4a95338691fa909db0774ec',
  aclaraciones: '21c5b7fd46420bd04db7a3f668dc372a37b99e9744a7d14e79eec275542ef226',
  etapas: '1b4c86184f777d56c862be69a7b71164f4eec8e30f0ccd17ef3f9ef23a3e0b20',
  ciclo: 'e1fca4bb7083735ae7b92e337db5c51e75db5ac57c9bc263a0438f5b11c66587'
};

describe('las huellas de lo que no cambia', () => {
  it('los tramos, con sus claves de hoy, en las cuatro combinaciones y con un destildado', () => {
    assert.equal(sha(vistas().map(tramosDeHoy)), HUELLAS.tramos);
  });

  it('las aclaraciones de hoy de las dos gestiones, en las cuatro combinaciones y con un destildado', () => {
    assert.equal(sha(vistas().map(aclaracionesDeHoy)), HUELLAS.aclaraciones);
  });

  it('las etapas del Ciclo de vida', () => {
    assert.equal(sha(etapasDe(CASOS, { anio: 2026, al: HOY_DE_LAS_METRICAS })), HUELLAS.etapas);
  });

  it('el PDF del Ciclo de vida', async () => {
    const pdf = await renderCicloDeVida(cicloDeLosCasos(), { hoy: HOY_DE_LAS_METRICAS, generado: GENERADO_CICLO });
    assert.equal(sha(contenidoPorHoja(pdf)), HUELLAS.ciclo);
  });
});
