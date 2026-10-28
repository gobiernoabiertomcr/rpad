// Avisos diarios por email que no son Notas Digitales: el aviso directo a las áreas (40 días antes), el recordatorio de
// cambios pendientes a quienes pueden auditarlos y el aviso a quien propuso cambios que nadie puede auditar. Salen solo en
// días hábiles y la fecha se recibe como parámetro, para poder probarlos con cualquier día.
// Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (secciones 4 y 9.2)
import pool from '../config/database.js';
import { sendEmail, sendEmailToArea } from './emailService.js';
import * as templates from './emailTemplates.js';
import { ahoraArgentina, esDiaHabil, rangoDeAviso, sumarDias } from './notasDigitalesCalendario.js';
import { conPedido } from './notasDigitalesDatos.js';
import { contextoDeCanal, cambiosConCanal, proximoDiaConQuienAudite } from './auditoriaService.js';
import { quienesAuditan, entraEnRecordatorio } from './auditoriaReglas.js';
import { emailValido } from './usuariosReglas.js';
import { leerCalendario } from './feriadosDatos.js';

export const DIAS_AVISO_AREAS = 40;

/**
 * Datasets externos que avisa en esa fecha el aviso a las áreas, agrupados por área (solo áreas con email).
 * Un día hábil avisa los vencimientos de fecha + 40 y los de los días no hábiles que siguen (spec 4.2).
 * Fuera de un día hábil no hay nada que avisar.
 * Un dataset que no requiere nota DGMIT (requiere_nota = 0) queda afuera: este email anticipa la nota formal, que a ese
 * dataset no le llega; el Sí (1) y el sin dato (NULL) siguen como hasta ahora (spec 2026-10-20-requiere-nota, 1.6). La vista
 * previa y la prueba del email en Correos usan esta misma función, así que quedan coherentes con el envío.
 * Cada dataset trae su vencimiento ('AAAA-MM-DD') y su pedido, { desde, hasta, texto } o null (eventual): los datos que se
 * le van a solicitar, calculados con fecha, el día del aviso, igual que en las Notas Digitales (conPedido). Trae también su
 * tipo de pedido efectivo (el guardado o, si no tiene, el sugerido) y sus meses, del mismo conPedido. Con ellos el email dice
 * "Datos que se solicitarán" (spec 2026-10-17-fechas-datasets, 9) y la frecuencia con "(Acumulado)" cuando corresponde; desde
 * el 18/10/2026 no lleva la fecha sugerida de envío (spec 18).
 */
export const datasetsExternosPorArea = async (fecha) => {
  const rango = rangoDeAviso(fecha, DIAS_AVISO_AREAS);
  if (!rango) return [];
  const [rows] = await pool.execute(
    `SELECT d.id, d.titulo, d.url_dataset, d.area_id,
            DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS vencimiento,
            d.tipo_gestion, d.tipo_pedido, DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al,
            f.nombre AS frecuencia_nombre, f.meses,
            a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario,
            a.telefono_area, a.celular_area, a.nombre_contacto, a.telefono_contacto, a.email_contacto
     FROM datasets d
     JOIN frecuencias f ON d.frecuencia_id = f.id
     JOIN areas a ON d.area_id = a.id
     WHERE d.activo = TRUE
       AND d.tipo_gestion = 'externa'
       AND (d.requiere_nota IS NULL OR d.requiere_nota = 1)
       AND d.proxima_actualizacion BETWEEN ? AND ?
       AND f.dias IS NOT NULL
       AND (a.email_principal IS NOT NULL OR a.email_secundario IS NOT NULL)
     ORDER BY a.nombre ASC, d.titulo ASC`,
    [rango.desde, rango.hasta]
  );

  // Agrupar por área
  const porArea = {};
  rows.forEach(d => {
    if (!porArea[d.area_id]) {
      porArea[d.area_id] = {
        area_id: d.area_id,
        area_nombre: d.area_nombre,
        area_superior: d.area_superior,
        email_principal: d.email_principal,
        email_secundario: d.email_secundario,
        telefono_area: d.telefono_area,
        celular_area: d.celular_area,
        nombre_contacto: d.nombre_contacto,
        telefono_contacto: d.telefono_contacto,
        email_contacto: d.email_contacto,
        datasets: []
      };
    }
    const { pedido, tipo_pedido: tipoPedido, meses } = conPedido(d, fecha);
    porArea[d.area_id].datasets.push({
      id: d.id,
      titulo: d.titulo,
      url_dataset: d.url_dataset,
      vencimiento: d.vencimiento,
      frecuencia_nombre: d.frecuencia_nombre,
      pedido,
      tipo_pedido: tipoPedido,
      meses
    });
  });

  return Object.values(porArea);
};

