// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 10): el panel personal de cada usuario, con sus licencias y
// sus horas extras. Todas las rutas llevan authMiddleware y trabajan siempre sobre req.user.userId: nadie ve lo de otra persona.
// Lo cargado se lee con services/miEspacioDatos.js, se calcula con las reglas puras (services/miEspacioReglas.js) y se arma
// como datos con services/miEspacioResumen.js: la página imprime los números y los textos tal cual (Ruling 19). Hoy es
// hoyArgentina(). Respuestas { success, data?, error?, campo? }; un año que no sirve da 400 en `anio`, antes que nada.
// Sin modalidad (sin vínculo cargado en Configuración → Usuarios), las licencias, las horas extras, el año y el saldo inicial
// responden { modalidad: null, mensaje } y no muestran nada; el Resumen lo dice en su `mensaje` (sección 1).
// Las licencias se cargan, se corrigen y se borran (baja lógica) acá, cada una en una transacción con la fila de la persona
// bloqueada; una carga que no cierra (`evaluarLicencia`) no se guarda. Un id de otra persona responde 404, como uno que no
// existe: no se revela que existe (sección 10).
import pool from '../config/database.js';
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_MI_ESPACIO, DIAS_VACACIONES, anioVigente, camposDelSaldoInicial, textoDeLasMitades, evaluarLicencia
} from '../services/miEspacioReglas.js';
import { resumenDe, filasDeLicencias, tablaDeHorasExtras, proximoFeriadoDe } from '../services/miEspacioResumen.js';
import { estadoDe, contextoDe } from '../services/miEspacioDatos.js';
import { idPositivo } from '../services/proyectosReglas.js';
import { esAdmin } from '../services/usuariosReglas.js';

// Los años que se pueden pedir (las reglas aceptan más: el control va acá)
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

// El año del pedido como número: sin `anio` (o vacío), el en curso; un texto de cuatro cifras de ANIO_MINIMO a ANIO_MAXIMO, ese
// año; cualquier otra cosa ('abc', '1999', '2026.5', ' 2026', un `anio` repetido, que Express da como lista), null (400)
const anioDelPedido = (valor, hoy) => {
  if (valor === undefined || valor === '') return Number(hoy.slice(0, 4));
  if (typeof valor !== 'string' || !/^\d{4}$/.test(valor)) return null;
  const anio = Number(valor);
  return anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO ? anio : null;
};

// [status, cuerpo]: lo que responde cada ruta
const rechazoDelAnio = () => [400, { success: false, error: MENSAJES_MI_ESPACIO.anio, campo: 'anio' }];
const sinModalidad = () => [200, { success: true, data: { modalidad: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad } }];
const conDatos = (data) => [200, { success: true, data }];

// Responde lo que devolvió la operación, o 500 con `mensaje` si algo inesperado falló (el error completo, solo en la consola)
const responder = async (res, mensaje, operacion) => {
  try {
    const [status, cuerpo] = await operacion();
    res.status(status).json(cuerpo);
  } catch (error) {
    console.error(`${mensaje}:`, error);
    res.status(500).json({ success: false, error: mensaje });
  }
};

// GET /api/mi-espacio/resumen: el Resumen «Niveles», ya calculado. «Hoy y mañana» lleva el próximo feriado, con las mismas
// filas de los feriados del cálculo (sin leerlas otra vez)
export const verResumen = (req, res) => responder(res, 'Error al obtener el Resumen', async () => {
  const hoy = hoyArgentina();
  const { persona, estado, feriados, filasFeriados, calculo } = await contextoDe(req.user.userId, hoy);
  const hoyYManana = { ausentes: [], proximo_feriado: proximoFeriadoDe(filasFeriados, hoy) };
  return conDatos(resumenDe({ persona, estado, calculo, hoy, feriados, hoyYManana }));
});

// GET /api/mi-espacio/licencias?anio=AAAA: la pestaña Licencias de un año (sin `anio`, el en curso)
export const listarLicenciasMias = (req, res) => responder(res, 'Error al obtener las licencias', async () => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return rechazoDelAnio();
  const { persona, estado, feriados, calculo } = await contextoDe(req.user.userId, hoy);
  if (estado.modalidad === null) return sinModalidad();
  // Sin el paso a Configuración todavía: ninguna fila tiene vínculo con una licencia de Configuración
  return conDatos(filasDeLicencias(estado, calculo, { anio, hoy, persona, vinculos: new Map(), feriados }));
});

