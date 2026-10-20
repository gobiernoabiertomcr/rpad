// Quién audita cada cambio pendiente y por qué canal se le pide (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2,
// 9.1 y 9.3): funciones puras, sin base de datos. Las personas, con su disponibilidad del día (activa, con contraseña y
// sin licencia), las lee auditoriaService.personasDeAuditoria.
import { esAuditor } from './usuariosReglas.js';
import { diasHabilesTranscurridos, esDiaHabil } from './notasDigitalesCalendario.js';

// El recordatorio incluye los cambios propuestos hace una hora o más (spec 9.2), en segundos
export const ANTIGUEDAD_MINIMA_RECORDATORIO = 3600;
// La nota de auditoría se reitera a los 5 días hábiles de la última que incluyó el cambio (spec 9.3)
export const DIAS_HABILES_PARA_REITERAR_AUDITORIA = 5;

// "Ana", "Ana y Juan", "Ana, Juan y Pedro"
const listaDeNombres = (nombres) => (nombres.length <= 1
  ? nombres.join('')
  : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);

/**
 * Disponible un día (spec 3): activa, con la contraseña definida y sin licencia ese día. Es la única definición del
 * sistema: la usan auditoriaService.personasDeAuditoria y la lectura por rango (personasPorDia).
 * usuario: { activo, tiene_contrasena } (booleanos). licencias: las no anuladas de esa persona, [{ desde, hasta }]
 * ('AAAA-MM-DD', los dos días incluidos). ausente_por_licencia: estaría disponible si no fuera por la licencia.
 * { de_licencia, ausente_por_licencia, disponible }
 */
export const disponibilidad = (usuario, licencias, fecha) => {
  const deLicencia = licencias.some(l => l.desde <= fecha && l.hasta >= fecha);
  const habilitada = Boolean(usuario.activo) && Boolean(usuario.tiene_contrasena);
  return { de_licencia: deLicencia, ausente_por_licencia: habilitada && deLicencia, disponible: habilitada && !deLicencia };
};

// Día sin auditor: ningún auditor (superadmin o admin) está disponible. Los editores no cuentan
const sinAuditorDisponible = (personas) => !personas.some(p => p.disponible && esAuditor(p.rol));

/**
 * Períodos sin auditor: los días hábiles sin auditor seguidos. Solo cuentan los días hábiles: un fin de semana o un feriado
 * en el medio no cortan el período (ni lo alargan). dias: en orden, [{ fecha, personas }], cada persona con rol,
 * nombre_completo y disponible de ese día. Forman períodos los días hasta `hasta` inclusive; los que siguen solo sirven
 * para encontrar vuelve: el primer día hábil después del período con algún auditor disponible (null si no está en dias).
 * respaldo: los editores disponibles en al menos un día del período, del nombre a la Z, sin repetir.
 * [{ desde, hasta, vuelve, respaldo: [nombre_completo] }]
 */
export const agruparDiasSinAuditor = (dias, hasta) => {
  const periodos = [];
  let abierto = null;
  for (const { fecha, personas } of dias) {
    if (!esDiaHabil(fecha)) continue;
    const sinAuditor = sinAuditorDisponible(personas);
    if (!sinAuditor && abierto) {
      abierto.vuelve = fecha;
      abierto = null;
    }
    if (fecha > hasta) {
      if (!abierto) break;
      continue;
    }
    if (!sinAuditor) continue;
    if (!abierto) {
      abierto = { desde: fecha, hasta: fecha, vuelve: null, respaldo: new Map() };
      periodos.push(abierto);
    }
    abierto.hasta = fecha;
    for (const p of personas) if (p.disponible && p.rol === 'editor') abierto.respaldo.set(p.id, p.nombre_completo);
  }
  return periodos.map(p => ({ ...p, respaldo: [...p.respaldo.values()].sort((a, b) => a.localeCompare(b, 'es')) }));
};

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

// El 403 de un editor que quiere auditar el cambio de otro editor cuando hay auditores disponibles (spec 8.2)
export const mensajeNoCorresponde = (auditores) =>
  `Este cambio lo auditan ${listaDeNombres(auditores.map(p => p.nombre_completo))}. Podés auditarlo solo si ninguno está disponible.`;

