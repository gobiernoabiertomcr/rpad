import pool from '../config/database.js';
import { fuentesDe } from '../services/seguimientoDatos.js';
import { seguimientoDe, resumenParaLista, nombreCorto, nombreDelPdf, disposicionDeAdjunto, sinErroresTecnicos } from '../services/seguimientoReglas.js';
import { renderSeguimiento, OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { hoyArgentina, ahoraArgentina } from '../services/notasDigitalesCalendario.js';
import { esAdmin } from '../services/usuariosReglas.js';

// Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset-design): solo lectura, para todos los roles con sesión
// (authMiddleware, sin adminOnly). Las reglas y las consultas están en services/seguimientoReglas.js y seguimientoDatos.js; el
// PDF, en services/seguimientoPdf.js.

const NO_ENCONTRADO = { success: false, error: 'Dataset no encontrado' };
const ERROR_AL_OBTENER = { success: false, error: 'Error al obtener el seguimiento' };
const ERROR_AL_GENERAR_PDF = { success: false, error: 'Error al generar el PDF del seguimiento' };

// Un id es un entero positivo escrito solo con dígitos: 'abc', '0', '-3', '1.5' y '1e3' no lo son. Devuelve el número o null.
const idDelDataset = (texto) => {
  if (!/^\d+$/.test(texto ?? '')) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Las fuentes de un dataset, o null si el id no es válido o no existe (el llamador responde 404)
const fuentesDelDataset = async (texto) => {
  const id = idDelDataset(texto);
  if (id === null) return null;
  return (await fuentesDe([id])).get(id) ?? null;
};

// GET /api/seguimiento: una fila por dataset (activos y dados de baja), para la lista de "Sin elegir"
export const listarSeguimiento = async (req, res) => {
  try {
    const hoy = hoyArgentina();
    const data = [...(await fuentesDe(null)).values()].map((fuentes) => resumenParaLista(fuentes, hoy));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al listar el seguimiento:', error);
    res.status(500).json(ERROR_AL_OBTENER);
  }
};

// GET /api/seguimiento/:id: todo el Seguimiento de un dataset. El texto técnico del error de un email que no se pudo enviar lo
// recibe solo administración (esAdmin); el lector ve "No se pudo enviar.".
export const verSeguimiento = async (req, res) => {
  try {
    const fuentes = await fuentesDelDataset(req.params.id);
    if (!fuentes) return res.status(404).json(NO_ENCONTRADO);
    const seguimiento = seguimientoDe(fuentes, hoyArgentina());
    res.json({ success: true, data: esAdmin(req.user?.rol) ? seguimiento : sinErroresTecnicos(seguimiento) });
  } catch (error) {
    console.error('Error al obtener el seguimiento:', error);
    res.status(500).json(ERROR_AL_OBTENER);
  }
};

// GET /api/seguimiento/:id/pdf: el PDF de una hoja, con el nombre corto de quien lo genera y la hora (argentina) en el pie. El
// nombre del archivo es "Seguimiento - <título> - <AAAA-MM-DD>.pdf" (disposicionDeAdjunto lo deja apto para el encabezado HTTP).
export const descargarSeguimientoPdf = async (req, res) => {
  try {
    const fuentes = await fuentesDelDataset(req.params.id);
    if (!fuentes) return res.status(404).json(NO_ENCONTRADO);
    // Un solo instante para el pie y para "hoy" (que no queden en días distintos a la medianoche)
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const [[usuario]] = await pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]);
    const seguimiento = seguimientoDe(fuentes, hoy, OPCIONES_CINTA_PDF);
    const pdf = await renderSeguimiento(seguimiento, { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposicionDeAdjunto(nombreDelPdf(seguimiento.ficha.titulo ?? 'Dataset', hoy)));
    res.send(pdf);
  } catch (error) {
    console.error('Error al generar el PDF del seguimiento:', error);
    res.status(500).json(ERROR_AL_GENERAR_PDF);
  }
};