// GET /api/mi-espacio/horas-extras?anio=AAAA: la pestaña Horas extras de un año (sin `anio`, el en curso)
export const listarHorasExtras = (req, res) => responder(res, 'Error al obtener las horas extras', async () => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return rechazoDelAnio();
  const { estado, feriados, calculo } = await contextoDe(req.user.userId, hoy);
  if (estado.modalidad === null) return sinModalidad();
  return conDatos(tablaDeHorasExtras(estado, calculo, { anio, hoy, feriados }));
});

// GET /api/mi-espacio/anio/:anio: los días de vacaciones y los estudios que valen ese año, para «Mis vacaciones y saldos». Si no
// los eligió para ese año, los del anterior más cercano (`anioVigente`), con `heredado`; sin ninguno, null. `texto_mitades` es
// el de esos días (null sin ninguno) y `textos_mitades`, el de cada valor de DIAS_VACACIONES ('10' a '30'): el modal muestra el
// del botón elegido sin recalcular
export const verAnio = (req, res) => responder(res, 'Error al obtener el año', async () => {
  const anio = anioDelPedido(req.params.anio, hoyArgentina());
  if (anio === null) return rechazoDelAnio();
  const estado = await estadoDe(req.user.userId);
  if (estado.modalidad === null) return sinModalidad();
  const vigente = anioVigente(estado.anios, anio);
  return conDatos({
    anio,
    dias_vacaciones: vigente?.dias_vacaciones ?? null,
    estudios: vigente?.estudios ?? null,
    heredado: vigente !== null && vigente.anio !== anio,
    texto_mitades: textoDeLasMitades(anio, vigente?.dias_vacaciones),
    textos_mitades: Object.fromEntries(DIAS_VACACIONES.map((dias) => [String(dias), textoDeLasMitades(anio, dias)]))
  });
});

// GET /api/mi-espacio/saldo-inicial: los campos de «Para arrancar» (`camposDelSaldoInicial`, con el arranque o, si todavía no
// hay, con hoy), cada uno con lo guardado en `valor` (null si no hay nada guardado de ese concepto y ese año)
export const verSaldoInicial = (req, res) => responder(res, 'Error al obtener el saldo inicial', async () => {
  const hoy = hoyArgentina();
  const estado = await estadoDe(req.user.userId);
  if (estado.modalidad === null) return sinModalidad();
  const { modalidad, arranque, anios, saldos } = estado;
  const campos = camposDelSaldoInicial({ modalidad, arranque: arranque ?? hoy, anios }).map((campo) => ({
    ...campo,
    valor: saldos.find((saldo) => saldo.concepto === campo.concepto && saldo.anio === campo.anio)?.cantidad ?? null
  }));
  return conDatos({ arranque, modalidad, campos });
});

// Las licencias: cargar, corregir y borrar (spec, 3.8, 3.10 y sección 10)

// Cuántas veces se intenta una transacción que MariaDB cortó por un bloqueo mutuo
const INTENTOS = 2;

/**
 * Corre trabajo(conexion) en una transacción, con la fila de la persona bloqueada (`SELECT … FOR UPDATE`) antes de leer
 * nada, y devuelve su [status, cuerpo]: un 2xx la confirma, cualquier otro la deshace. Con REPEATABLE READ, lo que ve la
 * transacción queda fijo en su primera lectura común: por eso el bloqueo va primero. Así dos cargas a la vez de la misma
 * persona (dos pestañas, un doble clic) se ordenan, y la segunda ve lo que guardó la primera (Review Focus 3). Si MariaDB la
 * corta por un bloqueo mutuo (ER_LOCK_DEADLOCK: ya la deshizo entera), la repite una vez desde el principio.
 */
const enTransaccion = async (usuarioId, trabajo) => {
  for (let intento = 1; ; intento += 1) {
    let conexion;
    try {
      conexion = await pool.getConnection();
      await conexion.beginTransaction();
      await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
      const [status, cuerpo] = await trabajo(conexion);
      if (status < 300) await conexion.commit();
      else await conexion.rollback();
      return [status, cuerpo];
    } catch (error) {
      await conexion?.rollback().catch(() => {});
      if (error?.code !== 'ER_LOCK_DEADLOCK' || intento >= INTENTOS) throw error;
    } finally {
      conexion?.release();
    }
  }
};

// El cuerpo del pedido como objeto (sin cuerpo, o con algo que no es un objeto, {})
const cuerpoDe = (req) => {
  const { body } = req;
  return body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {};
};

