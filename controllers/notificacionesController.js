import { sendEmailToArea, verifyConnection, listaDeCorreos } from '../services/emailService.js';
import { avisoDiarioAislado } from '../services/miEspacioEventosDiario.js';
import { correoDelDatoQuincenaAislado } from '../services/datoQuincenaCorreo.js';
import * as templates from '../services/emailTemplates.js';
import { ejecutarNotasDigitales, anotarEnLaUltimaCorrida, enviarLasQueEsperanFirma } from '../services/notasDigitales.js';
import { sacarFotoSiCorresponde } from '../services/metricasFoto.js';
import { enviarAvisosDeVencimiento } from '../services/miEspacioAvisos.js';
import { ejecutarRecordatoriosDeEventos as correrLosRecordatorios } from '../services/miEspacioEventosCorrida.js';
import { textoDelResultadoDeEventos } from '../services/miEspacioEventosReglas.js';
import { obtenerConfig, conPedido } from '../services/notasDigitalesDatos.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';
import { leerCalendario } from '../services/feriadosDatos.js';
import { MENSAJE_CORRIDA_SIN_FERIADOS } from '../services/feriadosReglas.js';
import {
  datasetsExternosPorArea, enviarAvisoAreas, cambiosPendientesParaAdmin, enviarCambiosPendientes, DIAS_AVISO_AREAS
} from '../services/avisosDiariosService.js';
import { enviarResumenAvisosRetenidos } from '../services/avisosSuperadminService.js';

// Área de ejemplo para la vista previa y la prueba del aviso a áreas cuando ese día no hay datos. fecha: el día del aviso.
// Los dos datasets vencen el fin de mes que corresponde a los 40 días, como los de un aviso real, y llevan sus datos
// solicitados: el 1 es un trimestral acumulado con Datos al del corte anterior (pide desde lo que falta; el email dice
// "Trimestralmente (Acumulado)", spec 18) y el 2, una foto al corte.
// El pedido, el tipo y los meses salen de las mismas reglas que el aviso (conPedido), así que el ejemplo no se desactualiza ni
// se aparta de la forma de un dataset real (el email dice la frecuencia con "(Acumulado)" a partir de ellos).
const areaDeEjemplo = (fecha) => {
  const vencimiento = vencimientoDelMes(sumarDias(fecha, DIAS_AVISO_AREAS));
  const pedidoTipoYMesesDe = (datos) => {
    const { pedido, tipo_pedido: tipoPedido, meses } = conPedido({ vencimiento, tipo_gestion: 'externa', ...datos }, fecha);
    return { pedido, tipo_pedido: tipoPedido, meses };
  };
  return {
    area_id: 0,
    area_nombre: 'Dirección de Ejemplo',
    area_superior: 'Secretaría de Ejemplo',
    email_principal: 'ejemplo@comodoro.gov.ar',
    email_secundario: null,
    telefono_area: '297 4XXXXXX',
    celular_area: null,
    nombre_contacto: 'Persona de contacto',
    telefono_contacto: null,
    email_contacto: null,
    datasets: [
      {
        id: 1, titulo: 'Dataset de Ejemplo 1', frecuencia_nombre: 'Trimestralmente', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo', vencimiento,
        // (sus datos llegan al corte del ciclo anterior: el mes antes del vencimiento, menos los 3 meses del ciclo)
        ...pedidoTipoYMesesDe({ meses: 3, tipo_pedido: 'acumulado', datos_al: sumarMeses(vencimiento, -4) })
      },
      {
        id: 2, titulo: 'Dataset de Ejemplo 2', frecuencia_nombre: 'Cada dos años', url_dataset: 'https://datos.comodoro.gov.ar/dataset/ejemplo-2', vencimiento,
        ...pedidoTipoYMesesDe({ meses: 24, tipo_pedido: 'foto', datos_al: null })
      }
    ]
  };
};

