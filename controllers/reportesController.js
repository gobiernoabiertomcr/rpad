import pool from '../config/database.js';
import { ahoraArgentina, esFechaIso, sumarDias } from '../services/notasDigitalesCalendario.js';
import { estadoDelDataset } from '../services/fechasDatasetReglas.js';
import { nombreCorto, seguimientoDe, disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import { fuentesDe, idsDeLaLista } from '../services/seguimientoDatos.js';
import { OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { renderEstadoGeneral } from '../services/reportesEstadoGeneralPdf.js';
import { renderPorArea } from '../services/reportesPorAreaPdf.js';
import { renderAvisos, avisosDelPeriodo, MENSAJE_PERIODO_INVALIDO } from '../services/reportesAvisosPdf.js';
import { agendaDe, opcionesDeAgenda } from '../services/reportesAgenda.js';
import { renderAgenda } from '../services/reportesAgendaPdf.js';
import { renderParaCompletar } from '../services/reportesParaCompletarPdf.js';
import { renderInformeAnual, logrosPorProyecto } from '../services/reportesInformeAnualPdf.js';
import { leerFoto } from '../services/metricasFoto.js';
import { nombreDelReporte } from '../services/reportesNombres.js';
import { ESTADISTICOS, DIAS } from '../services/metricasReglas.js';
import { metricasDe, deLaFoto, SIN_METRICAS } from './metricasController.js';

// Los reportes PDF (spec 2026-10-24-metricas-y-reportes, 5), todos con la base de los reportes (services/reportesPdfBase.js): acá van
// las consultas y lo que les toca a los dibujantes. El Cumplimiento ya no está (el ranking de áreas está en Métricas) y el Historial de
// notificaciones pasó a ser Avisos del RPAD.

// Un 500 dice un mensaje fijo por reporte, como los de controllers/metricasController.js: el texto del error (el de mysql2 trae la
// consulta) lo vería cualquier rol, también el lector. El error completo va solo a console.error
const ERROR_AL_GENERAR = Object.freeze({
  estado: 'Error al generar el PDF del Estado general',
  avisos: 'Error al generar el PDF de Avisos del RPAD',
  area: 'Error al generar el PDF del reporte por área',
  agenda: 'Error al generar el PDF de la Agenda de pedidos',
  completar: 'Error al generar el PDF de Datos para completar',
  informe: 'Error al generar el PDF del Informe anual'
});
const responderError = (res, reporte, error) => {
  console.error(`${ERROR_AL_GENERAR[reporte]}:`, error);
  res.status(500).json({ success: false, error: ERROR_AL_GENERAR[reporte] });
};

/**
 * Estado de una fila de los reportes (spec 2026-10-17-fechas-datasets, 11): el mismo cálculo que el listado y el tablero,
 * estadoDelDataset, con la próxima como 'AAAA-MM-DD' (proxima_iso) y la frecuencia en meses (null es eventual).
 * hoy es la fecha de Argentina ('AAAA-MM-DD').
 */
const estadoDeLaFila = (d, hoy) => estadoDelDataset({
  proxima: d.proxima_iso, meses: d.frecuencia_meses ?? null, tipoGestion: d.tipo_gestion, hoy
}).estado;

// Columnas que suman las reglas de las fechas a un SELECT de datasets (alias d) con su frecuencia (alias f):
// los meses de la frecuencia y la próxima y "Datos al" como 'AAAA-MM-DD'
const COLUMNAS_FECHAS = `f.meses AS frecuencia_meses,
             DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS proxima_iso,
             DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al_iso`;

// =====================================================
// REPORTE: Estado General de Datasets
// =====================================================
// El PDF lo dibuja services/reportesEstadoGeneralPdf.js con la base de los reportes (el diseño del anexo): acá van la consulta, el
// estado de cada fila y el pie, con el nombre corto de quien lo pide y la hora argentina (un solo instante para el pie y para "hoy").
export const reporteEstadoGeneral = async (req, res) => {
  try {
    // Obtener datos
    const [datasets] = await pool.execute(`
      SELECT d.*, f.nombre AS frecuencia_nombre, f.dias AS frecuencia_dias,
             ${COLUMNAS_FECHAS},
             a.nombre AS area_nombre, t.nombre AS tema_nombre
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      JOIN areas a ON d.area_id = a.id
      JOIN temas t ON d.tema_principal_id = t.id
      WHERE d.activo = TRUE
      ORDER BY d.proxima_actualizacion ASC
    `);
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const [[usuario]] = await pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]);

    const pdf = await renderEstadoGeneral(datasets.map(d => ({
      titulo: d.titulo,
      area: d.area_nombre,
      frecuencia: d.frecuencia_nombre,
      datos_al: d.datos_al_iso,
      proxima: d.proxima_iso,
      estado: estadoDeLaFila(d, hoy)
    })), { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });

    res.setHeader('Content-Type', 'application/pdf');
    // La fecha de hoy en Argentina, la del PDF (con new Date(), en un servidor en UTC, después de las 21 decía mañana)
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('estado', { hoy })));
    res.send(pdf);
  } catch (error) {
    responderError(res, 'estado', error);
  }
};

