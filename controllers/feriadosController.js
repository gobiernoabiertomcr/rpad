// Feriados (spec 2026-10-26-feriados, sección 3): los días no hábiles que no son los 9 fijos, para la pestaña Feriados de
// Configuración y para Mi espacio. GET /api/feriados lo lee cualquier rol con sesión (authMiddleware); cargar, corregir, «no
// rige», la baja y GET /api/feriados/afectadas (cuántas licencias de Mi espacio incluye un feriado en un día que era hábil y,
// desde los días restituidos, cuántas vacaciones quedan con días para restituir y desde cuándo corre el plazo), solo
// administración (authMiddleware + adminOnly).
// La foto de los días por restituir (spec 2026-10-31-mi-espacio-dias-restituidos, 6) va en la transacción del feriado: el alta,
// la corrección (solo las fechas nuevas), volver a regir (ese año) y el día que carga «Se pasó al» anotan los días de las
// vacaciones ya cargadas que dejan de ser hábiles (services/miEspacioRestituciones.js); «no rige» y la baja no la tocan.
// Las reglas son puras (services/feriadosReglas.js) y las consultas de lectura están en services/feriadosDatos.js; acá se
// escribe. Hoy es hoyArgentina(). Respuestas { success, data?, error?, campo?, message?, avisos? }.
// Orden de los controles en las que reciben un id: un id que no es un entero positivo, que no existe o dado de baja da 404
// (`noEncontrado`); después, la validación da 400 { success: false, error, campo }. Corregir, «no rige» y la baja leen la fila
// con filaDeFeriado dentro de su transacción, como primera lectura (la bloquea con FOR UPDATE: dos escrituras del mismo feriado
// se esperan y la segunda ve lo que dejó la primera). La baja es lógica (activo, o hasta_anio en uno que se repite).
import pool from '../config/database.js';
import { hoyArgentina, formatoCorto, esFechaIso } from '../services/notasDigitalesCalendario.js';
import {
  MENSAJES_FERIADO, feriadosDelAnio, aniosDelSelector, validarFeriado, errorDeLaCorreccion, validarRige, bajaDesde,
  avisosDeLaFecha
} from '../services/feriadosReglas.js';
import { filasDeFeriados, filaDeFeriado } from '../services/feriadosDatos.js';
import { licenciasQueIncluyen, vacacionesParaRestituir, fotosParaElFeriado } from '../services/miEspacioDatos.js';
import { sacarLaFoto, acomodarLaFotoDelFeriado } from '../services/miEspacioRestituciones.js';
import { idPositivo } from '../services/proyectosReglas.js';

// Los años que se pueden pedir en GET /api/feriados
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

// GET /api/feriados?anio=AAAA: los feriados del año (los 9 fijos y los de la tabla, tal como los arma feriadosDelAnio) y los años
// del selector de la pestaña
export const listarFeriados = async (req, res) => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return res.status(400).json({ success: false, error: MENSAJES_FERIADO.anio, campo: 'anio' });
  try {
    const filas = await filasDeFeriados();
    res.json({ success: true, data: { anio, anios: aniosDelSelector(filas, hoy), feriados: feriadosDelAnio(filas, anio) } });
  } catch (error) {
    console.error('Error obteniendo los feriados:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los feriados' });
  }
};

// GET /api/feriados/afectadas?fecha=&se_repite=&id=: cuántas licencias de Mi espacio incluye el feriado del modal, antes de guardar
// (licenciasQueIncluyen: solo por las fechas en que cambia un día hábil), y de ellas cuántas vacaciones quedarían con días para
// restituir y desde cuándo corre su plazo (vacacionesParaRestituir: solo las fechas que el guardado no tenía). La fecha y «se
// repite» ('1'; cualquier otro valor es '0') son los del modal; con el id de uno guardado (al corregir), sus años que no rigen y su
// baja desde un año, no se lo cuenta como otro feriado ese día y sus fechas de antes no quedan para restituir; sin id, o con uno
// que no sirve, no existe o está dado de baja, ninguno. Solo números y una fecha: ni personas ni tipos. Una fecha que no es una
// fecha da 400 en `fecha`
export const afectadasPorFeriado = async (req, res) => {
  const { fecha, se_repite: seRepite, id } = req.query;
  if (!esFechaIso(fecha)) return res.status(400).json({ success: false, error: MENSAJES_FERIADO.fecha, campo: 'fecha' });
  try {
    const guardada = await filaDeFeriado(id);
    const fila = {
      fecha, se_repite: seRepite === '1' ? 1 : 0, hasta_anio: guardada?.hasta_anio ?? null, no_rige: guardada?.no_rige ?? [],
      activo: 1
    };
    const excluir = guardada?.id ?? null;
    const licencias = await licenciasQueIncluyen(fila, { excluir });
    res.json({
      success: true, data: { licencias_afectadas: licencias, ...(await restitucionDelModal(fila, excluir, guardada)) }
    });
  } catch (error) {
    console.error('Error contando las licencias que incluyen el feriado:', error?.stack ?? error);
    res.status(500).json({ success: false, error: 'Error al contar las licencias que incluyen el feriado' });
  }
};