// La vista previa y la prueba del aviso a las áreas muestran lo que saldría en la próxima corrida posible (hoy, si es
// día hábil): un sábado, lo del lunes en lugar de nada (o lo del martes, si el lunes es feriado). El día hábil, con el
// calendario que lee el pedido, el mismo que después recibe datasetsExternosPorArea (spec 2026-10-27-feriados-en-notas, 4).
// Sin valor por defecto: un olvido tira. Se exporta solo para el test
export const fechaDelProximoAviso = (hoy, calendario) => calendario.proximoDiaHabil(hoy);

// Lo que la corrida anota en la última corrida que muestra Correos > Estado cuando fallan los avisos de Mi espacio
const textoFallaDeMiEspacio = (mensaje) => `No se pudieron enviar los avisos de Mi espacio: ${mensaje}`;

/**
 * Proceso diario (cron de las 8:15): aviso directo a las áreas, Notas Digitales, desde el 10/01 la foto del año anterior,
 * los avisos de vencimiento de Mi espacio y, al final, el correo del dato de la quincena (data.dato_quincena).
 * El calendario de días hábiles (con los feriados de la tabla) se lee una vez, al principio, y el mismo objeto va al aviso a
 * las áreas, al resumen al superadmin, a las Notas Digitales y a dia_habil (spec 2026-10-27-feriados-en-notas, 2 y 3); data
 * suma calendario: de dónde salió ('tabla' o 'fijos'). Si la tabla no se pudo leer, la corrida sigue con los 9 fijos y las
 * Notas Digitales anotan el error entre los suyos (paso 'feriados'): la corrida queda con errores y responde 207
 */
