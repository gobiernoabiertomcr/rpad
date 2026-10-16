// Cómo se firman las Notas Digitales de una fecha: el firmante titular, su autorizado durante una licencia o la firma
// de Correos sin titular elegido; y la autorización que todavía falta comunicar
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 6 y 7)
import pool from '../config/database.js';
import { firmaDeUsuario } from './firmasService.js';
import { licenciaEnFecha, proximaLicencia } from './licenciasService.js';
import { textoLeyendaAutorizacion } from './notasDigitalesContenido.js';
import { diaHabilAnterior, ultimoDiaHabilHasta } from './notasDigitalesCalendario.js';

const ROLES_AUTORIZABLES = ['admin', 'editor'];

const firmaParaNota = (firma) => ({ nombre: firma?.nombre ?? '', cargo: firma?.cargo ?? '', imagen: firma?.imagen ?? null });

// La firma del firmante titular elegido, o null (sin titular, o si el titular no tiene firma)
export const firmaTitularDe = (config) => firmaDeUsuario(config.firmante_usuario_id);

/**
 * La firma de la persona autorizada de una licencia, con su email, si en esa fecha sigue cumpliendo las condiciones
 * (spec 6.3): admin o editor activo, con la imagen de su firma y sin licencia. null si no hay autorizado o ya no las cumple.
 */
export const autorizadoVigente = async (licencia, fecha) => {
  if (!licencia?.autorizado_id) return null;
  const [[usuario]] = await pool.query('SELECT rol, activo, email FROM usuarios WHERE id = ?', [licencia.autorizado_id]);
  if (!usuario || !usuario.activo || !ROLES_AUTORIZABLES.includes(usuario.rol)) return null;
  const firma = await firmaDeUsuario(licencia.autorizado_id);
  if (!firma?.imagen) return null;
  if (await licenciaEnFecha(licencia.autorizado_id, fecha)) return null;
  return { ...firma, email: usuario.email };
};

// Número y año de la nota que comunicó la autorización de la licencia, o null si todavía no salió
const notaDeAutorizacion = async (licencia) => {
  if (!licencia.nota_autorizacion_id) return null;
  const [[nota]] = await pool.query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [licencia.nota_autorizacion_id]);
  return nota ?? null;
};

/**
 * Cómo se firman las notas de esa fecha:
 * - 'configuracion': sin firmante titular elegido, la firma de Correos, como siempre;
 * - 'titular': el titular no está de licencia;
 * - 'autorizado': está de licencia con un autorizado vigente: las dos firmas y la leyenda, que cita la nota de
 *   autorización (null si todavía no salió: la corrida la genera primero, con autorizacionPendiente);
 * - 'sin_autorizado': está de licencia sin autorizado vigente: ese día no se generan notas (la firma que se devuelve es
 *   la del titular, para las vistas previas, que muestran la nota como saldría a la vuelta).
 * firma: { titular: { nombre, cargo, imagen }, presentante: {...} | null, leyenda, firmanteId, presentanteId }
 */
export const firmaParaFecha = async (config, fecha) => {
  if (!config.firmante_usuario_id) {
    return {
      modo: 'configuracion',
      firma: {
        titular: { nombre: config.firma_nombre ?? '', cargo: config.firma_cargo ?? '', imagen: config.firma_imagen ?? null },
        presentante: null, leyenda: null, firmanteId: null, presentanteId: null
      }
    };
  }
  const titular = firmaParaNota(await firmaDeUsuario(config.firmante_usuario_id));
  const delTitular = { titular, presentante: null, leyenda: null, firmanteId: config.firmante_usuario_id, presentanteId: null };
  const licencia = await licenciaEnFecha(config.firmante_usuario_id, fecha);
  if (!licencia) return { modo: 'titular', firma: delTitular };
  const autorizado = await autorizadoVigente(licencia, fecha);
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
 * días hábiles, desde su víspera hasta su fin, con una persona autorizada vigente y sin nota de autorización.
 * Devuelve { licencia, autorizado } o null.
 */
export const autorizacionPendiente = async (config, hoy) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = (await licenciaEnFecha(config.firmante_usuario_id, hoy)) ?? (await proximaLicencia(config.firmante_usuario_id, hoy));
  if (!licencia || licencia.nota_autorizacion_id) return null;
  if (hoy < diaHabilAnterior(licencia.desde) || ultimoDiaHabilHasta(licencia.hasta) < licencia.desde) return null;
  const autorizado = await autorizadoVigente(licencia, hoy);
  return autorizado ? { licencia, autorizado } : null;
};

/**
 * Si hoy es la víspera (el último día hábil antes) de una licencia del firmante titular con días hábiles, devuelve
 * { hasta: último día hábil de la licencia, licencia }: hasta ahí se anticipan los avisos, con o sin autorizado
 * (spec 7.2 y 7.3). null en cualquier otro caso.
 */
export const anticipoPorLicencia = async (config, hoy) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = await proximaLicencia(config.firmante_usuario_id, hoy);
  if (!licencia || diaHabilAnterior(licencia.desde) !== hoy) return null;
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