// Para el modal: cuántas vacaciones quedarían con días para restituir con el feriado `fila` y desde cuándo corre el plazo
// (vacacionesParaRestituir), aislado: si falla, las dos en null y el error en la consola (la cuenta de las licencias sigue
// siendo la del modal, y si esa falla, el 500 de siempre)
const restitucionDelModal = async (fila, excluir, antes) => {
  try {
    const { vacaciones, plazo } = await vacacionesParaRestituir(fila, { excluir, antes });
    return { vacaciones_para_restituir: vacaciones, plazo_de_restitucion: plazo };
  } catch (error) {
    console.error('Error contando las vacaciones con días para restituir por el feriado:', error?.stack ?? error);
    return { vacaciones_para_restituir: null, plazo_de_restitucion: null };
  }
};

// Cuántas licencias de Mi espacio incluyen el feriado `id` tal como quedó guardado (filaDeFeriado, con el pool: después del commit),
// para la respuesta del alta y de la corrección, sin contarlo a él como otro feriado ese día. Aislado: el feriado ya se guardó, así
// que si la cuenta falla va null y el error, a la consola, sin cambiar el resto de la respuesta. Uno que mientras tanto se dio de
// baja no incluye ninguna. En la consola de las dos cuentas va solo la pila: los errores de mysql2 traen la consulta armada, y
// esta lee las licencias de Mi espacio
const licenciasAfectadasDe = async (id) => {
  try {
    const fila = await filaDeFeriado(id);
    return fila ? await licenciasQueIncluyen(fila, { excluir: id }) : 0;
  } catch (error) {
    console.error('Error contando las licencias que incluyen el feriado guardado:', error?.stack ?? error);
    return null;
  }
};

// Cuántas vacaciones quedan con días para restituir por el feriado `id` tal como quedó guardado y desde cuándo corre el plazo
// (vacacionesParaRestituir, con el pool: después del commit), sin contarlo a él como otro feriado ese día; con `antes` (la fila
// de antes de corregirlo), solo por sus fechas nuevas, las que sacaron foto. Aislado como licenciasAfectadasDe: si falla, las dos
// en null. Uno que mientras tanto se dio de baja no deja ninguna
const restitucionAfectadaDe = async (id, antes = null) => {
  try {
    const fila = await filaDeFeriado(id);
    if (!fila) return { vacaciones_para_restituir: 0, plazo_de_restitucion: null };
    const { vacaciones, plazo } = await vacacionesParaRestituir(fila, { excluir: id, antes });
    return { vacaciones_para_restituir: vacaciones, plazo_de_restitucion: plazo };
  } catch (error) {
    console.error('Error contando las vacaciones con días para restituir por el feriado guardado:', error?.stack ?? error);
    return { vacaciones_para_restituir: null, plazo_de_restitucion: null };
  }
};

// Las cuentas de la respuesta del alta y de la corrección, cada una aislada
const cuentasDelFeriado = async (id, antes = null) => ({
  licencias_afectadas: await licenciasAfectadasDe(id), ...(await restitucionAfectadaDe(id, antes))
});

/**
 * Saca la foto del feriado `id`, ya escrito, con la conexión de su transacción (spec 2026-10-31-mi-espacio-dias-restituidos, 6):
 * los días de las vacaciones (y de los días restituidos) ya cargadas que deja de hacer hábiles (`fotosParaElFeriado`, contra
 * los demás feriados activos), sin las fechas que ya tenía `antes` (la fila de antes de corregirlo). Devuelve `{ filas, fila }`:
 * las filas de los feriados, leídas después de escribirlo (para los avisos), y la suya.
 */
