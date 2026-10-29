import pool from '../config/database.js';
import { fuentesDe } from '../services/seguimientoDatos.js';
import {
  casosDe, vistaDe, contextoDelAnio, trabajoDelAnio, areasYTemas, textoDeLaFranja, etapasDe, conAnterior
} from '../services/metricasReglas.js';
import { cintasDeLaVista } from '../services/metricasCinta.js';
import { claveDeLaVista, leerFoto, etapasDeLaFoto, aniosConFoto as leerAniosConFoto } from '../services/metricasFoto.js';
import { opcionesDeMetricas, aniosDeMetricas, fotosDeMetricas } from '../services/metricasOpciones.js';
import { leerCalendario } from '../services/feriadosDatos.js';
import { exigirLaTabla } from '../services/feriadosReglas.js';
import { hoyArgentina, ahoraArgentina } from '../services/notasDigitalesCalendario.js';
import { nombreCorto, disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import { renderMetricasDelAnio } from '../services/reportesMetricasPdf.js';
import { nombreDelReporte } from '../services/reportesNombres.js';

// Métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7, 2.3 y 3): GET /api/metricas devuelve todo lo que dibuja la pestaña
// Métricas, de solo lectura y para todos los roles con sesión (authMiddleware, sin adminOnly), y GET /api/metricas/pdf, lo mismo en el
// PDF «Métricas del año» (services/reportesMetricasPdf.js). El servidor calcula y la página dibuja:
// las opciones del pedido y qué años se ven y cómo están en services/metricasOpciones.js, las reglas en services/metricasReglas.js,
// la cinta en services/metricasCinta.js y la foto del 31/12 en services/metricasFoto.js. El año en curso se calcula en vivo, al día de
// hoy; un año cerrado sale de su foto, que no se recalcula nunca (ni se destilda: se calculó con todos); uno cerrado que todavía no
// tiene foto (hasta el 10/01, o si una corrida no pudo sacarla) se calcula en vivo «al 31/12», como la va a sacar la corrida, con el
// aviso de la foto. Los datos del reporte «Ciclo de vida del dato» (cicloDeVidaDe: las etapas del circuito, con el año anterior) leen el
// año de la misma manera.
// Los días hábiles se cuentan con el calendario único (spec 2026-10-27-feriados-en-notas, 5: los 9 fijos y los feriados de la tabla,
// el de las corridas), que se lee una sola vez por pedido y solo si algún año va en vivo: un año con foto se lee de ella, que ya los
// trae contados (no lee la tabla). Si la tabla no se puede leer (leerCalendario cae a los 9 fijos), lo que va en vivo tira
// (exigirLaTabla, spec, 2): Métricas no cuenta con los 9 fijos como si fueran la tabla, y la API responde el 500 de siempre.

// (también lo usa el PDF «Datos para completar», controllers/reportesController.js)
export const SIN_METRICAS = Object.freeze({ success: false, error: 'No hay métricas de ese año' });
const ERROR_AL_OBTENER = { success: false, error: 'Error al obtener las métricas' };
const ERROR_AL_GENERAR_PDF = { success: false, error: 'Error al generar el PDF de las métricas' };

// Los títulos de los destildados que existen, en el orden pedido (para «Calculado sin 1 dataset: Parque Automotor.»)
const titulosDe = (fuentesPorDataset, sin) => sin.map((id) => fuentesPorDataset.get(id)?.dataset?.titulo)
  .filter((titulo) => typeof titulo === 'string' && titulo !== '');

// Las métricas de un año en vivo, con las fuentes de la base de hoy y las mismas cuentas que la foto (datosDeLaFoto): los casos al día
// `al` (hoy, o el 31/12) y, con ellos, la vista, sus cintas, el contexto, el trabajo del RPAD y las áreas, sin los destildados.
// `calendario`: el de la tabla (exigirLaTabla), con el que los casos y la vista cuentan los días hábiles (el contexto, el trabajo y las
// áreas no cuentan días hábiles)
const enVivo = (fuentesPorDataset, { anio, al, estadistico, dias, sin, calendario }) => {
  const casos = casosDe(fuentesPorDataset, { hoy: al, calendario });
  const vista = vistaDe(casos, { anio, al, estadistico, dias, sin, calendario });
  const opciones = { anio, al, sin };
  const titulos = titulosDe(fuentesPorDataset, sin);
  return {
    vista,
    cinta: cintasDeLaVista(vista, { estadistico, dias }),
    contexto: contextoDelAnio(fuentesPorDataset, opciones),
    trabajo: trabajoDelAnio(fuentesPorDataset, casos, { ...opciones, estadistico }),
    areas: areasYTemas(fuentesPorDataset, opciones),
    sin_titulos: titulos,
    sin_texto: textoDeLaFranja(titulos)
  };
};

// Las métricas de un año con foto, tal como las guardó (Ruling 16: nunca se recalculan): la vista y las cintas de la combinación de
// los selectores, el trabajo de su estadístico, el contexto y las áreas. En un año con foto no se destilda. Tira si a la foto le falta
// la combinación pedida: una foto que no se puede leer no pasa por «no hay métricas». `foto`: la de leerFoto. (También la lee así el
// Informe anual, controllers/reportesController.js)
export const deLaFoto = ({ anio, datos }, { estadistico, dias }) => {
  const clave = claveDeLaVista(estadistico, dias);
  const vista = datos.vistas[clave];
  const cinta = datos.cintas[clave];
  const trabajo = datos.trabajo[estadistico];
  if (!vista || !cinta || !trabajo) throw new Error(`La foto de ${anio} no se puede leer`);
  return { vista, cinta, contexto: datos.contexto, trabajo, areas: datos.areas, sin_titulos: [], sin_texto: '' };
};

// Todo lo que muestra la pestaña Métricas para `query` (los parámetros de la URL; ver opcionesDeMetricas), o null si ese año no tiene
// métricas (un año anterior a 2026 o futuro). `hoy`: el día de hoy (por defecto, el de Argentina). Lee la base: los años con foto y,
// según el año, la foto o el calendario (los feriados de la tabla) y las fuentes de todos los datasets (fuentesDe). Tira si algo falla
// (también con una foto que no se puede leer o, en vivo, si la tabla de los feriados no se puede leer). Devuelve:
// { anio, al, en_vivo, aviso_foto, anios, fotos, vista, cinta: { externa, interna }, contexto: { indice, indice_vacio, antiguedad,
//   estados }, trabajo, areas, sin_titulos, sin_texto }
// - anio, al, en_vivo y aviso_foto: los de opcionesDeMetricas; anios: los años que se pueden elegir (aniosDeMetricas); fotos: esos
//   años con su foto y lo que dice, sin ella, el botón del Informe anual de la pestaña Reportes (fotosDeMetricas);
// - vista: la de vistaDe con lo elegido (el circuito, los resultados, los casos y «Para completar»); cinta: la de cada gestión
//   (cintaDeMetricas; null si no se dibuja);
// - contexto: contextoDelAnio, el índice mes a mes (indiceMesAMes, y si no hay nada que dibujar, por qué), la antigüedad de los
//   vencidos (antiguedadDeVencidos) y los estados de `al` (estadosAl); trabajo: el del RPAD con el estadístico elegido
//   (trabajoDelAnio); areas: areasYTemas;
// - sin_titulos: los títulos de los destildados que existen, en el orden pedido ([] si no hay, y siempre en un año con foto); sin_texto:
//   la franja de la pestaña con esos títulos, ya armada («Calculado sin 1 dataset: Parque Automotor.», textoDeLaFranja; '' sin ninguno),
//   la misma leyenda que la píldora del PDF.
export const metricasDe = async (query, { hoy = hoyArgentina() } = {}) => (await metricasConOpciones(query, { hoy }))?.data ?? null;

// Lo de metricasDe (`data`) y las opciones con que se calculó (`opciones`, las de opcionesDeMetricas: el PDF dice en su píldora el
// estadístico y los días), o null si ese año no tiene métricas. El calendario se lee solo en vivo, después de saber que el año va en
// vivo (un año con foto no lee la tabla) y antes de las fuentes; sin la tabla, tira (exigirLaTabla)
const metricasConOpciones = async (query, { hoy }) => {
  const aniosConFoto = await leerAniosConFoto();
  const opciones = opcionesDeMetricas(query, { hoy, aniosConFoto });
  if (opciones === null) return null;
  const periodo = {
    anio: opciones.anio, al: opciones.al, en_vivo: opciones.en_vivo, aviso_foto: opciones.aviso_foto,
    anios: aniosDeMetricas({ hoy }), fotos: fotosDeMetricas({ hoy, aniosConFoto })
  };
  if (opciones.en_vivo) {
    const calendario = exigirLaTabla(await leerCalendario());
    return { opciones, data: { ...periodo, ...enVivo(await fuentesDe(null), { ...opciones, calendario }) } };
  }
  const foto = await leerFoto(opciones.anio);
  if (foto === null) return null;
  return { opciones, data: { ...periodo, ...deLaFoto(foto, opciones) } };
};

// Las etapas del Ciclo de vida del dato de un año leído como lo lee la pestaña (`periodo`: las opciones de opcionesDeMetricas). En vivo,
// etapasDe con los casos de todos los datasets al día `al` (hoy, o el 31/12 de un año cerrado que todavía no tiene foto), contados con
// el calendario de la tabla; con foto, las de la foto, que no se recalculan (etapasDeLaFoto, que tira si no se pueden leer) ni leen la
// tabla. null si la foto ya no está (se borró entre leer los años con foto y leerla, como en metricasConOpciones). `fuentes`: la función
// que da las fuentes de todos los datasets (fuentesDe); `pedirCalendario`: la que da el calendario de la tabla (una promesa, que tira
// si la tabla no se puede leer); las dos se piden solo en vivo
const etapasDelPeriodo = async (periodo, fuentes, pedirCalendario) => {
  if (periodo.en_vivo) {
    const calendario = await pedirCalendario();
    const casos = casosDe(await fuentes(), { hoy: periodo.al, calendario });
    return etapasDe(casos, { anio: periodo.anio, al: periodo.al, calendario });
  }
  const foto = await leerFoto(periodo.anio);
  return foto === null ? null : etapasDeLaFoto(foto);
};

// Los datos del reporte «Ciclo de vida del dato» (spec 2026-10-25-ciclo-de-vida-del-dato, 3.2 y 3.4) para `query` (los parámetros de la
// URL: solo cuenta el año, leído como en metricasDe; el reporte siempre cuenta todo, así que los selectores y los destildados de la
// pestaña no cambian nada), o null si ese año no tiene métricas (anterior a 2026 o futuro: el 404). `hoy`: el día de hoy (por defecto,
// el de Argentina). El año se lee como en la pestaña: el en curso, en vivo al día de hoy; uno cerrado, de su foto, o en vivo al 31/12 si
// todavía no la tiene (Ruling 17, con su aviso). El año anterior, para «Año anterior: …», se lee como se lee ese año (de su foto, o en
// vivo al 31/12), y antes de PRIMER_ANIO no hay (opcionesDeMetricas da null). El calendario (los feriados de la tabla) y las fuentes se
// piden una sola vez para los dos años, y solo si alguno va en vivo (siempre después de leer los años con foto). Tira si algo falla
// (también con una foto que no se puede leer o, en vivo, si la tabla de los feriados no se puede leer: exigirLaTabla). Devuelve
// { anio, al, en_vivo, aviso_foto, etapas }:
// - anio, al, en_vivo y aviso_foto: los de opcionesDeMetricas (el aviso de un año cerrado sin foto, para la píldora del PDF; si no,
//   null);
// - etapas: las de etapasDe del año ({ anio, al, externa, interna, aclaracion_de_la_hoja }) con conAnterior aplicado: cada etapa con
//   textos.anterior («Año anterior: mediana de 29 días hábiles», «… mediana en el día» o «Año anterior: no hay»).
export const cicloDeVidaDe = async (query, { hoy = hoyArgentina() } = {}) => {
  const aniosConFoto = await leerAniosConFoto();
  const opciones = opcionesDeMetricas(query, { hoy, aniosConFoto });
  if (opciones === null) return null;
  let pedidas = null;
  const fuentes = () => {
    pedidas ??= fuentesDe(null);
    return pedidas;
  };
  let leido = null;
  const calendario = () => {
    leido ??= leerCalendario().then(exigirLaTabla);
    return leido;
  };
  const etapas = await etapasDelPeriodo(opciones, fuentes, calendario);
  if (etapas === null) return null;
  const previo = opcionesDeMetricas({ anio: opciones.anio - 1 }, { hoy, aniosConFoto });
  const anteriores = previo === null ? null : await etapasDelPeriodo(previo, fuentes, calendario);
  return {
    anio: opciones.anio, al: opciones.al, en_vivo: opciones.en_vivo, aviso_foto: opciones.aviso_foto,
    etapas: conAnterior(etapas, anteriores)
  };
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

// Las métricas manuales de Gestión de `anio` (spec 2.2: van en «El trabajo del RPAD»; las carga administración en la tabla de siempre,
// metricas_manuales): [{ tipo, anio, mes, cantidad }], en el orden de la pestaña (del mes más nuevo al más viejo y por tipo). Por el año
// (no con la ventana de meses de /gestion/metricas-manuales, que depende del reloj de la base) y siempre de la base de hoy, también en un
// año con foto, como la pestaña
const metricasManualesDe = async (anio) => {
  const [filas] = await pool.execute('SELECT tipo, anio, mes, cantidad FROM metricas_manuales WHERE anio = ? ORDER BY mes DESC, tipo', [anio]);
  return filas.map((fila) => ({ tipo: fila.tipo, anio: Number(fila.anio), mes: Number(fila.mes), cantidad: Number(fila.cantidad) }));
};

// El PDF «Métricas del año» para `query` (los parámetros de GET /api/metricas: lo mismo que la API para la misma consulta, y un año con
// foto sale de la foto), con la combinación elegida y lo destildado en su píldora y las métricas manuales del año. `generado`: { momento:
// 'AAAA-MM-DD HH:MM:SS' (hora argentina: su día es hoy), por: nombre corto o null }. { anio, pdf }, o null si ese año no tiene métricas
export const pdfDeMetricas = async (query, generado) => {
  const calculadas = await metricasConOpciones(query, { hoy: generado.momento.slice(0, 10) });
  if (calculadas === null) return null;
  const { opciones, data } = calculadas;
  const manuales = await metricasManualesDe(data.anio);
  const pdf = await renderMetricasDelAnio({ ...data, estadistico: opciones.estadistico, dias: opciones.dias, manuales }, { generado });
  return { anio: data.anio, pdf };
};

// GET /api/metricas/pdf?anio=&estadistico=&dias=&sin=: el PDF de pdfDeMetricas, con el nombre corto de quien lo genera y la hora
// (argentina) en el pie. Un año sin métricas da el mismo 404 en JSON. El archivo se llama «Metricas-RPAD-AAAA.pdf» (disposicionDeAdjunto
// lo deja apto para el encabezado HTTP).
export const descargarMetricasPdf = async (req, res) => {
  try {
    // Un solo instante para el pie y para "hoy" (que no queden en días distintos a la medianoche)
    const momento = ahoraArgentina();
    const [[usuario]] = await pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]);
    const resultado = await pdfDeMetricas(req.query, { momento, por: nombreCorto(usuario?.nombre_completo) });
    if (resultado === null) return res.status(404).json(SIN_METRICAS);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('metricas', { anio: resultado.anio })));
    res.send(resultado.pdf);
  } catch (error) {
    console.error('Error al generar el PDF de las métricas:', error);
    res.status(500).json(ERROR_AL_GENERAR_PDF);
  }
};
