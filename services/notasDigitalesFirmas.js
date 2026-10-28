// Cómo se firman las Notas Digitales de una fecha: el firmante titular, su autorizado durante una licencia o la firma
// de Correos sin titular elegido; y la autorización que todavía falta comunicar
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 6 y 7). Los días hábiles, con el calendario (spec
// 2026-10-27-feriados-en-notas, 1 y 3): quien lo tiene lo pasa; si no, cada función que lee la base lo lee una vez
// (leerCalendario) y lo pasa a lo que llama.
import pool from '../config/database.js';
import { firmaDeUsuario } from './firmasService.js';
import { licenciaEnFecha, proximaLicencia } from './licenciasService.js';
import { textoLeyendaAutorizacion } from './notasDigitalesContenido.js';
import { diasHabilesLibres } from './licenciasReglas.js';
import { leerCalendario } from './feriadosDatos.js';
import { sumarDias } from './notasDigitalesCalendario.js';

const ROLES_AUTORIZABLES = ['admin', 'editor'];

// contratado: personal contratado, que las notas presentan así (firmasService.firmaDeUsuario)
const firmaParaNota = (firma) => ({
  nombre: firma?.nombre ?? '', cargo: firma?.cargo ?? '', contratado: Boolean(firma?.contratado), imagen: firma?.imagen ?? null
});

// La firma del firmante titular elegido, o null (sin titular, o si el titular no tiene firma)
export const firmaTitularDe = (config) => firmaDeUsuario(config.firmante_usuario_id);

// La firma de la persona autorizada de una licencia, con su email, si cumple las condiciones que no dependen de las
// fechas (spec 6.3): admin o editor activo, con la imagen de su firma. null si no hay autorizado o no las cumple.
export const autorizadoHabilitado = async (licencia) => {
  if (!licencia?.autorizado_id) return null;
  const [[usuario]] = await pool.query('SELECT rol, activo, email FROM usuarios WHERE id = ?', [licencia.autorizado_id]);
  if (!usuario || !usuario.activo || !ROLES_AUTORIZABLES.includes(usuario.rol)) return null;
  const firma = await firmaDeUsuario(licencia.autorizado_id);
  return firma?.imagen ? { ...firma, email: usuario.email } : null;
};

const mayor = (a, b) => (a > b ? a : b);
const menor = (a, b) => (a < b ? a : b);

/**
 * La parte de autorizadoParaLicencia que depende de las fechas (spec 6.3): si a la persona autorizada (licencia.autorizado_id)
 * le queda algún día hábil de la licencia del titular, desde max(desde, licencia.desde), sin licencia propia (no anulada).
 * licenciaExtra ({ desde, hasta }) suma una licencia suya todavía sin guardar y excluirLicenciaId saca una guardada (la que
 * se edita), para validar antes de guardar. conexion: el pool o una conexión con transacción. calendario: el de quien
 * llama; sin él, se lee con conexion.
 * Devuelve { primer_dia_disponible, ausencias: sus licencias que se superponen con la del titular, recortadas a ella } o
 * null si sus licencias cubren todos esos días hábiles. Un tramo sin días hábiles no tiene notas que presentar: no la
 * descarta (primer_dia_disponible es null).
 */
export const disponibilidadDelAutorizado = async (
  licencia, { desde = licencia.desde, licenciaExtra = null, excluirLicenciaId = null, conexion = pool, calendario = null } = {}
) => {
  const [guardadas] = await conexion.query(
    `SELECT DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta FROM usuarios_licencias
     WHERE usuario_id = ? AND anulada = 0 AND id <> ? AND desde <= ? AND hasta >= ?`,
    [licencia.autorizado_id, excluirLicenciaId ?? 0, licencia.hasta, licencia.desde]
  );
  const ausencias = [...guardadas, ...(licenciaExtra ? [licenciaExtra] : [])]
    .filter(a => a.desde <= licencia.hasta && a.hasta >= licencia.desde)
    .map(a => ({ desde: mayor(a.desde, licencia.desde), hasta: menor(a.hasta, licencia.hasta) }))
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const conElCalendario = calendario ?? (await leerCalendario(conexion));
  const { primerDia, cubiertos } = diasHabilesLibres(mayor(desde, licencia.desde), licencia.hasta, ausencias, conElCalendario);
  return cubiertos ? null : { primer_dia_disponible: primerDia, ausencias };
};

/**
 * La persona autorizada sirve para la licencia del titular (spec 6.3) si es admin o editor activo, con la imagen de su
 * firma, y le queda al menos un día hábil de la licencia, desde max(desde, licencia.desde), sin licencia propia: puede
 * faltar algunos días a la vez que el titular (esos días no se generan notas, 7.3). Las opciones son las de
 * disponibilidadDelAutorizado (calendario: el de quien llama; sin él, lo lee disponibilidadDelAutorizado). Devuelve
 * { ...firma, email, primer_dia_disponible, ausencias } o null.
 */
export const autorizadoParaLicencia = async (licencia, { desde, licenciaExtra, excluirLicenciaId, calendario } = {}) => {
  const autorizado = await autorizadoHabilitado(licencia);
  if (!autorizado) return null;
  const disponibilidad = await disponibilidadDelAutorizado(licencia, { desde, licenciaExtra, excluirLicenciaId, calendario });
  return disponibilidad ? { ...autorizado, ...disponibilidad } : null;
};

// Número y año de la nota que comunicó la autorización de la licencia, o null si todavía no salió
const notaDeAutorizacion = async (licencia) => {
  if (!licencia.nota_autorizacion_id) return null;
  const [[nota]] = await pool.query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [licencia.nota_autorizacion_id]);
  return nota ?? null;
};