const sacarLaFotoDe = async (conexion, id, antes = null) => {
  const filas = await filasDeFeriados(conexion);
  const fila = filas.find((otra) => otra.id === id) ?? null;
  if (fila !== null) {
    const otras = filas.filter((otra) => otra.id !== id);
    await sacarLaFoto(conexion, id, await fotosParaElFeriado(fila, { otras, antes }, conexion));
  }
  return { filas, fila };
};

// [status, cuerpo]: lo que responde cada escritura. Dentro de una transacción, un 2xx la confirma y cualquier otro la deshace
const noEncontrado = () => [404, { success: false, error: MENSAJES_FERIADO.noEncontrado }];
// El error de una regla, { campo, mensaje } (campo null en noSeRepite)
const rechazoDeValidacion = ({ campo, mensaje }) => [400, { success: false, error: mensaje, campo }];

// Cuántas veces se intenta una transacción que MariaDB corta por un bloqueo mutuo: la primera y una más
const INTENTOS = 2;

/**
 * Corre trabajo(conexion) en una transacción y devuelve lo que devolvió, [status, cuerpo]: un 2xx la confirma; cualquier otro, o
 * un error, la deshace. La conexión vuelve al pool siempre. Si MariaDB la corta por un bloqueo mutuo (ER_LOCK_DEADLOCK: ya la
 * deshizo entera), la repite una vez desde el principio, como las de Mi espacio: desde los días restituidos, el feriado escribe
 * también la foto (`mi_espacio_restituibles`), que escriben los pedidos de Mi espacio.
 */
const enTransaccion = async (trabajo) => {
  for (let intento = 1; ; intento++) {
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await trabajo(conexion);
      if (resultado[0] < 300) await conexion.commit();
      else await conexion.rollback();
      return resultado;
    } catch (error) {
      await conexion.rollback().catch(() => {});
      if (error?.code !== 'ER_LOCK_DEADLOCK' || intento >= INTENTOS) throw error;
    } finally {
      conexion.release();
    }
  }
};

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

// POST /api/feriados: carga uno, en una transacción con su foto (sacarLaFotoDe: si la foto falla, el feriado tampoco queda). Los
// avisos (fin de semana, ya hay uno ese día) no frenan nada: se calculan antes de guardar, con lo que ya está cargado, así una
// falla al leerlos no deja un feriado cargado con un 500. Ya confirmado, data.licencias_afectadas (cuántas licencias de Mi
// espacio incluye), data.vacaciones_para_restituir (cuántas vacaciones quedaron con días para restituir) y
// data.plazo_de_restitucion (desde la primera de esas fechas), con lo guardado (null si no se pudieron contar)
export const crearFeriado = (req, res) => responder(res, 'Error al cargar el feriado', async () => {
  const { datos, error } = validarFeriado(req.body, hoyArgentina());
  if (error) return rechazoDeValidacion(error);
  const avisos = avisosDeLaFecha(datos.fecha, await filasDeFeriados(), null);
  const [status, cuerpo] = await enTransaccion(async (conexion) => {
    const [resultado] = await conexion.query(
      'INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
      [datos.fecha, datos.nombre, datos.tipo, datos.trasladado_de, datos.se_repite, req.user.userId]
    );
    const id = resultado.insertId;
    await sacarLaFotoDe(conexion, id);
    return [201, { success: true, data: { id }, message: 'Feriado cargado.', avisos }];
  });
  const { id } = cuerpo.data;
  return [status, { ...cuerpo, data: { id, ...(await cuentasDelFeriado(id)) } }];
});

