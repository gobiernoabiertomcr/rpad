// Quién audita cada cambio pendiente y por qué canal se le pide (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2,
// 9.1 y 9.3): funciones puras, sin base de datos. Las personas, con su disponibilidad del día (activa, con contraseña y
// sin licencia), las lee auditoriaService.personasDeAuditoria.
import { esAuditor } from './usuariosReglas.js';
import { diasHabilesTranscurridos } from './notasDigitalesCalendario.js';

// El recordatorio incluye los cambios propuestos hace una hora o más (spec 9.2), en segundos
export const ANTIGUEDAD_MINIMA_RECORDATORIO = 3600;
// La nota de auditoría se reitera a los 5 días hábiles de la última que incluyó el cambio (spec 9.3)
export const DIAS_HABILES_PARA_REITERAR_AUDITORIA = 5;

// "Ana", "Ana y Juan", "Ana, Juan y Pedro"
const listaDeNombres = (nombres) => (nombres.length <= 1
  ? nombres.join('')
  : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);

/**
 * Quiénes auditan un cambio ese día (spec 8.2): los auditores disponibles que no lo propusieron; si no hay ninguno, los
 * editores disponibles que no lo propusieron, de respaldo.
 * personas: [{ id, rol, nombre_completo, disponible }]. Devuelve { personas, respaldo }.
 */
export const quienesAuditan = (personas, proponenteId) => {
  const candidatas = personas.filter(p => p.disponible && p.id !== proponenteId);
  const auditores = candidatas.filter(p => esAuditor(p.rol));
  if (auditores.length > 0) return { personas: auditores, respaldo: false };
  return { personas: candidatas.filter(p => p.rol === 'editor'), respaldo: true };
};

// El 403 de un editor que quiere auditar un cambio que tiene auditores disponibles (spec 8.2)
export const mensajeNoCorresponde = (auditores) =>
  `Este cambio lo auditan ${listaDeNombres(auditores.map(p => p.nombre_completo))}. Podés auditarlo solo si ninguno está disponible.`;

/**
 * Si usuario ({ id, rol }) puede aprobar o rechazar hoy un cambio que propuso otro (proponenteId), según la spec 8.2 y las
 * "Decisiones del plan" 1 y 2: un auditor, siempre; un editor, solo de respaldo, cuando ningún auditor que no lo propuso
 * está disponible. Que no sea su propio cambio lo controla quien llama.
 * Devuelve { puede: true, respaldo } o { puede: false, mensaje }.
 */
export const permisoParaAuditar = (usuario, proponenteId, personas) => {
  if (esAuditor(usuario.rol)) return { puede: true, respaldo: false };
  if (usuario.rol !== 'editor') {
    return { puede: false, mensaje: 'Solo pueden auditar cambios los auditores y, de respaldo, los editores.' };
  }
  const { personas: auditores, respaldo } = quienesAuditan(personas, proponenteId);
  return respaldo ? { puede: true, respaldo: true } : { puede: false, mensaje: mensajeNoCorresponde(auditores) };
};

/**
 * Canal de un cambio pendiente en la corrida de un día hábil (spec 9.1). 'nota' si se cumplen las cuatro condiciones:
 * 1. ya tuvo su primer recordatorio en un día hábil anterior (primer_recordatorio_fecha < hoy);
 * 2. ninguno de los titulares puede auditarlo hoy (lo propuso o no está disponible);
 * 3. hay auditores disponibles para el cambio (no es de respaldo);
 * 4. hay quién firme.
 * 'recordatorio' en cualquier otro caso. La misma función decide para el recordatorio de las 14:00 y la nota de las 8:15.
 * cambio: { usuario_id, primer_recordatorio_fecha ('AAAA-MM-DD' en hora de Argentina, o null) }
 * personas, titulares (ids) y hayQuienFirme: los de auditoriaService.contextoDeCanal
 */
export const canalDelCambio = ({ cambio, hoy, personas, titulares, hayQuienFirme }) => {
  const yaTuvoRecordatorio = Boolean(cambio.primer_recordatorio_fecha) && cambio.primer_recordatorio_fecha < hoy;
  const disponibles = new Set(personas.filter(p => p.disponible).map(p => p.id));
  const algunTitularPuede = titulares.some(id => id !== cambio.usuario_id && disponibles.has(id));
  const hayAuditores = !quienesAuditan(personas, cambio.usuario_id).respaldo;
  return yaTuvoRecordatorio && !algunTitularPuede && hayAuditores && hayQuienFirme ? 'nota' : 'recordatorio';
};

// Va en el recordatorio (spec 9.2): está en el canal recordatorio y se propuso hace una hora o más. antiguedad_segundos
// se mide con el reloj de la base (auditoriaService.cambiosConCanal)
export const entraEnRecordatorio = (cambio) =>
  cambio.canal === 'recordatorio' && Number(cambio.antiguedad_segundos) >= ANTIGUEDAD_MINIMA_RECORDATORIO;

/**
 * Sección de la nota de auditoría de hoy para un cambio del canal nota (spec 9.3): 'nuevo' si nunca estuvo en una nota de
 * auditoría (ultima: null), 'reiterado' si la última que lo incluyó es de hace 5 días hábiles o más; si no, null.
 */
export const seccionDeAuditoria = (ultima, hoy) => {
  if (!ultima) return 'nuevo';
  return diasHabilesTranscurridos(ultima, hoy) >= DIAS_HABILES_PARA_REITERAR_AUDITORIA ? 'reiterado' : null;
};
