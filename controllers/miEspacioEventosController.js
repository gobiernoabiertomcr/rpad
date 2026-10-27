// La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 1, 2, 3 y 7): los eventos de cada persona, los que
// compartieron con ella y los «para todos». Todas las rutas llevan authMiddleware y trabajan sobre req.user.userId, con su
// rol de la base (verificarSesion lo lee en cada pedido: quien deja de ser administración deja de compartir enseguida).
// Lo ve quien lo creó, las personas elegidas y, si es para todos, la administración (services/miEspacioEventosDatos.js); lo
// cambia y lo borra solo quien lo creó, y una invitada solo apaga o prende su recordatorio. Un id que no sirve, ajeno, que no
// existe o dado de baja responde 404, el mismo: no se revela que existe. Comparte solo administración (`esAdmin`), y solo con
// administración activa o con quien ya estaba en el evento (Review Focus 4: una invitada que dejó de ser administración o se
// desactivó sigue, pero nadie la suma de nuevo). Cuándo sale cada aviso se calcula en cada pedido con los feriados de ese
// momento, nunca se guarda (Review Focus 3). Las reglas y los textos son puros (services/miEspacioEventosReglas.js): la
// página los imprime tal cual. El listado suma lo demás de la agenda: tus licencias de Mi espacio (con el tipo), los
// feriados y los compañeros que no están (sin el tipo, como «Hoy no están»). Respuestas { success, data?, error?, campo?,
// message? }; un error de validación, 400 con su campo. Cada guardado es una transacción; el cambio y la baja empiezan
// bloqueando la fila del evento.
import pool from '../config/database.js';
import { ahoraArgentina, hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_EVENTO, validarEvento, validarAvisoDelEvento, avisoDe, personasDelPedido, itemDeEvento, itemDeLicencia,
  itemDeAusencia, itemsDeFeriados
} from '../services/miEspacioEventosReglas.js';
import {
  eventosVisibles, eventoVisible, eventoPropio, personasParaCompartir, licenciasPropiasEntre
} from '../services/miEspacioEventosDatos.js';
import { feriadosEntre, filasDeFeriados } from '../services/feriadosDatos.js';
import { feriadosDelRango } from '../services/feriadosReglas.js';
import { esAdmin } from '../services/usuariosReglas.js';
import { rangoDelPedido, ausentesPara } from './miEspacioController.js';

// Cuántos días antes de un evento se leen los feriados: su aviso sale antes que él («El día hábil anterior» de un lunes) y
// cada día que no es hábil lo corre uno más
const DIAS_DE_FERIADOS_ANTES = 31;
const desdeDeLosFeriados = (desde) => sumarDias(desde, -DIAS_DE_FERIADOS_ANTES);
// Cuántas veces se intenta una transacción que MariaDB cortó por un bloqueo mutuo
const INTENTOS = 3;

// [status, cuerpo]: lo que responde cada ruta
const conDatos = (data) => [200, { success: true, data }];
const noEncontrado = () => [404, { success: false, error: MENSAJES_EVENTO.noEncontrado }];
const rechazo = ({ campo, mensaje }) => [400, { success: false, error: mensaje, campo }];

// Responde lo que devolvió la operación, o 500 con `mensaje` si algo inesperado falló (la pila del error, solo en la consola:
// los errores de mysql2 traen la consulta armada con sus valores)
const responder = async (res, mensaje, operacion) => {
  try {
    const [status, cuerpo] = await operacion();
    res.status(status).json(cuerpo);
  } catch (error) {
    console.error(`${mensaje}:`, error?.stack ?? error);
    res.status(500).json({ success: false, error: mensaje });
  }
};

/**
 * Corre trabajo(conexion) en una transacción y devuelve lo que devolvió, `[status, cuerpo]`: un 2xx la confirma y cualquier
 * otro la deshace. Si MariaDB la corta por un bloqueo mutuo (ER_LOCK_DEADLOCK: ya la deshizo entera), la repite desde el
 * principio, hasta INTENTOS veces en total.
 */
const enTransaccion = async (trabajo) => {
  for (let intento = 1; ; intento += 1) {
    let conexion;
    try {
      conexion = await pool.getConnection();
      await conexion.beginTransaction();
      const resultado = await trabajo(conexion);
      if (resultado[0] < 300) await conexion.commit();
      else await conexion.rollback();
      return resultado;
    } catch (error) {
      await conexion?.rollback().catch(() => {});
      if (error?.code !== 'ER_LOCK_DEADLOCK' || intento >= INTENTOS) throw error;
    } finally {
      conexion?.release();
    }
  }
};