// PUT /api/feriados/:id: lo corrige con el formulario entero (en uno que se repite, la fecha y el nombre corrigen todos los años).
// Uno con «se repite» dado de baja desde un año no pasa a una fecha de ese año o de después (errorDeLaCorreccion). Los avisos
// no cuentan al que se corrige.
// Sacarle «se repite» no borra su hasta_anio ni sus años de feriados_no_rige (sin «se repite» las reglas no los miran): si se lo
// vuelven a marcar, vuelve lo que se había decidido. Borrarlos haría que un año que no rige contara dos veces, junto al día de
// su «se pasó al».
// En la misma transacción, la foto (spec 2026-10-31-mi-espacio-dias-restituidos, 6): la de sus fechas nuevas, las que no tenía
// antes de corregirlo (renombrarlo no fotografía las vacaciones cargadas después), y las de sus fechas viejas sin pedido pasan a
// otro feriado que rija ese día o se borran (acomodarLaFotoDelFeriado). Ya confirmada, las cuentas de crearFeriado, con lo
// guardado (también sus años que no rigen y su baja desde un año) y, las de restituir, solo por sus fechas nuevas
export const corregirFeriado = (req, res) => responder(res, 'Error al corregir el feriado', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrado();
  let antes = null;
  const [status, cuerpo] = await enTransaccion(async (conexion) => {
    const fila = await filaDeFeriado(id, conexion);
    if (!fila) return noEncontrado();
    const { datos, error } = validarFeriado(req.body, hoyArgentina());
    if (error) return rechazoDeValidacion(error);
    const despuesDeLaBaja = errorDeLaCorreccion(datos, fila);
    if (despuesDeLaBaja) return rechazoDeValidacion(despuesDeLaBaja);
    await conexion.query(
      'UPDATE feriados SET fecha = ?, nombre = ?, tipo = ?, trasladado_de = ?, se_repite = ? WHERE id = ?',
      [datos.fecha, datos.nombre, datos.tipo, datos.trasladado_de, datos.se_repite, id]
    );
    antes = fila;
    const { filas, fila: corregida } = await sacarLaFotoDe(conexion, id, antes);
    if (corregida !== null) await acomodarLaFotoDelFeriado(conexion, corregida, filas);
    const avisos = avisosDeLaFecha(datos.fecha, filas, id);
    return [200, { success: true, message: 'Feriado corregido.', avisos }];
  });
  if (status !== 200) return [status, cuerpo];
  return [status, { ...cuerpo, data: await cuentasDelFeriado(id, antes) }];
});

// El día al que se pasó uno que se repite: el que ya hay activo con esa fecha y ese nombre (repetir el pedido no lo duplica) o
// uno nuevo, con el mismo nombre y tipo, sin «se repite» y trasladado del día que no rige. Devuelve `{ id, nuevo }` (nuevo: si
// lo cargó ahora)
const cargarElDiaAlQueSePaso = async (conexion, fila, { anio, pasa_al: pasaAl }, creadoPor) => {
  const [[existente]] = await conexion.query(
    'SELECT id FROM feriados WHERE fecha = ? AND nombre = ? AND activo = 1 ORDER BY id LIMIT 1',
    [pasaAl, fila.nombre]
  );
  if (existente) return { id: Number(existente.id), nuevo: false };
  const [resultado] = await conexion.query(
    'INSERT INTO feriados (fecha, nombre, tipo, trasladado_de, se_repite, creado_por) VALUES (?, ?, ?, ?, 0, ?)',
    [pasaAl, fila.nombre, fila.tipo, `${anio}-${fila.fecha.slice(5)}`, creadoPor]
  );
  return { id: resultado.insertId, nuevo: true };
};