// Registra una notificación en el log de la BD (un error acá no corta el envío)
const logNotificacion = async (tipo, areaId, destinatarios, datasetsIds, success, errorMessage = null) => {
  try {
    await pool.execute(
      `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tipo, areaId, destinatarios, datasetsIds.join(','), datasetsIds.length, success ? 1 : 0, errorMessage]
    );
  } catch (error) {
    console.error('Error guardando log de notificación:', error);
  }
};

/**
 * Aviso directo a las áreas de gestión externa (spec 4.2). Devuelve qué se envió:
 * { dia_habil, enviados: [{ tipo, area, cantidad }], errores: [{ tipo, area, error }], sin_datasets }
 */
export const enviarAvisoAreas = async ({ hoy }) => {
  const resultado = { dia_habil: esDiaHabil(hoy), enviados: [], errores: [], sin_datasets: true };
  if (!resultado.dia_habil) return resultado;

  const areas = await datasetsExternosPorArea(hoy);
  resultado.sin_datasets = areas.length === 0;
  for (const areaData of areas) {
    const { subject, html } = templates.areaAviso40dias(areaData);
    const destinatarios = [areaData.email_principal, areaData.email_secundario].filter(Boolean);
    const envio = await sendEmailToArea({ subject, html, to: destinatarios });
    const datasetsIds = areaData.datasets.map(d => d.id);
    await logNotificacion('area-aviso-40', areaData.area_id, destinatarios.join(','), datasetsIds, envio.success, envio.error);
    if (envio.success) {
      resultado.enviados.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, cantidad: areaData.datasets.length });
    } else {
      resultado.errores.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, error: envio.error });
    }
  }
  return resultado;
};

/**
 * Cambios pendientes que puede revisar un admin (excluye los propios)
 * @param {number} adminId - ID del admin que va a revisar
 */
export const cambiosPendientesParaAdmin = async (adminId) => {
  const [rows] = await pool.execute(
    `SELECT
       cp.id,
       cp.tipo_cambio,
       cp.dataset_id,
       cp.datos_nuevos,
       cp.usuario_id,
       cp.created_at,
       d.titulo AS dataset_titulo,
       u.username AS usuario_username,
       u.nombre_completo AS usuario_nombre,
       -- El mismo texto que tiempoPendiente: singular con 1 y "días" con tilde
       CASE
         WHEN TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()) < 60 THEN CONCAT('Hace ', TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()),
           IF(TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()) = 1, ' minuto', ' minutos'))
         WHEN TIMESTAMPDIFF(HOUR, cp.created_at, NOW()) < 24 THEN CONCAT('Hace ', TIMESTAMPDIFF(HOUR, cp.created_at, NOW()),
           IF(TIMESTAMPDIFF(HOUR, cp.created_at, NOW()) = 1, ' hora', ' horas'))
         ELSE CONCAT('Hace ', TIMESTAMPDIFF(DAY, cp.created_at, NOW()), IF(TIMESTAMPDIFF(DAY, cp.created_at, NOW()) = 1, ' día', ' días'))
       END AS tiempo_pendiente
     FROM cambios_pendientes cp
     JOIN usuarios u ON cp.usuario_id = u.id
     LEFT JOIN datasets d ON cp.dataset_id = d.id
     WHERE cp.estado = 'pendiente'
       AND cp.usuario_id != ?
     ORDER BY cp.created_at ASC`,
    [adminId]
  );

  // Parsear datos_nuevos JSON
  return rows.map(row => ({
    ...row,
    datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos
  }));
};

// "Hace 45 minutos", "Hace 3 horas" o "Hace 2 días"; con 1, en singular: "Hace 1 hora"
const unidad = (cantidad, singular, plural) => `${cantidad} ${cantidad === 1 ? singular : plural}`;
export const tiempoPendiente = (segundos) => {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${unidad(minutos, 'minuto', 'minutos')}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${unidad(horas, 'hora', 'horas')}`;
  return `Hace ${unidad(Math.floor(horas / 24), 'día', 'días')}`;
};