/**
 * El único lugar donde se guarda un evento (el alta, el cambio y la baja) y se responde: `trabajo(conexion)` corre en una
 * transacción y su `[status, cuerpo]` es la respuesta. Lo que tenga que salir después de responder (los emails de la
 * invitación, el cambio y la cancelación, spec sección 4) se suma acá, una sola vez para las tres rutas.
 */
const guardarEvento = (res, mensaje, trabajo) => responder(res, mensaje, () => enTransaccion(trabajo));

// El cuerpo del pedido como objeto (sin cuerpo, o con algo que no es un objeto, {})
const cuerpoDe = (req) => {
  const { body } = req;
  return body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {};
};

// Quien pide, con su rol de la base
const quienPide = (req) => ({ id: req.user.userId, rol: req.user.rol });

// Los feriados que mueven el aviso de los eventos de desde a hasta (un Set, el de feriadosEntre)
const feriadosParaLosAvisos = (desde, hasta) => feriadosEntre(desdeDeLosFeriados(desde), hasta);

/**
 * Lo que se guarda de un alta o un cambio (`entrada`, el formulario entero), o lo que lo frena, en este orden:
 * validarEvento; compartir sin ser administración (`sinPermiso`, en `compartido`: también a quien lo creó y dejó de serlo);
 * y las personas (`personasDelPedido`): las de `personasParaCompartir` o las que ya estaban elegidas en el evento
 * (`anterior`, el de antes de un cambio; las filas de un «para todos» son de recordatorios apagados, no de elegidas), sin
 * quien lo guarda. Devuelve `{ datos }` o `{ error }`.
 */
const datosDelGuardado = async (entrada, { usuario, anterior = null }, conexion) => {
  const { datos, error } = validarEvento(entrada, hoyArgentina());
  if (error) return { error };
  if (datos.compartido && !esAdmin(usuario.rol)) {
    return { error: { campo: 'compartido', mensaje: MENSAJES_EVENTO.sinPermiso } };
  }
  if (!datos.compartido || datos.para_todos) return { datos };
  const yaEstaban = anterior?.compartido && !anterior.para_todos ? anterior.personas.map((persona) => persona.id) : [];
  const permitidas = new Set([...(await personasParaCompartir(usuario.id, conexion)).map((persona) => persona.id), ...yaEstaban]);
  const { personas, error: errorDePersonas } = personasDelPedido(datos.personas, { usuarioId: usuario.id, permitidas });
  return errorDePersonas ? { error: errorDePersonas } : { datos: { ...datos, personas } };
};

// Las columnas que se guardan de un evento, en el orden de INSERT y de UPDATE
const valoresDelEvento = (datos) => [datos.titulo, datos.detalle, datos.fecha, datos.desde, datos.hasta,
  datos.compartido ? 1 : 0, datos.para_todos ? 1 : 0, datos.recordatorio];

/**
 * Las filas de las personas de un evento después de guardarlo (spec, sección 3): sin compartir, ninguna; con «Todos», solo
 * las de quienes apagaron su recordatorio; con personas, exactamente las elegidas, y las que siguen conservan su
 * `sin_recordatorio` (Review Focus 1: no se borran y se vuelven a escribir). `antes`: las filas que tenía (las de
 * eventoPropio, leídas con el evento bloqueado; [] en un alta). Se borra y se suma solo lo que cambia, por la clave.
 */
const guardarPersonas = async (conexion, eventoId, datos, antes) => {
  let quedan = new Set();
  if (datos.compartido && datos.para_todos) {
    quedan = new Set(antes.filter((persona) => persona.sin_recordatorio).map((persona) => persona.id));
  } else if (datos.compartido) {
    quedan = new Set(datos.personas);
  }
  const tenia = new Set(antes.map((persona) => persona.id));
  const salen = [...tenia].filter((id) => !quedan.has(id));
  const entran = [...quedan].filter((id) => !tenia.has(id));
  if (salen.length > 0) {
    await conexion.query('DELETE FROM mi_espacio_evento_personas WHERE evento_id = ? AND usuario_id IN (?)', [eventoId, salen]);
  }
  if (entran.length > 0) {
    await conexion.query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id) VALUES ?',
      [entran.map((id) => [eventoId, id])]);
  }
};