/**
 * Cómo se firman las notas de esa fecha, sin leer las imágenes de las firmas: lo que necesitan Correos → Estado y la vista
 * previa para saber qué días hay notas (spec 2026-10-27-feriados-en-notas, 4), y lo primero que mira firmaParaFecha. modo:
 * - 'configuracion': sin firmante titular elegido (licencia null);
 * - 'titular': el titular no está de licencia (licencia null);
 * - 'autorizado': está de licencia con una persona autorizada vigente ese día (spec 6.3): admin o editor activo, con la imagen
 *   de su firma (se mira que esté, con imagen IS NOT NULL, sin traerla) y sin licencia propia;
 * - 'sin_autorizado': está de licencia sin persona autorizada vigente: ese día no se generan notas.
 * licencia: la del titular ese día (la de licenciaEnFecha), o null. Devuelve { modo, licencia }.
 */
export const modoDelDia = async (config, fecha) => {
  if (!config.firmante_usuario_id) return { modo: 'configuracion', licencia: null };
  const licencia = await licenciaEnFecha(config.firmante_usuario_id, fecha);
  if (!licencia) return { modo: 'titular', licencia: null };
  if (!licencia.autorizado_id) return { modo: 'sin_autorizado', licencia };
  const [[usuario]] = await pool.query(
    `SELECT u.rol, u.activo, (f.imagen IS NOT NULL) AS con_imagen
     FROM usuarios u LEFT JOIN usuarios_firmas f ON f.usuario_id = u.id WHERE u.id = ?`,
    [licencia.autorizado_id]
  );
  const habilitado = Boolean(usuario) && Boolean(Number(usuario.activo)) && ROLES_AUTORIZABLES.includes(usuario.rol)
    && Number(usuario.con_imagen) === 1;
  if (!habilitado || (await licenciaEnFecha(licencia.autorizado_id, fecha))) return { modo: 'sin_autorizado', licencia };
  return { modo: 'autorizado', licencia };
};

// Días hacia adelante en que se busca el primer día con notas (spec 2026-10-15, 7.7): la fecha y los 366 siguientes
const DIAS_PARA_BUSCAR_NOTAS = 366;