/**
 * Recordatorio de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.2), solo en días hábiles del
 * calendario (spec 2026-10-27-feriados-en-notas, 3: el de la corrida, con los feriados de la tabla; sin él, se lee). El mismo
 * calendario cuenta el canal de cada cambio (contextoDeCanal), como la nota de auditoría de las 8:15, y el «hasta» del aviso
 * a quien propone.
 * Incluye los cambios del canal recordatorio (9.1) propuestos hace una hora o más. Cada persona que puede auditarlos
 * (8.2) y está disponible recibe un email con los suyos; si los recibe de respaldo (no hay auditores disponibles), el
 * email lo dice. Quien está de licencia no lo recibe (5.3). La primera vez que un cambio va en un email enviado se
 * guarda primer_recordatorio_at = ahora ('AAAA-MM-DD HH:MM:SS' en hora de Argentina, ahoraArgentina() salvo en los tests
 * con fecha fija: Decisiones del plan 4).
 * Además, a quien propuso cambios que hoy no tienen a nadie que los audite le llega un aviso (avisarSinAuditor).
 * { fecha, dia_habil, enviados: [{ admin, email, cantidadPendientes, respaldo }], sinPendientes: [username],
 *   deLicencia: [username], canal_nota, sin_auditor: [{ usuario, cambios, hasta }], errores: [{ admin, error }] }
 */
export const enviarCambiosPendientes = async ({ hoy, ahora = ahoraArgentina(), calendario = null }) => {
  const conElCalendario = calendario ?? await leerCalendario();
  const resultados = {
    fecha: new Date().toISOString(), dia_habil: conElCalendario.esDiaHabil(hoy), enviados: [], sinPendientes: [],
    deLicencia: [], canal_nota: 0, sin_auditor: [], errores: []
  };
  if (!resultados.dia_habil) return resultados;

  const contexto = await contextoDeCanal(hoy, null, conElCalendario);
  const cambios = await cambiosConCanal(hoy, contexto);
  resultados.canal_nota = cambios.filter(c => c.canal === 'nota').length;
  // Los cambios de cada persona que los audita hoy (spec 8.2): un auditor los recibe como tal; un editor, de respaldo
  const porPersona = new Map();
  for (const cambio of cambios.filter(c => entraEnRecordatorio(c))) {
    const { personas, respaldo } = quienesAuditan(contexto.personas, cambio.usuario_id);
    for (const persona of personas) {
      if (!porPersona.has(persona.id)) porPersona.set(persona.id, { respaldo, cambios: [] });
      porPersona.get(persona.id).cambios.push({ ...cambio, tiempo_pendiente: tiempoPendiente(cambio.antiguedad_segundos) });
    }
  }

  for (const persona of contexto.personas) {
    // Durante la licencia no recibe emails del sistema (spec 5.3)
    if (persona.ausente_por_licencia) {
      resultados.deLicencia.push(persona.username);
      continue;
    }
    if (!persona.disponible) continue;
    const destino = porPersona.get(persona.id);
    if (!destino) {
      resultados.sinPendientes.push(persona.username);
      continue;
    }
    if (!emailValido(persona.email)) {
      resultados.errores.push({ admin: persona.username, error: 'No tiene un email válido' });
      continue;
    }
    const { subject, html } = templates.cambiosPendientesTemplate(destino.cambios, { respaldo: destino.respaldo });
    const envio = await sendEmail({ subject, html, to: [persona.email] });
    if (!envio.success) {
      resultados.errores.push({ admin: persona.username, error: envio.error });
      continue;
    }
    resultados.enviados.push({
      admin: persona.username, email: persona.email, cantidadPendientes: destino.cambios.length, respaldo: destino.respaldo
    });
    // Solo la primera vez: después se repite cada día hábil sin pisar la fecha (spec 9.2). El email ya salió: si guardar la
    // fecha falla, se anota el error y siguen los demás destinatarios (la fecha se guarda en el próximo recordatorio)
    try {
      await pool.query(
        'UPDATE cambios_pendientes SET primer_recordatorio_at = ? WHERE id IN (?) AND primer_recordatorio_at IS NULL',
        [ahora, destino.cambios.map(c => c.id)]
      );
    } catch (error) {
      console.error(`Error guardando el primer recordatorio (${persona.username}):`, error);
      resultados.errores.push({ admin: persona.username, error: `No se pudo guardar la fecha del primer recordatorio: ${error.message}` });
    }
  }
  await avisarSinAuditor({ hoy, ahora, contexto, cambios, resultados, calendario: conElCalendario });
  return resultados;
};