/**
 * GET /api/mi-espacio/eventos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD: lo que ve la persona en un rango de hasta 93 días (las
 * fechas, como «Hoy no están»: 400 en `fechas`, antes de leer nada). `puede_compartir`: si el formulario ofrece
 * «Compartido». Además de los eventos (por fecha, hora y título, cada uno como itemDeEvento), lo demás de la agenda (spec,
 * secciones 6 y 7), cada cosa entera y con sus días hábiles del rango:
 * - `licencias`: las suyas de Mi espacio (`licenciasPropiasEntre`), con el tipo (itemDeLicencia);
 * - `feriados`: los del rango, «Feriado: <nombre>» (itemsDeFeriados);
 * - `ausentes`: los compañeros que no están, como en «Hoy no están» (`ausentesPara`: leídas con margen y unidas, así la que
 *   empezó antes se ve entera), sin el tipo ni la nota (itemDeAusencia); a quien no es administración, [].
 * Las filas de los feriados se leen una vez: dan el Set (el de los avisos, que cubre también los días del rango), la lista y
 * los feriados de `ausentesPara`.
 */
export const listarEventos = (req, res) => responder(res, 'Error al obtener los eventos', async () => {
  const { desde, hasta, rechazo: rechazoDelRango } = rangoDelPedido(req.query);
  if (rechazoDelRango) return rechazoDelRango;
  const usuario = quienPide(req);
  const ahora = ahoraArgentina();
  const hoy = ahora.slice(0, 10);
  const [eventos, licencias, filasFeriados] = await Promise.all([
    eventosVisibles(usuario, desde, hasta), licenciasPropiasEntre(usuario.id, desde, hasta), filasDeFeriados()
  ]);
  const { ausentes } = await ausentesPara(usuario, { desde, hasta, hoy, filasFeriados });
  const feriados = feriadosDelRango(filasFeriados, desdeDeLosFeriados(desde), hasta);
  const rango = { desde, hasta, feriados };
  return conDatos({
    desde, hasta, hoy, puede_compartir: esAdmin(usuario.rol),
    eventos: eventos.map((evento) => itemDeEvento(evento, { usuarioId: usuario.id, ahora, feriados })),
    licencias: licencias.map((licencia) => itemDeLicencia(licencia, rango)),
    feriados: itemsDeFeriados(filasFeriados, desde, hasta),
    ausentes: ausentes.map((ausente) => itemDeAusencia(ausente, rango))
  });
});

// GET /api/mi-espacio/eventos/aviso?fecha=&desde=&recordatorio=: cuándo saldría el recordatorio, para el texto del
// formulario (`{ momento, texto }`), sin guardar nada. Un dato que no sirve, 400 en su campo
export const verAvisoDelEvento = (req, res) => responder(res, 'Error al calcular el aviso', async () => {
  const ahora = ahoraArgentina();
  const { datos, error } = validarAvisoDelEvento(req.query, ahora.slice(0, 10));
  if (error) return rechazo(error);
  const { momento, texto } = avisoDe(datos, { ahora, feriados: await feriadosParaLosAvisos(datos.fecha, datos.fecha) });
  return conDatos({ momento, texto });
});

// GET /api/mi-espacio/personas: con quiénes se puede compartir (`personasParaCompartir`: id, nombre e iniciales), sin quien
// pide. Solo administración comparte: al resto, 403
export const listarPersonasParaCompartir = (req, res) => responder(res, 'Error al obtener las personas', async () => {
  if (!esAdmin(req.user.rol)) return [403, { success: false, error: MENSAJES_EVENTO.sinPermiso }];
  return conDatos(await personasParaCompartir(req.user.userId));
});