export const ejecutarNotificacionesDiarias = async (req, res) => {
  const hoy = hoyArgentina();
  const resultados = {
    fecha: new Date().toISOString(), calendario: null, enviados: [], errores: [], sinDatasets: [], notasDigitales: null,
    dia_habil: null, avisos_retenidos: null, foto: null, miEspacio: null, dato_quincena: null, diario: null
  };

  try {
    // Nunca tira: si la tabla no se puede leer, devuelve el de los 9 fijos con su error
    const calendario = await leerCalendario();
    resultados.calendario = calendario.origen;

    // El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 6): lo que se sumó para hoy, a los superiores. Se dispara
    // antes que todo y sin esperarlo: la mañana tarda minutos y tiene que salir antes del evento, y un SMTP colgado acá no demora las
    // Notas. Nunca rechaza (y lleva su .catch, por las dudas: un rechazo sin manejar tumbaría el proceso con las Notas a mitad). No escribe en
    // la última corrida de las Notas, que registrarInicio borra: sus errores, en la respuesta y en su fila
    const diario = avisoDiarioAislado('manana', calendario).catch((error) => {
      console.error('Error en el aviso diario:', error?.stack ?? error);
      return { ocupada: false, dia_habil: null, enviados: 0, fallidos: 0, errores: [{ usuario_id: null, error: 'Error en el aviso diario' }] };
    });

    // Aviso directo a las áreas de gestión externa (40 días antes, solo en días hábiles). Va aislado: un error acá
    // no saltea las Notas Digitales
    try {
      const aviso = await enviarAvisoAreas({ hoy, calendario });
      resultados.dia_habil = aviso.dia_habil;
      resultados.enviados.push(...aviso.enviados);
      resultados.errores.push(...aviso.errores);
      if (aviso.sin_datasets) resultados.sinDatasets.push('area-aviso-40');
    } catch (error) {
      console.error('Error en el aviso a las áreas:', error);
      resultados.errores.push({ tipo: 'area-aviso-40', error: 'Error ejecutando el aviso a las áreas' });
    }
    resultados.dia_habil ??= calendario.esDiaHabil(hoy);

    // Resumen de los avisos al superadmin retenidos durante su licencia (spec 2026-10-15, 5.4). Aislado: un error acá no
    // saltea las Notas Digitales y los avisos quedan retenidos para el día hábil siguiente
    try {
      resultados.avisos_retenidos = await enviarResumenAvisosRetenidos({ hoy, calendario });
    } catch (error) {
      console.error('Error en el resumen de avisos retenidos:', error);
      resultados.errores.push({ tipo: 'avisos-retenidos', error: error.message });
    }

    // Notas Digitales (reemplazan los avisos de gestión interna y externa). Deciden solas si hoy es día hábil, con el
    // calendario de la corrida; si cayó a los 9 fijos, el error vuelve entre los suyos (paso 'feriados') y lo anotan en la
    // última corrida. creado_por: el admin que pidió la corrida; el cron no tiene req.user y queda en NULL
    try {
      resultados.notasDigitales = await ejecutarNotasDigitales({ hoy, usuarioId: req.user?.userId ?? null, calendario });
      if (resultados.notasDigitales.fallidas > 0) {
        resultados.errores.push({ tipo: 'notas-digitales', error: `${resultados.notasDigitales.fallidas} nota(s) no se pudieron enviar` });
      }
      // Pasos que fallaron con una excepción: también quedan en la última corrida que muestra Correos > Estado
      for (const fallo of resultados.notasDigitales.errores ?? []) {
        resultados.errores.push({ tipo: 'notas-digitales', paso: fallo.tipo, gestion: fallo.gestion, id: fallo.id, error: fallo.mensaje });
      }
    } catch (error) {
      console.error('Error en Notas Digitales:', error);
      resultados.errores.push({ tipo: 'notas-digitales', error: 'Error ejecutando Notas Digitales' });
    }

    // La foto del año anterior al 31/12 (spec 2026-10-24-metricas-y-reportes, 3): la saca la primera corrida desde el 10/01, sea o
    // no día hábil; si falta la de un año más viejo, la saca primero (una por corrida, Ruling 18). Cada corrida lee qué años ya tienen
    // foto (una consulta a metricas_fotos) y, si no toca sacar ninguna, no escribe nada (devuelve null, o { anio, ya: true } si la
    // del año anterior ya está). Aislada: un error acá (también si falta la tabla) no frena la respuesta, queda en la última corrida
    // que muestra Correos > Estado y la corrida del día siguiente la vuelve a intentar. Corre fuera del bloqueo de las Notas Digitales
    // (conBloqueo): con dos corridas a la vez, el registrarFin de la primera puede pisar la anotación de la segunda, que igual queda en
    // la respuesta y en el log (y la foto se reintenta al día siguiente). Con el calendario de la corrida (spec
    // 2026-10-27-feriados-en-notas, 2 y 5: una sola lectura de la tabla); si cayó a los 9 fijos, la foto no se saca y se reintenta en
    // la corrida siguiente
    try {
      resultados.foto = await sacarFotoSiCorresponde({ hoy, calendario });
    } catch (error) {
      const mensaje = String(error?.message ?? error);
      // Solo la pila: los errores de mysql2 traen la consulta entera, con todos los datos de la foto
      console.error('Error en la foto del año:', error?.stack ?? error);
      resultados.errores.push({ tipo: 'foto-del-anio', error: mensaje });
      await anotarEnLaUltimaCorrida(`No se pudo sacar la foto del año: ${mensaje}`).catch(() => {});
    }

    // El email de lo que vence pronto en Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 9): después de las Notas
    // Digitales (registrarInicio borra lo anotado en la última corrida) y de la foto, con su propio control de día hábil (lee
    // los feriados de la tabla por su cuenta: si no puede, no manda nada). Aislado: un error acá (también si falta una
    // tabla) no frena la respuesta, queda en la última corrida y lo que no salió sale en la próxima corrida de su tramo. Un
    // email que no salió va a los errores con su persona y el texto del envío; en la última corrida, solo el motivo fijo
    // (el texto de nodemailer puede traer la dirección de email)
    try {
      resultados.miEspacio = await enviarAvisosDeVencimiento({ hoy });
      const fallidos = resultados.miEspacio.errores;
      if (fallidos.length > 0) {
        resultados.errores.push(...fallidos.map((fallo) => ({ tipo: 'mi-espacio', ...fallo })));
        const motivos = [...new Set(fallidos.map(({ motivo }) => motivo))].join('; ');
        await anotarEnLaUltimaCorrida(textoFallaDeMiEspacio(motivos)).catch(() => {});
      }
    } catch (error) {
      const mensaje = String(error?.message ?? error);
      console.error('Error en los avisos de Mi espacio:', error?.stack ?? error);
      resultados.errores.push({ tipo: 'mi-espacio', error: mensaje });
      await anotarEnLaUltimaCorrida(textoFallaDeMiEspacio(mensaje)).catch(() => {});
    }

    // El correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 8): al final, para darle unos segundos más al bot,
    // con el calendario de la corrida. Nunca rechaza y tiene su candado y su registro: no escribe en la última corrida de las
    // Notas. Sus errores, con su tipo; «ocupada» no es un error
    resultados.dato_quincena = await correoDelDatoQuincenaAislado(calendario);
    for (const fallo of resultados.dato_quincena.errores) resultados.errores.push({ tipo: 'dato-quincena', ...fallo });

    resultados.diario = await diario;
    for (const fallo of resultados.diario.errores) resultados.errores.push({ tipo: 'mi-espacio-diario', ...fallo });

    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success ? 'Proceso completado.' : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });
  } catch (error) {
    console.error('Error en notificaciones:', error);
    res.status(500).json({ success: false, error: 'Error ejecutando notificaciones' });
  }
};

