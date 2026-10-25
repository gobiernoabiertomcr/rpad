import { fuentesDe } from '../services/seguimientoDatos.js';
import {
  casosDe, vistaDe, indiceMesAMes, antiguedadDeVencidos, estadosAl, trabajoDelAnio, areasYTemas
} from '../services/metricasReglas.js';
import { cintasDeLaVista } from '../services/metricasCinta.js';
import { claveDeLaVista, leerFoto, aniosConFoto as leerAniosConFoto } from '../services/metricasFoto.js';
import { opcionesDeMetricas, aniosDeMetricas } from '../services/metricasOpciones.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';

// Métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7, 2.3 y 3): GET /api/metricas devuelve todo lo que dibuja la pestaña
// Métricas, de solo lectura y para todos los roles con sesión (authMiddleware, sin adminOnly). El servidor calcula y la página dibuja:
// las opciones del pedido y qué años se ven y cómo están en services/metricasOpciones.js, las reglas en services/metricasReglas.js,
// la cinta en services/metricasCinta.js y la foto del 31/12 en services/metricasFoto.js. El año en curso se calcula en vivo, al día de
// hoy; un año cerrado sale de su foto, que no se recalcula nunca (ni se destilda: se calculó con todos); uno cerrado que todavía no
// tiene foto (hasta el 10/01, o si una corrida no pudo sacarla) se calcula en vivo «al 31/12», como la va a sacar la corrida, con el
// aviso de la foto.

const SIN_METRICAS = { success: false, error: 'No hay métricas de ese año' };
const ERROR_AL_OBTENER = { success: false, error: 'Error al obtener las métricas' };

// Los títulos de los destildados que existen, en el orden pedido (para «Calculado sin 1 dataset: Parque Automotor.»)
const titulosDe = (fuentesPorDataset, sin) => sin.map((id) => fuentesPorDataset.get(id)?.dataset?.titulo)
  .filter((titulo) => typeof titulo === 'string' && titulo !== '');

// Las métricas de un año en vivo, con las fuentes de la base de hoy y las mismas cuentas que la foto (datosDeLaFoto): los casos al día
// `al` (hoy, o el 31/12) y, con ellos, la vista, sus cintas, el contexto, el trabajo del RPAD y las áreas, sin los destildados
const enVivo = (fuentesPorDataset, { anio, al, estadistico, dias, sin }) => {
  const casos = casosDe(fuentesPorDataset, { hoy: al });
  const vista = vistaDe(casos, { anio, al, estadistico, dias, sin });
  const opciones = { anio, al, sin };
  return {
    vista,
    cinta: cintasDeLaVista(vista, { estadistico, dias }),
    contexto: {
      indice: indiceMesAMes(fuentesPorDataset, opciones),
      antiguedad: antiguedadDeVencidos(fuentesPorDataset, opciones),
      estados: estadosAl(fuentesPorDataset, opciones)
    },
    trabajo: trabajoDelAnio(fuentesPorDataset, casos, { ...opciones, estadistico }),
    areas: areasYTemas(fuentesPorDataset, opciones),
    sin_titulos: titulosDe(fuentesPorDataset, sin)
  };
};

// Las métricas de un año con foto, tal como las guardó (Ruling 16: nunca se recalculan): la vista y las cintas de la combinación de
// los selectores, el trabajo de su estadístico, el contexto y las áreas. En un año con foto no se destilda. Tira si a la foto le falta
// la combinación pedida: una foto que no se puede leer no pasa por «no hay métricas»
const deLaFoto = ({ anio, datos }, { estadistico, dias }) => {
  const clave = claveDeLaVista(estadistico, dias);
  const vista = datos.vistas[clave];
  const cinta = datos.cintas[clave];
  const trabajo = datos.trabajo[estadistico];
  if (!vista || !cinta || !trabajo) throw new Error(`La foto de ${anio} no se puede leer`);
  return { vista, cinta, contexto: datos.contexto, trabajo, areas: datos.areas, sin_titulos: [] };
};

// Todo lo que muestra la pestaña Métricas para `query` (los parámetros de la URL; ver opcionesDeMetricas), o null si ese año no tiene
// métricas (un año anterior a 2026 o futuro). `hoy`: el día de hoy (por defecto, el de Argentina). Lee la base: los años con foto y,
// según el año, la foto o las fuentes de todos los datasets (fuentesDe). Tira si algo falla (también con una foto que no se puede
// leer). Devuelve:
// { anio, al, en_vivo, aviso_foto, anios, vista, cinta: { externa, interna }, contexto: { indice, antiguedad, estados }, trabajo,
//   areas, sin_titulos }
// - anio, al, en_vivo y aviso_foto: los de opcionesDeMetricas; anios: los años que se pueden elegir (aniosDeMetricas);
// - vista: la de vistaDe con lo elegido (el circuito, los resultados, los casos y «Para completar»); cinta: la de cada gestión
//   (cintaDeMetricas; null si no se dibuja);
// - contexto: el índice mes a mes (indiceMesAMes), la antigüedad de los vencidos (antiguedadDeVencidos) y los estados de `al`
//   (estadosAl); trabajo: el del RPAD con el estadístico elegido (trabajoDelAnio); areas: areasYTemas;
// - sin_titulos: los títulos de los destildados que existen, en el orden pedido ([] si no hay, y siempre en un año con foto).
export const metricasDe = async (query, { hoy = hoyArgentina() } = {}) => {
  const aniosConFoto = await leerAniosConFoto();
  const opciones = opcionesDeMetricas(query, { hoy, aniosConFoto });
  if (opciones === null) return null;
  const periodo = {
    anio: opciones.anio, al: opciones.al, en_vivo: opciones.en_vivo, aviso_foto: opciones.aviso_foto,
    anios: aniosDeMetricas({ hoy })
  };
  if (opciones.en_vivo) return { ...periodo, ...enVivo(await fuentesDe(null), opciones) };
  const foto = await leerFoto(opciones.anio);
  if (foto === null) return null;
  return { ...periodo, ...deLaFoto(foto, opciones) };
};

// GET /api/metricas?anio=&estadistico=&dias=&gestion=&sin=: lo de metricasDe. Un año sin métricas da 404 en JSON
export const verMetricas = async (req, res) => {
  try {
    const data = await metricasDe(req.query);
    if (data === null) return res.status(404).json(SIN_METRICAS);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener las métricas:', error);
    res.status(500).json(ERROR_AL_OBTENER);
  }
};
