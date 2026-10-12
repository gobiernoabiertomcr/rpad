// Motor de Notas Digitales: genera, numera, envía y reintenta los avisos y reiteraciones.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5, 7.4 y 8)
import pool from '../config/database.js';
import { sendEmail, listaDeCorreos } from './emailService.js';
import { construirNota, renderHtml, renderTexto } from './notasDigitalesContenido.js';
import { renderPdf } from './notasDigitalesPdf.js';
import {
  hoyArgentina, esDiaHabil, proximoDiaHabil, primerDiaHabilDelMes, periodoDe, periodoSiguiente, sumarDias
} from './notasDigitalesCalendario.js';
import {
  VENTANA_DIAS, obtenerConfig, seleccionarParaAviso, seleccionarParaReiteracion, pendientesDeAviso, antecedentesDe, areasDe
} from './notasDigitalesDatos.js';

export const MAX_INTENTOS = 5;
const GESTIONES = ['interna', 'externa'];
const BLOQUEO = 'rpad_notas_digitales';

export class ErrorDeUso extends Error {}

const remitente = () => `"Dirección de Datos Públicos y Comunicación" <${process.env.SMTP_USER}>`;

export const configuracionCompleta = (config) => {
  const faltan = [];
  for (const gestion of GESTIONES) {
    if (listaDeCorreos(config[`para_${gestion}`]).length === 0) faltan.push(`Para (gestión ${gestion})`);
  }
  if (!String(config.firma_nombre ?? '').trim()) faltan.push('nombre de la firma');
  if (!String(config.firma_cargo ?? '').trim()) faltan.push('cargo de la firma');
  return faltan;
};

// Agrega a cada dataset lo que la nota muestra: antecedentes (avisos) y contactos (externa)
const prepararContenido = async ({ tipo, gestion, datasets }) => {
  const antecedentes = tipo === 'aviso' ? await antecedentesDe(datasets.map(d => d.id)) : new Map();
  const conDatos = datasets.map(d => ({ informado: null, reiteraciones: 0, ...d, antecedente: antecedentes.get(d.id) ?? null }));
  const areas = gestion === 'externa' ? await areasDe([...new Set(datasets.map(d => d.area_id))]) : [];
  return { datasets: conDatos, areas };
};

const destinatarios = (config, gestion, esPrueba) => (esPrueba
  ? { para: listaDeCorreos(config.casillas_prueba), cc: [], cco: [] }
  : {
    para: listaDeCorreos(config[`para_${gestion}`]),
    cc: listaDeCorreos(config[`cc_${gestion}`]),
    cco: listaDeCorreos(config.cco)
  });

