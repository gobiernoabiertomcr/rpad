/**
 * El dato de la quincena (spec 2026-11-07-dato-quincena): el archivo de las ediciones de Grok Bot.
 *
 * `recibirEdicion` es el final del POST (sección 4, pasos 5 a 7), después del límite de pedidos, del token y de la lectura
 * del multipart (`req.partes`): el JSON de metadata, la validación de la edición y el guardado inmutable, con el recibo
 * (sección 7). Cada pedido deja un renglón en la consola con la clave (si ya la tiene) y el estado, nunca lo recibido ni el
 * token; un 500, además, solo el código y el mensaje del error (nunca err.sql, que traería la edición).
 *
 * `listar`, `ver` y `descargar` son las lecturas (sección 9), para cualquier rol con sesión (authMiddleware): la lista de un
 * año, el detalle con los textos ya armados y la descarga de cada archivo. Un id que no pasa idPositivo o que no existe da el
 * mismo 404; un error de la base, un 500 con un mensaje fijo por operación y, en la consola, solo el código y el mensaje.
 */
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { MENSAJES_DEL_CUERPO, motivoDeRechazo } from '../middleware/cuerpo.js';
import { idPositivo } from '../services/proyectosReglas.js';
import { disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import {
  textoDeMetadata, erroresDeLaEdicion, claveDeEdicion, huellaDelPaquete, filasDeLaEdicion, avisosDeLaEdicion, reciboDe, sha256,
  anioDeLaLista, itemDeLaLista, detalleDeLaEdicion
} from '../services/datoQuincenaReglas.js';
import {
  guardarEdicion, leerRecibo, listarEdiciones, leerEdicion, leerArchivo
} from '../services/datoQuincenaDatos.js';

const MENSAJE_JSON_INVALIDO = 'No se pudo leer la edición: metadata no es un JSON válido.';
const MENSAJE_CON_ERRORES = 'La edición tiene errores.';
const MENSAJE_AL_GUARDAR = 'No se pudo guardar la edición.';
const mensajeDeConflicto = (clave) => `Ya hay una edición con la clave ${clave} y otro contenido. No se cambió nada.`;

// El JSON de metadata, o undefined si no es UTF-8 o no es un JSON (el BOM se conserva y lo hace fallar: sección 4)
const leerMetadata = (buffer) => {
  const texto = textoDeMetadata(buffer);
  if (texto === null) return undefined;
  try {
    return { texto, edicion: JSON.parse(texto) };
  } catch {
    return undefined;
  }
};

/**
 * POST /api/dato-quincena/ediciones, con `req.partes` ya leídas. metadata que no es un JSON, 400; con una clave reservada o
 * demasiados niveles (lo que datosComunes no ve en un multipart), el 400 de middleware/cuerpo.js; una edición con errores,
 * 422 con `errores`. Si no, la guarda: 201 con el recibo, 200 con el de la primera vez si ya estaba igual, o 409 si la clave
 * tiene otro contenido. El recibo y sus avisos salen siempre de lo guardado, después del commit. Un error de la base, 500.
 */
export const recibirEdicion = async (req, res) => {
  let clave = null;
  const responder = (status, cuerpo, motivo) => {
    if (clave !== null) console.log(`Dato de la quincena: ${clave} ${status}`);
    else console.warn(`Dato de la quincena: ${status} (${motivo})`);
    res.status(status).json(cuerpo);
  };
  try {
    const { partes } = req;
    const leida = leerMetadata(partes.metadata);
    if (leida === undefined) return responder(400, { success: false, error: MENSAJE_JSON_INVALIDO }, 'metadata no es un JSON');
    const { texto, edicion } = leida;
    const motivo = motivoDeRechazo(edicion);
    if (motivo !== null) return responder(400, { success: false, error: MENSAJES_DEL_CUERPO[400] }, motivo);
    const errores = erroresDeLaEdicion(edicion, partes, { hoy: hoyArgentina() });
    if (errores.length > 0) {
      return responder(422, { success: false, error: MENSAJE_CON_ERRORES, errores }, 'la edición tiene errores');
    }

    clave = claveDeEdicion(edicion);
    const { estado, id } = await guardarEdicion({
      clave,
      tipo: edicion.tipo,
      fecha_edicion: edicion.fecha_edicion,
      referencia_piloto: edicion.referencia_piloto,
      titulo: edicion.titulo,
      metadataTexto: texto,
      huella: huellaDelPaquete(partes),
      filas: filasDeLaEdicion(edicion),
      // El manifiesto ya coincide con las partes: el nombre y el MIME son los suyos; los bytes y el SHA-256, los de lo recibido
      adjuntos: edicion.adjuntos.map(({ campo, nombre, mime }) => ({
        campo, nombre, mime, bytes: partes[campo].length, sha256: sha256(partes[campo]), contenido: partes[campo]
      }))
    });
    if (estado === 'conflicto') return responder(409, { success: false, error: mensajeDeConflicto(clave) });

    const recibo = await leerRecibo(id);
    if (recibo === null) throw new Error('La edición guardada no se pudo leer');
    const avisos = avisosDeLaEdicion(JSON.parse(recibo.fila.metadata), recibo.guardadas);
    const repetida = estado === 'repetida';
    responder(repetida ? 200 : 201, { success: true, data: reciboDe(recibo.fila, recibo.adjuntos, avisos, repetida) });
  } catch (error) {
    const linea = clave !== null ? `Dato de la quincena: ${clave} 500` : 'Dato de la quincena: 500 (error inesperado)';
    console.error(linea, error?.code ?? '', error?.message ?? '');
    if (!res.headersSent) res.status(500).json({ success: false, error: MENSAJE_AL_GUARDAR });
  }
};

// Las lecturas (sección 9)
const MENSAJE_ANIO_INVALIDO = 'El año no es válido.';
const MENSAJE_NO_EXISTE = 'No existe esa edición.';
const MENSAJE_SIN_ARCHIVO = 'El archivo no existe.';
const MENSAJE_AL_LISTAR = 'Error al obtener las ediciones';
const MENSAJE_AL_VER = 'Error al obtener la edición';
const MENSAJE_AL_DESCARGAR = 'Error al descargar el archivo';

const noExiste = (res) => res.status(404).json({ success: false, error: MENSAJE_NO_EXISTE });

// Un 500 de una lectura: el mensaje fijo de la operación y, en la consola, solo el código y el mensaje del error
const errorDeLectura = (res, mensaje, error) => {
  console.error(mensaje, error?.code ?? '', error?.message ?? '');
  if (!res.headersSent) res.status(500).json({ success: false, error: mensaje });
};

/**
 * GET /api/dato-quincena/ediciones?anio=AAAA: las ediciones de un año (sin anio, el más reciente con ediciones), con los años
 * que tienen y su cantidad. Un anio que no es un entero de 2000 a 2100, 400.
 */
export const listar = async (req, res) => {
  const pedido = anioDeLaLista(req.query.anio);
  if (!pedido.valido) return res.status(400).json({ success: false, error: MENSAJE_ANIO_INVALIDO });
  try {
    const { anios, anio, filas } = await listarEdiciones(pedido.anio);
    res.json({ success: true, data: { anios, anio, ediciones: filas.map(itemDeLaLista) } });
  } catch (error) {
    errorDeLectura(res, MENSAJE_AL_LISTAR, error);
  }
};

// GET /api/dato-quincena/ediciones/:id: el detalle de una edición, con los textos ya armados
export const ver = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const leida = await leerEdicion(id);
    if (leida === null) return noExiste(res);
    const edicion = JSON.parse(leida.fila.metadata);
    res.json({ success: true, data: detalleDeLaEdicion({ ...leida, edicion }) });
  } catch (error) {
    errorDeLectura(res, MENSAJE_AL_VER, error);
  }
};

/**
 * GET /api/dato-quincena/ediciones/:id/archivos/:campo: los bytes guardados de infografia_png, correo_texto, calculos o
 * metadata, con su Content-Type fijo y un Content-Disposition de adjunto con su nombre (el no-store y el nosniff los ponen
 * app.js y Helmet). En una edición que existe, otro campo o unos cálculos que no llegaron, 404 «El archivo no existe.».
 */
export const descargar = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const leido = await leerArchivo(id, req.params.campo);
    if (!leido.existe) return noExiste(res);
    if (leido.archivo === null) return res.status(404).json({ success: false, error: MENSAJE_SIN_ARCHIVO });
    const { nombre, mime, contenido } = leido.archivo;
    res.set({ 'Content-Type': mime, 'Content-Disposition': disposicionDeAdjunto(nombre) });
    res.send(contenido);
  } catch (error) {
    errorDeLectura(res, MENSAJE_AL_DESCARGAR, error);
  }
};