/**
 * Prueba del aviso a áreas: se envía solo a las casillas de prueba de Notas Digitales
 */
export const pruebaAvisoArea = async (req, res) => {
  try {
    const casillas = listaDeCorreos((await obtenerConfig()).casillas_prueba);
    if (casillas.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay casillas de prueba configuradas (Correos > Configuración)' });
    }
    const calendario = await leerCalendario();
    const fecha = fechaDelProximoAviso(hoyArgentina(), calendario);
    const [area] = await datasetsExternosPorArea(fecha, calendario);
    const datosArea = area ?? areaDeEjemplo(fecha);
    const { subject, html } = templates.areaAviso40dias(datosArea);
    const result = await sendEmailToArea({ subject: `[PRUEBA] ${subject}`, html, to: casillas });
    if (!result.success) return res.status(502).json({ success: false, error: `No se pudo enviar la prueba: ${result.error}` });
    res.json({
      success: true,
      message: `Prueba enviada a ${casillas.join(', ')}${area ? '' : ' (con datos de ejemplo)'}`,
      data: { area: datosArea.area_nombre, ejemplo: !area, destinatarios: casillas }
    });
  } catch (error) {
    console.error('Error en prueba de aviso a áreas:', error);
    res.status(500).json({ success: false, error: 'Error enviando la prueba' });
  }
};

/**
 * Verifica la conexión SMTP
 */
export const verificarSMTP = async (req, res) => {
  const result = await verifyConnection();
  res.json({
    success: result.success,
    message: result.success ? 'Conexión SMTP verificada' : 'Error conectando a SMTP',
    error: result.error || null,
    code: result.code || null
  });
};

/**
 * Vista previa del aviso a áreas (sin enviar)
 */
export const previewEmail = async (req, res) => {
  if (req.params.tipo !== 'area-aviso-40') {
    return res.status(400).json({ success: false, error: 'Tipo no válido', tiposDisponibles: ['area-aviso-40'] });
  }
  try {
    const calendario = await leerCalendario();
    const fecha = fechaDelProximoAviso(hoyArgentina(), calendario);
    const [area] = await datasetsExternosPorArea(fecha, calendario);
    const { html } = templates.areaAviso40dias(area ?? areaDeEjemplo(fecha));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error en vista previa:', error);
    res.status(500).json({ success: false, error: 'Error generando la vista previa' });
  }
};

