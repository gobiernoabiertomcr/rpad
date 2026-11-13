/**
 * El dato de la quincena (spec 2026-11-07-dato-quincena): el archivo de las ediciones de Datito.
 *
 * `recibirEdicion` es el final del POST (sección 4, pasos 5 a 7), después del límite de pedidos, del token y de la lectura
 * del multipart (`req.partes`): el JSON de metadata, la validación de la edición y el guardado inmutable, con el recibo
 * (sección 7). Cada pedido deja un renglón en la consola con la clave (si ya la tiene) y el estado, nunca lo recibido ni el
 * token; un 500, además, solo el código y el mensaje del error (nunca err.sql, que traería la edición).
 *
 * `listar`, `ver` y `descargar` son las lecturas (sección 9), para cualquier rol con sesión (authMiddleware): la lista de un
 * año, el detalle con los textos ya armados y la descarga de cada archivo. Un id que no pasa idPositivo o que no existe da el
 * mismo 404; un error de la base, un 500 con un mensaje fijo por operación y, en la consola, solo el código y el mensaje.
 *
 * El correo del RPAD (spec 2026-11-12-dato-quincena-correo, 5, 6, 11 y 12): el guardado programa el envío de una regular en su
 * transacción; el recibo suma su envío (envioDelRecibo), la lista la pastilla de cada edición (pastillaDelEnvio, con lo que ve
 * administración solo si quien pide es de administración) y el detalle la línea (lineaDelCorreo). Cada pedido toma su hora una
 * vez (ahoraArgentina) y lee una vez el interruptor y el calendario (leerCalendario: con la tabla de feriados caída, los 9
 * fijos).
 */
import { ahoraArgentina } from '../services/notasDigitalesCalendario.js';
import { leerCalendario } from '../services/feriadosDatos.js';
import { esAdmin } from '../services/usuariosReglas.js';
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
import { envioDelRecibo, lineaDelCorreo, pastillaDelEnvio } from '../services/datoQuincenaCorreoReglas.js';
import { leerConfig, correosDeLasEdiciones, listaDeHoy } from '../services/datoQuincenaCorreoDatos.js';

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
 * tiene otro contenido. El recibo y sus avisos salen siempre de lo guardado, después del commit, y su envío, de lo guardado en
 * ese momento: un 200 dice el de ahora («Enviada por correo el …» si ya salió). Un error de la base, 500.
 */
export const recibirEdicion = async (req, res) => {
  let clave = null;
  const responder = (status, cuerpo, motivo) => {
    if (clave !== null) console.log(`Dato de la quincena: ${clave} ${status}`);
    else console.warn(`Dato de la quincena: ${status} (${motivo})`);
    res.status(status).json(cuerpo);
  };
  try {
    const ahora = ahoraArgentina();
    const hoy = ahora.slice(0, 10);
    const { partes } = req;
    const leida = leerMetadata(partes.metadata);
    if (leida === undefined) return responder(400, { success: false, error: MENSAJE_JSON_INVALIDO }, 'metadata no es un JSON');
    const { texto, edicion } = leida;
    const motivo = motivoDeRechazo(edicion);
    if (motivo !== null) return responder(400, { success: false, error: MENSAJES_DEL_CUERPO[400] }, motivo);
    const errores = erroresDeLaEdicion(edicion, partes, { hoy });
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
      })),
      ahora,
      hoy
    });
    if (estado === 'conflicto') return responder(409, { success: false, error: mensajeDeConflicto(clave) });

    const recibo = await leerRecibo(id);
    if (recibo === null) throw new Error('La edición guardada no se pudo leer');
    const avisos = avisosDeLaEdicion(JSON.parse(recibo.fila.metadata), recibo.guardadas);
    const repetida = estado === 'repetida';
    const [{ envioActivo }, calendario] = await Promise.all([leerConfig(), leerCalendario()]);
    const envio = envioDelRecibo({
      tipo: recibo.fila.tipo, fecha_edicion: recibo.fila.fecha_edicion, correo: recibo.correo, envios: recibo.envios, envioActivo,
      ahora, calendario
    });
    responder(repetida ? 200 : 201, { success: true, data: reciboDe(recibo.fila, recibo.adjuntos, avisos, repetida, envio) });
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