// =====================================================
// REPORTE: Avisos del RPAD
// =====================================================
// Reemplaza al Historial de notificaciones (spec 2026-10-24-metricas-y-reportes, 5): el PDF lo dibuja services/reportesAvisosPdf.js
// con la base de los reportes. Acá van el período, las consultas y el pie, con el nombre corto de quien lo pide y la hora argentina (un
// solo instante para el pie y para "hoy"). Las consultas no leen las direcciones (destinatarios, para, cc, cco) ni el texto de los
// errores: no hay cómo que lleguen al PDF.

const PERIODO_INVALIDO = { success: false, error: MENSAJE_PERIODO_INVALIDO };

// El período de GET /reportes/avisos?desde=&hasta=: dos fechas 'AAAA-MM-DD' que existen, con desde <= hasta (se comparan como texto).
// Sin una de las dos (o vacía), la de por defecto: del 1/1 del año de hoy a hoy. null si no es válido.
const periodoDeAvisos = ({ desde, hasta }, hoy) => {
  const conDefecto = (valor, defecto) => (valor === undefined || valor === '' ? defecto : valor);
  const periodo = { desde: conDefecto(desde, `${hoy.slice(0, 4)}-01-01`), hasta: conDefecto(hasta, hoy) };
  return esFechaIso(periodo.desde) && esFechaIso(periodo.hasta) && periodo.desde <= periodo.hasta ? periodo : null;
};

// Los títulos de los datasets por id (también de los dados de baja: el aviso los nombró)
const titulosPorId = async (ids) => {
  if (ids.length === 0) return new Map();
  const [filas] = await pool.query('SELECT id, titulo FROM datasets WHERE id IN (?)', [ids]);
  return new Map(filas.map(d => [d.id, d.titulo]));
};

// Los emails y las notas que pueden caer en el período, con los títulos de sus datasets: lo que recibe avisosDelPeriodo, que deja los
// del período. enviado_at es TIMESTAMP: se lee con UNIX_TIMESTAMP y se pasa a hora argentina (como services/seguimientoDatos.js), y la
// consulta trae un día de más a cada lado (la zona de la sesión de la base puede ser cualquiera: nunca corre más de 14 horas); el día que
// cuenta es el de Argentina. notas_digitales.fecha es DATE: entra justo; enviada_at, DATETIME, ya está en hora argentina.
const avisosDe = async ({ desde, hasta }) => {
  const [[emails], [notas]] = await Promise.all([
    pool.query(
      `SELECT l.id, l.tipo, UNIX_TIMESTAMP(l.enviado_at) ts, l.success, l.datasets_ids
       FROM notificaciones_log l
       WHERE l.enviado_at >= ? AND l.enviado_at < ?
       ORDER BY l.enviado_at, l.id`, [`${sumarDias(desde, -1)} 00:00:00`, `${sumarDias(hasta, 2)} 00:00:00`]
    ),
    pool.query(
      `SELECT n.id, n.numero, n.anio, n.tipo, n.gestion, DATE_FORMAT(n.fecha, '%Y-%m-%d') fecha, n.estado, n.es_prueba,
         DATE_FORMAT(n.enviada_at, '%Y-%m-%d %H:%i:%s') enviada
       FROM notas_digitales n
       WHERE n.es_prueba = 0 AND n.tipo IN ('aviso', 'reiteracion') AND n.fecha BETWEEN ? AND ?
       ORDER BY n.fecha, n.id`, [desde, hasta]
    )
  ]);
  const idsDeEmail = new Map(emails.map(e => [e.id, idsDeLaLista(e.datasets_ids)]));
  const [titulos, [deLasNotas]] = await Promise.all([
    titulosPorId([...new Set([...idsDeEmail.values()].flat())]),
    notas.length === 0 ? [[]] : pool.query(
      `SELECT nd.nota_id, d.titulo FROM notas_digitales_datasets nd JOIN datasets d ON d.id = nd.dataset_id WHERE nd.nota_id IN (?)`,
      [notas.map(n => n.id)]
    )
  ]);
  const titulosDeNota = new Map();
  for (const { nota_id: id, titulo } of deLasNotas) {
    if (!titulosDeNota.has(id)) titulosDeNota.set(id, []);
    titulosDeNota.get(id).push(titulo);
  }
  return avisosDelPeriodo({
    emails: emails.map(e => ({
      tipo: e.tipo, enviado: e.ts == null ? null : ahoraArgentina(new Date(Number(e.ts) * 1000)), success: Boolean(e.success),
      datasets: idsDeEmail.get(e.id).map(id => titulos.get(id)).filter(Boolean)
    })),
    notas: notas.map(n => ({ ...n, datasets: titulosDeNota.get(n.id) ?? [] }))
  }, { desde, hasta });
};

