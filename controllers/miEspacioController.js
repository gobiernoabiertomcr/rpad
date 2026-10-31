// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 10): el panel personal de cada usuario, con sus licencias y
// sus horas extras. Todas las rutas llevan authMiddleware y trabajan siempre sobre req.user.userId: nadie ve lo de otra persona.
// Lo cargado se lee con services/miEspacioDatos.js, se calcula con las reglas puras (services/miEspacioReglas.js) y se arma
// como datos con services/miEspacioResumen.js: la página imprime los números y los textos tal cual (Ruling 19). Hoy es
// hoyArgentina(). Respuestas { success, data?, error?, campo?, message? } (el 400 de los días de PUT /mi-espacio/salidas suma
// `fecha` y `errores`); un año que no sirve da 400 en `anio`, antes que nada.
// Sin modalidad (sin vínculo cargado en Configuración → Usuarios), las licencias, las horas extras, el año y el saldo inicial
// responden { modalidad: null, mensaje } y no muestran nada; el Resumen lo dice en su `mensaje` (sección 1).
// Las licencias se cargan, se corrigen y se borran (baja lógica) acá, cada una en una transacción; una carga que no cierra
// (`evaluarLicencia`) no se guarda. Las ausencias de día entero de quien puede tener licencia pasan a Configuración →
// Licencias en la misma transacción (sección 6, services/miEspacioPaso.js). Las horas extras, los días de cada año y el saldo
// inicial («Mis vacaciones y saldos», sección 4) se guardan también cada uno en una transacción, sin tocar Configuración, y
// ningún faltante los frena (3.10). Las personas de contrato cargan sus horas en la planilla (spec 2026-10-27-mi-espacio-horas,
// sección 8: GET y PUT /mi-espacio/salidas, todos los días de un guardado o ninguno), y las de planta, en sus horas extras:
// cada una rechaza a la otra modalidad. La nota de una licencia (spec 2026-10-27-mi-espacio-licencia-word) se arma en el
// momento, para la vista y para el Word, y no se guarda. Un id de otra persona responde 404, como uno que no existe: no se
// revela que existe (sección 10). Lo único de otras personas que se ve es «Hoy no están» (sección 7: quién de administración
// no está, nunca de qué), los eventos que le compartieron o le muestran (un Personal (Público), solo «Carla: Turno médico»),
// en «Hoy y mañana» (los de la agenda: controllers/miEspacioEventosController.js) y, solo el firmante titular, las personas
// que puede autorizar con sus licencias (sección 6), como en Configuración.
import pool from '../config/database.js';
import { hoyArgentina, ahoraArgentina, sumarDias, diasEntre, esFechaIso } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_MI_ESPACIO, DIAS_VACACIONES, MAXIMO_DIAS_POR_GUARDADO, anioVigente, camposDelSaldoInicial, textoDeLasMitades,
  evaluarLicencia, validarHorasExtras, validarSalida, mesDeLaPlanilla, validarAnio, validarSaldoInicial, modalidadDe,
  ausenciasUnidas, ausentesDelRango, ausentesDeHoyYManana, nombreCorto
} from '../services/miEspacioReglas.js';
import {
  resumenDe, filasDeLicencias, filaDeUnaLicencia, tablaDeHorasExtras, planillaDelMes, proximoFeriadoDe, textoDeLaListaDe
} from '../services/miEspacioResumen.js';
import {
  estadoDe, contextoDe, personaDe, licenciaDe, datosDeLaNota, ausenciasVisibles, feriadosPara, administracionActiva,
  usuariosActivos
} from '../services/miEspacioDatos.js';
import { filasDeFeriados } from '../services/feriadosDatos.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { notaDeLicencia, htmlDeLaNota, aclaracionDeLaNota, MENSAJES_NOTA } from '../services/miEspacioNota.js';
import { renderNotaDocx, TIPO_WORD } from '../services/miEspacioNotaWord.js';
import { disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import { aplicarCarga, aplicarCorreccion, aplicarBaja, pasoPrevisto, vinculosDe } from '../services/miEspacioPaso.js';
import {
  bloquearUsuarios, firmanteTitular, autorizables, conSusLicencias
} from '../services/licenciasOficialesService.js';
import { puedeTenerLicencia } from '../services/licenciasReglas.js';
import { idPositivo } from '../services/proyectosReglas.js';
import { esAdmin } from '../services/usuariosReglas.js';
import { eventosVisibles } from '../services/miEspacioEventosDatos.js';
import { itemDeEvento, eventosDeHoyYManana } from '../services/miEspacioEventosReglas.js';

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

// Responde lo que devolvió la operación, o 500 con `mensaje` si algo inesperado falló (la pila del error, solo en la consola).
// Solo la pila: los errores de mysql2 traen la consulta armada con sus valores, y en una licencia son el tipo y la nota
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
 * Los eventos de «Hoy y mañana» (spec 2026-10-26-mi-espacio-agenda, sección 6, y spec 2026-10-27-mi-espacio-resumen, 4.4):
 * los que la persona (`{ id, rol }`) ve hoy y mañana, como en la agenda (`eventosVisibles` e `itemDeEvento`), en
 * `eventosDeHoyYManana`, cada uno con su `dia` y su `quien`. El mismo `ahora` (`ahoraArgentina()`) da el aviso de cada evento
 * y saca los de hoy que ya terminaron (decisión del usuario, 27/10/2026). `feriados`: el Set del cálculo (cubre el aviso de
 * cada evento); `administracion`: la del contexto (`administracionActiva`, sin leerla otra vez), que da el nombre corto de
 * quien lo creó y de quién está («de Julián», «con Carla»; spec 2026-10-28-mi-espacio-agenda-onda, 5.1); `usuarios`: todos los
 * usuarios activos (`usuariosActivos`), contra los que va el nombre corto de un Personal (Público) («Carla: Turno médico»,
 * «lo ven Julián y Tomás como «…»»; spec 2026-10-29-mi-espacio-evento-publico, 5.4 y 6.3). Aislado: si leerlos falla, el
 * Resumen sale igual, con [], y el error queda en la consola.
 */
const eventosDelResumen = async (usuario, hoy, { feriados, administracion, usuarios }) => {
  try {
    const eventos = await eventosVisibles(usuario, hoy, sumarDias(hoy, 1));
    const ahora = ahoraArgentina();
    const contexto = { usuarioId: usuario.id, ahora, feriados, administracion, usuarios };
    return eventosDeHoyYManana(eventos.map((evento) => itemDeEvento(evento, contexto)), hoy, ahora);
  } catch (error) {
    console.error('Error al obtener los eventos de hoy y mañana:', error?.stack ?? error);
    return [];
  }
};

/**
 * Todos los usuarios activos, para el nombre corto de un Personal (Público) en «Hoy y mañana» (`usuariosActivos`). Aislados,
 * como los eventos: si leerlos falla, el Resumen sale igual (los nombres de un Público, con el primer nombre) y el error queda
 * en la consola.
 */
const usuariosDelResumen = async () => {
  try {
    return await usuariosActivos();
  } catch (error) {
    console.error('Error al obtener los usuarios de hoy y mañana:', error?.stack ?? error);
    return [];
  }
};

/**
 * Los vínculos de las licencias con Configuración para `para_revisar` del Resumen (`vinculosDe`, como la lista; spec
 * 2026-10-28-mi-espacio-licencia-anulada, 2.2). Aislados, como los eventos: antes de `para_revisar` el Resumen no leía las
 * tablas de Configuración, así que si leerlos falla sale igual, sin nada para revisar (un Map vacío), y el error queda en la
 * consola.
 */
const vinculosDelResumen = async (persona, estado, hoy) => {
  try {
    return await vinculosDe(persona, estado, hoy);
  } catch (error) {
    console.error('Error al obtener lo que hay para revisar en el Resumen:', error?.stack ?? error);
    return new Map();
  }
};

// GET /api/mi-espacio/resumen: el Resumen «Titular», ya calculado. «Hoy y mañana» lleva los compañeros que no están hoy y, aparte,
// los que empiezan mañana (`ausentesPara` de hoy a mañana, en dos grupos con `ausentesDeHoyYManana`: decisión del usuario,
// 27/10/2026; a quien no es de administración, ninguno; con la administración del contexto, sin leerla otra vez), el próximo
// feriado, con las mismas filas de los feriados del cálculo (sin leerlas otra vez), y, al final, los eventos de hoy y de
// mañana (`eventos`, aislados: ver eventosDelResumen). Con los vínculos de sus licencias con Configuración (`vinculosDe`,
// como la lista, también aislados: ver vinculosDelResumen), `para_revisar` dice lo que en Configuración quedó distinto (spec
// 2026-10-28-mi-espacio-licencia-anulada, 2.2, 3.1 y 3.2). Van también sin modalidad: la página decide qué mostrar
export const verResumen = (req, res) => responder(res, 'Error al obtener el Resumen', async () => {
  const hoy = hoyArgentina();
  const { persona, estado, feriados, filasFeriados, administracion, calculo } = await contextoDe(req.user.userId, hoy);
  const [{ ausentes }, eventos, vinculos] = await Promise.all([
    ausentesPara(persona, { desde: hoy, hasta: sumarDias(hoy, 1), hoy, filasFeriados, administracion }),
    usuariosDelResumen().then((usuarios) =>
      eventosDelResumen({ id: req.user.userId, rol: req.user.rol }, hoy, { feriados, administracion, usuarios })),
    vinculosDelResumen(persona, estado, hoy)
  ]);
  const hoyYManana = {
    ...ausentesDeHoyYManana(ausentes, hoy), proximo_feriado: proximoFeriadoDe(filasFeriados, hoy), eventos
  };
  return conDatos(resumenDe({ persona, estado, calculo, hoy, feriados, hoyYManana, vinculos }));
});

// GET /api/mi-espacio/licencias?anio=AAAA: la pestaña Licencias de un año (sin `anio`, el en curso). Cada fila dice cómo
// está en Configuración (`configuracion`) y, una creada, qué se puede hacer con sus fechas (`vinculosDe`); `otros_anios`, las
// licencias de otros años del selector que todavía no terminaron (spec 2026-10-28-mi-espacio-licencia-anulada, 2.3)
export const listarLicenciasMias = (req, res) => responder(res, 'Error al obtener las licencias', async () => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return rechazoDelAnio();
  const { persona, estado, feriados, calculo } = await contextoDe(req.user.userId, hoy);
  if (estado.modalidad === null) return sinModalidad();
  const vinculos = await vinculosDe(persona, estado, hoy);
  return conDatos(filasDeLicencias(estado, calculo, { anio, hoy, persona, vinculos, feriados }));
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
// del botón elegido sin recalcular. Los dos, con el arranque o, si todavía no hay, con hoy, como los campos del saldo inicial
// (verSaldoInicial): en el año del arranque, desde el 1/7, la primera mitad es lo que se escribe en «De la AAAA» (spec
// 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8)
export const verAnio = (req, res) => responder(res, 'Error al obtener el año', async () => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.params.anio, hoy);
  if (anio === null) return rechazoDelAnio();
  const estado = await estadoDe(req.user.userId);
  if (estado.modalidad === null) return sinModalidad();
  const vigente = anioVigente(estado.anios, anio);
  const opciones = { arranque: estado.arranque ?? hoy };
  return conDatos({
    anio,
    dias_vacaciones: vigente?.dias_vacaciones ?? null,
    estudios: vigente?.estudios ?? null,
    heredado: vigente !== null && vigente.anio !== anio,
    texto_mitades: textoDeLasMitades(anio, vigente?.dias_vacaciones, opciones),
    textos_mitades: Object.fromEntries(DIAS_VACACIONES.map((dias) => [String(dias), textoDeLasMitades(anio, dias, opciones)]))
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

// Las licencias: cargar, corregir y borrar (spec, 3.8, 3.10 y sección 10), con el paso a Configuración → Licencias en la
// misma transacción (sección 6, services/miEspacioPaso.js)

// Cuántas veces se intenta una transacción que MariaDB cortó por un bloqueo mutuo
const INTENTOS = 2;
// Lo que devuelve el trabajo de una transacción que empezó bloqueando solo la fila de la persona y que, con lo que leyó bajo
// el bloqueo, puede tocar Configuración: se deshace y vuelve a empezar bloqueando a todos los usuarios
const CON_TODOS = Symbol('con todos los usuarios bloqueados');

/**
 * Corre trabajo(conexion, conTodos) en una transacción y devuelve su [status, cuerpo]: un 2xx la confirma, cualquier otro la
 * deshace. Antes de leer nada, bloquea: con `conTodos`, a todos los usuarios (bloquearUsuarios, como Configuración → Licencias:
 * es lo que hace cuando la operación puede tocar una licencia de Configuración); si no, solo la fila de la persona
 * (`SELECT … FOR UPDATE`). Siempre como primera sentencia: bloquear la fila propia y después a todos podría trabarse con una
 * carga de Configuración, y con REPEATABLE READ lo que ve la transacción queda fijo en su primera lectura común. Así dos
 * cargas a la vez de la misma persona (dos pestañas, un doble clic) se ordenan, y la segunda ve lo que guardó la primera
 * (Review Focus 3). Si el trabajo devuelve CON_TODOS (el rol cambió entre la lectura previa y el bloqueo), vuelve a empezar
 * con todos bloqueados. Si MariaDB la corta por un bloqueo mutuo (ER_LOCK_DEADLOCK: ya la deshizo entera), la repite una vez
 * desde el principio.
 */
const enTransaccion = async (usuarioId, conTodos, trabajo) => {
  let todos = conTodos;
  let cortadas = 0;
  for (;;) {
    let conexion;
    try {
      conexion = await pool.getConnection();
      await conexion.beginTransaction();
      if (todos) await bloquearUsuarios(conexion);
      else await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
      const resultado = await trabajo(conexion, todos);
      if (resultado === CON_TODOS && !todos) {
        await conexion.rollback();
        todos = true;
        continue;
      }
      const [status, cuerpo] = resultado;
      if (status < 300) await conexion.commit();
      else await conexion.rollback();
      return [status, cuerpo];
    } catch (error) {
      await conexion?.rollback().catch(() => {});
      cortadas += 1;
      if (error?.code !== 'ER_LOCK_DEADLOCK' || cortadas >= INTENTOS) throw error;
    } finally {
      conexion?.release();
    }
  }
};

// Si una carga o una corrección puede tocar Configuración: la persona puede tener licencia (superadmin, admin y editor; el
// paso mira después si es de día entero y no termina antes de hoy). Se decide con el rol leído del pool antes de abrir la
// transacción, y se vuelve a mirar con el leído bajo el bloqueo
const puedePasar = (persona) => puedeTenerLicencia(persona?.rol);
// Si una baja puede tocar Configuración: la fila es una creada (pasoDeLaBaja no depende del rol)
const esCreada = (fila) => fila?.oficial === 'creada' && fila.licencia_oficial_id !== null;

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
// Lo que frena una carga (`evaluarLicencia`) o el paso a Configuración: su status (400, si no dice otro) con su campo (null
// sin modalidad, sin arranque o en el «ya empezó» de una baja)
const rechazoDeLaCarga = ({ status = 400, campo, mensaje }) => [status, { success: false, error: mensaje, campo }];

// El mensaje de Configuración para una persona a cargo que no es un id
const MENSAJE_AUTORIZADO_INVALIDO = 'La persona autorizada no es válida.';

/**
 * La persona a cargo del pedido (`autorizado_id`): `{ autorizado }`, con undefined si no vino, null para «nadie» (null o '')
 * o el id; o `{ error }` con el 400 en `autorizado_id`. Solo las vacaciones dejan persona a cargo (corrección del usuario a
 * la spec, sección 6): un valor en otro tipo es `autorizadoSoloVacaciones`, antes de abrir la transacción. Que la persona
 * sea el firmante titular y que la autorizada sirva lo controla Configuración (rechazoDeLaBase).
 */
const autorizadoDelPedido = (entrada) => {
  if (!Object.hasOwn(entrada, 'autorizado_id')) return { autorizado: undefined };
  const valor = entrada.autorizado_id;
  if (valor === null || valor === '') return { autorizado: null };
  if (entrada.tipo !== 'vacaciones') {
    return { error: { campo: 'autorizado_id', mensaje: MENSAJES_MI_ESPACIO.autorizadoSoloVacaciones } };
  }
  const id = idPositivo(valor);
  return id === null ? { error: { campo: 'autorizado_id', mensaje: MENSAJE_AUTORIZADO_INVALIDO } } : { autorizado: id };
};

// Lo que dejó el paso en la fila de Mi espacio
const DEL_PASO = 'licencia_oficial_id = ?, oficial = ?, sin_pasar = ?';
const valoresDelPaso = (paso) => [paso.licencia_oficial_id, paso.oficial, paso.sin_pasar];

/**
 * POST /api/mi-espacio/licencias/calculo: el cálculo de «Cargar licencia» antes de guardar (`{ ...licencia, id? }`, con el
 * id de la que se corrige), sin guardar nada: `{ error, vista, paso }`. Un error va dentro de `data`, con 200. `paso` es lo
 * que pasaría con Configuración (`pasoPrevisto`: `{ pasa, avisos, firmante, sin_pasar_previsto }`), o null si la licencia
 * no se puede guardar como está; un error del paso (el tipo fijo de unas vacaciones con persona a cargo, «ya empezó», «ya
 * terminó») va en `error` si la licencia no tiene otro. Lo que se anuncia de las Notas Digitales (la víspera, el límite para
 * cambiar el tipo) se cuenta con el calendario de las filas de los feriados que ya leyó `contextoDe` (spec
 * 2026-10-27-feriados-en-notas, 4): si no se pueden leer, Mi espacio no se calcula, como siempre
 */
export const calcularLicencia = (req, res) => responder(res, 'Error al calcular la licencia', async () => {
  const hoy = hoyArgentina();
  const entrada = cuerpoDe(req);
  const editadaId = idPositivo(entrada.id);
  const { persona, estado, feriados, filasFeriados } = await contextoDe(req.user.userId, hoy);
  const { datos, error, vista } = evaluar(estado, entrada, { hoy, feriados, editadaId });
  if (datos === null) return conDatos({ error, vista, paso: null });
  const anterior = estado.licencias.find((fila) => fila.id === editadaId) ?? null;
  const previsto = await pasoPrevisto(
    { persona, anterior, fila: { id: editadaId, ...datos }, hoy, calendario: calendarioCon(filasFeriados) }
  );
  return conDatos({ error: previsto.error, vista, paso: previsto.paso });
});

// POST /api/mi-espacio/licencias: carga una licencia de la persona y, si es de día entero, la pasa a Configuración (con el
// calendario de las filas de los feriados que ya leyó contextoDe)
export const cargarLicenciaMia = (req, res) => responder(res, 'Error al cargar la licencia', async () => {
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  const { autorizado, error: errorDelAutorizado } = autorizadoDelPedido(entrada);
  if (errorDelAutorizado) return rechazoDeLaCarga(errorDelAutorizado);
  return enTransaccion(usuarioId, puedePasar(await personaDe(usuarioId)), async (conexion, conTodos) => {
    const { persona, estado, feriados, filasFeriados } = await contextoDe(usuarioId, hoy, conexion);
    if (!conTodos && puedePasar(persona)) return CON_TODOS;
    const { datos, error } = evaluar(estado, entrada, { hoy, feriados });
    if (error) return rechazoDeLaCarga(error);
    const paso = await aplicarCarga(conexion,
      { persona, fila: datos, hoy, autorizadoId: autorizado ?? null, calendario: calendarioCon(filasFeriados) });
    if (paso.error) return rechazoDeLaCarga(paso.error);
    const [resultado] = await conexion.query(
      `INSERT INTO mi_espacio_licencias (usuario_id, tipo, desde, hasta, horas, mostrar, nota, licencia_oficial_id, oficial,
         sin_pasar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, datos.tipo, datos.desde, datos.hasta, datos.horas, mostrarDe(persona, datos), datos.nota,
        ...valoresDelPaso(paso)]
    );
    return [201, { success: true, data: { id: resultado.insertId }, message: 'Licencia cargada.' }];
  });
});

// PUT /api/mi-espacio/licencias/:id: corrige una licencia activa de la persona (la corregida no choca consigo misma) y
// Configuración la sigue, si corresponde (con el calendario de las filas de los feriados que ya leyó contextoDe)
export const corregirLicenciaMia = (req, res) => responder(res, 'Error al corregir la licencia', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrada();
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  const { autorizado, error: errorDelAutorizado } = autorizadoDelPedido(entrada);
  if (errorDelAutorizado) return rechazoDeLaCarga(errorDelAutorizado);
  return enTransaccion(usuarioId, puedePasar(await personaDe(usuarioId)), async (conexion, conTodos) => {
    const { persona, estado, feriados, filasFeriados } = await contextoDe(usuarioId, hoy, conexion);
    if (!conTodos && puedePasar(persona)) return CON_TODOS;
    const anterior = estado.licencias.find((fila) => fila.id === id);
    if (!anterior) return noEncontrada();
    const { datos, error } = evaluar(estado, entrada, { hoy, feriados, editadaId: id });
    if (error) return rechazoDeLaCarga(error);
    const paso = await aplicarCorreccion(conexion, {
      persona, anterior, fila: { id, ...datos }, hoy, autorizadoPedido: autorizado, calendario: calendarioCon(filasFeriados)
    });
    if (paso.error) return rechazoDeLaCarga(paso.error);
    await conexion.query(
      `UPDATE mi_espacio_licencias SET tipo = ?, desde = ?, hasta = ?, horas = ?, mostrar = ?, nota = ?, ${DEL_PASO}
       WHERE id = ? AND usuario_id = ? AND activo = 1`,
      [datos.tipo, datos.desde, datos.hasta, datos.horas, mostrarDe(persona, datos), datos.nota, ...valoresDelPaso(paso), id,
        usuarioId]
    );
    return [200, { success: true, data: { id }, message: 'Licencia corregida.', avisos: paso.avisos }];
  });
});

// DELETE /api/mi-espacio/licencias/:id: baja lógica de una licencia activa de la persona. En Mi espacio nunca se frena
// (borrar solo libera días: spec, 3.10); una creada que ya empezó no se borra, porque no se puede anular en Configuración
export const borrarLicenciaMia = (req, res) => responder(res, 'Error al borrar la licencia', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrada();
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  return enTransaccion(usuarioId, esCreada(await licenciaDe(usuarioId, id)), async (conexion, conTodos) => {
    const fila = await licenciaDe(usuarioId, id, conexion);
    if (!fila) return noEncontrada();
    if (!conTodos && esCreada(fila)) return CON_TODOS;
    const persona = await personaDe(usuarioId, conexion);
    const paso = await aplicarBaja(conexion, { persona, fila, hoy });
    if (paso.error) return rechazoDeLaCarga(paso.error);
    await conexion.query(
      'UPDATE mi_espacio_licencias SET activo = 0 WHERE id = ? AND usuario_id = ? AND activo = 1', [id, usuarioId]
    );
    return [200, { success: true, message: 'Licencia borrada.' }];
  });
});

// La nota de una licencia (spec 2026-10-27-mi-espacio-licencia-word, secciones 4 y 5): la nota en papel para pedir la
// licencia, armada en el momento con lo que hay en la base (nunca se guarda). Solo lectura

// Los rechazos de notaDeLicencia, por su clave: el uso autorizado no tiene nota (404) y una licencia de días sin ningún día
// hábil, por un feriado cargado después, no tiene qué pedir (409). Cualquier otra clave ('error': una licencia o una persona
// que no arman una nota) no está acá: es un 500
const RECHAZOS_DE_LA_NOTA = Object.freeze({ sinNota: 404, sinDiasHabiles: 409 });

/**
 * Lo que comparten las dos rutas de la nota: `{ rechazo }` con el [status, cuerpo] de un 404 o un 409, o `{ nota, guardada,
 * licencia, contexto }`. La licencia tiene que ser activa y de la persona (`datosDeLaNota`, que trae también la fecha de la
 * nota y la firma); un id que no es un entero positivo, de otra persona, que no existe o dado de baja da el mismo 404. La
 * licencia sale del `estado` de `contextoDe` (con sus horas como número) y los días hábiles se cuentan con sus feriados, como
 * la lista. Sin modalidad, la nota se arma igual: el texto no depende de ella. Una nota que no se puede armar (la clave
 * 'error') tira, y la ruta responde 500 con el mensaje fijo (el detalle, solo en la consola).
 */
const leerLaNota = async (usuarioId, licenciaId, hoy) => {
  const id = idPositivo(licenciaId);
  if (id === null) return { rechazo: noEncontrada() };
  const datos = await datosDeLaNota(usuarioId, id);
  if (datos === null) return { rechazo: noEncontrada() };
  const contexto = await contextoDe(usuarioId, hoy);
  // Borrada entre las dos lecturas: tampoco está
  const licencia = contexto.estado.licencias.find((fila) => fila.id === id);
  if (!licencia) return { rechazo: noEncontrada() };
  const { guardada, nombre, cargo, vinculo } = datos;
  // Las salidas de la planilla: las horas a favor nombran los días tildados «Sumar a {mes anterior}» que suman a sus horas
  const { nota, error } = notaDeLicencia(licencia,
    { fecha: guardada, persona: { nombre, cargo, vinculo }, feriados: contexto.feriados, salidas: contexto.estado.salidas });
  if (error !== undefined) {
    if (!Object.hasOwn(RECHAZOS_DE_LA_NOTA, error)) throw new Error(`La licencia ${id} no arma una nota (${error})`);
    return { rechazo: [RECHAZOS_DE_LA_NOTA[error], { success: false, error: MENSAJES_NOTA[error] }] };
  }
  return { nota, guardada, licencia, contexto };
};

// GET /api/mi-espacio/licencias/:id/nota: lo que necesita el segundo paso de «Cargar licencia», en una sola respuesta: la
// licencia como la arma la lista (`fila`, aunque la lista muestre otro año o no muestre nada, sin modalidad), la hoja de la
// nota (`html`, armada y escapada acá), su fecha, el renglón que va arriba (`aclaracion`) y en qué lista de Licencias quedó
// (`lista`, «Está en la lista de 2027.», solo si no es la del año de hoy; si no, null: spec
// 2026-10-28-mi-espacio-licencia-anulada, 2.3)
export const verNotaDeLicencia = (req, res) => responder(res, MENSAJES_NOTA.error, async () => {
  const hoy = hoyArgentina();
  const { rechazo, nota, guardada, licencia, contexto } = await leerLaNota(req.user.userId, req.params.id, hoy);
  if (rechazo) return rechazo;
  const { persona, estado, feriados, calculo } = contexto;
  const vinculos = await vinculosDe(persona, estado, hoy);
  return conDatos({
    fila: filaDeUnaLicencia(estado, calculo, { id: licencia.id, hoy, persona, vinculos, feriados }),
    html: htmlDeLaNota(nota),
    fecha: guardada,
    aclaracion: aclaracionDeLaNota(guardada),
    lista: textoDeLaListaDe(licencia.desde, hoy)
  });
});

// GET /api/mi-espacio/licencias/:id/word: la nota en Word, con el nombre del archivo en el Content-Disposition. Los errores
// van en JSON, como en las demás rutas; el 500, con el mensaje fijo y la pila solo en la consola, como `responder`
export const bajarWordDeLicencia = async (req, res) => {
  try {
    const { rechazo, nota } = await leerLaNota(req.user.userId, req.params.id, hoyArgentina());
    if (rechazo) {
      const [status, cuerpo] = rechazo;
      res.status(status).json(cuerpo);
      return;
    }
    const word = await renderNotaDocx(nota);
    res.set({ 'Content-Type': TIPO_WORD, 'Content-Disposition': disposicionDeAdjunto(nota.nombre) });
    res.send(word);
  } catch (error) {
    console.error(`${MENSAJES_NOTA.error}:`, error?.stack ?? error);
    res.status(500).json({ success: false, error: MENSAJES_NOTA.error });
  }
};

// Las horas extras: cargar, corregir y borrar (spec, 3.7 y sección 10). Nunca tocan Configuración: la transacción bloquea
// solo la fila de la persona, así dos cargas a la vez se ordenan y la segunda ve lo que guardó la primera. Desde la planilla
// de contrato (spec 2026-10-27-mi-espacio-horas, sección 8) son solo de planta: cargarlas o corregirlas a una persona de
// contrato da 400 (`contratoEnLaPlanilla`), así nadie de contrato crea horarios que ya no cuentan; borrarlas no se frena

// Un id que no es un entero positivo, de otra persona, que no existe o dado de baja: el mismo 404
const noEncontradas = () => [404, { success: false, error: MENSAJES_MI_ESPACIO.noEncontradas }];

// Lo que frena cargar o corregir unas horas extras antes de validarlas, como a una licencia (`evaluarLicencia`): sin
// modalidad o sin arranque, con campo null. Ningún faltante las frena: lo que deja de cerrar al corregirlas o borrarlas (un
// franco ya usado, unas horas a favor ya usadas) lo avisa el Resumen (spec, 3.10)
const frenoDeLasHorasExtras = (estado) => {
  if (estado.modalidad === null) return { campo: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad };
  if (estado.arranque === null) return { campo: null, mensaje: MENSAJES_MI_ESPACIO.sinArranque };
  return null;
};

// Contrato carga sus horas en la planilla: las horas extras de antes le dan 400 con campo null (después del freno)
const contratoEnLaPlanilla = () => rechazoDeLaCarga({ campo: null, mensaje: MENSAJES_MI_ESPACIO.contratoEnLaPlanilla });

// POST /api/mi-espacio/horas-extras: carga unas horas extras de la persona (`{ fecha, desde, hasta, nota }`, las horas
// 'HH:MM'; un horario que pasa la medianoche cuenta entero en `fecha`)
export const cargarHorasExtras = (req, res) => responder(res, 'Error al cargar las horas extras', async () => {
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  return enTransaccion(usuarioId, false, async (conexion) => {
    const estado = await estadoDe(usuarioId, conexion);
    const freno = frenoDeLasHorasExtras(estado);
    if (freno) return rechazoDeLaCarga(freno);
    if (estado.modalidad === 'contrato') return contratoEnLaPlanilla();
    const { datos, error } = validarHorasExtras(entrada, { hoy, estado });
    if (error) return rechazoDeLaCarga(error);
    const [resultado] = await conexion.query(
      'INSERT INTO mi_espacio_horas_extras (usuario_id, fecha, desde, hasta, nota) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, datos.fecha, datos.desde, datos.hasta, datos.nota]
    );
    return [201, { success: true, data: { id: resultado.insertId }, message: 'Horas extras cargadas.' }];
  });
});

// PUT /api/mi-espacio/horas-extras/:id: corrige unas horas extras activas de la persona (las corregidas no chocan consigo
// mismas). El 404 va antes que los frenos y que el de contrato
export const corregirHorasExtras = (req, res) => responder(res, 'Error al corregir las horas extras', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontradas();
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  return enTransaccion(usuarioId, false, async (conexion) => {
    const estado = await estadoDe(usuarioId, conexion);
    if (!estado.horasExtras.some((fila) => fila.id === id)) return noEncontradas();
    const freno = frenoDeLasHorasExtras(estado);
    if (freno) return rechazoDeLaCarga(freno);
    if (estado.modalidad === 'contrato') return contratoEnLaPlanilla();
    const { datos, error } = validarHorasExtras(entrada, { hoy, estado, editadaId: id });
    if (error) return rechazoDeLaCarga(error);
    await conexion.query(
      `UPDATE mi_espacio_horas_extras SET fecha = ?, desde = ?, hasta = ?, nota = ?
       WHERE id = ? AND usuario_id = ? AND activo = 1`,
      [datos.fecha, datos.desde, datos.hasta, datos.nota, id, usuarioId]
    );
    return [200, { success: true, data: { id }, message: 'Horas extras corregidas.' }];
  });
});

// DELETE /api/mi-espacio/horas-extras/:id: baja lógica de unas horas extras activas de la persona. Nunca se frena, tampoco
// sin modalidad o sin arranque
export const borrarHorasExtras = (req, res) => responder(res, 'Error al borrar las horas extras', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontradas();
  const usuarioId = req.user.userId;
  return enTransaccion(usuarioId, false, async (conexion) => {
    const [resultado] = await conexion.query(
      'UPDATE mi_espacio_horas_extras SET activo = 0 WHERE id = ? AND usuario_id = ? AND activo = 1', [id, usuarioId]
    );
    if (resultado.affectedRows === 0) return noEncontradas();
    return [200, { success: true, message: 'Horas extras borradas.' }];
  });
});

// La planilla de contrato (spec 2026-10-27-mi-espacio-horas, sección 8): un mes y el guardado de sus días. Contrato lee y
// guarda solo `mi_espacio_salidas` (planta, solo sus horas extras): la planilla rechaza a planta. Las horas no se guardan: las
// calculan las reglas con los feriados del momento (sección 6). Nunca toca Configuración ni manda emails

// Un mes que no sirve (`mesDeLaPlanilla`), y la planilla a una persona de planta
const rechazoDelMes = () => [400, { success: false, error: MENSAJES_MI_ESPACIO.mes, campo: 'mes' }];
const planillaSoloContrato = () => rechazoDeLaCarga({ campo: null, mensaje: MENSAJES_MI_ESPACIO.planillaSoloContrato });

/**
 * GET /api/mi-espacio/salidas?mes=AAAA-MM: la planilla de un mes (`planillaDelMes`), con los feriados y el cálculo de
 * `contextoDe` (los avisos de las salidas que dejaron de cerrar salen del cálculo). Sin `mes` (o vacío), el de hoy; un mes que
 * no es 'AAAA-MM', anterior al primero de `rangoDeFechas` o posterior al de hoy (también un `mes` repetido, que Express da
 * como lista) da 400 en `mes`, antes de leer nada. Sin modalidad, `{ modalidad: null, mensaje }`, como las otras lecturas;
 * en planta, 400 con campo null. Leer no pide el arranque.
 */
export const verPlanilla = (req, res) => responder(res, 'Error al obtener la planilla', async () => {
  const hoy = hoyArgentina();
  const mes = mesDeLaPlanilla(req.query.mes, hoy);
  if (mes === null) return rechazoDelMes();
  const { estado, feriados, filasFeriados, calculo } = await contextoDe(req.user.userId, hoy);
  if (estado.modalidad === null) return sinModalidad();
  if (estado.modalidad !== 'contrato') return planillaSoloContrato();
  return conDatos(planillaDelMes(estado, calculo, { mes, hoy, feriados, filasFeriados }));
});

// La fecha de un día del pedido para su error: la que trae, si es una fecha; si no (o si el día no es un objeto), null
const fechaDelDia = (dia) => (dia !== null && typeof dia === 'object' && esFechaIso(dia.fecha) ? dia.fecha : null);

// Las fechas que están más de una vez en el pedido, cada una una vez (solo las fechas válidas: las otras las rechaza
// validarSalida)
const fechasRepetidas = (dias) => {
  const vistas = new Set();
  const repetidas = new Set();
  for (const fecha of dias.map(fechaDelDia)) {
    if (fecha === null) continue;
    if (vistas.has(fecha)) repetidas.add(fecha);
    vistas.add(fecha);
  }
  return [...repetidas];
};

/**
 * El 400 de los días de un guardado (`errores`: `[{ fecha, campo, mensaje }]`): todos, por fecha (los sin fecha válida,
 * primero; los demás, en el orden del pedido), con el primero también en `error`, `campo` y `fecha`, para el aviso de arriba.
 */
const rechazoDeLosDias = (errores) => {
  const ordenados = [...errores].sort((a, b) => {
    if (a.fecha === b.fecha) return 0;
    if (a.fecha === null) return -1;
    if (b.fecha === null) return 1;
    return a.fecha < b.fecha ? -1 : 1;
  });
  const [primero] = ordenados;
  return [400, { success: false, error: primero.mensaje, campo: primero.campo, fecha: primero.fecha, errores: ordenados }];
};

// «Horas extras guardadas: 3 días.» («1 día»)
const textoDeLoGuardado = (cantidad) => `Horas extras guardadas: ${cantidad} ${cantidad === 1 ? 'día' : 'días'}.`;

// Guardar un día: un upsert por la clave (usuario_id, fecha), que vuelve a activar la fila de un día borrado; borrarlo, la
// baja lógica de su fila activa, que le saca también el tilde (si no la hay, no hace nada). El tilde «Sumar a {mes
// anterior}» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 8) se escribe solo si el día lo trae: sin él, el primer upsert
// no lo nombra, así un día nuevo queda en 0 y uno guardado conserva el suyo (una página vieja que no lo conoce no lo borra)
const UPSERT_DE_LA_SALIDA = `INSERT INTO mi_espacio_salidas (usuario_id, fecha, entrada, salida, nota) VALUES (?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE entrada = VALUES(entrada), salida = VALUES(salida), nota = VALUES(nota), activo = 1`;
const UPSERT_DE_LA_SALIDA_CON_LA_MARCA = `INSERT INTO mi_espacio_salidas
  (usuario_id, fecha, entrada, salida, nota, al_mes_anterior) VALUES (?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE entrada = VALUES(entrada), salida = VALUES(salida), nota = VALUES(nota),
    al_mes_anterior = VALUES(al_mes_anterior), activo = 1`;
const BAJA_DE_LA_SALIDA =
  'UPDATE mi_espacio_salidas SET activo = 0, al_mes_anterior = 0 WHERE usuario_id = ? AND fecha = ? AND activo = 1';

/**
 * PUT /api/mi-espacio/salidas: guarda los días de la planilla (`{ dias: [{ fecha, entrada, salida, nota,
 * al_mes_anterior }] }`, cada día con su estado completo: todo vacío es borrarlo; `al_mes_anterior`, el tilde «Sumar a {mes
 * anterior}», es opcional: true o false, y sin él se conserva lo guardado), todos o ninguno, en una transacción que bloquea
 * solo la fila de la persona (dos guardados a la vez se ordenan, y el segundo ve lo que dejó el primero: un doble envío deja
 * una sola fila por día).
 * Los controles, en este orden, con el estado leído bajo el bloqueo:
 * 1. la modalidad y el arranque (`frenoDeLasHorasExtras`), y planta (`planillaSoloContrato`), los dos con campo null;
 * 2. `dias`, una lista de 1 a MAXIMO_DIAS_POR_GUARDADO días (`sinDias` o `muchosDias`, en `dias`);
 * 3. sin fechas repetidas (`diaRepetido`, en `fecha`, con la forma de los errores de los días);
 * 4. `validarSalida` de todos: si alguno falla, no se guarda ninguno (`rechazoDeLosDias`).
 * Responde `{ guardados }`, los días del pedido (también los borrados que no tenían nada).
 */
export const guardarSalidas = (req, res) => responder(res, 'Error al guardar las horas extras', async () => {
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const { dias } = cuerpoDe(req);
  return enTransaccion(usuarioId, false, async (conexion) => {
    const estado = await estadoDe(usuarioId, conexion);
    const freno = frenoDeLasHorasExtras(estado);
    if (freno) return rechazoDeLaCarga(freno);
    if (estado.modalidad !== 'contrato') return planillaSoloContrato();
    if (!Array.isArray(dias) || dias.length === 0) {
      return rechazoDeLaCarga({ campo: 'dias', mensaje: MENSAJES_MI_ESPACIO.sinDias });
    }
    if (dias.length > MAXIMO_DIAS_POR_GUARDADO) {
      return rechazoDeLaCarga({ campo: 'dias', mensaje: MENSAJES_MI_ESPACIO.muchosDias });
    }
    const repetidas = fechasRepetidas(dias);
    if (repetidas.length > 0) {
      return rechazoDeLosDias(repetidas.map((fecha) => ({ fecha, campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaRepetido })));
    }
    // El Set de los feriados del estado (`feriadosPara`: de hoy − 3 años a hoy + 2, estirado a lo cargado) cubre todo día que
    // validarSalida mira con los feriados: los consulta solo después de comprobar que la fecha está entre el primer día de
    // `rangoDeFechas` (el 01/01 de hace dos años) y hoy, y un borrado no los consulta. Las filas se leen con la conexión de la
    // transacción (no se toma una segunda del pool con la fila bloqueada)
    const feriados = await feriadosPara([estado], hoy, await filasDeFeriados(conexion));
    const validados = dias.map((dia) => ({ dia, ...validarSalida(dia, { hoy, estado, feriados }) }));
    const errores = validados.filter(({ error }) => error !== null)
      .map(({ dia, error }) => ({ fecha: fechaDelDia(dia), campo: error.campo, mensaje: error.mensaje }));
    if (errores.length > 0) return rechazoDeLosDias(errores);
    for (const { datos } of validados) {
      const fila = [usuarioId, datos.fecha, datos.entrada, datos.salida, datos.nota];
      if (datos.borrar) await conexion.query(BAJA_DE_LA_SALIDA, [usuarioId, datos.fecha]);
      else if (datos.al_mes_anterior === null) await conexion.query(UPSERT_DE_LA_SALIDA, fila);
      else await conexion.query(UPSERT_DE_LA_SALIDA_CON_LA_MARCA, [...fila, datos.al_mes_anterior ? 1 : 0]);
    }
    return [200, { success: true, data: { guardados: dias.length }, message: textoDeLoGuardado(dias.length) }];
  });
});

// «Mis vacaciones y saldos» (spec, sección 4): los días de cada año y el saldo inicial, cada uno en una transacción que
// bloquea solo la fila de la persona. Piden la modalidad (sin ella, 400 con campo null). Bajar los días de un año o corregir
// el saldo inicial no se frena, aunque deje algo sin cubrir: es un faltante del Resumen (3.10)
const sinModalidadParaGuardar = () => rechazoDeLaCarga({ campo: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad });

// PUT /api/mi-espacio/anio/:anio: los días de vacaciones y los estudios de ese año (`{ dias_vacaciones, estudios }`, con
// null por «No estudio»), con un upsert. Un año que no sirve (`validarAnio`: de dos años antes al siguiente del de hoy) da
// 400 en `anio` antes que nada
export const guardarAnio = (req, res) => responder(res, 'Error al guardar el año', async () => {
  const usuarioId = req.user.userId;
  const { datos, error } = validarAnio(req.params.anio, cuerpoDe(req), hoyArgentina());
  // El error se parte siguiendo el orden de validarAnio: el año va primero (antes que la modalidad) y el resto, después
  if (error?.campo === 'anio') return rechazoDeLaCarga(error);
  return enTransaccion(usuarioId, false, async (conexion) => {
    if (modalidadDe((await personaDe(usuarioId, conexion))?.vinculo) === null) return sinModalidadParaGuardar();
    if (error) return rechazoDeLaCarga(error);
    await conexion.query(
      `INSERT INTO mi_espacio_anios (usuario_id, anio, dias_vacaciones, estudios) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE dias_vacaciones = VALUES(dias_vacaciones), estudios = VALUES(estudios)`,
      [usuarioId, datos.anio, datos.dias_vacaciones, datos.estudios]
    );
    return [200, { success: true, data: datos, message: 'Días del año guardados.' }];
  });
});

// PUT /api/mi-espacio/saldo-inicial: el saldo inicial (`{ saldos: { <clave>: número } }`, uno por campo de
// `camposDelSaldoInicial`; lo que no es un campo no se guarda). La primera vez crea el arranque con hoy; después su fecha no
// cambia. Los campos se arman con el arranque que va a quedar, y piden los días de su año cargados (los de un año anterior,
// que valdrían heredados, no alcanzan: si no, 400 en `dias_vacaciones`). Reemplaza todas las filas del saldo de la persona
export const guardarSaldoInicial = (req, res) => responder(res, 'Error al guardar el saldo inicial', async () => {
  const hoy = hoyArgentina();
  const usuarioId = req.user.userId;
  const entrada = cuerpoDe(req);
  return enTransaccion(usuarioId, false, async (conexion) => {
    const { modalidad, arranque: guardado, anios } = await estadoDe(usuarioId, conexion);
    if (modalidad === null) return sinModalidadParaGuardar();
    const arranque = guardado ?? hoy;
    if (!anios.some((delAnio) => delAnio.anio === Number(arranque.slice(0, 4)))) {
      return rechazoDeLaCarga({ campo: 'dias_vacaciones', mensaje: MENSAJES_MI_ESPACIO.diasVacaciones });
    }
    const { datos, error } = validarSaldoInicial(entrada, camposDelSaldoInicial({ modalidad, arranque, anios }));
    if (error) return rechazoDeLaCarga(error);
    if (guardado === null) {
      await conexion.query('INSERT INTO mi_espacio_arranque (usuario_id, fecha) VALUES (?, ?)', [usuarioId, arranque]);
    }
    await conexion.query('DELETE FROM mi_espacio_saldos WHERE usuario_id = ?', [usuarioId]);
    if (datos.length > 0) {
      await conexion.query('INSERT INTO mi_espacio_saldos (usuario_id, concepto, anio, cantidad) VALUES ?',
        [datos.map((saldo) => [usuarioId, saldo.concepto, saldo.anio, saldo.cantidad])]);
    }
    return [200, { success: true, data: { arranque }, message: 'Saldo inicial guardado.' }];
  });
});

// «Hoy no están» (spec, sección 7): los compañeros que no están en un rango, sin el tipo ni la nota. «Los compañeros» son
// administración (`esAdmin`): solo ellos ven a los demás, y solo se ven ellos

// El rango más largo que se puede pedir, los dos días incluidos (también el de la agenda: GET /api/mi-espacio/eventos, en
// controllers/miEspacioEventosController.js, con rangoDelPedido)
export const DIAS_DE_AUSENTES = 93;
export const MENSAJE_RANGO_DE_AUSENTES = `Elegí un rango de hasta ${DIAS_DE_AUSENTES} días.`;
// Cuánto antes y después del rango se leen las ausencias: una se une con las seguidas (separadas solo por días no hábiles),
// así la que empezó antes o sigue después se ve entera, con su desde y su vuelta. Una cadena de más de un año se corta ahí
const MARGEN_DE_LAS_AUSENCIAS = 366;

// Una fecha del pedido: 'AAAA-MM-DD' de un año de ANIO_MINIMO a ANIO_MAXIMO; cualquier otra cosa (una repetida, que Express
// da como lista), null
export const fechaDelPedido = (valor) => {
  if (!esFechaIso(valor)) return null;
  const anio = Number(valor.slice(0, 4));
  return anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO ? valor : null;
};
export const rechazoDeLasFechas = (mensaje) => [400, { success: false, error: mensaje, campo: 'fechas' }];

/**
 * El rango de un pedido (`?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`, en `query`): `{ desde, hasta }`, o `{ rechazo }` con el
 * [status, cuerpo] del 400 en `fechas`: una fecha que falta o no sirve (fechaDelPedido) o un hasta anterior al desde,
 * MENSAJES_MI_ESPACIO.fecha; más de DIAS_DE_AUSENTES días contando los dos, MENSAJE_RANGO_DE_AUSENTES. Lo usan «Hoy no
 * están» y la agenda
 */
export const rangoDelPedido = (query) => {
  const desde = fechaDelPedido(query?.desde);
  const hasta = fechaDelPedido(query?.hasta);
  if (desde === null || hasta === null || hasta < desde) return { rechazo: rechazoDeLasFechas(MENSAJES_MI_ESPACIO.fecha) };
  if (diasEntre(desde, hasta) + 1 > DIAS_DE_AUSENTES) return { rechazo: rechazoDeLasFechas(MENSAJE_RANGO_DE_AUSENTES) };
  return { desde, hasta };
};

/**
 * Los compañeros que no están entre desde y hasta, como los ve `persona` (`{ id, rol }`): `{ puede_ver, ausentes }`. Sin
 * `esAdmin`, `{ puede_ver: false, ausentes: [] }`, sin consultar. Si no, las ausencias que se muestran de los demás
 * (`ausenciasVisibles`, sin las de la persona), leídas con margen, cada una con el nombre corto de su persona (`nombreCorto`
 * contra la administración activa: «Carla», o «Carla B.» si hay otra Carla; spec 2026-10-28-mi-espacio-agenda-onda, 5.1),
 * unidas con los feriados que necesitan (`feriadosPara` con hoy: cubre los años de las filas, que se cargan hasta el año que
 * viene, y la vuelta que pasa al siguiente) y cortadas al rango (`ausentesDelRango`: `{ nombre, desde, hasta, vuelve, texto,
 * vuelve_texto }`, con «Carla no está»). `filasFeriados` y `administracion` (la de `administracionActiva`): las filas de los
 * feriados y la administración, si ya se leyeron. La usan «Hoy no están», el Resumen y la agenda (GET
 * /api/mi-espacio/eventos, en controllers/miEspacioEventosController.js): leer las ausencias solo dentro del rango cortaría
 * las que empezaron antes.
 */
export const ausentesPara = async (persona, { desde, hasta, hoy, filasFeriados = null, administracion = null }) => {
  if (!esAdmin(persona?.rol)) return { puede_ver: false, ausentes: [] };
  const [filas, deAdministracion] = await Promise.all([
    ausenciasVisibles(sumarDias(desde, -MARGEN_DE_LAS_AUSENCIAS), sumarDias(hasta, MARGEN_DE_LAS_AUSENCIAS),
      { excluir: persona.id }),
    administracion ?? administracionActiva()
  ]);
  const conNombreCorto = filas.map((fila) =>
    ({ ...fila, nombre: nombreCorto({ id: fila.usuario_id, nombre: fila.nombre }, deAdministracion) }));
  const feriados = await feriadosPara([{ licencias: filas }], hoy, filasFeriados);
  return { puede_ver: true, ausentes: ausentesDelRango(ausenciasUnidas(conNombreCorto, feriados), desde, hasta) };
};

// GET /api/mi-espacio/ausentes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD: «Hoy no están» de un rango de hasta 93 días. Las fechas se
// validan antes que nada, también para quien no puede ver (400 en `fechas`)
export const listarAusentes = (req, res) => responder(res, 'Error al obtener quiénes no están', async () => {
  const { desde, hasta, rechazo } = rangoDelPedido(req.query);
  if (rechazo) return rechazo;
  return conDatos(await ausentesPara({ id: req.user.userId, rol: req.user.rol }, { desde, hasta, hoy: hoyArgentina() }));
});

// GET /api/mi-espacio/firmante: lo que necesita el campo «Autorizo a presentar las notas en mi nombre a:» (spec, sección 6).
// Al firmante titular de las Notas Digitales, `{ soy_titular: true, hoy, autorizables }`: las personas que puede autorizar,
// cada una con sus licencias en curso y futuras y sus ausencias unidas con la vuelta, lo mismo que GET /usuarios/licencias
// le da a Configuración (el mismo servicio). A cualquier otra persona, `{ soy_titular: false }`
export const verFirmante = (req, res) => responder(res, 'Error al obtener los datos del firmante', async () => {
  const titular = await firmanteTitular();
  if (titular === null || titular !== req.user.userId) return conDatos({ soy_titular: false });
  const hoy = hoyArgentina();
  return conDatos({ soy_titular: true, hoy, autorizables: await conSusLicencias(await autorizables(pool, titular), hoy) });
});