// A las 14:00 sale lo que quede de la firma digital. Da lo que pasó, o null si no hubo nada (así, con la firma digital apagada, la respuesta
// es la de siempre). Una falla se anota en la última corrida, con el motivo fijo: nunca tira
const lasQueEsperanFirma = async (calendario) => {
  try {
    const resumen = await enviarLasQueEsperanFirma({ hoy: hoyArgentina(), calendario });
    if (resumen.errores.length > 0 || resumen.fallidas > 0 || resumen.ocupado) {
      await anotarEnLaUltimaCorrida('No se pudieron enviar todas las notas que esperaban la firma digital: se reintenta en la próxima corrida').catch(() => {});
    }
    return resumen.enviadas + resumen.fallidas + resumen.errores.length > 0 || resumen.ocupado ? resumen : null;
  } catch (error) {
    console.error('Error enviando las notas que esperaban la firma digital:', error?.stack ?? error);
    await anotarEnLaUltimaCorrida('No se pudieron enviar las notas que esperaban la firma digital: se reintenta en la próxima corrida').catch(() => {});
    return { ejecutado: false, ocupado: false, enviadas: 0, fallidas: 0, errores: [{ mensaje: 'No se pudieron enviar las notas que esperaban la firma digital' }] };
  }
};

/**
 * Ejecuta el recordatorio de cambios pendientes
 * Llamado por cron (14:00); solo envía en días hábiles (spec 4.1), con el calendario de los feriados de la tabla, leído una
 * vez (spec 2026-10-27-feriados-en-notas, 2 y 3): el mismo cuenta el día, el canal de cada cambio y el aviso a quien propone.
 * Envía un email a cada persona que puede auditar cambios con los que le corresponden (excluye los propios y los que van
 * por nota de auditoría, spec 2026-10-15, 9.2)
 * data suma calendario: de dónde salió ('tabla' o 'fijos'). Si la tabla no se pudo leer (calendario.error), la corrida sigue
 * con los 9 fijos, lo anota en la última corrida de las Notas Digitales (esta corrida no tiene registro propio: Correos >
 * Estado lo muestra en rojo hasta la corrida siguiente) y responde 207 con success false, también un día que no es hábil.
 * El mensaje no cambia: dice lo enviado o los errores del envío. Después del aviso diario, el correo del dato de la quincena
 * (data.dato_quincena): sus errores dan 207 y «ocupada» no es un error
 */
export const ejecutarNotificacionCambiosPendientes = async (req, res) => {
  try {
    const calendario = await leerCalendario();
    const sinFeriados = calendario.error !== null;
    if (sinFeriados) await anotarEnLaUltimaCorrida(MENSAJE_CORRIDA_SIN_FERIADOS).catch(() => {});
    // Primero, las notas que esperaban la firma digital (spec 2026-11-03-notas-firma-digital, 4.9): aisladas, un error no frena los recordatorios
    const firmaDigital = await lasQueEsperanFirma(calendario);
    // Los recordatorios tampoco frenan el aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 6): enviarCambiosPendientes
    // no tiene try, y su 500 se sigue respondiendo después del paso. El paso no tira, y sus errores dan 207 sin cambiar el mensaje; una
    // corrida «ocupada» no es un error
    let resultados;
    let fallaDeLosRecordatorios = null;
    try {
      resultados = await enviarCambiosPendientes({ hoy: hoyArgentina(), calendario });
    } catch (error) {
      fallaDeLosRecordatorios = error;
    }
    const diario = await avisoDiarioAislado('tarde', calendario);
    // El correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 8): lo que llegó después de las 8:05 y los
    // reintentos. Tampoco lo frenan los recordatorios, y nunca rechaza; sus errores dan 207 sin cambiar el mensaje
    const datoQuincena = await correoDelDatoQuincenaAislado(calendario);
    if (fallaDeLosRecordatorios) throw fallaDeLosRecordatorios;
    const sinErroresDelDiario = diario.errores.length === 0 && diario.fallidos === 0;
    const sinErroresDelDato = datoQuincena.errores.length === 0 && datoQuincena.fallidos === 0;
    const data = {
      ...resultados, calendario: calendario.origen, diario, dato_quincena: datoQuincena,
      ...(firmaDigital ? { firma_digital: firmaDigital } : {})
    };
    const sinErroresDeFirma = !firmaDigital || (firmaDigital.errores.length === 0 && !firmaDigital.ocupado);
    if (!resultados.dia_habil) {
      // Las que esperaban la firma no salen un día no hábil (salen en la corrida siguiente), pero un error al mirarlas se dice igual
      const bien = !sinFeriados && sinErroresDeFirma && sinErroresDelDiario && sinErroresDelDato;
      return res.status(bien ? 200 : 207)
        .json({ success: bien, message: 'Hoy no es día hábil: no se envían recordatorios.', data });
    }
    const sinErrores = resultados.errores.length === 0;
    const success = sinErrores && !sinFeriados && sinErroresDeFirma && sinErroresDelDiario && sinErroresDelDato;
    res.status(success ? 200 : 207).json({
      success,
      message: sinErrores
        ? `Recordatorios enviados a ${resultados.enviados.length} ${resultados.enviados.length === 1 ? 'persona' : 'personas'}.`
        : `Proceso completado con ${resultados.errores.length} errores.`,
      data
    });
  } catch (error) {
    console.error('Error en notificación de cambios pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando notificación de cambios pendientes',
      details: error.message
    });
  }
};