// El día al que se había pasado ese año (el que cargó «Se pasó al»: activo, con el mismo nombre y trasladado del día que no
// regía), para avisarlo al volver a regir; su fecha, o null si no hay
const fechaDelDiaAlQueSePaso = async (conexion, fila, { anio }) => {
  const [[pasado]] = await conexion.query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM feriados
     WHERE nombre = ? AND trasladado_de = ? AND activo = 1 ORDER BY fecha, id LIMIT 1`,
    [fila.nombre, `${anio}-${fila.fecha.slice(5)}`]
  );
  return pasado ? pasado.fecha : null;
};

// `pasado`: al volver a regir, la fecha del día al que se había pasado, si sigue cargado (no se toca: lo dice el mensaje)
const textoDeRige = ({ anio, rige, pasa_al: pasaAl }, pasado = null) => {
  if (rige) {
    const vuelve = `En ${anio} vuelve a regir.`;
    return pasado === null
      ? vuelve
      : `${vuelve} El día al que se había pasado (${formatoCorto(pasado)}) sigue cargado: si ya no corresponde, dalo de baja.`;
  }
  return pasaAl === null ? `En ${anio} no rige.` : `En ${anio} no rige: se pasó al ${formatoCorto(pasaAl)}.`;
};

// PUT /api/feriados/:id/rige: en uno que se repite, { anio, rige, pasa_al } marca (rige: false) o desmarca (rige: true) que ese
// año no rige; con pasa_al, en la misma transacción carga el día al que se pasó. Una sola escritura en feriados_no_rige, la de
// ese año (INSERT IGNORE o DELETE): repetir el pedido no cambia nada. Volver a regir no toca el día al que se había pasado (es un
// feriado más): si sigue cargado, el mensaje lo dice. nuevo_id: el id del día al que se pasó, o null. avisos: los de ese día
// (fin de semana, ya hay otro feriado), contra la proyección completa y sin contarlo a él, como al cargar uno; sin pasa_al, [].
// El día que carga saca su foto, como un alta (spec 2026-10-31-mi-espacio-dias-restituidos, 6); el que ya estaba, no. «No rige»
// no toca la foto (la regla ve que ese día volvió a ser hábil) y volver a regir saca la de ese año, como un alta de esa fecha
// (decisión del controlador del plan, por la decisión 4 de la spec: cuenta cualquier día que deja de ser hábil)
export const cambiarRige = (req, res) => responder(res, 'Error al cambiar si rige el feriado', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrado();
  return enTransaccion(async (conexion) => {
    const fila = await filaDeFeriado(id, conexion);
    if (!fila) return noEncontrado();
    const { datos, error } = validarRige(req.body, fila, hoyArgentina());
    if (error) return rechazoDeValidacion(error);
    if (datos.rige) {
      await conexion.query('DELETE FROM feriados_no_rige WHERE feriado_id = ? AND anio = ?', [id, datos.anio]);
      // Volver a regir es como cargar esa fecha (decisión 4 de la spec de los días restituidos: cuenta cualquier día que deja de
      // ser hábil): saca la foto de ese año, una fecha nueva contra la fila de antes, que no la tenía
      await sacarLaFotoDe(conexion, id, fila);
      const pasado = await fechaDelDiaAlQueSePaso(conexion, fila, datos);
      return [200, { success: true, message: textoDeRige(datos, pasado), data: { nuevo_id: null }, avisos: [] }];
    }
    await conexion.query('INSERT IGNORE INTO feriados_no_rige (feriado_id, anio) VALUES (?, ?)', [id, datos.anio]);
    if (datos.pasa_al === null) return [200, { success: true, message: textoDeRige(datos), data: { nuevo_id: null }, avisos: [] }];
    const { id: nuevoId, nuevo } = await cargarElDiaAlQueSePaso(conexion, fila, datos, req.user.userId);
    // Las filas, leídas después del FOR UPDATE de filaDeFeriado (su primera lectura) y de cargar el día: el que se cargó (o el que
    // ya estaba) no se cuenta a sí mismo
    const filas = nuevo ? (await sacarLaFotoDe(conexion, nuevoId)).filas : await filasDeFeriados(conexion);
    const avisos = avisosDeLaFecha(datos.pasa_al, filas, nuevoId);
    return [200, { success: true, message: textoDeRige(datos), data: { nuevo_id: nuevoId }, avisos }];
  });
});

// DELETE /api/feriados/:id?desde=AAAA: la baja de bajaDesde. Sin «se repite», la baja entera (desde no cuenta); con «se repite»,
// desde el año elegido (hasta_anio = desde - 1, los anteriores no cambian) o entera si es su primer año o uno anterior
export const darDeBajaFeriado = (req, res) => responder(res, 'Error al dar de baja el feriado', async () => {
  const id = idPositivo(req.params.id);
  if (id === null) return noEncontrado();
  return enTransaccion(async (conexion) => {
    const fila = await filaDeFeriado(id, conexion);
    if (!fila) return noEncontrado();
    const { cambio, error } = bajaDesde(fila, req.query.desde);
    if (error) return rechazoDeValidacion(error);
    if (Object.hasOwn(cambio, 'hasta_anio')) {
      await conexion.query('UPDATE feriados SET hasta_anio = ? WHERE id = ?', [cambio.hasta_anio, id]);
    } else {
      await conexion.query('UPDATE feriados SET activo = 0 WHERE id = ?', [id]);
    }
    return [200, { success: true, message: 'Feriado dado de baja.' }];
  });
});