// Asigna el número, renderiza HTML, texto y PDF y deja la nota registrada como pendiente
export const generarNota = async ({ tipo, gestion, fecha, datasets, config, esPrueba = false, usuarioId = null, preparado = null }) => {
  const contenido = preparado ?? await prepararContenido({ tipo, gestion, datasets });
  const { para, cc, cco } = destinatarios(config, gestion, esPrueba);
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const anio = esPrueba ? null : Number(fecha.slice(0, 4));
    let numero = null;
    if (!esPrueba) {
      const [[fila]] = await conexion.query(
        'SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM notas_digitales WHERE anio = ? FOR UPDATE', [anio]
      );
      numero = Number(fila.siguiente);
    }
    const nota = construirNota({ tipo, gestion, numero, anio, esPrueba, fecha, datasets: contenido.datasets, areas: contenido.areas, config });
    const pdf = await renderPdf(nota, { firmaImagen: config.firma_imagen });
    const [resultado] = await conexion.query(
      `INSERT INTO notas_digitales
         (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, cc, cco, html, texto, pdf, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, anio, tipo, gestion, tipo === 'reiteracion' ? periodoDe(fecha) : null, fecha, esPrueba ? 1 : 0,
        nota.asunto, para.join(', '), cc.join(', '), cco.join(', '), renderHtml(nota), renderTexto(nota), pdf, usuarioId]
    );
    if (!esPrueba) {
      for (const d of contenido.datasets) {
        await conexion.query(
          'INSERT INTO notas_digitales_datasets (nota_id, dataset_id, seccion, vencimiento) VALUES (?, ?, ?, ?)',
          [resultado.insertId, d.id, d.vencimiento < fecha ? 'vencido' : 'proximo', d.vencimiento]
        );
      }
    }
    await conexion.commit();
    return resultado.insertId;
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
};

// Envía el contenido guardado de la nota (un reintento manda exactamente lo mismo)
export const enviarNota = async (id) => {
  const [[nota]] = await pool.query(
    'SELECT id, numero, anio, es_prueba, asunto, para, cc, cco, html, texto, pdf, estado FROM notas_digitales WHERE id = ?', [id]
  );
  if (!nota) throw new ErrorDeUso(`No existe la nota ${id}`);
  if (nota.estado === 'enviada') return { success: true, yaEnviada: true };

  const archivo = nota.es_prueba ? 'Nota-Digital-PRUEBA.pdf' : `Nota-Digital-${nota.numero}-${String(nota.anio).slice(-2)}.pdf`;
  const resultado = await sendEmail({
    from: remitente(),
    replyTo: process.env.SMTP_USER,
    to: nota.para,
    cc: nota.cc,
    bcc: nota.cco,
    subject: nota.asunto,
    html: nota.html,
    text: nota.texto,
    attachments: [{ filename: archivo, content: nota.pdf, contentType: 'application/pdf' }]
  });

  if (resultado.success) {
    await pool.query(
      `UPDATE notas_digitales SET estado = 'enviada', intentos = intentos + 1, enviada_at = NOW(),
         message_id = ?, respuesta_smtp = ?, ultimo_error = NULL WHERE id = ?`,
      [resultado.messageId ?? null, String(resultado.response ?? '').slice(0, 500), id]
    );
  } else {
    await pool.query(
      "UPDATE notas_digitales SET estado = 'fallida', intentos = intentos + 1, ultimo_error = ? WHERE id = ?",
      [resultado.error, id]
    );
  }
  return resultado;
};

// Ejecuta fn con el bloqueo de Notas Digitales tomado. El bloqueo vive en la base (vale para todos los
// procesos de Passenger) y pertenece a la conexión que lo pidió, así que se mantiene una conexión
// dedicada hasta liberarlo. Si está ocupado, devuelve { ocupado: true } sin ejecutar fn.
const conBloqueo = async (fn) => {
  const conexion = await pool.getConnection();
  let descartar = false;
  try {
    const [[{ bloqueo }]] = await conexion.query('SELECT GET_LOCK(?, 0) AS bloqueo', [BLOQUEO]);
    // GET_LOCK devuelve 1 si lo tomó, 0 si está ocupado y NULL ante un error
    if (Number(bloqueo) !== 1) return { ocupado: true };
    try {
      return { ocupado: false, resultado: await fn() };
    } finally {
      try {
        await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO]);
      } catch (error) {
        // No tapa el resultado ni el error de fn. Sin RELEASE_LOCK la conexión se cierra:
        // al terminar la sesión la base libera el bloqueo igual.
        console.error('⚠️ No se pudo liberar el bloqueo de Notas Digitales:', error.message);
        descartar = true;
      }
    }
  } finally {
    if (descartar) conexion.destroy();
    else conexion.release();
  }
};

// Reintento manual de una nota: comparte el bloqueo con la corrida diaria para no enviar dos veces la misma nota
export const reintentarNota = async (id) => {
  const corrida = await conBloqueo(() => enviarNota(id));
  if (corrida.ocupado) {
    return { success: false, enCurso: true, error: 'Hay una corrida de Notas Digitales en curso; reintentá en unos minutos' };
  }
  return corrida.resultado;
};

export const ejecutarNotasDigitales = async ({ hoy = hoyArgentina(), usuarioId = null } = {}) => {
  const resumen = { fecha: hoy, ejecutado: false, motivo: null, generadas: [], enviadas: 0, fallidas: 0 };
  const corrida = await conBloqueo(async () => {
    const config = await obtenerConfig();
    if (!config.envio_activo) return { ...resumen, motivo: 'Envío automático desactivado' };
    const faltan = configuracionCompleta(config);
    if (faltan.length) return { ...resumen, motivo: `Configuración incompleta: ${faltan.join(', ')}` };
    if (!esDiaHabil(hoy)) return { ...resumen, motivo: 'Día no hábil' };

    resumen.ejecutado = true;
    const contar = (resultado) => {
      if (resultado.success) resumen.enviadas++;
      else resumen.fallidas++;
    };

    // 1. Reintentos de notas pendientes o fallidas
    const [pendientes] = await pool.query(
      "SELECT id FROM notas_digitales WHERE estado IN ('pendiente', 'fallida') AND es_prueba = 0 AND intentos < ? ORDER BY id",
      [MAX_INTENTOS]
    );
    for (const { id } of pendientes) contar(await enviarNota(id));

    // 2. Avisos
    for (const gestion of GESTIONES) {
      const datasets = await seleccionarParaAviso(gestion, hoy);
      if (!datasets.length) continue;
      const id = await generarNota({ tipo: 'aviso', gestion, fecha: hoy, datasets, config, usuarioId });
      resumen.generadas.push({ id, tipo: 'aviso', gestion, datasets: datasets.length });
      contar(await enviarNota(id));
    }

    // 3. Reiteraciones: una evaluación por mes y gestión
    const periodo = periodoDe(hoy);
    for (const gestion of GESTIONES) {
      if (config[`reiteracion_evaluada_${gestion}`] === periodo) continue;
      const [[existente]] = await pool.query(
        "SELECT COUNT(*) AS cantidad FROM notas_digitales WHERE tipo = 'reiteracion' AND gestion = ? AND periodo = ? AND es_prueba = 0",
        [gestion, periodo]
      );
      if (Number(existente.cantidad) === 0) {
        const datasets = await seleccionarParaReiteracion(gestion, hoy);
        if (datasets.length) {
          const id = await generarNota({ tipo: 'reiteracion', gestion, fecha: hoy, datasets, config, usuarioId });
          resumen.generadas.push({ id, tipo: 'reiteracion', gestion, datasets: datasets.length });
          contar(await enviarNota(id));
        }
      }
      // El nombre de columna sale de GESTIONES, una lista fija del código
      await pool.query(`UPDATE notas_digitales_config SET reiteracion_evaluada_${gestion} = ? WHERE id = 1`, [periodo]);
    }
    return resumen;
  });
  return corrida.ocupado ? { ...resumen, motivo: 'Otra corrida en curso' } : corrida.resultado;
};

// Datos de ejemplo para la vista previa y las pruebas cuando hoy no hay datasets para esa nota
const ejemplo = (tipo, hoy) => {
  const informado = tipo === 'reiteracion' ? { numero: 1, anio: Number(hoy.slice(0, 4)), fecha: sumarDias(hoy, -30) } : null;
  const comun = {
    url_dataset: 'https://datos.comodoro.gov.ar', area_id: 0, area_nombre: 'Área de ejemplo',
    frecuencia_nombre: 'Anualmente', informado
  };
  return {
    datasets: [
      { ...comun, id: 0, titulo: 'Dataset de ejemplo próximo a vencer', ultima_actualizacion: sumarDias(hoy, -335), vencimiento: sumarDias(hoy, 30), reiteraciones: 0, antecedente: null },
      {
        ...comun, id: -1, titulo: 'Dataset de ejemplo vencido', ultima_actualizacion: sumarDias(hoy, -380), vencimiento: sumarDias(hoy, -15),
        reiteraciones: tipo === 'reiteracion' ? 1 : 0,
        antecedente: tipo === 'aviso' ? { cantidad: 3, primera: sumarDias(hoy, -90), ultima: sumarDias(hoy, -30) } : null
      }
    ],
    areas: [{
      id: 0, nombre: 'Área de ejemplo', area_superior: 'Secretaría de ejemplo', email_principal: 'area@ejemplo.gov.ar',
      email_secundario: null, telefono_area: '297 400-0000', celular_area: null, nombre_contacto: 'Persona de contacto',
      telefono_contacto: null, email_contacto: null
    }]
  };
};

const contenidoParaMostrar = async (tipo, gestion, hoy) => {
  const reales = tipo === 'aviso' ? await seleccionarParaAviso(gestion, hoy) : await seleccionarParaReiteracion(gestion, hoy);
  if (reales.length) return { ...(await prepararContenido({ tipo, gestion, datasets: reales })), ejemplo: false };
  return { ...ejemplo(tipo, hoy), ejemplo: true };
};

export const previewNota = async ({ tipo, gestion, hoy = hoyArgentina() }) => {
  const config = await obtenerConfig();
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const nota = construirNota({ tipo, gestion, numero: null, anio: null, esPrueba: false, fecha: hoy, datasets, areas, config });
  return { html: renderHtml(nota), asunto: nota.asunto, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : datasets.length };
};

export const enviarPrueba = async ({ tipo, gestion, hoy = hoyArgentina(), usuarioId = null }) => {
  const config = await obtenerConfig();
  const casillas = listaDeCorreos(config.casillas_prueba);
  if (casillas.length === 0) throw new ErrorDeUso('No hay casillas de prueba configuradas');
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const id = await generarNota({
    tipo, gestion, fecha: hoy, datasets, config, esPrueba: true, usuarioId, preparado: { datasets, areas }
  });
  const resultado = await enviarNota(id);
  return { id, ejemplo: esEjemplo, destinatarios: casillas, ...resultado };
};

export const estadoNotas = async ({ hoy = hoyArgentina() } = {}) => {
  const config = await obtenerConfig();
  const [[{ fallidas }]] = await pool.query(
    "SELECT COUNT(*) AS fallidas FROM notas_digitales WHERE estado = 'fallida' AND es_prueba = 0"
  );
  const periodoActual = periodoDe(hoy);
  const proximas = {};
  for (const gestion of GESTIONES) {
    const fechasAviso = (await pendientesDeAviso(gestion))
      .map(vencimiento => {
        const desde = sumarDias(vencimiento, -VENTANA_DIAS[gestion]);
        return proximoDiaHabil(desde > hoy ? desde : hoy);
      })
      .sort();
    const fechaAviso = fechasAviso[0] ?? null;

    const evaluado = config[`reiteracion_evaluada_${gestion}`] === periodoActual;
    const fechaReiteracion = evaluado
      ? primerDiaHabilDelMes(periodoSiguiente(periodoActual))
      : proximoDiaHabil(primerDiaHabilDelMes(periodoActual) > hoy ? primerDiaHabilDelMes(periodoActual) : hoy);

    proximas[gestion] = {
      aviso: fechaAviso ? { fecha: fechaAviso, cantidad: fechasAviso.filter(f => f === fechaAviso).length } : null,
      reiteracion: { fecha: fechaReiteracion, cantidad: (await seleccionarParaReiteracion(gestion, fechaReiteracion)).length }
    };
  }
  return {
    envio_activo: Boolean(config.envio_activo),
    configuracion_faltante: configuracionCompleta(config),
    fallidas: Number(fallidas),
    proximas
  };
};
