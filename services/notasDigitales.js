// Motor de Notas Digitales: genera, numera, envía y reintenta los avisos y reiteraciones.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5, 6.7, 7.4 y 8)
import pool from '../config/database.js';
import { sendEmail, listaDeCorreos } from './emailService.js';
import { construirNota, construirAnexo, renderHtml, renderTexto } from './notasDigitalesContenido.js';
import { renderPdf } from './notasDigitalesPdf.js';
import { renderAnexo } from './notasDigitalesAnexo.js';
import {
  hoyArgentina, ahoraArgentina, esFechaIso, esDiaHabil, proximoDiaHabil, diaHabilAnterior, primerDiaHabilDelMes, periodoDe,
  periodoSiguiente, sumarDias, formatoCorto
} from './notasDigitalesCalendario.js';
import {
  VENTANA_DIAS, obtenerConfig, seleccionarParaAviso, seleccionarParaReiteracion, aperturaDelProximoAviso, antecedentesDe, areasDe,
  fichasDe
} from './notasDigitalesDatos.js';

export const MAX_INTENTOS = 5;
const GESTIONES = ['interna', 'externa'];
const BLOQUEO = 'rpad_notas_digitales';

export class ErrorDeUso extends Error {}

const remitente = () => `"Dir. de Datos Públicos y Comunicación" <${process.env.SMTP_USER}>`;

// firmaTitular: la firma del firmante titular (firmasService.firmaDeUsuario), si hay uno elegido (spec 2026-10-15, 6.2)
export const configuracionCompleta = (config, firmaTitular = null) => {
  const faltan = [];
  for (const gestion of GESTIONES) {
    if (listaDeCorreos(config[`para_${gestion}`]).length === 0) faltan.push(`Para (gestión ${gestion})`);
  }
  const firma = config.firmante_usuario_id ? firmaTitular : { nombre: config.firma_nombre, cargo: config.firma_cargo };
  if (!String(firma?.nombre ?? '').trim()) faltan.push('nombre de la firma');
  if (!String(firma?.cargo ?? '').trim()) faltan.push('cargo de la firma');
  return faltan;
};

// Ficha del anexo de cada dataset del aviso, en el orden de la tabla de la nota (spec 6.7). Las fechas son las de la
// nota (las de la selección): el anexo coincide con la tabla aunque el dataset cambie mientras se genera, y nunca
// pasa al anexo una ficha sin vencimiento.
const fichasDelAviso = async (datasets) => {
  const fichasPorId = await fichasDe(datasets.map(d => d.id));
  return datasets
    .filter(d => fichasPorId.has(d.id))
    .map(d => ({ ...fichasPorId.get(d.id), ultima_actualizacion: d.ultima_actualizacion ?? null, vencimiento: d.vencimiento ?? null }))
    .filter(f => f.vencimiento);
};

// Agrega a cada dataset lo que la nota muestra: antecedentes y contactos (externa); en los avisos, las fichas del anexo
const prepararContenido = async ({ tipo, gestion, datasets }) => {
  // Antecedente de los emails anteriores, de todos los datasets: en los avisos va en una fila a todo el ancho y en
  // las reiteraciones, en la celda "Informado en" (spec 6.4)
  const antecedentes = await antecedentesDe(datasets.map(d => d.id));
  const conDatos = datasets.map(d => ({ informado: null, reiteraciones: 0, ...d, antecedente: antecedentes.get(d.id) ?? null }));
  const areas = gestion === 'externa' ? await areasDe([...new Set(datasets.map(d => d.area_id))]) : [];
  const fichas = tipo === 'aviso' ? await fichasDelAviso(datasets) : [];
  return { datasets: conDatos, areas, fichas };
};

// El anexo tiene una hoja por dataset, como anuncia la nota: si a algún dataset le falta la ficha (o su vencimiento),
// el aviso no se genera en lugar de salir con un anexo incompleto
const validarFichas = ({ datasets, fichas = [] }) => {
  if (fichas.length !== datasets.length || fichas.some(f => !f.vencimiento)) {
    throw new Error(`El anexo del aviso necesita una ficha con vencimiento por cada dataset (${fichas.length} de ${datasets.length})`);
  }
  return fichas;
};

