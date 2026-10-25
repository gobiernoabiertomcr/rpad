// Casos para las pruebas de las métricas (spec 2026-10-24-metricas-y-reportes, 7). Son los casos reales del Seguimiento
// (tests/seguimiento-casos.js: el dump de producción del 20/10/2026, con los nombres de las personas y los correos cambiados) más lo
// que les falta para las métricas. El dump es anterior a «Recibido el» y a las notas DGMIT:
// - lo importado del Excel (la tabla actualizaciones_recibido) se simula sumándolo a `nuevos` del cambio, con la misma regla que
//   fuentesDe (services/seguimientoDatos.js): completa lo que el cambio no dice y nunca lo pisa;
// - las notas DGMIT las arma cada test con `notaDgmit`.
// Los ayudantes para armar fuentes a mano son los de tests/seguimiento-reglas.test.js, con los mismos nombres inventados.
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS } from './seguimiento-casos.js';

export { CASOS, CATALOGOS, HOY_DE_LOS_CASOS };

// El día de los números reales de la spec y de sus maquetas
export const HOY_DE_LAS_METRICAS = '2026-10-24';

// «Recibido el» y origen importados, por cambio_id (spec, 4). El 7 es la actualización del 04/02/2026 del 52 (Directores Generales
// de Planta Permanente): el área entregó los datos el mismo día de la carga
export const IMPORTADOS = Object.freeze({ 7: Object.freeze({ recibido_el: '2026-02-04', origen_datos: 'area' }) });

const copia = (valor) => structuredClone(valor);

// Lo importado completa `recibido_el` y `origen_datos` de un cambio que no los trae (o los trae en null), sin pisar lo que guardó
const conImportados = (cambios, importados) => cambios.map((c) => {
  const importado = importados?.[c.id];
  if (!importado || !c.nuevos || typeof c.nuevos !== 'object') return c;
  const suma = Object.fromEntries(['recibido_el', 'origen_datos']
    .filter((clave) => c.nuevos[clave] == null && importado[clave] != null).map((clave) => [clave, importado[clave]]));
  return { ...c, nuevos: { ...c.nuevos, ...suma } };
});

// Las fuentes de un caso real, como las da fuentesDe: una copia (cada test puede cambiarla), con los catálogos y lo importado.
// `dataset`: lo que se pisa del dataset; `importados`: por cambio_id (por defecto, IMPORTADOS; {} para ninguno)
export const fuentesDelCaso = (id, { dataset = {}, importados = IMPORTADOS } = {}) => {
  const base = copia(CASOS[id]);
  return { ...base, dataset: { ...base.dataset, ...dataset }, cambios: conImportados(base.cambios, importados), catalogos: CATALOGOS };
};

// Las fuentes con algo más: cada lista de `extra` (cambios, emails, notas, notasDgmit…) se suma al final de la que ya tienen
export const con = (fuentes, extra) => ({
  ...fuentes, ...Object.fromEntries(Object.entries(extra).map(([clave, valor]) => [clave, [...(fuentes[clave] ?? []), ...valor]]))
});

// El Map<id, Fuentes> que da fuentesDe, con estas fuentes
export const mapaDe = (...fuentes) => new Map(fuentes.map((f) => [f.dataset.id, f]));

// Todos los casos reales, en orden de id
export const mapaDeLosCasos = (opciones) => mapaDe(...Object.keys(CASOS).map((id) => fuentesDelCaso(id, opciones)));

// Un cambio 'editar' aprobado (por defecto, del 52)
export const cambio = (datos) => ({
  id: 60, tipo: 'editar', estado: 'aprobado', creado: '2026-03-02 10:00:00', revisado: '2026-03-02 11:00:00',
  propuso: 'Ana María Uno', reviso: 'Bruno Pablo Dos', motivo: null, nuevos: {}, anteriores: {}, dataset_id: 52, ...datos
});

// Un email del registro (notificaciones_log), enviado
export const email = (datos) => ({
  id: 900, tipo: 'externo-5', enviado: '2026-10-05 08:00:00', success: true, cantidad: 1, area: null, area_articulo: null,
  destinatarios: null, error: null, ...datos
});

// Una Nota Digital de aviso, enviada, en la sección de próximos a vencer
export const nota = (datos) => ({
  id: 900, numero: 5, anio: 2026, tipo: 'aviso', gestion: 'externa', fecha: '2026-10-15', estado: 'enviada', enviada: '2026-10-15 08:15:00',
  para: null, cc: null, seccion: 'proximo', vencimiento: '2026-10-31', datos_solicitados: null, creado_por: null, firmante: null, ...datos
});

// Una nota DGMIT como la da fuentesDe
export const notaDgmit = (datos) => ({
  id: 1, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '2026-10-16 09:30:00',
  por: 'Diego Martín Cuatro', por_id: 7, datasets: [], historial: [], ...datos
});

// Las fuentes de un dataset armado a mano (por defecto, el del 52), sin cambios ni avisos
export const solo = (dataset, extra = {}) => ({
  dataset: { ...copia(CASOS[52].dataset), ...dataset }, altasSinDataset: [], cambios: [], historial: [], emails: [], notas: [],
  auditorias: [], notasDgmit: [], catalogos: CATALOGOS, ...extra
});