/**
 * Aviso a quien propone cuando nadie puede auditar sus cambios: los del recordatorio de hoy que no tienen a nadie que los
 * audite (quienesAuditan vacío: ni auditores ni editores de respaldo disponibles) y que nunca tuvieron este aviso. Un email
 * por persona con todos sus cambios en esa situación, solo si está disponible: de licencia no se manda (le llega a su
 * vuelta, si sigue sin auditor); inactiva o sin rol de auditoría o edición, tampoco. hasta: el primer día hábil del
 * calendario desde mañana en que alguien puede auditarlos. Si el email salió, se guarda aviso_sin_auditores_at = ahora, para
 * no repetirlo. Suma a resultados.sin_auditor [{ usuario, cambios, hasta }] y los errores a resultados.errores.
 */
const avisarSinAuditor = async ({ hoy, ahora, contexto, cambios, resultados, calendario }) => {
  const porProponente = new Map();
  for (const cambio of cambios.filter(c => entraEnRecordatorio(c))) {
    if (cambio.aviso_sin_auditores_at) continue;
    if (quienesAuditan(contexto.personas, cambio.usuario_id).personas.length > 0) continue;
    if (!porProponente.has(cambio.usuario_id)) porProponente.set(cambio.usuario_id, []);
    porProponente.get(cambio.usuario_id).push(cambio);
  }

  for (const [proponenteId, suyos] of porProponente) {
    const persona = contexto.personas.find(p => p.id === proponenteId);
    if (!persona?.disponible) continue;
    if (!emailValido(persona.email)) {
      resultados.errores.push({ admin: persona.username, error: 'No tiene un email válido' });
      continue;
    }
    // Los recordatorios ya salieron: si algo falla con el aviso de esta persona, se anota el error y siguen las demás.
    // Sin la fecha guardada, el aviso se reintenta el próximo día hábil
    try {
      await enviarAvisoSinAuditor({ persona, suyos, hoy, ahora, resultados, calendario });
    } catch (error) {
      console.error(`Error enviando el aviso sin auditor (${persona.username}):`, error);
      resultados.errores.push({ admin: persona.username, error: `No se pudo enviar el aviso sin auditor: ${error.message}` });
    }
  }
};

// El aviso de una persona (avisarSinAuditor): calcula hasta cuándo (con el calendario de la corrida), envía el email y guarda
// la fecha
const enviarAvisoSinAuditor = async ({ persona, suyos, hoy, ahora, resultados, calendario }) => {
  const hasta = await proximoDiaConQuienAudite(persona.id, sumarDias(hoy, 1), calendario);
  const { subject, html } = templates.sinAuditorTemplate(suyos, { hasta });
  const envio = await sendEmail({ subject, html, to: [persona.email] });
  if (!envio.success) {
    resultados.errores.push({ admin: persona.username, error: envio.error });
    return;
  }
  resultados.sin_auditor.push({ usuario: persona.username, cambios: suyos.length, hasta });
  // El email ya salió: si guardar la fecha falla, se anota el error (mañana se volvería a avisar)
  try {
    await pool.query(
      'UPDATE cambios_pendientes SET aviso_sin_auditores_at = ? WHERE id IN (?) AND aviso_sin_auditores_at IS NULL',
      [ahora, suyos.map(c => c.id)]
    );
  } catch (error) {
    console.error(`Error guardando el aviso sin auditor (${persona.username}):`, error);
    resultados.errores.push({ admin: persona.username, error: `No se pudo guardar la fecha del aviso sin auditor: ${error.message}` });
  }
};
