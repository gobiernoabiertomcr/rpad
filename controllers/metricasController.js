import pool from '../config/database.js';
import { fuentesDe } from '../services/seguimientoDatos.js';
import { casosDe, vistaDe, contextoDelAnio, trabajoDelAnio, areasYTemas } from '../services/metricasReglas.js';
import { cintasDeLaVista } from '../services/metricasCinta.js';
import { claveDeLaVista, leerFoto, aniosConFoto as leerAniosConFoto } from '../services/metricasFoto.js';
import { opcionesDeMetricas, aniosDeMetricas, fotosDeMetricas } from '../services/metricasOpciones.js';
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
// aviso de la foto.

// (también lo usa el PDF «Datos para completar», controllers/reportesController.js)
export const SIN_METRICAS = Object.freeze({ success: false, error: 'No hay métricas de ese año' });
const ERROR_AL_OBTENER = { success: false, error: 'Error al obtener las métricas' };
const ERROR_AL_GENERAR_PDF = { success: false, error: 'Error al generar el PDF de las métricas' };

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
    contexto: contextoDelAnio(fuentesPorDataset, opciones),
    trabajo: trabajoDelAnio(fuentesPorDataset, casos, { ...opciones, estadistico }),
    areas: areasYTemas(fuentesPorDataset, opciones),
    sin_titulos: titulosDe(fuentesPorDataset, sin)
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
  return { vista, cinta, contexto: datos.contexto, trabajo, areas: datos.areas, sin_titulos: [] };
};

// Todo lo que muestra la pestaña Métricas para `query` (los parámetros de la URL; ver opcionesDeMetricas), o null si ese año no tiene
// métricas (un año anterior a 2026 o futuro). `hoy`: el día de hoy (por defecto, el de Argentina). Lee la base: los años con foto y,
// según el año, la foto o las fuentes de todos los datasets (fuentesDe). Tira si algo falla (también con una foto que no se puede
// leer). Devuelve:
// { anio, al, en_vivo, aviso_foto, anios, fotos, vista, cinta: { externa, interna }, contexto: { indice, indice_vacio, antiguedad,
//   estados }, trabajo, areas, sin_titulos }
// - anio, al, en_vivo y aviso_foto: los de opcionesDeMetricas; anios: los años que se pueden elegir (aniosDeMetricas); fotos: esos
//   años con su foto y lo que dice, sin ella, el botón del Informe anual de la pestaña Reportes (fotosDeMetricas);
// - vista: la de vistaDe con lo elegido (el circuito, los resultados, los casos y «Para completar»); cinta: la de cada gestión
//   (cintaDeMetricas; null si no se dibuja);
// - contexto: contextoDelAnio, el índice mes a mes (indiceMesAMes, y si no hay nada que dibujar, por qué), la antigüedad de los
//   vencidos (antiguedadDeVencidos) y los estados de `al` (estadosAl); trabajo: el del RPAD con el estadístico elegido
//   (trabajoDelAnio); areas: areasYTemas;
// - sin_titulos: los títulos de los destildados que existen, en el orden pedido ([] si no hay, y siempre en un año con foto).
export const metricasDe = async (query, { hoy = hoyArgentina() } = {}) => (await metricasConOpciones(query, { hoy }))?.data ?? null;

// Lo de metricasDe (`data`) y las opciones con que se calculó (`opciones`, las de opcionesDeMetricas: el PDF dice en su píldora el
// estadístico y los días), o null si ese año no tiene métricas
const metricasConOpciones = async (query, { hoy }) => {
  const aniosConFoto = await leerAniosConFoto();
  const opciones = opcionesDeMetricas(query, { hoy, aniosConFoto });
  if (opciones === null) return null;
  const periodo = {
    anio: opciones.anio, al: opciones.al, en_vivo: opciones.en_vivo, aviso_foto: opciones.aviso_foto,
    anios: aniosDeMetricas({ hoy }), fotos: fotosDeMetricas({ hoy, aniosConFoto })
  };
  if (opciones.en_vivo) return { opciones, data: { ...periodo, ...enVivo(await fuentesDe(null), opciones) } };
  const foto = await leerFoto(opciones.anio);
  if (foto === null) return null;
  return { opciones, data: { ...periodo, ...deLaFoto(foto, opciones) } };
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