/**
 * El primer día con notas desde `desde` (incluido) hasta `desde` + 366 inclusive: hábil con el calendario y con un modo que no es
 * 'sin_autorizado' (modoDelDia: firma el titular, o su persona autorizada). Es la regla de la corrida, con la que Correos → Estado
 * y la vista previa anuncian el día real en que sale cada cosa (spec 2026-10-27-feriados-en-notas, 4). null si no hay ninguno.
 * calendario: el de quien llama; sin él, se lee (leerCalendario).
 * Solo lee. Salta los días no hábiles de a uno, con el predicado del calendario (nunca con proximoDiaHabil, que tira si no hay
 * ninguno en 366 días) y, en una licencia sin persona autorizada vigente, salta hasta el primer día hábil, desde el día
 * siguiente, en que ella no falta o, si no le queda ninguno (o ya no sirve), hasta el fin de la licencia
 * (primer_dia_disponible de autorizadoParaLicencia): es lo mismo que probar día por día, sin recorrer la licencia.
 */
export const primerDiaConNotas = async (config, desde, calendario) => {
  const conElCalendario = calendario ?? await leerCalendario();
  const limite = sumarDias(desde, DIAS_PARA_BUSCAR_NOTAS);
  let dia = desde;
  while (dia <= limite) {
    if (!conElCalendario.esDiaHabil(dia)) {
      dia = sumarDias(dia, 1);
      continue;
    }
    const { modo, licencia } = await modoDelDia(config, dia);
    if (modo !== 'sin_autorizado') return dia;
    // Desde el día siguiente, no desde el comienzo de la licencia: así los días libres que quedaron atrás no obligan a
    // recorrerla día por día
    dia = (await autorizadoParaLicencia(licencia, { desde: sumarDias(dia, 1), calendario: conElCalendario }))?.primer_dia_disponible
      ?? sumarDias(licencia.hasta, 1);
  }
  return null;
};

/**
 * Cómo se firman las notas de esa fecha: el modo de modoDelDia y, solo para ese modo, las firmas (con sus imágenes):
 * - 'configuracion': la firma de Correos, como siempre;
 * - 'titular': la del titular;
 * - 'autorizado': las dos firmas y la leyenda, que cita la nota de autorización (null si todavía no salió: la corrida la genera
 *   primero, con autorizacionPendiente). Si al leer su firma la persona autorizada ya no sirve, 'sin_autorizado';
 * - 'sin_autorizado': ese día no se generan notas (la firma que se devuelve es la del titular). La vista previa no muestra ese
 *   día: busca el primer día con notas (primerDiaConNotas), hasta 366 días desde hoy (spec 2026-10-15, 7.7); solo si no hay
 *   ninguno muestra hoy, con la firma del titular.
 * firma: { titular: { nombre, cargo, contratado, imagen }, presentante: {...} | null, leyenda, firmanteId, presentanteId }
 * (la firma de Correos no es de una persona: nunca es de personal contratado)
 */
export const firmaParaFecha = async (config, fecha) => {
  const { modo, licencia } = await modoDelDia(config, fecha);
  if (modo === 'configuracion') {
    return {
      modo,
      firma: {
        titular: { nombre: config.firma_nombre ?? '', cargo: config.firma_cargo ?? '', contratado: false, imagen: config.firma_imagen ?? null },
        presentante: null, leyenda: null, firmanteId: null, presentanteId: null
      }
    };
  }
  const titular = firmaParaNota(await firmaDeUsuario(config.firmante_usuario_id));
  const delTitular = { titular, presentante: null, leyenda: null, firmanteId: config.firmante_usuario_id, presentanteId: null };
  if (modo === 'titular') return { modo, firma: delTitular };
  if (modo === 'sin_autorizado') return { modo, firma: delTitular, licencia };
  // modoDelDia ya miró que ese día no falta: con la firma completa se vuelven a mirar las condiciones que no dependen de las fechas
  const autorizado = await autorizadoHabilitado(licencia);
  if (!autorizado) return { modo: 'sin_autorizado', firma: delTitular, licencia };
  const presentante = firmaParaNota(autorizado);
  const nota = await notaDeAutorizacion(licencia);
  return {
    modo: 'autorizado',
    licencia,
    autorizado,
    firma: {
      ...delTitular,
      presentante,
      presentanteId: licencia.autorizado_id,
      leyenda: nota ? textoLeyendaAutorizacion({ presentante, titular, nota, licencia }) : null
    }
  };
};

