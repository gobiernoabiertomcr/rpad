/**
 * El correo del dato de la quincena, para administración (spec 2026-11-12-dato-quincena-correo, 9, 12 y 15): todas sus rutas
 * van con authMiddleware y adminOnly (superadmin, admin y editor). Solo acá salen la configuración, la lista, las direcciones y
 * el estado de cada persona: la lista de ediciones y su detalle (datoQuincenaController.js) no los traen.
 *
 * - `verCorreo`: el envío automático, las próximas ediciones (con una lectura de la tabla de feriados: si no se pudo leer,
 *   ninguna) y las personas activas, con su email, si lo reciben y hasta cuándo están de licencia hoy, y el pie con cuántas lo
 *   reciben.
 * - `cambiarEnvio` (`{ activo }`, prende solo el `true` literal) y `cambiarDestinatarios` (`{ usuarios: [ids] }`, reemplaza la
 *   lista en una transacción).
 * - `verCorreoDeLaEdicion`: la caja del correo del detalle.
 * - `reenviarEdicion` (`{ a: 'todas' }` o `{ a: <id> }`) y `mandarPruebaDeLaEdicion`, con el candado de la corrida.
 *
 * Un id que no es un entero positivo o que no existe, 404 «No existe esa edición.», antes de mirar el cuerpo o el candado. Un
 * 500, un mensaje fijo por operación y, en la consola, solo el código y el mensaje del error (nunca err.sql ni el texto del
 * transporte, que pueden traer una dirección).
 */
import { ahoraArgentina } from '../services/notasDigitalesCalendario.js';
import { filasDeFeriados, leerCalendario } from '../services/feriadosDatos.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { emailValido, TEXTO_ROL } from '../services/usuariosReglas.js';
import { idPositivo } from '../services/proyectosReglas.js';
import { leerEdicion } from '../services/datoQuincenaDatos.js';
import {
  MENSAJES_CORREO, estaVigente, proximasEdiciones, lineaDelCorreo, resumenDelCorreo, textoDeLaPersona, textoDelEnvioAMano,
  sePuedeReenviar, textoDelReenvio, listaDePersonas, aQuienReenviar, textoDeLaLicencia, textoDelInterruptor,
  textoDeLaListaGuardada, textoDeLosQueReciben
} from '../services/datoQuincenaCorreoReglas.js';
import {
  leerConfig, correoDe, listaDeHoy, personasDelCorreo, ultimaRegular, guardarEnvioActivo, reemplazarDestinatarios,
  edicionDelCorreo, enviosConNombres, usuarioDeLaPrueba
} from '../services/datoQuincenaCorreoDatos.js';
import { reenviar, mandarPrueba } from '../services/datoQuincenaCorreo.js';

const MENSAJE_AL_VER_EL_CORREO = 'Error al obtener el correo del dato de la quincena';
const MENSAJE_AL_CAMBIAR_EL_ENVIO = 'Error al cambiar el envío automático';
const MENSAJE_AL_GUARDAR_LA_LISTA = 'Error al guardar la lista';
const MENSAJE_AL_VER_LA_EDICION = 'Error al obtener el correo de la edición';
const MENSAJE_AL_REENVIAR = 'Error al reenviar la edición';
const MENSAJE_AL_MANDAR_LA_PRUEBA = 'Error al mandar la prueba';

// Un rechazo con su mensaje fijo de MENSAJES_CORREO
const rechazar = (res, status, clave) => res.status(status).json({ success: false, error: MENSAJES_CORREO[clave] });
const noExiste = (res) => rechazar(res, 404, 'noExiste');

// Un 500: el mensaje fijo de la operación y, en la consola, solo el código y el mensaje del error
const errorInterno = (res, mensaje, error) => {
  console.error(mensaje, error?.code ?? '', error?.message ?? '');
  if (!res.headersSent) res.status(500).json({ success: false, error: mensaje });
};

// Por nombre, como en Configuración (y por id entre dos iguales)
const porNombre = (una, otra) => una.nombre.localeCompare(otra.nombre, 'es') || (una.id ?? 0) - (otra.id ?? 0);

// La tabla de feriados, una vez en el pedido: sus filas (para los nombres) y el calendario. Si no se pudo leer, el calendario
// lleva el error y las próximas ediciones no se estiman (proximasEdiciones mira `calendario.error`, no los 9 fijos)
const leerLosFeriados = async () => {
  try {
    const filas = await filasDeFeriados();
    return { filas, calendario: calendarioCon(filas) };
  } catch (error) {
    console.error('No se pudieron leer los feriados: el correo del dato de la quincena no estima las próximas ediciones.',
      error?.code ?? '', error?.message ?? '');
    return { filas: [], calendario: calendarioCon([], { origen: 'fijos', error: String(error?.message ?? error) }) };
  }
};