// POST /api/mi-espacio/eventos: un evento nuevo de la persona, con sus personas
export const crearEvento = (req, res) => guardarEvento(res, 'Error al guardar el evento', async (conexion) => {
  const usuario = quienPide(req);
  const { datos, error } = await datosDelGuardado(cuerpoDe(req), { usuario }, conexion);
  if (error) return rechazo(error);
  const [resultado] = await conexion.query(
    `INSERT INTO mi_espacio_eventos (titulo, detalle, fecha, desde, hasta, compartido, para_todos, recordatorio, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...valoresDelEvento(datos), usuario.id]
  );
  await guardarPersonas(conexion, resultado.insertId, datos, []);
  return [201, { success: true, data: { id: resultado.insertId }, message: 'Evento guardado.' }];
});

// PUT /api/mi-espacio/eventos/:id: cambia un evento de la persona con el formulario entero (solo quien lo creó)
export const cambiarEvento = (req, res) => guardarEvento(res, 'Error al cambiar el evento', async (conexion) => {
  const usuario = quienPide(req);
  const antes = await eventoPropio(req.params.id, usuario.id, conexion, { bloquear: true });
  if (antes === null) return noEncontrado();
  const { datos, error } = await datosDelGuardado(cuerpoDe(req), { usuario, anterior: antes }, conexion);
  if (error) return rechazo(error);
  await conexion.query(
    `UPDATE mi_espacio_eventos
     SET titulo = ?, detalle = ?, fecha = ?, desde = ?, hasta = ?, compartido = ?, para_todos = ?, recordatorio = ?
     WHERE id = ?`,
    [...valoresDelEvento(datos), antes.id]
  );
  await guardarPersonas(conexion, antes.id, datos, antes.personas);
  return [200, { success: true, data: { id: antes.id }, message: 'Evento cambiado.' }];
});

// DELETE /api/mi-espacio/eventos/:id: baja lógica de un evento de la persona (solo quien lo creó)
export const borrarEvento = (req, res) => guardarEvento(res, 'Error al borrar el evento', async (conexion) => {
  const antes = await eventoPropio(req.params.id, req.user.userId, conexion, { bloquear: true });
  if (antes === null) return noEncontrado();
  await conexion.query('UPDATE mi_espacio_eventos SET activo = 0 WHERE id = ?', [antes.id]);
  return [200, { success: true, message: 'Evento borrado.' }];
});

/**
 * La fila de una invitada con su recordatorio (spec, sección 2), con el evento bloqueado (sus filas, las de ahora): en uno
 * con personas, la suya (la tiene: por eso lo ve); con «Todos», apagar la crea (o la marca) y prender la borra. Se escribe
 * por la clave y solo si cambia algo.
 */
const guardarMiFila = async (conexion, evento, usuarioId, sinAviso) => {
  const mia = evento.personas.find((persona) => persona.id === usuarioId);
  if (evento.para_todos && !sinAviso) {
    if (mia) {
      await conexion.query('DELETE FROM mi_espacio_evento_personas WHERE evento_id = ? AND usuario_id = ?', [evento.id, usuarioId]);
    }
  } else if (mia) {
    await conexion.query('UPDATE mi_espacio_evento_personas SET sin_recordatorio = ? WHERE evento_id = ? AND usuario_id = ?',
      [sinAviso ? 1 : 0, evento.id, usuarioId]);
  } else {
    await conexion.query('INSERT INTO mi_espacio_evento_personas (evento_id, usuario_id, sin_recordatorio) VALUES (?, ?, 1)',
      [evento.id, usuarioId]);
  }
};

// PUT /api/mi-espacio/eventos/:id/mi-recordatorio (`{ sin_aviso: true | false }`): una invitada apaga o prende su
// recordatorio; el evento no cambia. Responde su recordatorio y cuándo sale, como los da itemDeEvento
export const cambiarMiRecordatorio = (req, res) => responder(res, 'Error al cambiar tu recordatorio', () =>
  enTransaccion(async (conexion) => {
    const usuario = quienPide(req);
    const evento = await eventoVisible(req.params.id, usuario, conexion, { bloquear: true });
    if (evento === null) return noEncontrado();
    if (evento.creado_por === usuario.id) return rechazo({ campo: null, mensaje: MENSAJES_EVENTO.esTuyo });
    const { sin_aviso: sinAviso } = cuerpoDe(req);
    if (typeof sinAviso !== 'boolean') return rechazo({ campo: 'sin_aviso', mensaje: MENSAJES_EVENTO.miRecordatorio });
    await guardarMiFila(conexion, evento, usuario.id, sinAviso);
    const personas = [...evento.personas.filter((persona) => persona.id !== usuario.id),
      { id: usuario.id, nombre: '', sin_recordatorio: sinAviso }];
    const feriados = await feriadosParaLosAvisos(evento.fecha, evento.fecha);
    const { mi_recordatorio: miRecordatorio, aviso } =
      itemDeEvento({ ...evento, personas }, { usuarioId: usuario.id, ahora: ahoraArgentina(), feriados });
    return [200, {
      success: true, data: { mi_recordatorio: miRecordatorio, aviso },
      message: sinAviso ? 'Recordatorio apagado.' : 'Recordatorio prendido.'
    }];
  }));