/**
 * La corrida de los recordatorios de la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, sección 5): la llama una
 * Tarea Cron cada media hora; solo manda en días hábiles, con su propio candado (services/miEspacioEventosCorrida.js).
 * Cuando la corrida termina, responde con `data` (lo que devolvió): con otra corrida en curso, 200 «Otra corrida de los
 * recordatorios está en curso.»; un día que no es hábil, 200 «Hoy no es día hábil: no se mandan recordatorios.»; con
 * fallidos o errores, 207; si no, 200 «Recordatorios enviados: N.» (el mensaje es el resultado que queda anotado). Una
 * excepción (no se pudo tomar el candado), 500 `{ success: false, error }`, sin `data`.
 */
export const ejecutarRecordatoriosDeEventos = async (req, res) => {
  try {
    const data = await correrLosRecordatorios();
    if (data.ocupada) {
      return res.status(200).json({ success: true, message: 'Otra corrida de los recordatorios está en curso.', data });
    }
    if (data.dia_habil === false) {
      return res.status(200).json({ success: true, message: 'Hoy no es día hábil: no se mandan recordatorios.', data });
    }
    const success = data.fallidos === 0 && data.errores.length === 0;
    res.status(success ? 200 : 207).json({ success, message: textoDelResultadoDeEventos(data), data });
  } catch (error) {
    // Solo la pila: los errores de mysql2 traen la consulta armada con sus valores
    console.error('Error en los recordatorios de la agenda:', error?.stack ?? error);
    res.status(500).json({ success: false, error: 'Error en los recordatorios de la agenda' });
  }
};

/**
 * Preview de email de cambios pendientes (sin enviar)
 */
export const previewCambiosPendientes = async (req, res) => {
  try {
    // Usar el usuario actual o buscar cualquier admin para preview
    const userId = req.user?.id || 0;
    
    let cambiosPendientes = await cambiosPendientesParaAdmin(userId);

    // Si no hay datos reales, usar ejemplo
    if (cambiosPendientes.length === 0) {
      cambiosPendientes = [
        {
          id: 1,
          tipo_cambio: 'crear',
          dataset_id: null,
          datos_nuevos: { titulo: 'Dataset de Ejemplo Nuevo' },
          usuario_username: 'usuario_ejemplo',
          usuario_nombre: 'Usuario de Ejemplo',
          tiempo_pendiente: 'Hace 2 horas'
        },
        {
          id: 2,
          tipo_cambio: 'editar',
          dataset_id: 5,
          dataset_titulo: 'Presupuesto Municipal 2025',
          datos_nuevos: { titulo: 'Presupuesto Municipal 2025 (Actualizado)' },
          usuario_username: 'otro_usuario',
          usuario_nombre: 'Otro Usuario',
          tiempo_pendiente: 'Hace 1 día'
        },
        {
          id: 3,
          tipo_cambio: 'eliminar',
          dataset_id: 10,
          dataset_titulo: 'Dataset Obsoleto',
          datos_nuevos: null,
          usuario_username: 'tercer_usuario',
          usuario_nombre: 'Tercer Usuario',
          tiempo_pendiente: 'Hace 3 días'
        }
      ];
    }

    const { html } = templates.cambiosPendientesTemplate(cambiosPendientes);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