// `evaluarLicencia` con lo de un pedido: el uso autorizado llega por la misma ruta, desde su propio formulario (no ofrecerlo
// en «Cargar licencia» le toca a la página)
const evaluar = (estado, entrada, { hoy, feriados, editadaId = null }) =>
  evaluarLicencia(estado, entrada, { hoy, feriados, editadaId, uso_autorizado: entrada.tipo === 'uso_autorizado' });

// La casilla «Mostrar a mis compañeros» la tiene solo administración («los compañeros» son administración: spec, sección 7);
// el lector y el colaborador guardan 0
const mostrarDe = (persona, datos) => (esAdmin(persona?.rol) ? datos.mostrar : 0);

// Un id que no es un entero positivo, de otra persona, que no existe o dado de baja: el mismo 404
const noEncontrada = () => [404, { success: false, error: MENSAJES_MI_ESPACIO.noEncontrada }];
// Lo que frena una carga (`evaluarLicencia`): 400 con su campo (null sin modalidad o sin arranque)
const rechazoDeLaCarga = ({ campo, mensaje }) => [400, { success: false, error: mensaje, campo }];

// POST /api/mi-espacio/licencias/calculo: el cálculo de «Cargar licencia» antes de guardar (`{ ...licencia, id? }`, con el
// id de la que se corrige), sin guardar nada. Un error va dentro de `data`, con 200: `{ error, vista }`
export const calcularLicencia = (req, res) => responder(res, 'Error al calcular la licencia', async () => {
  const hoy = hoyArgentina();
  const entrada = cuerpoDe(req);
  const { estado, feriados } = await contextoDe(req.user.userId, hoy);
  const { error, vista } = evaluar(estado, entrada, { hoy, feriados, editadaId: idPositivo(entrada.id) });
  return conDatos({ error, vista });
});

// POST /api/mi-espacio/licencias: carga una licencia de la persona
export const cargarLicenciaMia = (req, res) => responder(res, 'Error al cargar la licencia', () => {
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  return enTransaccion(usuarioId, async (conexion) => {
    const { persona, estado, feriados } = await contextoDe(usuarioId, hoy, conexion);
    const { datos, error } = evaluar(estado, entrada, { hoy, feriados });
    if (error) return rechazoDeLaCarga(error);
    const [resultado] = await conexion.query(
      `INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, mostrar, nota)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, datos.tipo, datos.desde, datos.hasta, datos.horas, mostrarDe(persona, datos), datos.nota]
    );
    return [201, { success: true, data: { id: resultado.insertId }, message: 'Licencia cargada.' }];
  });
});

// PUT /api/mi-espacio/licencias/:id: corrige una licencia activa de la persona (la corregida no choca consigo misma)
export const corregirLicenciaMia = (req, res) => responder(res, 'Error al corregir la licencia', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrada();
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  return enTransaccion(usuarioId, async (conexion) => {
    const { persona, estado, feriados } = await contextoDe(usuarioId, hoy, conexion);
    if (!estado.licencias.some((fila) => fila.id === id)) return noEncontrada();
    const { datos, error } = evaluar(estado, entrada, { hoy, feriados, editadaId: id });
    if (error) return rechazoDeLaCarga(error);
    await conexion.query(
      `UPDATE mi_espacio_licencias SET tipo = ?, desde = ?, hasta = ?, horas = ?, mostrar = ?, nota = ?
       WHERE id = ? AND usuario_id = ? AND activo = 1`,
      [datos.tipo, datos.desde, datos.hasta, datos.horas, mostrarDe(persona, datos), datos.nota, id, usuarioId]
    );
    return [200, { success: true, data: { id }, message: 'Licencia corregida.', avisos: [] }];
  });
});

// DELETE /api/mi-espacio/licencias/:id: baja lógica de una licencia activa de la persona. Nunca se frena: borrar solo libera
// días (spec, 3.10)
export const borrarLicenciaMia = (req, res) => responder(res, 'Error al borrar la licencia', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrada();
  const usuarioId = req.user.userId;
  return enTransaccion(usuarioId, async (conexion) => {
    const [resultado] = await conexion.query(
      'UPDATE mi_espacio_licencias SET activo = 0 WHERE id = ? AND usuario_id = ? AND activo = 1', [id, usuarioId]
    );
    if (resultado.affectedRows === 0) return noEncontrada();
    return [200, { success: true, message: 'Licencia borrada.' }];
  });
});
