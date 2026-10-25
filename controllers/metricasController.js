import { fuentesDe } from '../services/seguimientoDatos.js';
import {
  ESTADISTICOS, DIAS, PRIMER_ANIO, casosDe, vistaDe, indiceMesAMes, antiguedadDeVencidos, estadosAl, trabajoDelAnio, areasYTemas
} from '../services/metricasReglas.js';
import {
  DIA_DE_LA_FOTO, claveDeLaVista, cintasDeLaVista, leerFoto, aniosConFoto as leerAniosConFoto
} from '../services/metricasFoto.js';
import { esFechaIso, formatoCorto, hoyArgentina } from '../services/notasDigitalesCalendario.js';

// Métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7, 2.3 y 3): GET /api/metricas devuelve todo lo que dibuja la pestaña
// Métricas, de solo lectura y para todos los roles con sesión (authMiddleware, sin adminOnly). El servidor calcula y la página dibuja:
// las reglas son las de services/metricasReglas.js, la cinta la de services/metricasCinta.js y la foto del 31/12 la de
// services/metricasFoto.js. El año en curso se calcula en vivo, al día de hoy; un año cerrado sale de su foto, que no se recalcula
// nunca (ni se destilda: se calculó con todos); entre el 1/1 y el 10/1 el año que terminó todavía no tiene foto, y se calcula en vivo
// «al 31/12», como la va a sacar la corrida del 10/01.

const SIN_METRICAS = { success: false, error: 'No hay métricas de ese año' };
const ERROR_AL_OBTENER = { success: false, error: 'Error al obtener las métricas' };

// El selector de la gestión del circuito (spec, 2.2): la primera es la de entrada
const GESTIONES = Object.freeze(['externa', 'interna']);

const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

// «La foto de 2026 se saca el 10/01/2027»
const avisoDeLaFoto = (anio) => `La foto de ${anio} se saca el ${formatoCorto(`${anio + 1}-${DIA_DE_LA_FOTO}`)}`;

// Cómo se ve `anio` en `hoy`: { al, en_vivo, aviso_foto }, o null si ese año no tiene métricas. Los años van de PRIMER_ANIO (2026) al
// de hoy: el de hoy, en vivo al día de hoy; uno con foto (de los años con foto, `conFoto`, un Set), de su foto al 31/12; el que terminó,
// mientras no tenga foto y hasta el 10/01 (el día en que la saca la corrida de las 8:15), en vivo al 31/12, con el aviso de la foto.
// Después del 10/01, un año sin foto no tiene métricas (spec 3: el selector muestra los años con foto).
const periodoDe = (anio, hoy, conFoto) => {
  const actual = Number(hoy.slice(0, 4));
  if (!Number.isInteger(anio) || anio < PRIMER_ANIO || anio > actual) return null;
  if (anio === actual) return { al: hoy, en_vivo: true, aviso_foto: null };
  const al = `${anio}-12-31`;
  if (conFoto.has(anio)) return { al, en_vivo: false, aviso_foto: null };
  if (anio === actual - 1 && hoy.slice(5) <= DIA_DE_LA_FOTO) return { al, en_vivo: true, aviso_foto: avisoDeLaFoto(anio) };
  return null;
};

// Los años con foto, como un Set de números (lo que no es una lista, ninguno)
const conjuntoDeFotos = (aniosConFoto) => new Set(Array.isArray(aniosConFoto) ? aniosConFoto.map(Number) : []);

// Los años que se pueden ver en `hoy` ('AAAA-MM-DD'), del más viejo al más nuevo (spec 1.6 y 3): de 2026 al de hoy, el de hoy, los que
// tienen foto (`aniosConFoto`, la lista de services/metricasFoto.js) y, hasta el 10/01, el que terminó. [] si `hoy` no es una fecha.
export const aniosDeMetricas = ({ hoy, aniosConFoto } = {}) => {
  if (!esFechaIso(hoy)) return [];
  const conFoto = conjuntoDeFotos(aniosConFoto);
  const actual = Number(hoy.slice(0, 4));
  return Array.from({ length: Math.max(0, actual - PRIMER_ANIO + 1) }, (_, i) => PRIMER_ANIO + i)
    .filter((anio) => periodoDe(anio, hoy, conFoto) !== null);
};

// El año pedido: un entero, o un texto de cuatro dígitos; si no, null (vale el de entrada)
const anioPedido = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor) ? valor : null;
  return typeof valor === 'string' && /^\d{4}$/.test(valor) ? Number(valor) : null;
};

// Uno de `validos` si `valor` lo es; si no, el primero (el de entrada). Un parámetro repetido en la URL llega como lista: no sirve
const elegido = (valor, validos) => (validos.includes(valor) ? valor : validos[0]);

// Los destildados (spec 1.5, `?sin=12,45`): los enteros positivos escritos solo con dígitos (como el id del Seguimiento: '0', '-2',
// '1.5' y '1e3' no lo son), sin repetidos y en el orden pedido. Acepta el texto separado por comas o, si el parámetro se repitió en la
// URL, la lista de textos; lo demás se ignora.
const destildadosDe = (valor) => {
  const textos = (Array.isArray(valor) ? valor : [valor]).filter((texto) => typeof texto === 'string').flatMap((texto) => texto.split(','));
  const ids = textos.map((texto) => texto.trim()).filter((texto) => /^\d+$/.test(texto)).map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)];
};

// Las opciones de un pedido de métricas (`query`: los parámetros de la URL, los de req.query), leídas con tolerancia (Review Focus 2
// del plan): lo que no sirve cae al de entrada (el año de hoy, mediana, días hábiles y gestión externa) o se ignora (un destildado que
// no es un entero positivo). `hoy`: 'AAAA-MM-DD'; `aniosConFoto`: los años con foto. Devuelve { anio, al, en_vivo, aviso_foto,
// estadistico, dias, gestion, sin }: `al`, el día al que se calcula (hoy, o el 31/12 de un año cerrado); `en_vivo`, si se calcula con
// la base de hoy (false: sale de la foto); `aviso_foto`, el aviso de un año que terminó y todavía no tiene foto (si no, null); `sin`,
// los destildados (en un año con foto, ninguno: la foto se calculó con todos). null si el año pedido no tiene métricas (un año anterior
// a 2026, futuro, o cerrado y sin foto después del 10/01: el 404) o si `hoy` no es una fecha. Pura: nunca tira.
export const opcionesDeMetricas = (query, { hoy, aniosConFoto } = {}) => {
  if (!esFechaIso(hoy)) return null;
  const q = objeto(query);
  const anio = anioPedido(q.anio) ?? Number(hoy.slice(0, 4));
  const periodo = periodoDe(anio, hoy, conjuntoDeFotos(aniosConFoto));
  if (periodo === null) return null;
  return {
    anio, ...periodo,
    estadistico: elegido(q.estadistico, ESTADISTICOS), dias: elegido(q.dias, DIAS), gestion: elegido(q.gestion, GESTIONES),
    sin: periodo.en_vivo ? destildadosDe(q.sin) : []
  };
};

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
// métricas. `hoy`: el día de hoy (por defecto, el de Argentina). Lee la base: los años con foto y, según el año, la foto o las fuentes
// de todos los datasets (fuentesDe). Tira si algo falla (también con una foto que no se puede leer). Devuelve:
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
    anios: aniosDeMetricas({ hoy, aniosConFoto })
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