// GET /reportes/avisos?desde=&hasta= (authMiddleware: todos los roles con sesión). Un período que no es válido da 400. El archivo se
// llama «Avisos-RPAD-AAAA-MM-DD.pdf», con la fecha de hoy en Argentina, como el del Por área.
export const reporteAvisos = async (req, res) => {
  try {
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const periodo = periodoDeAvisos(req.query, hoy);
    if (periodo === null) return res.status(400).json(PERIODO_INVALIDO);
    const [[[usuario]], avisos] = await Promise.all([
      pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]),
      avisosDe(periodo)
    ]);
    const pdf = await renderAvisos({ ...periodo, avisos }, { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('avisos', { hoy })));
    res.send(pdf);
  } catch (error) {
    responderError(res, 'avisos', error);
  }
};

// =====================================================
// REPORTE: Por Área Específica
// =====================================================
// El PDF lo dibuja services/reportesPorAreaPdf.js con la base de los reportes (spec 2026-10-24-metricas-y-reportes, 5): la portada,
// con el área, sus contactos, las tarjetas y la lista de sus datasets activos por grupo, y detrás la hoja del Seguimiento de cada uno
// (la de la descarga: seguimientoDe con la cinta del PDF). Acá van las consultas (las fuentes del Seguimiento, en una sola llamada con
// todos los ids), el estado de cada dataset y el pie, con el nombre corto de quien lo pide y la hora argentina (un solo instante para
// el pie y para "hoy"). Los dados de baja no van: ni en la lista ni con una hoja.
export const reportePorArea = async (req, res) => {
  try {
    const { areaId } = req.params;

    // Obtener área
    const [areas] = await pool.execute('SELECT * FROM areas WHERE id = ?', [areaId]);
    if (areas.length === 0) {
      return res.status(404).json({ success: false, error: 'Área no encontrada' });
    }
    const area = areas[0];

    // Los datasets activos del área, por próxima (y por título, los que no tienen): el orden dentro de cada grupo de la portada y
    // de las hojas
    const [datasets] = await pool.execute(`
      SELECT d.id, d.titulo, d.tipo_gestion, ${COLUMNAS_FECHAS}
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      WHERE d.area_id = ? AND d.activo = TRUE
      ORDER BY d.proxima_actualizacion ASC, d.titulo ASC
    `, [area.id]);
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const [[[usuario]], fuentes] = await Promise.all([
      pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]),
      fuentesDe(datasets.map(d => d.id))
    ]);

    // Un dataset sin sus fuentes queda sin Seguimiento: el dibujante no saca un reporte con hojas de menos (tira error: 500)
    const pdf = await renderPorArea({
      area,
      datasets: datasets.map(d => ({
        titulo: d.titulo,
        datos_al: d.datos_al_iso,
        proxima: d.proxima_iso,
        estado: estadoDeLaFila(d, hoy),
        activo: true,
        seguimiento: fuentes.has(d.id) ? seguimientoDe(fuentes.get(d.id), hoy, OPCIONES_CINTA_PDF) : null
      }))
    }, { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });

    res.setHeader('Content-Type', 'application/pdf');
    // La fecha de hoy en Argentina, la del PDF (no la del reloj del servidor)
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('area', { area: area.id, hoy })));
    res.send(pdf);
  } catch (error) {
    responderError(res, 'area', error);
  }
};