// Lo que ve un editor antes de auditar sin responsabilidad el cambio de un auditor (spec 2026-10-20-editor-sin-responsabilidad)
export const avisoSinResponsabilidad = (auditores) =>
  `Este cambio lo auditan ${listaDeNombres(auditores.map(p => p.nombre_completo))}. Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.`;

// El 409 al aprobar o rechazar: lo que la persona confirmó (con o sin responsabilidad) ya no es lo que corresponde hoy
export const MENSAJE_SITUACION_CAMBIADA = 'La situación de este cambio cambió. Revisá el aviso y volvé a confirmar.';

/**
 * Si usuario ({ id, rol }) puede aprobar o rechazar hoy un cambio que propuso otro (proponenteId), según la spec 8.2, las
 * "Decisiones del plan" 1 y 2 y la spec 2026-10-20-editor-sin-responsabilidad: un auditor, siempre; un editor, de respaldo
 * cuando ningún auditor que no lo propuso está disponible y, si hay alguno, sin responsabilidad por la auditoría cuando el
 * cambio lo propuso un auditor (por su rol de hoy, leído de personas: si no está, falla cerrado). Que no sea su propio
 * cambio lo controla quien llama.
 * Devuelve siempre { puede, respaldo, sin_responsabilidad, mensaje } (respaldo y sin_responsabilidad nunca juntos).
 */
export const permisoParaAuditar = (usuario, proponenteId, personas) => {
  const permiso = (puede, { respaldo = false, sin_responsabilidad = false, mensaje = null } = {}) =>
    ({ puede, respaldo, sin_responsabilidad, mensaje });
  if (esAuditor(usuario.rol)) return permiso(true);
  if (usuario.rol !== 'editor') return permiso(false, { mensaje: 'Solo pueden auditar cambios los auditores y los editores.' });
  const { personas: auditores, respaldo } = quienesAuditan(personas, proponenteId);
  if (respaldo) return permiso(true, { respaldo: true });
  const proponente = personas.find(p => p.id === proponenteId);
  return proponente && esAuditor(proponente.rol)
    ? permiso(true, { sin_responsabilidad: true, mensaje: avisoSinResponsabilidad(auditores) })
    : permiso(false, { mensaje: mensajeNoCorresponde(auditores) });
};

// Recordatorios por email antes de pedir la auditoría por nota (pedido del usuario el 16/10/2026; antes era 1): el del día
// del primer recordatorio y el del día hábil siguiente. La nota sale recién al segundo día hábil después del primero.
export const RECORDATORIOS_ANTES_DE_LA_NOTA = 2;

/**
 * Canal de un cambio pendiente en la corrida de un día hábil (spec 9.1). 'nota' si se cumplen las cuatro condiciones:
 * 1. ya tuvo sus recordatorios: el primero fue hace RECORDATORIOS_ANTES_DE_LA_NOTA días hábiles o más
 *    (diasHabilesTranscurridos(primer_recordatorio_fecha, hoy) >= 2: recordatorio el día 1 y el día 2, nota el día 3);
 * 2. ninguno de los titulares puede auditarlo hoy (lo propuso o no está disponible);
 * 3. hay auditores disponibles para el cambio (no es de respaldo);
 * 4. la nota de auditoría puede salir (hayQuienFirme): envío automático activo, configuración completa, Para de auditoría
 *    y quién firme. Con el envío apagado o la configuración incompleta no hay nota posible, y el cambio sigue con
 *    recordatorios en lugar de quedar sin canal.
 * 'recordatorio' en cualquier otro caso. La misma función decide para el recordatorio de las 14:00 y la nota de las 8:15.
 * cambio: { usuario_id, primer_recordatorio_fecha ('AAAA-MM-DD' en hora de Argentina, o null) }
 * personas, titulares (ids) y hayQuienFirme: los de auditoriaService.contextoDeCanal
 */
export const canalDelCambio = ({ cambio, hoy, personas, titulares, hayQuienFirme }) => {
  const yaTuvoRecordatorio = Boolean(cambio.primer_recordatorio_fecha)
    && diasHabilesTranscurridos(cambio.primer_recordatorio_fecha, hoy) >= RECORDATORIOS_ANTES_DE_LA_NOTA;
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