/**
 * GET /api/dato-quincena/correo: `{ envio_activo, proximas, personas, reciben_texto }`. `proximas`, las de proximasEdiciones
 * desde la última regular, con sus textos; `personas`, las activas por nombre: `{ id, nombre, cargo, rol, email, recibe,
 * licencia }`, con `rol` el nombre del rol y `licencia` «De licencia hasta el 30/11» o null; `reciben_texto`, «Lo reciben 2
 * personas.» (cuenta las activas que lo reciben: una inactiva que quedó en la lista no).
 */
export const verCorreo = async (req, res) => {
  try {
    const hoy = ahoraArgentina().slice(0, 10);
    const [{ envioActivo }, ultima, personas, feriados] = await Promise.all([
      leerConfig(), ultimaRegular(), personasDelCorreo(hoy), leerLosFeriados()
    ]);
    const { filas, calendario } = feriados;
    const activas = personas.map(({ id, nombre, cargo, rol, email, recibe, hasta }) => ({
      id, nombre, cargo, rol: TEXTO_ROL[rol] ?? rol, email, recibe, licencia: textoDeLaLicencia(hasta, hoy)
    })).sort(porNombre);
    res.json({
      success: true,
      data: {
        envio_activo: envioActivo,
        proximas: proximasEdiciones({ ultimaRegular: ultima, hoy, calendario, filasDeFeriados: filas }),
        personas: activas,
        reciben_texto: textoDeLosQueReciben(activas.filter((persona) => persona.recibe === true).length)
      }
    });
  } catch (error) {
    errorInterno(res, MENSAJE_AL_VER_EL_CORREO, error);
  }
};

/**
 * PUT /api/dato-quincena/correo/envio (`{ activo: true | false }`): prende o apaga el envío automático y anota quién y cuándo.
 * Prende solo el `true` literal; algo que no es un booleano («true» como texto, un 1, nada), 400 sin cambiar nada: un cuerpo
 * que no se entiende no lo apaga a escondidas.
 */
export const cambiarEnvio = async (req, res) => {
  const activo = req.body?.activo;
  if (typeof activo !== 'boolean') return rechazar(res, 400, 'envioInvalido');
  try {
    await guardarEnvioActivo(activo, req.user.userId, ahoraArgentina());
    res.json({ success: true, data: { envio_activo: activo }, message: textoDelInterruptor(activo) });
  } catch (error) {
    errorInterno(res, MENSAJE_AL_CAMBIAR_EL_ENVIO, error);
  }
};

/**
 * PUT /api/dato-quincena/correo/destinatarios (`{ usuarios: [ids] }`): la lista completa de quienes lo reciben, ids sin repetir
 * de usuarios activos (vacía, nadie). Si no, 400 «La lista de personas no es válida.» y nada cambia. Responde los ids guardados,
 * de menor a mayor.
 */
export const cambiarDestinatarios = async (req, res) => {
  const ids = listaDePersonas(req.body?.usuarios);
  if (ids === null) return rechazar(res, 400, 'listaInvalida');
  try {
    if (!(await reemplazarDestinatarios(ids, req.user.userId, ahoraArgentina()))) return rechazar(res, 400, 'listaInvalida');
    res.json({
      success: true, data: { usuarios: [...ids].sort((uno, otro) => uno - otro) }, message: textoDeLaListaGuardada(ids.length)
    });
  } catch (error) {
    errorInterno(res, MENSAJE_AL_GUARDAR_LA_LISTA, error);
  }
};

/**
 * GET /api/dato-quincena/ediciones/:id/correo: la caja del correo del detalle, `{ resumen, linea, personas, reenvios,
 * se_puede_reenviar, lista_de_hoy }`. `linea` es la misma del detalle; `personas`, las del envío automático por nombre,
 * `{ nombre, texto, mal }`; `reenvios`, los reenvíos y las pruebas en orden, `{ texto }`; `lista_de_hoy`, `[{ id, nombre }]`
 * para el diálogo de «Reenviar». Lo que depende de la vigencia (los reintentos de una edición vencida, Ruling 9) se lee con la
 * de hoy. Sin direcciones.
 */