/**
 * Lo que hace falta para mostrar el envío de unas ediciones (spec 2026-11-12-dato-quincena-correo, 6 y 12), con una lectura de
 * cada cosa por pedido: el interruptor, la lista de hoy (para «Reenviada…»), el calendario y, por edición, su correo, sus filas
 * automáticas y sus reenvíos. Cada edición se arma con `parametrosDelEnvio`.
 */
const leerElEnvio = async (ids) => {
  const [{ envioActivo }, lista, calendario, correos] = await Promise.all([
    leerConfig(), listaDeHoy(), leerCalendario(), correosDeLasEdiciones(ids)
  ]);
  return { envioActivo, lista, calendario, correos, ahora: ahoraArgentina() };
};

// Los parámetros de lineaDelCorreo y pastillaDelEnvio para una edición (`{ id, tipo, fecha_edicion }`), con el correo que el bot
// dice haber mandado (`correoDelBot`: `{ estado, enviado_at }` de su JSON)
const parametrosDelEnvio = ({ envioActivo, lista, calendario, correos, ahora }, { id, tipo, fecha_edicion }, correoDelBot) => {
  const { correo, envios, reenvios } = correos.get(id) ?? { correo: null, envios: [], reenvios: [] };
  return { tipo, fecha_edicion, correo, envios, reenvios, lista, correoDelBot, envioActivo, ahora, calendario };
};

// Un 500 de una lectura: el mensaje fijo de la operación y, en la consola, solo el código y el mensaje del error
const errorDeLectura = (res, mensaje, error) => {
  console.error(mensaje, error?.code ?? '', error?.message ?? '');
  if (!res.headersSent) res.status(500).json({ success: false, error: mensaje });
};

/**
 * GET /api/dato-quincena/ediciones?anio=AAAA: las ediciones de un año (sin anio, el más reciente con ediciones), con los años
 * que tienen y su cantidad. Un anio que no es un entero de 2000 a 2100, 400. Cada edición con la pastilla de su envío: la de
 * administración (esAdmin de quien pide) dice además si a alguien no le llegó.
 */
export const listar = async (req, res) => {
  const pedido = anioDeLaLista(req.query.anio);
  if (!pedido.valido) return res.status(400).json({ success: false, error: MENSAJE_ANIO_INVALIDO });
  try {
    const { anios, anio, filas } = await listarEdiciones(pedido.anio);
    const lectura = filas.length === 0 ? null : await leerElEnvio(filas.map((fila) => fila.id));
    const admin = esAdmin(req.user?.rol);
    const ediciones = filas.map((fila) => itemDeLaLista(fila, pastillaDelEnvio({
      ...parametrosDelEnvio(lectura, fila, fila.correo_del_bot), admin
    })));
    res.json({ success: true, data: { anios, anio, ediciones } });
  } catch (error) {
    errorDeLectura(res, MENSAJE_AL_LISTAR, error);
  }
};

// GET /api/dato-quincena/ediciones/:id: el detalle de una edición, con los textos ya armados. La línea del correo es la misma
// para todos los roles
export const ver = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const leida = await leerEdicion(id);
    if (leida === null) return noExiste(res);
    const edicion = JSON.parse(leida.fila.metadata);
    const linea = lineaDelCorreo(parametrosDelEnvio(await leerElEnvio([leida.fila.id]), leida.fila, edicion.correo));
    res.json({ success: true, data: detalleDeLaEdicion({ ...leida, edicion, lineaDelCorreo: linea }) });
  } catch (error) {
    errorDeLectura(res, MENSAJE_AL_VER, error);
  }
};

/**
 * GET /api/dato-quincena/ediciones/:id/archivos/:campo: los bytes guardados de infografia_png, infografia_svg, correo_texto,
 * calculos o metadata, con su Content-Type fijo (TIPO_DE_DESCARGA; el SVG, image/svg+xml) y un Content-Disposition de adjunto
 * con su nombre (el no-store y el nosniff los ponen app.js y Helmet). El SVG va siempre como adjunto: el RPAD no lo dibuja
 * (spec 2026-11-12-dato-quincena-correo, 11). En una edición que existe, otro campo, o unos cálculos o un SVG que no llegaron,
 * 404 «El archivo no existe.».
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