/**
 * Autorización que todavía no se comunicó con una nota (spec 7.2): la licencia del titular en curso o la próxima, con
 * días hábiles, desde su víspera hasta su fin, con una persona autorizada que sirve para la licencia desde hoy y sin nota
 * de autorización. La persona autorizada puede estar de licencia hoy: la víspera la autorización se comunica igual (la
 * firma el titular, que todavía no está de licencia). Durante la licencia del titular, un día en que ella también falta
 * es sin autorizado (firmaParaFecha) y la corrida termina antes de llegar acá. La víspera y los días hábiles, con el
 * calendario (sin él, lo lee una vez y lo pasa a autorizadoParaLicencia). Devuelve { licencia, autorizado } o null.
 */
export const autorizacionPendiente = async (config, hoy, calendario) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = (await licenciaEnFecha(config.firmante_usuario_id, hoy)) ?? (await proximaLicencia(config.firmante_usuario_id, hoy));
  if (!licencia || licencia.nota_autorizacion_id) return null;
  const conElCalendario = calendario ?? (await leerCalendario());
  const { diaHabilAnterior, ultimoDiaHabilHasta } = conElCalendario;
  if (hoy < diaHabilAnterior(licencia.desde) || ultimoDiaHabilHasta(licencia.hasta) < licencia.desde) return null;
  const autorizado = await autorizadoParaLicencia(licencia, { desde: hoy, calendario: conElCalendario });
  return autorizado ? { licencia, autorizado } : null;
};

/**
 * Si hoy es la víspera (el último día hábil antes) de una licencia del firmante titular con días hábiles, devuelve
 * { hasta: último día hábil de la licencia, licencia }: hasta ahí se anticipan los avisos, con o sin autorizado
 * (spec 7.2 y 7.3). null en cualquier otro caso. La víspera y los días hábiles, con el calendario (sin él, lo lee).
 */
export const anticipoPorLicencia = async (config, hoy, calendario) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = await proximaLicencia(config.firmante_usuario_id, hoy);
  if (!licencia) return null;
  const { diaHabilAnterior, ultimoDiaHabilHasta } = calendario ?? (await leerCalendario());
  if (diaHabilAnterior(licencia.desde) !== hoy) return null;
  const hasta = ultimoDiaHabilHasta(licencia.hasta);
  return hasta < licencia.desde ? null : { hasta, licencia };
};

/**
 * La primera nota que comunicó la autorización vigente queda en la licencia (las siguientes del mismo día no la pisan).
 * licencia: la de autorizacionPendiente, con la que se armó la nota. Si mientras se generaba la licencia cambió (otra
 * persona autorizada, otras fechas o anulada), la nota dice otra cosa y no se registra. Devuelve si la registró.
 */
export const registrarNotaDeAutorizacion = async (licencia, notaId) => {
  const [resultado] = await pool.query(
    `UPDATE usuarios_licencias SET nota_autorizacion_id = ?
     WHERE id = ? AND nota_autorizacion_id IS NULL AND anulada = 0 AND autorizado_id = ? AND desde = ? AND hasta = ?`,
    [notaId, licencia.id, licencia.autorizado_id, licencia.desde, licencia.hasta]
  );
  return resultado.affectedRows === 1;
};