export const verCorreoDeLaEdicion = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const leida = await leerEdicion(id);
    if (leida === null) return noExiste(res);
    const { tipo, fecha_edicion } = leida.fila;
    const correoDelBot = JSON.parse(leida.fila.metadata).correo;
    const ahora = ahoraArgentina();
    const [{ envioActivo }, lista, calendario, correo, filas] = await Promise.all([
      leerConfig(), listaDeHoy(), leerCalendario(), correoDe(id), enviosConNombres(id)
    ]);
    const vigente = estaVigente(fecha_edicion, ahora.slice(0, 10));
    const automaticas = filas.filter((fila) => fila.tipo === 'automatico');
    // Los mismos reenvíos que lee el detalle (correosDeLasEdiciones): los que salieron
    const reenvios = filas.filter((fila) => fila.tipo === 'reenvio' && fila.estado === 'enviado');
    res.json({
      success: true,
      data: {
        resumen: resumenDelCorreo({ tipo, correo, envios: automaticas, reenvios, vigente }),
        linea: lineaDelCorreo({
          tipo, fecha_edicion, correo, envios: automaticas, reenvios, lista, correoDelBot, envioActivo, ahora, calendario
        }),
        personas: automaticas.map((fila) => ({ nombre: fila.nombre, ...textoDeLaPersona(fila, { vigente }) })).sort(porNombre),
        reenvios: filas.filter((fila) => fila.tipo !== 'automatico').map((fila) => ({ texto: textoDelEnvioAMano(fila) })),
        se_puede_reenviar: sePuedeReenviar({ tipo, correo, envios: automaticas, vigente }),
        lista_de_hoy: lista.map(({ usuario_id, nombre }) => ({ id: usuario_id, nombre })).sort(porNombre)
      }
    });
  } catch (error) {
    errorInterno(res, MENSAJE_AL_VER_LA_EDICION, error);
  }
};

// Los rechazos de «Reenviar» que vienen del servicio: lo que no se puede por cómo está la edición, 409; a quién, 400
const ESTADO_DEL_RECHAZO = Object.freeze({ soloRegulares: 409, todaviaSeManda: 409, noEstaEnLaLista: 400, listaVacia: 400 });

/**
 * POST /api/dato-quincena/ediciones/:id/reenvios (`{ a: 'todas' }` o `{ a: <id de una persona de la lista de hoy> }`): sale en
 * el momento (services/datoQuincenaCorreo.js, `reenviar`). Sin un «a» que sirva, 400; un piloto o una edición que todavía se
 * manda sola, 409; una persona que no está en la lista de hoy (o la lista vacía), 400; con una corrida mandando, 409. Si salió a
 * alguien, 200 con `{ enviados, fallidos }` y el texto; si no le llegó a nadie, 502 con lo mismo.
 */
export const reenviarEdicion = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const edicion = await edicionDelCorreo(id);
    if (edicion === null) return noExiste(res);
    const a = aQuienReenviar(req.body?.a);
    if (a === null) return rechazar(res, 400, 'aQuien');
    const resultado = await reenviar({ edicion, a, creadoPor: req.user.userId });
    if (resultado.estado === 'ocupado') return rechazar(res, 409, 'ocupado');
    if (resultado.estado === 'rechazado') return rechazar(res, ESTADO_DEL_RECHAZO[resultado.motivo], resultado.motivo);
    const { enviados, fallidos } = resultado;
    const texto = textoDelReenvio({ enviados, fallidos });
    if (enviados === 0) return res.status(502).json({ success: false, error: texto, data: { enviados, fallidos } });
    res.json({ success: true, data: { enviados, fallidos }, message: texto });
  } catch (error) {
    errorInterno(res, MENSAJE_AL_REENVIAR, error);
  }
};

/**
 * POST /api/dato-quincena/ediciones/:id/prueba: «Enviarme una prueba», a la casilla de quien la pide (sin un email válido, 400),
 * de cualquier edición, también un piloto y con el envío apagado. Con una corrida mandando, 409; si no salió, 502; si salió, 200
 * «Te mandamos la prueba a tu casilla.».
 */
export const mandarPruebaDeLaEdicion = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const edicion = await edicionDelCorreo(id);
    if (edicion === null) return noExiste(res);
    const usuario = await usuarioDeLaPrueba(req.user.userId);
    if (usuario === null || !emailValido(usuario.email)) return rechazar(res, 400, 'sinEmailPropio');
    const resultado = await mandarPrueba({ edicion, usuario });
    if (resultado.estado === 'ocupado') return rechazar(res, 409, 'ocupado');
    if (!resultado.enviado) return rechazar(res, 502, 'pruebaFallida');
    res.json({ success: true, message: MENSAJES_CORREO.prueba });
  } catch (error) {
    errorInterno(res, MENSAJE_AL_MANDAR_LA_PRUEBA, error);
  }
};