// =====================================================
// REPORTE: Agenda de pedidos
// =====================================================
// Qué vence en los próximos 3, 6 o 12 meses, mes por mes, con los vencidos aparte (spec 2026-10-24-metricas-y-reportes, 5, punto 6): la
// agenda la arma services/reportesAgenda.js (agendaDe) y el PDF lo dibuja services/reportesAgendaPdf.js. Acá van la consulta de los
// datasets activos (el área y la frecuencia por su nombre, los meses de la frecuencia, la próxima y «Datos al» como 'AAAA-MM-DD', el tipo
// de pedido guardado y «Requiere nota DGMIT») y el pie, con el nombre corto de quien lo pide y la hora argentina (un solo instante para
// el pie y para "hoy").

// GET /reportes/agenda?meses=&gestion= (authMiddleware: todos los roles con sesión). Los valores que no sirven caen a 6 meses y a las dos
// gestiones (opcionesDeAgenda). El archivo se llama «Agenda-de-pedidos-AAAA-MM-DD.pdf», con la fecha de hoy en Argentina.
export const reporteAgenda = async (req, res) => {
  try {
    const { meses, gestion } = opcionesDeAgenda(req.query);
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const [[[usuario]], [datasets]] = await Promise.all([
      pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]),
      pool.execute(`
        SELECT d.titulo, d.tipo_gestion, d.tipo_pedido, d.requiere_nota, a.nombre AS area_nombre, f.nombre AS frecuencia_nombre,
               ${COLUMNAS_FECHAS}
        FROM datasets d
        JOIN frecuencias f ON d.frecuencia_id = f.id
        JOIN areas a ON d.area_id = a.id
        WHERE d.activo = TRUE
      `)
    ]);
    const agenda = agendaDe(datasets.map(d => ({
      titulo: d.titulo,
      area: d.area_nombre,
      tipo_gestion: d.tipo_gestion,
      frecuencia: d.frecuencia_nombre,
      frecuencia_meses: d.frecuencia_meses ?? null,
      proxima: d.proxima_iso,
      datos_al: d.datos_al_iso,
      tipo_pedido: d.tipo_pedido,
      requiere_nota: d.requiere_nota
    })), { hoy, meses, gestion });
    const pdf = await renderAgenda({ meses, gestion, agenda }, { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('agenda', { hoy })));
    res.send(pdf);
  } catch (error) {
    responderError(res, 'agenda', error);
  }
};

// =====================================================
// REPORTE: Datos para completar
// =====================================================
// Lo mismo que la sección «Para completar» de la pestaña Métricas (spec 2026-10-24-metricas-y-reportes, 5, punto 7, y 2.2): la
// vista.para_completar del año pedido, sin destildados, de la misma función que GET /api/metricas (metricasDe, con el año de la consulta y
// el hoy del pie). El PDF lo dibuja services/reportesParaCompletarPdf.js.

// El PDF «Datos para completar» para `query` (los parámetros de GET /reportes/para-completar: `anio`, leído como en GET /api/metricas, y
// por defecto el en curso; Ruling 39): lo que dice «Para completar» de la pestaña Métricas de ese año (el en curso, en vivo; uno cerrado
// sin foto, en vivo al 31/12, como entre el 01/01 y el día de la foto; uno con foto, de su foto). `generado`: { momento:
// 'AAAA-MM-DD HH:MM:SS' (hora argentina: su día es hoy), por: nombre corto o null }. El PDF, o null si ese año no tiene métricas
export const pdfDeParaCompletar = async (query, generado) => {
  const hoy = generado.momento.slice(0, 10);
  const anio = query !== null && typeof query === 'object' ? query.anio : undefined;
  const metricas = await metricasDe({ anio }, { hoy });
  if (metricas === null) return null;
  return renderParaCompletar({ anio: metricas.anio, al: metricas.al, para_completar: metricas.vista?.para_completar }, { hoy, generado });
};

// GET /reportes/para-completar?anio= (authMiddleware: todos los roles con sesión). El archivo se llama «Datos-para-completar-AAAA-MM-DD.pdf»,
// con la fecha de hoy en Argentina (sea del año que sea: el PDF dice de qué año es). Un año sin métricas (anterior a 2026 o futuro), el
// 404 de Métricas.
export const reporteParaCompletar = async (req, res) => {
  try {
    // Un solo instante para el pie y para "hoy"
    const momento = ahoraArgentina();
    const [[usuario]] = await pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]);
    const pdf = await pdfDeParaCompletar(req.query, { momento, por: nombreCorto(usuario?.nombre_completo) });
    if (pdf === null) return res.status(404).json(SIN_METRICAS);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('completar', { hoy: momento.slice(0, 10) })));
    res.send(pdf);
  } catch (error) {
    responderError(res, 'completar', error);
  }
};