const destinatarios = (config, gestion, esPrueba) => (esPrueba
  ? { para: listaDeCorreos(config.casillas_prueba), cc: [], cco: [] }
  : {
    para: listaDeCorreos(config[`para_${gestion}`]),
    cc: listaDeCorreos(config[`cc_${gestion}`]),
    cco: listaDeCorreos(config.cco)
  });

// Imágenes y pie del membrete con que se arma el PDF (se congelan en la nota al generarla)
const opcionesPdf = (config) => ({
  firmaImagen: config.firma_imagen, membreteImagen: config.membrete_imagen, membretePie: config.membrete_pie
});

// Asigna el número, renderiza HTML, texto, PDF y (en los avisos) el anexo y deja la nota registrada como pendiente
export const generarNota = async ({ tipo, gestion, fecha, datasets, config, esPrueba = false, usuarioId = null, preparado = null }) => {
  const contenido = preparado ?? await prepararContenido({ tipo, gestion, datasets });
  const fichas = tipo === 'aviso' ? validarFichas(contenido) : null;
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
    const pdf = await renderPdf(nota, opcionesPdf(config));
    // El anexo se renderiza antes del INSERT: si falla, no queda una nota numerada sin su anexo
    const anexoPdf = fichas ? await renderAnexo(construirAnexo({ numero, anio, esPrueba, fecha, fichas })) : null;
    const [resultado] = await conexion.query(
      `INSERT INTO notas_digitales
         (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, cc, cco, html, texto, pdf, anexo_pdf, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, anio, tipo, gestion, tipo === 'reiteracion' ? periodoDe(fecha) : null, fecha, esPrueba ? 1 : 0,
        nota.asunto, para.join(', '), cc.join(', '), cco.join(', '), renderHtml(nota), renderTexto(nota), pdf, anexoPdf, usuarioId]
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
    'SELECT id, numero, anio, es_prueba, asunto, para, cc, cco, html, texto, pdf, anexo_pdf, estado FROM notas_digitales WHERE id = ?', [id]
  );
  if (!nota) throw new ErrorDeUso(`No existe la nota ${id}`);
  if (nota.estado === 'enviada') return { success: true, yaEnviada: true };

  // La nota y, en los avisos, su anexo (spec 6.7): los dos PDF guardados al generarla
  const sufijo = nota.es_prueba ? 'PRUEBA' : `${nota.numero}-${String(nota.anio).slice(-2)}`;
  const adjuntos = [{ filename: `Nota-Digital-${sufijo}.pdf`, content: nota.pdf, contentType: 'application/pdf' }];
  if (nota.anexo_pdf) adjuntos.push({ filename: `Anexo-Nota-Digital-${sufijo}.pdf`, content: nota.anexo_pdf, contentType: 'application/pdf' });
  const resultado = await sendEmail({
    from: remitente(),
    replyTo: process.env.SMTP_USER,
    to: nota.para,
    cc: nota.cc,
    bcc: nota.cco,
    subject: nota.asunto,
    html: nota.html,
    text: nota.texto,
    attachments: adjuntos
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

// =====================================================
// Corrida diaria
// =====================================================
const LARGO_RESULTADO = 1000;

// 'aviso interna', 'reintento (nota 12)'...
const pasoDe = ({ tipo, gestion, id }) => `${tipo}${gestion ? ` ${gestion}` : ''}${id ? ` (nota ${id})` : ''}`;
const describirError = (error) => `${pasoDe(error)}: ${error.mensaje}`;

// Un paso que falla queda en el resumen (y en el log del servidor) y la corrida sigue con los demás
const anotarError = (resumen, contexto, error) => {
  // Solo la pila: los errores de mysql2 traen la consulta entera, con el PDF de la nota
  console.error(`❌ Notas Digitales, ${pasoDe(contexto)}:`, error?.stack ?? error);
  resumen.errores.push({ ...contexto, mensaje: String(error?.message ?? error) });
};

// Texto legible para el Estado: el motivo por el que no corrió, o lo enviado y los errores
const textoResultado = (resumen) => {
  const base = resumen.motivo ?? `${resumen.enviadas} enviada(s), ${resumen.fallidas} fallida(s)`;
  const errores = resumen.errores.length
    ? `. ${resumen.errores.length} error(es): ${resumen.errores.map(describirError).join('; ')}`
    : '';
  return `${base}${errores}`.slice(0, LARGO_RESULTADO);
};

// Registro de la última corrida en la configuración. Si el UPDATE falla se informa en el log y la corrida
// sigue: el registro no puede tapar su resultado. updated_at = updated_at: no es un cambio de configuración.
// asignaciones es texto fijo de este módulo; los valores van como parámetros.
const registrarCorrida = async (asignaciones, parametros) => {
  try {
    await pool.query(`UPDATE notas_digitales_config SET ${asignaciones}, updated_at = updated_at WHERE id = 1`, parametros);
  } catch (error) {
    console.error('⚠️ No se pudo registrar la corrida de Notas Digitales:', error.message);
  }
};

const registrarInicio = (hoy) => registrarCorrida(
  `ultima_corrida_fecha = ?, ultima_corrida_inicio = ?, ultima_corrida_fin = NULL, ultima_corrida_resultado = NULL,
   ultima_corrida_con_errores = 0`,
  [esFechaIso(hoy) ? hoy : null, ahoraArgentina()]
);

const registrarFin = (resumen) => registrarCorrida(
  'ultima_corrida_fin = ?, ultima_corrida_resultado = ?, ultima_corrida_con_errores = ?',
  [ahoraArgentina(), textoResultado(resumen), resumen.errores.length ? 1 : 0]
);

// Los pasos de una corrida (spec 8.1). Cada reintento, cada aviso y cada reiteración van aislados.
const correrPasos = async (resumen, hoy, usuarioId) => {
  // Con una fecha en otro formato las consultas no seleccionarían nada, en silencio: se registra como error
  if (!esFechaIso(hoy)) {
    resumen.motivo = 'Fecha de corrida inválida';
    anotarError(resumen, { tipo: 'fecha' }, new Error(`"${hoy}" no es una fecha AAAA-MM-DD`));
    return;
  }
  const config = await obtenerConfig();
  if (!config.envio_activo) {
    resumen.motivo = 'Envío automático desactivado';
    return;
  }
  const faltan = configuracionCompleta(config);
  if (faltan.length) {
    resumen.motivo = `Configuración incompleta: ${faltan.join(', ')}`;
    return;
  }
  if (!esDiaHabil(hoy)) {
    resumen.motivo = 'Día no hábil';
    return;
  }
  resumen.ejecutado = true;

  // Envía una nota ya generada; una excepción (no un envío fallido) queda como error del paso
  const enviar = async (id, contexto) => {
    try {
      const resultado = await enviarNota(id);
      if (resultado.success) resumen.enviadas++;
      else resumen.fallidas++;
    } catch (error) {
      anotarError(resumen, { ...contexto, id }, error);
    }
  };

  // 1. Reintentos de notas pendientes o fallidas
  let pendientes = [];
  try {
    [pendientes] = await pool.query(
      "SELECT id FROM notas_digitales WHERE estado IN ('pendiente', 'fallida') AND es_prueba = 0 AND intentos < ? ORDER BY id",
      [MAX_INTENTOS]
    );
  } catch (error) {
    anotarError(resumen, { tipo: 'reintento' }, error);
  }
  for (const { id } of pendientes) await enviar(id, { tipo: 'reintento' });

  // 2. Avisos: si falla el de una gestión, igual se intenta el de la otra
  for (const gestion of GESTIONES) {
    let id;
    try {
      const datasets = await seleccionarParaAviso(gestion, hoy);
      if (!datasets.length) continue;
      id = await generarNota({ tipo: 'aviso', gestion, fecha: hoy, datasets, config, usuarioId });
      resumen.generadas.push({ id, tipo: 'aviso', gestion, datasets: datasets.length });
    } catch (error) {
      anotarError(resumen, { tipo: 'aviso', gestion }, error);
      continue;
    }
    await enviar(id, { tipo: 'aviso', gestion });
  }

  // 3. Reiteraciones: una evaluación por mes y gestión
  const periodo = periodoDe(hoy);
  for (const gestion of GESTIONES) {
    if (config[`reiteracion_evaluada_${gestion}`] === periodo) continue;
    try {
      const [[existente]] = await pool.query(
        "SELECT COUNT(*) AS cantidad FROM notas_digitales WHERE tipo = 'reiteracion' AND gestion = ? AND periodo = ? AND es_prueba = 0",
        [gestion, periodo]
      );
      if (Number(existente.cantidad) === 0) {
        const datasets = await seleccionarParaReiteracion(gestion, hoy);
        if (datasets.length) {
          // Si la generación lanza una excepción se sale al catch sin marcar el mes: se reintenta en la próxima corrida
          const id = await generarNota({ tipo: 'reiteracion', gestion, fecha: hoy, datasets, config, usuarioId });
          resumen.generadas.push({ id, tipo: 'reiteracion', gestion, datasets: datasets.length });
          await enviar(id, { tipo: 'reiteracion', gestion });
        }
      }
      // Generada (aunque el envío haya fallado) o sin datasets: el mes queda evaluado.
      // El nombre de columna sale de GESTIONES, una lista fija del código
      await pool.query(`UPDATE notas_digitales_config SET reiteracion_evaluada_${gestion} = ? WHERE id = 1`, [periodo]);
    } catch (error) {
      anotarError(resumen, { tipo: 'reiteracion', gestion }, error);
    }
  }
};

export const ejecutarNotasDigitales = async ({ hoy = hoyArgentina(), usuarioId = null } = {}) => {
  const resumen = { fecha: hoy, ejecutado: false, motivo: null, generadas: [], enviadas: 0, fallidas: 0, errores: [] };
  // Con el bloqueo ocupado no se registra nada: la corrida que lo tiene es la que registra
  const corrida = await conBloqueo(async () => {
    await registrarInicio(hoy);
    try {
      await correrPasos(resumen, hoy, usuarioId);
    } catch (error) {
      // Lo que falla fuera de los pasos aislados (por ejemplo, leer la configuración)
      anotarError(resumen, { tipo: 'corrida' }, error);
    }
    await registrarFin(resumen);
    return resumen;
  });
  return corrida.ocupado ? { ...resumen, motivo: 'Otra corrida en curso' } : corrida.resultado;
};

// Datos de ejemplo para la vista previa y las pruebas cuando hoy no hay datasets para esa nota.
// El aviso solo informa datasets a vencer (spec 5.2): su ejemplo no tiene el vencido. El a vencer lleva antecedente de
// emails anteriores: en el aviso sale en su fila a todo el ancho y en la reiteración, en "Informado en".
// Los datasets de ejemplo traen también los campos de la ficha del anexo (spec 6.7), con el área de ejemplo.
const ejemplo = (tipo, gestion, hoy) => {
  const area = {
    id: 0, nombre: 'Área de ejemplo', area_superior: 'Secretaría de ejemplo', email_principal: 'area@ejemplo.gov.ar',
    email_secundario: null, telefono_area: '297 400-0000', celular_area: null, nombre_contacto: 'Persona de contacto',
    telefono_contacto: null, email_contacto: null
  };
  const { id: areaId, nombre: areaNombre, ...contactoDelArea } = area;
  const informado = tipo === 'reiteracion' ? { numero: 1, anio: Number(hoy.slice(0, 4)), fecha: sumarDias(hoy, -30) } : null;
  const comun = {
    url_dataset: 'https://datos.comodoro.gov.ar', area_id: areaId, area_nombre: areaNombre,
    frecuencia_nombre: 'Anualmente', informado,
    descripcion: 'Descripción de ejemplo del conjunto de datos: qué información reúne, de dónde proviene y para qué sirve. En una nota real, acá va la descripción cargada en el registro del dataset.',
    observaciones: null, que_se_solicita: null, tipo_gestion: gestion,
    tema_principal: 'Tema de ejemplo', tema_secundario: null, formatos: 'CSV', ...contactoDelArea
  };
  const proximo = {
    ...comun, id: 0, titulo: 'Dataset de ejemplo próximo a vencer', ultima_actualizacion: sumarDias(hoy, -335), vencimiento: sumarDias(hoy, 30), reiteraciones: 0,
    antecedente: { cantidad: 3, primera: sumarDias(hoy, -90), ultima: sumarDias(hoy, -30) }
  };
  const vencido = {
    ...comun, id: -1, titulo: 'Dataset de ejemplo vencido', ultima_actualizacion: sumarDias(hoy, -380), vencimiento: sumarDias(hoy, -15),
    reiteraciones: 1, antecedente: null
  };
  return {
    datasets: tipo === 'aviso' ? [proximo] : [proximo, vencido],
    areas: [area],
    // El anexo del aviso: la ficha del dataset a vencer (el aviso no lleva vencidos)
    fichas: tipo === 'aviso' ? [proximo] : []
  };
};

const contenidoParaMostrar = async (tipo, gestion, hoy) => {
  const reales = tipo === 'aviso' ? await seleccionarParaAviso(gestion, hoy) : await seleccionarParaReiteracion(gestion, hoy);
  if (reales.length) return { ...(await prepararContenido({ tipo, gestion, datasets: reales })), ejemplo: false };
  return { ...ejemplo(tipo, gestion, hoy), ejemplo: true };
};

// La nota de la vista previa: los datos de hoy (o de ejemplo) con N° XX
const notaDeVistaPrevia = async ({ tipo, gestion, hoy }) => {
  const config = await obtenerConfig();
  const { datasets, areas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const nota = construirNota({ tipo, gestion, numero: null, anio: null, esPrueba: false, fecha: hoy, datasets, areas, config });
  return { nota, config, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : datasets.length };
};

export const previewNota = async ({ tipo, gestion, hoy = hoyArgentina() }) => {
  const { nota, ejemplo: esEjemplo, cantidad } = await notaDeVistaPrevia({ tipo, gestion, hoy });
  return { html: renderHtml(nota), asunto: nota.asunto, ejemplo: esEjemplo, cantidad };
};

// PDF de la vista previa, con el membrete y la firma cargados: no se guarda ni se envía
export const previewPdf = async ({ tipo, gestion, hoy = hoyArgentina() }) => {
  const { nota, config } = await notaDeVistaPrevia({ tipo, gestion, hoy });
  return renderPdf(nota, opcionesPdf(config));
};

// Anexo del aviso de la vista previa (N° XX): no se guarda ni se envía
export const previewAnexo = async ({ gestion, hoy = hoyArgentina() }) => {
  const { fichas } = await contenidoParaMostrar('aviso', gestion, hoy);
  return renderAnexo(construirAnexo({ numero: null, anio: null, fecha: hoy, fichas }));
};

export const enviarPrueba = async ({ tipo, gestion, hoy = hoyArgentina(), usuarioId = null }) => {
  const config = await obtenerConfig();
  const casillas = listaDeCorreos(config.casillas_prueba);
  if (casillas.length === 0) throw new ErrorDeUso('No hay casillas de prueba configuradas');
  const { datasets, areas, fichas, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, hoy);
  const id = await generarNota({
    tipo, gestion, fecha: hoy, datasets, config, esPrueba: true, usuarioId, preparado: { datasets, areas, fichas }
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
    // Primer día hábil desde hoy en que se abre un mes con datasets a vencer sin aviso (los vencidos van a la
    // reiteración); la cantidad es lo que se seleccionaría ese día (todo el mes, más lo que ya esté en la ventana).
    // Se cuenta desde la próxima corrida posible: un sábado, lo que vence ese fin de semana el lunes ya está vencido.
    const corrida = proximoDiaHabil(hoy);
    const apertura = await aperturaDelProximoAviso(gestion, corrida);
    let aviso = null;
    if (apertura) {
      const desde = sumarDias(apertura, -VENTANA_DIAS[gestion]);
      const fecha = proximoDiaHabil(desde > corrida ? desde : corrida);
      aviso = { fecha, cantidad: (await seleccionarParaAviso(gestion, fecha)).length };
    }

    const evaluado = config[`reiteracion_evaluada_${gestion}`] === periodoActual;
    const fechaReiteracion = evaluado
      ? primerDiaHabilDelMes(periodoSiguiente(periodoActual))
      : proximoDiaHabil(primerDiaHabilDelMes(periodoActual) > hoy ? primerDiaHabilDelMes(periodoActual) : hoy);

    proximas[gestion] = {
      aviso,
      reiteracion: { fecha: fechaReiteracion, cantidad: (await seleccionarParaReiteracion(gestion, fechaReiteracion)).length }
    };
  }
  const ultimaCorrida = await leerUltimaCorrida();
  return {
    envio_activo: Boolean(config.envio_activo),
    configuracion_faltante: configuracionCompleta(config),
    fallidas: Number(fallidas),
    proximas,
    ultima_corrida: ultimaCorrida,
    alertas: [
      ...alertasDeCorrida(config, ultimaCorrida, hoy),
      // Advertencias que no bloquean el envío (las imágenes no están en configuracionCompleta)
      ...(config.firma_imagen ? [] : [{
        tipo: 'sin-firma', nivel: 'advertencia', mensaje: 'No hay imagen de la firma: las notas saldrían sin la firma escaneada.'
      }]),
      ...(config.membrete_imagen ? [] : [{
        tipo: 'sin-membrete', nivel: 'advertencia', mensaje: 'No hay imagen del membrete: las notas saldrían sin el encabezado institucional.'
      }])
    ]
  };
};

// Última corrida registrada (null si nunca hubo una). en_curso: empezó, no terminó y el bloqueo sigue tomado.
const leerUltimaCorrida = async () => {
  const [[fila]] = await pool.query(
    `SELECT DATE_FORMAT(ultima_corrida_fecha, '%Y-%m-%d') AS fecha,
            DATE_FORMAT(ultima_corrida_inicio, '%Y-%m-%d %H:%i') AS inicio,
            DATE_FORMAT(ultima_corrida_fin, '%Y-%m-%d %H:%i') AS fin,
            ultima_corrida_resultado AS resultado, ultima_corrida_con_errores AS con_errores,
            IS_FREE_LOCK(?) AS bloqueo_libre
     FROM notas_digitales_config WHERE id = 1`,
    [BLOQUEO]
  );
  if (!fila?.inicio) return null;
  const { bloqueo_libre: libre, ...corrida } = fila;
  return { ...corrida, con_errores: Boolean(Number(corrida.con_errores)), en_curso: !corrida.fin && Number(libre) !== 1 };
};

const fechaHora = (texto) => `${formatoCorto(texto.slice(0, 10))} ${texto.slice(11, 16)}`;

// Alertas de la corrida diaria para la pantalla de Estado (spec: "nunca dejar de enviar en silencio")
const alertasDeCorrida = (config, corrida, hoy) => {
  const alertas = [];
  if (corrida?.con_errores) {
    alertas.push({
      tipo: 'corrida-con-errores', nivel: 'error',
      mensaje: `La última corrida (${formatoCorto(corrida.fecha)}) terminó con errores: ${corrida.resultado}`
    });
  }
  if (corrida && !corrida.fin && !corrida.en_curso) {
    alertas.push({
      tipo: 'corrida-interrumpida', nivel: 'error',
      mensaje: `La corrida que empezó el ${fechaHora(corrida.inicio)} no terminó: el proceso se interrumpió. Revisá el libro y el registro del servidor.`
    });
  }
  if (config.envio_activo) {
    const debioCorrer = diaHabilAnterior(hoy);
    if (!corrida) {
      alertas.push({
        tipo: 'sin-corrida', nivel: 'error',
        mensaje: 'El envío automático está activado pero no hay registro de ninguna corrida diaria: el cron no está llamando a /api/cron/notificaciones.'
      });
    } else if (corrida.fecha && corrida.fecha < debioCorrer) {
      alertas.push({
        tipo: 'sin-corrida', nivel: 'error',
        mensaje: `No hubo corrida diaria desde el ${formatoCorto(corrida.fecha)} (tenía que correr el ${formatoCorto(debioCorrer)}): el cron no está llamando a /api/cron/notificaciones.`
      });
    }
  }
  return alertas;
};