// =====================================================
// REPORTE: Informe anual
// =====================================================
// Solo para un año con foto (spec 2026-10-24-metricas-y-reportes, 5, Para presentar, punto 2, y 3): la foto del 31/12 de ese año, la
// del año anterior para la comparación (o, sin ella, «Primer año con foto») y los logros del año, los hitos de Gestión → Proyectos. Las
// fotos se leen como las lee Métricas (leerFoto y deLaFoto: nunca se recalculan), con la combinación por defecto (mediana en días
// hábiles) y todos los datasets. El PDF lo dibuja services/reportesInformeAnualPdf.js. Acá van las consultas y el pie, con el nombre
// corto de quien lo pide y la hora argentina.

const SIN_FOTO_DEL_ANIO = Object.freeze({ success: false, error: 'Todavía no hay foto de ese año: se saca el 10/01 del año siguiente.' });

// El año de GET /reportes/informe-anual?anio=: cuatro cifras, de 1000 a 9999 (como los años de Métricas); null si no es un año (falta,
// viene repetido o con otra forma)
const anioDelInforme = (valor) => (typeof valor === 'string' && /^\d{4}$/.test(valor) && Number(valor) >= 1000 ? Number(valor) : null);

// Lo de una foto que lee el Informe: el año, el día y, con la combinación por defecto, lo de deLaFoto (la vista, el contexto y el
// trabajo, como en Métricas). null sin foto
const COMBINACION_DEL_INFORME = Object.freeze({ estadistico: ESTADISTICOS[0], dias: DIAS[0] });
const delInforme = (foto) => (foto === null ? null
  : { anio: foto.anio, al: foto.al, ...COMBINACION_DEL_INFORME, ...deLaFoto(foto, COMBINACION_DEL_INFORME) });

// Los hitos con fecha en `anio`, con el nombre de su proyecto, como los lee Gestión → Proyectos (getTimeline, controllers/
// gestionController.js): los de proyectos activos y los sin proyecto (los logros del área). Los proyectos en el orden de Gestión →
// Proyectos (por categoría, orden y nombre; los sin proyecto al final) y cada hito por fecha; la fecha como 'AAAA-MM-DD' (es DATE: se
// corta como texto, sin zona horaria).
const hitosDelAnio = async (anio) => {
  const [filas] = await pool.execute(
    `SELECT ph.proyecto_id, p.nombre AS proyecto, DATE_FORMAT(ph.fecha, '%Y-%m-%d') AS fecha, ph.titulo, ph.descripcion
     FROM proyecto_hitos ph
     LEFT JOIN proyectos p ON p.id = ph.proyecto_id
     WHERE (ph.proyecto_id IS NULL OR p.activo = TRUE) AND ph.fecha BETWEEN ? AND ?
     ORDER BY ph.proyecto_id IS NULL, p.categoria, p.orden, p.nombre, p.id, ph.fecha, ph.id`,
    [`${anio}-01-01`, `${anio}-12-31`]
  );
  return filas;
};

// GET /reportes/informe-anual?anio= (authMiddleware: todos los roles con sesión). Sin foto de ese año (o con un año que no es un año),
// 404 en JSON. El archivo se llama «Informe-anual-RPAD-AAAA.pdf».
export const reporteInformeAnual = async (req, res) => {
  try {
    const anio = anioDelInforme(req.query.anio);
    const foto = anio === null ? null : await leerFoto(anio);
    if (foto === null) return res.status(404).json(SIN_FOTO_DEL_ANIO);
    const momento = ahoraArgentina();
    const [[[usuario]], anterior, hitos] = await Promise.all([
      pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]),
      leerFoto(anio - 1),
      hitosDelAnio(anio)
    ]);
    const pdf = await renderInformeAnual({ foto: delInforme(foto), anterior: delInforme(anterior), logros: logrosPorProyecto(hitos) },
      { generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelReporte('informe', { anio })));
    res.send(pdf);
  } catch (error) {
    responderError(res, 'informe', error);
  }
};
