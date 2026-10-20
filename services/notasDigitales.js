// Motor de Notas Digitales: genera, numera, envía y reintenta los avisos, las reiteraciones y la nota de auditoría de los
// cambios pendientes.
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (secciones 5, 6.7, 7.4 y 8) y
// docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (9 y 10, la nota de auditoría)
import pool from '../config/database.js';
import { sendEmail, listaDeCorreos, remitente } from './emailService.js';
import {
  construirNota, construirNotaDeAutorizacion, construirNotaDeAuditoria, construirAnexo, renderHtml, renderTexto,
  textoLeyendaAutorizacion, textoNumero
} from './notasDigitalesContenido.js';
import { renderPdf } from './notasDigitalesPdf.js';
import { renderAnexo } from './notasDigitalesAnexo.js';
import { seguimientosDeLaNota, renderAnexoDeReiteracion } from './notasDigitalesSeguimiento.js';
import {
  hoyArgentina, ahoraArgentina, esFechaIso, esDiaHabil, proximoDiaHabil, diaHabilAnterior, primerDiaHabilDelMes, periodoDe,
  periodoSiguiente, sumarDias, sumarDiasHabiles, formatoCorto, ultimoDiaHabilHasta, diasEntre
} from './notasDigitalesCalendario.js';
import {
  GESTIONES, VENTANA_DIAS, obtenerConfig, configuracionCompleta, seleccionarParaAviso, seleccionarParaReiteracion,
  aperturaDelProximoAviso, antecedentesDe, areasDe, fichasDe, conPedido, pendientesEnSuFecha, DIAS_PARA_REITERAR
} from './notasDigitalesDatos.js';
import { sumarMeses, tipoSugerido, vencimientoDelMes } from './fechasDatasetReglas.js';
import {
  firmaParaFecha, anticipoPorLicencia, autorizacionPendiente, registrarNotaDeAutorizacion, firmaTitularDe, autorizadoParaLicencia,
  disponibilidadDelAutorizado
} from './notasDigitalesFirmas.js';
import { licenciaEnFecha, proximaLicencia } from './licenciasService.js';
import { unirAusencias, diasHabilesLibres } from './licenciasReglas.js';
import { emailValido } from './usuariosReglas.js';
import {
  contextoDeCanal, seleccionarParaAuditoria, catalogosParaAuditoria, cambiosConCanal, notasDeAuditoriaDe, periodosSinAuditor,
  DIAS_PERIODOS_SIN_AUDITOR
} from './auditoriaService.js';
import { DIAS_HABILES_PARA_REITERAR_AUDITORIA, quienesAuditan } from './auditoriaReglas.js';

export const MAX_INTENTOS = 5;
const BLOQUEO = 'rpad_notas_digitales';

export class ErrorDeUso extends Error {}

// A un dataset adelantado ya le toca la reiteración ese día: su aviso anticipado se envió y pasaron DIAS_PARA_REITERAR días
// corridos desde su cuenta_desde (inclusive), las mismas condiciones que seleccionarParaReiteracion, que solo toma avisos
// enviados. No entra en el aviso en su fecha y lo informa la reiteración, citando la nota anticipada (spec 2026-10-15, 7.6).
// Es permanente mientras el aviso siga enviado: así un dataset nunca sale el mismo día en un aviso y en una reiteración ni
// vuelve como aviso después de reiterado. Si el anticipado no salió (pendiente o fallido), la reiteración no lo tomaría y
// el dataset se quedaría sin nada: entra en el aviso en su fecha aunque los 20 días ya hayan pasado (spec 2026-10-15, 7.6).
// cumplioDiasParaReiterar es la prueba de fechas sola (la misma de seleccionarParaReiteracion): la comparten yaTocaReiterar y
// el aviso en su fecha, que guarda sin cuenta_desde al dataset que pasó la prueba sin haber tenido su anticipado enviado.
const cumplioDiasParaReiterar = (dataset, dia) => dataset.cuenta_desde <= sumarDias(dia, -DIAS_PARA_REITERAR);
const yaTocaReiterar = (dataset, dia) => dataset.aviso_estado === 'enviada' && cumplioDiasParaReiterar(dataset, dia);

// Ficha del anexo de cada dataset del aviso, en el orden de la tabla de la nota (spec 6.7). Las fechas, la frecuencia, el
// tipo de pedido, los meses y el pedido son los de la nota (los de la selección, spec 2026-10-17-fechas-datasets, 9 y 18): el
// anexo coincide con la tabla aunque el dataset cambie mientras se genera (la frecuencia con "(Acumulado)" sale de esos
// tres juntos), y nunca pasa al anexo una ficha sin vencimiento. datasets: los de prepararContenido, que ya traen su pedido.
const fichasDelAviso = async (datasets, fecha) => {
  const fichasPorId = await fichasDe(datasets.map(d => d.id), fecha);
  return datasets
    .filter(d => fichasPorId.has(d.id))
    .map(d => ({
      ...fichasPorId.get(d.id), ultima_actualizacion: d.ultima_actualizacion ?? null, vencimiento: d.vencimiento ?? null,
      frecuencia_nombre: d.frecuencia_nombre, meses: d.meses, datos_al: d.datos_al, tipo_pedido: d.tipo_pedido, pedido: d.pedido
    }))
    .filter(f => f.vencimiento);
};

// Agrega a cada dataset lo que la nota muestra: antecedentes y contactos (externa); en los avisos, las fichas del anexo.
// fecha: el día de la nota. Un dataset que no trae su pedido (uno armado a mano: los de la selección lo traen) lo calcula
// acá, una sola vez, con las fechas de la nota y su día: la tabla de la nota, el anexo y lo que se guarda en
// notas_digitales_datasets salen del mismo cálculo.
const prepararContenido = async ({ tipo, gestion, datasets, fecha }) => {
  // Antecedente de los emails anteriores, de todos los datasets: en los avisos va en una fila a todo el ancho y en
  // las reiteraciones, en la celda "Informado en" (spec 6.4)
  const antecedentes = await antecedentesDe(datasets.map(d => d.id));
  const conDatos = datasets.map(d => ({
    informado: null, reiteraciones: 0, ...(d.pedido === undefined ? conPedido({ tipo_gestion: gestion, ...d }, fecha) : d),
    antecedente: antecedentes.get(d.id) ?? null
  }));
  const areas = gestion === 'externa' ? await areasDe([...new Set(datasets.map(d => d.area_id))]) : [];
  const fichas = tipo === 'aviso' ? await fichasDelAviso(conDatos, fecha) : [];
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

// ccAutorizado: el email de la persona autorizada, en las notas que comunican su autorización (spec 2026-10-15, 7.2).
// Va solo si es un email válido: uno mal cargado no puede hacer fallar el envío de la nota.
// La nota de auditoría va a sus propios destinatarios, con el CCO general (spec 2026-10-15, 10.1).
const destinatarios = (config, gestion, esPrueba, ccAutorizado = null, tipo = null) => {
  if (esPrueba) return { para: listaDeCorreos(config.casillas_prueba), cc: [], cco: [] };
  if (tipo === 'auditoria') {
    return { para: listaDeCorreos(config.para_auditoria), cc: listaDeCorreos(config.cc_auditoria), cco: listaDeCorreos(config.cco) };
  }
  // La nota de autorización no tiene gestión: va a los "Para" de las dos, sin repetir
  const para = gestion
    ? listaDeCorreos(config[`para_${gestion}`])
    : [...new Set(GESTIONES.flatMap(g => listaDeCorreos(config[`para_${g}`])))];
  const cc = gestion ? listaDeCorreos(config[`cc_${gestion}`]) : [];
  if (ccAutorizado && emailValido(ccAutorizado) && !cc.includes(ccAutorizado)) cc.push(ccAutorizado);
  return { para, cc, cco: listaDeCorreos(config.cco) };
};

// Imágenes de las firmas y del membrete con que se arma el PDF (se congelan en la nota al generarla)
const opcionesPdf = (config, firma) => ({
  firmaImagen: firma.titular.imagen, presentanteImagen: firma.presentante?.imagen ?? null,
  membreteImagen: config.membrete_imagen, membretePie: config.membrete_pie
});

// La firma del titular solo (la nota de autorización la firma él, aunque ya esté de licencia)
const soloTitular = (firma) => ({ ...firma, presentante: null, presentanteId: null, leyenda: null });

/**
 * Asigna el número, renderiza HTML, texto, PDF y (en los avisos y las reiteraciones) el anexo y deja la nota registrada como
 * pendiente. El anexo de la reiteración es el Seguimiento de cada dataset (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2):
 * sus fuentes son las de preparado.fuentesPorId (las de ejemplo) o, sin ellas, las de la base.
 * firma: la de firmaParaFecha (sin ella, la que corresponde a la fecha). rangoVencimientos: asunto de un aviso anticipado.
 * autorizacion: { nombre, cargo, contratado, email, desde, hasta } de la persona autorizada: en un aviso suma el párrafo
 * de autorización; con tipo 'autorizacion' es la nota de autorización (sin gestión ni datasets), que firma solo el titular.
 * En los dos casos va en CC.
 * auditoria: { nuevos, reiterados, catalogos } de la nota de auditoría (tipo 'auditoria', sin gestión ni datasets; spec
 * 2026-10-15, 10). Salvo en las pruebas, cada cambio queda en notas_digitales_cambios con su sección: cuenta como incluido
 * desde que la nota se genera (spec 9.3).
 */
export const generarNota = async ({
  tipo, gestion, fecha, datasets, config, esPrueba = false, usuarioId = null, preparado = null,
  firma = null, rangoVencimientos = null, autorizacion = null, auditoria = null
}) => {
  const esAutorizacion = tipo === 'autorizacion';
  const esAuditoria = tipo === 'auditoria';
  const firmaDelDia = firma ?? (await firmaParaFecha(config, fecha)).firma;
  const firmaNota = esAutorizacion ? soloTitular(firmaDelDia) : firmaDelDia;
  const contenido = esAutorizacion || esAuditoria
    ? { datasets: [], areas: [], fichas: [] }
    : preparado ?? await prepararContenido({ tipo, gestion, datasets, fecha });
  const fichas = tipo === 'aviso' ? validarFichas(contenido) : null;
  // El Seguimiento de cada dataset de la reiteración se lee antes de abrir la transacción: la corrida ya tiene conexiones tomadas
  // (el bloqueo) y fuentesDe hace sus consultas en paralelo. Si falla (o le falta un dataset), la reiteración no se genera.
  const seguimientos = tipo === 'reiteracion'
    ? await seguimientosDeLaNota(contenido.datasets, fecha, contenido.fuentesPorId ?? null)
    : null;
  const { para, cc, cco } = destinatarios(config, gestion, esPrueba, autorizacion?.email ?? null, tipo);
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
    let nota;
    if (esAutorizacion) {
      nota = construirNotaDeAutorizacion({ numero, anio, esPrueba, fecha, firma: firmaNota, autorizacion });
    } else if (esAuditoria) {
      nota = construirNotaDeAuditoria({ numero, anio, esPrueba, fecha, ...auditoria, firma: firmaNota, config });
    } else {
      nota = construirNota({
        tipo, gestion, numero, anio, esPrueba, fecha, datasets: contenido.datasets, areas: contenido.areas, config,
        firma: firmaNota, rangoVencimientos, autorizacion
      });
    }
    const pdf = await renderPdf(nota, opcionesPdf(config, firmaNota));
    // El anexo se renderiza antes del INSERT: si falla, no queda una nota numerada sin su anexo. El de la reiteración, ya con el
    // número de la nota en el pie y la hora de la generación
    let anexoPdf = null;
    if (fichas) {
      anexoPdf = await renderAnexo(construirAnexo({ numero, anio, esPrueba, fecha, fichas }));
    } else if (seguimientos) {
      anexoPdf = await renderAnexoDeReiteracion({
        seguimientos, fecha, numeroTexto: textoNumero({ numero, anio, esPrueba }), momento: ahoraArgentina()
      });
    }
    const [resultado] = await conexion.query(
      `INSERT INTO notas_digitales
         (numero, anio, tipo, gestion, periodo, fecha, es_prueba, asunto, para, cc, cco, html, texto, pdf, anexo_pdf, creado_por,
          firmante_id, presentada_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, anio, tipo, gestion ?? null, tipo === 'reiteracion' ? periodoDe(fecha) : null, fecha, esPrueba ? 1 : 0,
        nota.asunto, para.join(', '), cc.join(', '), cco.join(', '), renderHtml(nota), renderTexto(nota), pdf, anexoPdf, usuarioId,
        firmaNota.firmanteId, firmaNota.presentanteId]
    );
    if (!esPrueba) {
      // Con cada dataset queda lo que pidió esta nota, tal como salió (spec 2026-10-17-fechas-datasets, 6 y 9). Sin pedido
      // (eventual), los tres en NULL; sin período (edición, relevamiento), las fechas en NULL y el texto.
      for (const d of contenido.datasets) {
        await conexion.query(
          `INSERT INTO notas_digitales_datasets
             (nota_id, dataset_id, seccion, vencimiento, cuenta_desde, datos_desde, datos_hasta, datos_solicitados)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [resultado.insertId, d.id, d.vencimiento < fecha ? 'vencido' : 'proximo', d.vencimiento, d.cuenta_desde ?? null,
            d.pedido?.desde ?? null, d.pedido?.hasta ?? null, d.pedido?.texto ?? null]
        );
      }
      for (const [seccion, cambios] of [['nuevo', auditoria?.nuevos ?? []], ['reiterado', auditoria?.reiterados ?? []]]) {
        for (const cambio of cambios) {
          await conexion.query(
            'INSERT INTO notas_digitales_cambios (nota_id, cambio_id, seccion) VALUES (?, ?, ?)', [resultado.insertId, cambio.id, seccion]
          );
        }
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

  // La nota y su anexo (spec 6.7; el de la reiteración, spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.2): los dos PDF
  // guardados al generarla, que nunca se regeneran. Las notas sin anexo (autorización, auditoría y las reiteraciones anteriores al
  // anexo de seguimiento) van con la nota sola
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
  const licencia = resumen.licencia ? `. ${resumen.licencia}` : '';
  const errores = resumen.errores.length
    ? `. ${resumen.errores.length} error(es): ${resumen.errores.map(describirError).join('; ')}`
    : '';
  return `${base}${licencia}${errores}`.slice(0, LARGO_RESULTADO);
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

// Datos de la persona autorizada para el párrafo o la nota de autorización (spec 2026-10-15, 7.2); contratado: personal
// contratado, que el texto presenta así
const datosDeAutorizacion = ({ licencia, autorizado }) => ({
  nombre: autorizado.nombre, cargo: autorizado.cargo, contratado: Boolean(autorizado.contratado), email: autorizado.email,
  desde: licencia.desde, hasta: licencia.hasta
});

// Lo que dice el resumen de una corrida en un día de licencia del firmante sin autorizado (spec 2026-10-15, 7.3)
const textoSinAutorizado = (licencia) =>
  `Licencia del firmante del ${formatoCorto(licencia.desde)} al ${formatoCorto(licencia.hasta)} sin autorizado: no se generan notas`;

// Datasets del aviso de hoy. En la víspera de una licencia del firmante (anticipo), la selección mira hasta el último día
// hábil de la licencia y cada dataset que hoy no habría entrado guarda su fecha normal de aviso (cuenta_desde): el primer
// día hábil desde que su mes entra en la ventana (spec 2026-10-15, 7.3)
const prepararAviso = async (gestion, hoy, anticipo) => {
  if (!anticipo) return seleccionarParaAviso(gestion, hoy);
  const normales = new Set((await seleccionarParaAviso(gestion, hoy)).map(d => d.id));
  return (await seleccionarParaAviso(gestion, hoy, anticipo.hasta)).map(d => (normales.has(d.id)
    ? d
    : { ...d, cuenta_desde: proximoDiaHabil(sumarDias(d.apertura_mes, -VENTANA_DIAS[gestion])) }));
};

// El orden de los datasets en un aviso: por vencimiento y por título, como la selección; el id desempata
const porVencimientoYTitulo = (a, b) =>
  a.vencimiento.localeCompare(b.vencimiento) || a.titulo.localeCompare(b.titulo, 'es') || a.id - b.id;

// Lo que decide cómo sale el día, solo lectura, en el orden de la corrida: la firma de la fecha (modo, firma y licencia del
// firmante) y, salvo en un día sin autorizado (en que no se genera ninguna nota), la autorización todavía no comunicada
// (pendiente, y sus datos en autorizacion) y el anticipo de la víspera de una licencia (solo con el titular firmando).
const contextoDelDia = async (config, fecha) => {
  const { modo, firma, licencia } = await firmaParaFecha(config, fecha);
  if (modo === 'sin_autorizado') return { modo, firma, licencia };
  const pendiente = await autorizacionPendiente(config, fecha);
  const autorizacion = pendiente ? datosDeAutorizacion(pendiente) : null;
  const anticipo = modo === 'titular' ? await anticipoPorLicencia(config, fecha) : null;
  return { modo, firma, licencia, pendiente, autorizacion, anticipo };
};

/**
 * El aviso de una gestión en una fecha, solo lectura (sin notas, sin escrituras, sin resumen): lo arma la corrida y también
 * las vistas previas. modo, licencia y anticipo son los de contextoDelDia; autorizacion, los datos de la autorización a
 * comunicar (la corrida pasa null si la licencia cambió mientras se generaba). Devuelve:
 * - datasets: la selección del día (prepararAviso: en la víspera de una licencia del firmante, con lo anticipado y su
 *   cuenta_desde) y, con persona autorizada (modo 'autorizado', licencia del titular), lo adelantado en la víspera que hoy
 *   toca o ya tocó y todavía no salió (spec 2026-10-15, 7.6), ordenado por vencimiento y título. El que entra con los 20 días
 *   ya cumplidos (solo puede ser uno con el aviso anticipado sin enviar, 7.6) se guarda sin cuenta_desde: con la del
 *   anticipado, la reiteración de esta misma corrida lo tomaría también;
 * - rangoVencimientos: { desde, hasta } de los vencimientos, para el asunto de un aviso con datasets anticipados (spec 7.3).
 *   Solo el de la víspera (con anticipo): el aviso en su fecha no lo lleva aunque sus datasets traen cuenta_desde (salvo el
 *   recuperado, con los 20 días cumplidos, que va con null): su asunto lleva el mes de la nota;
 * - autorizacion: la que comunica este aviso (solo la víspera, o sea con anticipo), si no null;
 * - errorEnSuFecha: el error de buscar lo que sale en su fecha, o null. Si falla, datasets es la selección normal del día:
 *   lo adelantado sale en la corrida siguiente.
 */
export const avisoDelDia = async ({ gestion, fecha, modo, licencia = null, anticipo = null, autorizacion = null }) => {
  let datasets = await prepararAviso(gestion, fecha, anticipo);
  let errorEnSuFecha = null;
  if (modo === 'autorizado') {
    try {
      // Las licencias de la persona autorizada durante la del titular
      const ausencias = (await disponibilidadDelAutorizado(licencia))?.ausencias ?? [];
      const enSuFecha = (await pendientesEnSuFecha(gestion, fecha, licencia, ausencias))
        .filter(d => d.dia_en_su_fecha <= fecha && !yaTocaReiterar(d, fecha))
        .map(d => (cumplioDiasParaReiterar(d, fecha) ? { ...d, cuenta_desde: null } : d));
      if (enSuFecha.length) datasets = [...datasets, ...enSuFecha].sort(porVencimientoYTitulo);
    } catch (error) {
      errorEnSuFecha = error;
    }
  }
  const rangoVencimientos = anticipo && datasets.some(d => d.cuenta_desde)
    ? { desde: datasets[0].vencimiento, hasta: datasets.at(-1).vencimiento }
    : null;
  return { datasets, rangoVencimientos, autorizacion: anticipo ? autorizacion : null, errorEnSuFecha };
};

// ¿Ya se generó la nota de auditoría (no de prueba) de esta fecha? Una sola por día (Decisiones del plan 12)
const hayNotaDeAuditoria = async (fecha) => {
  const [[fila]] = await pool.query(
    "SELECT COUNT(*) AS cantidad FROM notas_digitales WHERE tipo = 'auditoria' AND es_prueba = 0 AND fecha = ?", [fecha]
  );
  return Number(fila.cantidad) > 0;
};

// Los pasos de una corrida (spec 8.1): reintentos, avisos, reiteraciones y la nota de auditoría de los cambios pendientes
// (spec 2026-10-15, 9.3). Cada reintento, cada aviso, cada reiteración y la nota de auditoría van aislados.
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
  const faltan = configuracionCompleta(config, await firmaTitularDe(config));
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

  const delDia = await contextoDelDia(config, hoy);
  let { modo, firma, licencia } = delDia;
  // Licencia del firmante sin autorizado: ese día no se genera ninguna nota (spec 2026-10-15, 7.3). Los reintentos de
  // arriba siguen: su contenido ya está congelado.
  if (modo === 'sin_autorizado') {
    resumen.licencia = textoSinAutorizado(licencia);
    return;
  }

  // La autorización todavía no comunicada (spec 7.2) va en los avisos de la víspera, aunque ese día la persona autorizada
  // esté de licencia; si no hay avisos, o se dio más tarde, sale una nota de autorización firmada por el titular
  const { pendiente, autorizacion, anticipo } = delDia;
  let autorizacionComunicada = false;
  let autorizacionDesactualizada = false;
  // Registra en la licencia la nota que comunicó la autorización. Si la licencia cambió mientras se generaba (otra
  // persona, otras fechas o anulada), la nota dice otra cosa: no se registra, se informa y la corrida siguiente trabaja
  // con los datos nuevos. Un error al registrar se informa y no frena el envío de la nota, que ya está generada.
  const registrarAutorizacion = async (id) => {
    try {
      if (await registrarNotaDeAutorizacion(pendiente.licencia, id)) {
        autorizacionComunicada = true;
      } else if (!autorizacionComunicada && !autorizacionDesactualizada) {
        autorizacionDesactualizada = true;
        anotarError(resumen, { tipo: 'autorizacion', id }, new Error(
          'La licencia del firmante cambió mientras se generaba la nota: no queda como nota de autorización y la corrida siguiente usa los datos nuevos'
        ));
      }
    } catch (error) {
      anotarError(resumen, { tipo: 'autorizacion', id }, error);
    }
  };
  const generarAutorizacion = async () => {
    let id;
    try {
      id = await generarNota({ tipo: 'autorizacion', gestion: null, fecha: hoy, datasets: [], config, usuarioId, firma, autorizacion });
      resumen.generadas.push({ id, tipo: 'autorizacion', gestion: null, datasets: 0 });
    } catch (error) {
      anotarError(resumen, { tipo: 'autorizacion' }, error);
      return;
    }
    await registrarAutorizacion(id);
    await enviar(id, { tipo: 'autorizacion' });
  };

  // En la víspera de una licencia del firmante, el aviso suma lo que se habría avisado durante la licencia
  if (anticipo) {
    resumen.licencia = `Víspera de la licencia del firmante: avisos anticipados hasta el ${formatoCorto(anticipo.hasta)} más la ventana${autorizacion ? `, con la autorización a ${autorizacion.nombre}` : ''}`;
  } else if (pendiente) {
    // Autorización tardía o cambiada: primero la nota de autorización; sin ella, ese día no salen las demás (spec 7.2)
    await generarAutorizacion();
    if (!autorizacionComunicada) return;
    ({ modo, firma, licencia } = await firmaParaFecha(config, hoy));
    // Si justo ahora la persona autorizada dejó de cumplir las condiciones, el día es sin autorizado (spec 6.3 y 7.3)
    if (modo === 'sin_autorizado') {
      resumen.licencia = textoSinAutorizado(licencia);
      return;
    }
  }
  if (modo === 'autorizado' && !firma.leyenda) {
    anotarError(resumen, { tipo: 'autorizacion' }, new Error('Falta la nota de autorización de la licencia del firmante'));
    return;
  }

  // 2. Avisos: si falla el de una gestión, igual se intenta el de la otra
  let avisoConAutorizacion = false;
  for (const gestion of GESTIONES) {
    let id;
    let conAutorizacion = null;
    try {
      // En la víspera, el aviso comunica la autorización todavía pendiente (si la licencia no cambió en esta corrida).
      // Con persona autorizada, lo que se adelantó en la víspera sale también en su fecha, presentado por ella; si buscarlo
      // falla, se informa y el aviso del día sale con la selección normal (avisoDelDia).
      const aviso = await avisoDelDia({
        gestion, fecha: hoy, modo, licencia, anticipo, autorizacion: autorizacionDesactualizada ? null : autorizacion
      });
      if (aviso.errorEnSuFecha) anotarError(resumen, { tipo: 'aviso', gestion }, aviso.errorEnSuFecha);
      const { datasets, rangoVencimientos } = aviso;
      conAutorizacion = aviso.autorizacion;
      if (!datasets.length) continue;
      id = await generarNota({ tipo: 'aviso', gestion, fecha: hoy, datasets, config, usuarioId, firma, rangoVencimientos, autorizacion: conAutorizacion });
      resumen.generadas.push({ id, tipo: 'aviso', gestion, datasets: datasets.length });
    } catch (error) {
      anotarError(resumen, { tipo: 'aviso', gestion }, error);
      continue;
    }
    if (conAutorizacion) {
      avisoConAutorizacion = true;
      await registrarAutorizacion(id);
    }
    await enviar(id, { tipo: 'aviso', gestion });
  }

  // Víspera sin avisos que lleven la autorización: sale igual, en su nota (spec 7.2). Si un aviso la llevó pero no quedó
  // registrada en la licencia, la corrida siguiente genera la nota de autorización (autorización tardía).
  if (anticipo && autorizacion && !avisoConAutorizacion) await generarAutorizacion();

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
          const id = await generarNota({ tipo: 'reiteracion', gestion, fecha: hoy, datasets, config, usuarioId, firma });
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

  // 4. Nota de auditoría de los cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.3 y 10): una sola
  // por día (Decisiones del plan 12), con la firma del día. Si hoy no hay quién firme (licencia sin autorizado) o la nota
  // de autorización no se pudo generar, la corrida ya terminó arriba, como para las demás notas. Los cambios que entran
  // son los del canal nota, que ya exige el envío activo, la configuración completa y un Para de auditoría (spec 9.1):
  // sin eso siguen por recordatorio y esta nota no se genera.
  try {
    if (!(await hayNotaDeAuditoria(hoy))) {
      const { nuevos, reiterados } = await seleccionarParaAuditoria(hoy, await contextoDeCanal(hoy, config));
      if (nuevos.length || reiterados.length) {
        const id = await generarNota({
          tipo: 'auditoria', gestion: null, fecha: hoy, datasets: [], config, usuarioId, firma,
          auditoria: { nuevos, reiterados, catalogos: await catalogosParaAuditoria() }
        });
        resumen.generadas.push({ id, tipo: 'auditoria', gestion: null, datasets: 0, cambios: nuevos.length + reiterados.length });
        await enviar(id, { tipo: 'auditoria' });
      }
    }
  } catch (error) {
    anotarError(resumen, { tipo: 'auditoria' }, error);
  }
};

export const ejecutarNotasDigitales = async ({ hoy = hoyArgentina(), usuarioId = null } = {}) => {
  const resumen = { fecha: hoy, ejecutado: false, motivo: null, licencia: null, generadas: [], enviadas: 0, fallidas: 0, errores: [] };
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
// Vencen a fin de mes (R1) y traen Datos al, el tipo de pedido sugerido para su gestión y el pedido del día, como los
// reales (spec 2026-10-17-fechas-datasets, 9): el a vencer, el fin del mes en que caen los 30 días o, si así queda fuera
// de la ventana del aviso de su gestión (los 40 días de la externa), el fin del mes anterior a ese; el vencido, el fin del
// mes pasado. Sus datos llegan al corte del ciclo anterior, como los de un dataset que se actualizó a tiempo.
// En la externa, el a vencer requiere nota DGMIT y el vencido no (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.5: así la
// reiteración de ejemplo muestra los dos valores); en la interna, sin el dato, como los reales.
export const ejemplo = (tipo, gestion, hoy) => {
  const area = {
    id: 0, nombre: 'Área de ejemplo', area_superior: 'Secretaría de ejemplo', email_principal: 'area@ejemplo.gov.ar',
    email_secundario: null, telefono_area: '297 400-0000', celular_area: null, nombre_contacto: 'Persona de contacto',
    telefono_contacto: null, email_contacto: null
  };
  const { id: areaId, nombre: areaNombre, ...contactoDelArea } = area;
  const informado = tipo === 'reiteracion' ? { numero: 1, anio: Number(hoy.slice(0, 4)), fecha: sumarDias(hoy, -30) } : null;
  const meses = 12;
  const comun = {
    url_dataset: 'https://datos.comodoro.gov.ar', area_id: areaId, area_nombre: areaNombre,
    frecuencia_nombre: 'Anualmente', meses, tipo_pedido: tipoSugerido(gestion, meses), informado,
    descripcion: 'Descripción de ejemplo del conjunto de datos: qué información reúne, de dónde proviene y para qué sirve. En una nota real, acá va la descripción cargada en el registro del dataset.',
    observaciones: null, que_se_solicita: null, tipo_gestion: gestion,
    tema_principal: 'Tema de ejemplo', tema_secundario: null, formatos: 'CSV', ...contactoDelArea
  };
  const fechas = (vencimiento) => ({ vencimiento, datos_al: sumarMeses(vencimiento, -1 - meses) });
  // (el fin del mes anterior está a más de 9 días: nunca pasa de hoy; y a lo sumo a 32, adentro de las dos ventanas)
  let aVencer = vencimientoDelMes(sumarDias(hoy, 30));
  while (diasEntre(hoy, aVencer) > VENTANA_DIAS[gestion]) aVencer = sumarMeses(aVencer, -1);
  const requiereNota = (valor) => (gestion === 'externa' ? valor : null);
  const proximo = conPedido({
    ...comun, id: 0, titulo: 'Dataset de ejemplo próximo a vencer', ultima_actualizacion: sumarDias(hoy, -335),
    ...fechas(aVencer), requiere_nota: requiereNota(1), reiteraciones: 0,
    antecedente: { cantidad: 3, primera: sumarDias(hoy, -90), ultima: sumarDias(hoy, -30) }
  }, hoy);
  const vencido = conPedido({
    ...comun, id: -1, titulo: 'Dataset de ejemplo vencido', ultima_actualizacion: sumarDias(hoy, -380), ...fechas(sumarMeses(hoy, -1)),
    requiere_nota: requiereNota(0), reiteraciones: 1, antecedente: null
  }, hoy);
  return {
    datasets: tipo === 'aviso' ? [proximo] : [proximo, vencido],
    areas: [area],
    // El anexo del aviso: la ficha del dataset a vencer (el aviso no lleva vencidos)
    fichas: tipo === 'aviso' ? [proximo] : []
  };
};

// Ejemplo de la nota de auditoría para la vista previa y la prueba cuando hoy no hay cambios para pedir (spec 10.4):
// una actualización y un alta nuevas, y una baja ya solicitada. La actualización es un registro de actualización de un
// anual (spec 2026-10-17-fechas-datasets, 9): venció a fin del mes pasado, llegaron los datos al corte y la próxima es
// dentro de un año, a fin de mes
const ejemploAuditoria = (hoy) => {
  const comun = { usuario_nombre: 'Persona de ejemplo', usuario_cargo: 'Cargo de ejemplo', fecha_propuesta: diaHabilAnterior(diaHabilAnterior(hoy)) };
  const vencio = sumarMeses(hoy, -1);
  return {
    nuevos: [
      {
        ...comun, id: 0, tipo_cambio: 'editar', dataset_titulo: 'Dataset de ejemplo',
        datos_anteriores: { ultima_actualizacion: sumarDias(hoy, -380), datos_al: sumarMeses(vencio, -13), proxima_actualizacion: vencio },
        datos_nuevos: {
          ultima_actualizacion: comun.fecha_propuesta, datos_al: sumarMeses(vencio, -1), recibido_el: diaHabilAnterior(comun.fecha_propuesta),
          proxima_actualizacion: sumarMeses(vencio, 12), notas: null, registro_actualizacion: true
        }
      },
      {
        ...comun, id: -1, tipo_cambio: 'crear', dataset_titulo: null, datos_anteriores: null,
        datos_nuevos: {
          titulo: 'Dataset nuevo de ejemplo', descripcion: 'Descripción de ejemplo del conjunto de datos propuesto.',
          tipo_gestion: 'interna', url_dataset: 'https://datos.comodoro.gov.ar/dataset/nuevo'
        }
      }
    ],
    reiterados: [{
      ...comun, id: -2, tipo_cambio: 'eliminar', dataset_titulo: 'Dataset de ejemplo a dar de baja', fecha_propuesta: sumarDias(hoy, -14),
      datos_nuevos: { eliminado: true }, datos_anteriores: { titulo: 'Dataset de ejemplo a dar de baja', tipo_gestion: 'externa' },
      solicitado: { numero: 1, anio: Number(hoy.slice(0, 4)), fecha: diaHabilAnterior(sumarDias(hoy, -6)), reiteraciones: 0 }
    }],
    catalogos: { areas: {}, frecuencias: {}, temas: {}, formatos: {} }
  };
};

// Lo que llevaría la nota de auditoría ese día (spec 9.3) o, si no lleva nada, el ejemplo
const contenidoDeAuditoriaParaMostrar = async (config, fecha) => {
  const { nuevos, reiterados } = await seleccionarParaAuditoria(fecha, await contextoDeCanal(fecha, config));
  if (nuevos.length || reiterados.length) return { nuevos, reiterados, catalogos: await catalogosParaAuditoria(), ejemplo: false };
  return { ...ejemploAuditoria(fecha), ejemplo: true };
};

// Días hacia adelante en que se busca la próxima corrida que genera notas (spec 2026-10-15, 7.7)
const DIAS_PARA_BUSCAR_VISTA_PREVIA = 366;
const MOTIVO_DIA_NO_HABIL = 'día no hábil';
const MOTIVO_SIN_AUTORIZADO = 'licencia del firmante sin persona autorizada';
const MOTIVO_AUTORIZADO_DE_LICENCIA = 'la persona autorizada está de licencia';

/**
 * El día que muestran la vista previa y la prueba: el de la próxima corrida que genera notas (spec 2026-10-15, 7.7). Hoy, si
 * es día hábil y ese día se generan notas; si no, el primer día hábil siguiente en que sí. Un día hábil no genera notas si el
 * firmante titular está de licencia sin una persona autorizada que pueda presentarlas (sin ninguna, o con licencia propia
 * ese día): firmaParaFecha da 'sin_autorizado'. Se busca hasta 366 días después de hoy; sin ninguno, hoy.
 * Devuelve { fecha, motivo }. motivo: null si la fecha es hoy; si no, por qué hoy no se generan notas ('día no hábil', 'la
 * persona autorizada está de licencia' o 'licencia del firmante sin persona autorizada').
 * Solo lee. Salta los días no hábiles sin mirarlos y, en una licencia sin autorizado vigente, salta hasta el primer día hábil
 * en que la persona autorizada no falta o, si no le queda ninguno desde mañana (o ya no sirve), hasta el fin de la licencia
 * (primer_dia_disponible de autorizadoParaLicencia desde mañana): es lo mismo que probar día por día, sin recorrer la licencia.
 */
export const fechaDeVistaPrevia = async (config, hoy) => {
  const limite = sumarDias(hoy, DIAS_PARA_BUSCAR_VISTA_PREVIA);
  let motivo = null;
  let dia = hoy;
  while (dia <= limite) {
    if (!esDiaHabil(dia)) {
      if (dia === hoy) motivo = MOTIVO_DIA_NO_HABIL;
      dia = proximoDiaHabil(dia);
      continue;
    }
    const { modo, licencia } = await firmaParaFecha(config, dia);
    if (modo !== 'sin_autorizado') return { fecha: dia, motivo };
    if (dia === hoy) {
      motivo = licencia.autorizado_id && await licenciaEnFecha(licencia.autorizado_id, hoy)
        ? MOTIVO_AUTORIZADO_DE_LICENCIA
        : MOTIVO_SIN_AUTORIZADO;
    }
    // Hoy ese día es sin autorizado: el próximo candidato es el primer día hábil, desde mañana, en que la persona autorizada no
    // falta; si no le queda ninguno (o ya no sirve), la vuelta del titular. Desde mañana, no desde el comienzo de la licencia:
    // así los días libres que quedaron atrás no obligan a recorrerla día por día
    dia = (await autorizadoParaLicencia(licencia, { desde: sumarDias(dia, 1) }))?.primer_dia_disponible ?? sumarDias(licencia.hasta, 1);
  }
  return { fecha: hoy, motivo: null };
};

// La firma de la vista previa. Si la autorización de la persona autorizada todavía no se comunicó (autorización tardía o
// cambiada, spec 2026-10-15, 7.2), la corrida genera primero la nota de autorización y la leyenda la cita: acá esa nota no
// existe ni se genera, y la leyenda dice "Nota Digital N° XX".
const firmaDeVistaPrevia = ({ modo, firma, licencia, pendiente }) => {
  if (modo !== 'autorizado' || firma.leyenda || !pendiente) return firma;
  return {
    ...firma,
    leyenda: textoLeyendaAutorizacion({ presentante: firma.presentante, titular: firma.titular, nota: { numero: null, anio: null }, licencia })
  };
};

// El día de la vista previa o la prueba con lo que decide cómo sale ese día (el mismo contextoDelDia de la corrida) y su firma.
// Una sola vez por pedido: el HTML, el PDF, el anexo y la prueba se arman con lo mismo.
const diaDeVistaPrevia = async (config, hoy) => {
  const { fecha, motivo } = await fechaDeVistaPrevia(config, hoy);
  const contexto = await contextoDelDia(config, fecha);
  return { fecha, motivo, contexto, firma: firmaDeVistaPrevia(contexto) };
};

// Los datasets de la vista previa o la prueba de ese día, o el ejemplo si no hay. El aviso sale de avisoDelDia con el contexto
// del día, igual que en la corrida (víspera de una licencia, aviso en su fecha); si buscar lo que sale en su fecha falla,
// falla también la vista previa: no muestra una nota distinta a la que saldría. La reiteración sigue su selección de siempre.
// Devuelve { datasets, areas, fichas, rangoVencimientos, autorizacion, ejemplo }.
const contenidoParaMostrar = async (tipo, gestion, fecha, contexto) => {
  let reales;
  let aviso = { rangoVencimientos: null, autorizacion: null };
  if (tipo === 'aviso') {
    const { modo, licencia, anticipo, autorizacion } = contexto;
    aviso = await avisoDelDia({ gestion, fecha, modo, licencia, anticipo, autorizacion });
    if (aviso.errorEnSuFecha) throw aviso.errorEnSuFecha;
    reales = aviso.datasets;
  } else {
    reales = await seleccionarParaReiteracion(gestion, fecha);
  }
  if (reales.length) {
    const { rangoVencimientos, autorizacion } = aviso;
    return { ...(await prepararContenido({ tipo, gestion, datasets: reales, fecha })), rangoVencimientos, autorizacion, ejemplo: false };
  }
  return { ...ejemplo(tipo, gestion, fecha), rangoVencimientos: null, autorizacion: null, ejemplo: true };
};

// La nota de la vista previa: los datos de la fecha de la próxima corrida con notas (o de ejemplo) con N° XX, firmada como
// saldría (spec 2026-10-15, 7.7). La de auditoría no tiene gestión (spec 2026-10-15, 10.4).
const notaDeVistaPrevia = async ({ tipo, gestion, hoy }) => {
  const config = await obtenerConfig();
  const { fecha, motivo, contexto, firma } = await diaDeVistaPrevia(config, hoy);
  if (tipo === 'auditoria') {
    const { ejemplo: esEjemplo, ...auditoria } = await contenidoDeAuditoriaParaMostrar(config, fecha);
    const nota = construirNotaDeAuditoria({ numero: null, anio: null, esPrueba: false, fecha, ...auditoria, firma, config });
    return { nota, config, firma, fecha, motivo, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : auditoria.nuevos.length + auditoria.reiterados.length };
  }
  const { datasets, areas, rangoVencimientos, autorizacion, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, fecha, contexto);
  const nota = construirNota({
    tipo, gestion, numero: null, anio: null, esPrueba: false, fecha, datasets, areas, config, firma, rangoVencimientos, autorizacion
  });
  return { nota, config, firma, fecha, motivo, ejemplo: esEjemplo, cantidad: esEjemplo ? 0 : datasets.length };
};

export const previewNota = async ({ tipo, gestion, hoy = hoyArgentina() }) => {
  const { nota, ejemplo: esEjemplo, cantidad, fecha, motivo } = await notaDeVistaPrevia({ tipo, gestion, hoy });
  return { html: renderHtml(nota), asunto: nota.asunto, ejemplo: esEjemplo, cantidad, fecha, motivo };
};

// PDF de la vista previa, con el membrete y la firma cargados: no se guarda ni se envía
export const previewPdf = async ({ tipo, gestion, hoy = hoyArgentina() }) => {
  const { nota, config, firma } = await notaDeVistaPrevia({ tipo, gestion, hoy });
  return renderPdf(nota, opcionesPdf(config, firma));
};

// Anexo del aviso de la vista previa (N° XX), del mismo día y la misma selección que la nota: no se guarda ni se envía
export const previewAnexo = async ({ gestion, hoy = hoyArgentina() }) => {
  const { fecha, contexto } = await diaDeVistaPrevia(await obtenerConfig(), hoy);
  const { fichas } = await contenidoParaMostrar('aviso', gestion, fecha, contexto);
  return renderAnexo(construirAnexo({ numero: null, anio: null, fecha, fichas }));
};

// "Prueba enviada a …", con lo que aclara en un solo paréntesis: que son datos de ejemplo y/o que es la nota de otro día
// (spec 2026-10-15, 7.7)
export const mensajeDePrueba = ({ destinatarios, ejemplo, motivo, fecha }) => {
  const aclaraciones = [ejemplo && 'con datos de ejemplo', motivo && `como saldría el ${formatoCorto(fecha)}`].filter(Boolean);
  return `Prueba enviada a ${destinatarios.join(', ')}${aclaraciones.length > 0 ? ` (${aclaraciones.join(', ')})` : ''}`;
};

// La prueba se genera como una nota de prueba (sin número, sin registrar datasets ni cambios incluidos ni la autorización) y va
// solo a las casillas de prueba. Muestra el mismo día y el mismo contenido que la vista previa: fecha y motivo dicen cuál.
export const enviarPrueba = async ({ tipo, gestion, hoy = hoyArgentina(), usuarioId = null }) => {
  const config = await obtenerConfig();
  const casillas = listaDeCorreos(config.casillas_prueba);
  if (casillas.length === 0) throw new ErrorDeUso('No hay casillas de prueba configuradas');
  const { fecha, motivo, contexto, firma } = await diaDeVistaPrevia(config, hoy);
  // La prueba de la nota de auditoría: los cambios de ese día o el ejemplo, sin registrar cambios incluidos (spec 2026-10-15, 11.2)
  if (tipo === 'auditoria') {
    const { ejemplo: esEjemplo, ...auditoria } = await contenidoDeAuditoriaParaMostrar(config, fecha);
    const id = await generarNota({ tipo, gestion: null, fecha, datasets: [], config, esPrueba: true, usuarioId, firma, auditoria });
    return { id, ejemplo: esEjemplo, fecha, motivo, destinatarios: casillas, ...(await enviarNota(id)) };
  }
  const { datasets, areas, fichas, rangoVencimientos, autorizacion, ejemplo: esEjemplo } = await contenidoParaMostrar(tipo, gestion, fecha, contexto);
  const id = await generarNota({
    tipo, gestion, fecha, datasets, config, esPrueba: true, usuarioId, preparado: { datasets, areas, fichas }, firma, rangoVencimientos, autorizacion
  });
  const resultado = await enviarNota(id);
  return { id, ejemplo: esEjemplo, fecha, motivo, destinatarios: casillas, ...resultado };
};

// Licencia del firmante titular en curso o la próxima, con lo que hace falta para mostrar su efecto (spec 2026-10-15, 7.5).
// { publica, titular, ausencias } o null. publica: el objeto de estado.licencia_firmante (su forma no cambia); titular: la
// licencia tal como la guarda la base (para el aviso en su fecha, 7.6); ausencias: las licencias de la persona autorizada
// durante la del titular ([{ desde, hasta }], vacías sin autorizado).
const licenciaDelFirmante = async (config, hoy) => {
  if (!config.firmante_usuario_id) return null;
  const licencia = (await licenciaEnFecha(config.firmante_usuario_id, hoy)) ?? (await proximaLicencia(config.firmante_usuario_id, hoy));
  if (!licencia) return null;
  // La persona autorizada sirve si le queda algún día hábil de toda la licencia sin licencia propia: puede faltar algunos
  // días a la vez que el titular, también hasta el final. Si el día que se mira (el primer día hábil desde el inicio de la
  // licencia, o desde hoy si ya empezó; sin ninguno hasta el fin, ese mismo día) está de licencia, hasta cuándo, con sus
  // licencias seguidas unidas: esos días no se generan notas
  const desdeHoy = licencia.desde > hoy ? licencia.desde : hoy;
  const habil = proximoDiaHabil(desdeHoy);
  const evaluado = habil <= licencia.hasta ? habil : desdeHoy;
  const autorizado = await autorizadoParaLicencia(licencia);
  const ausente = autorizado?.primer_dia_disponible
    ? unirAusencias(autorizado.ausencias).find(a => a.desde <= evaluado && evaluado <= a.hasta)
    : null;
  const [[nota]] = licencia.nota_autorizacion_id
    ? await pool.query('SELECT numero, anio FROM notas_digitales WHERE id = ?', [licencia.nota_autorizacion_id])
    : [[null]];
  const ultimoHabil = ultimoDiaHabilHasta(licencia.hasta);
  return {
    publica: {
      desde: licencia.desde,
      hasta: licencia.hasta,
      en_curso: licencia.desde <= hoy,
      autorizado: autorizado ? autorizado.nombre : null,
      nota_autorizacion: nota ? { numero: nota.numero, anio: nota.anio } : null,
      autorizado_no_vigente: Boolean(licencia.autorizado_id) && !autorizado,
      autorizado_de_licencia_hasta: ausente?.hasta ?? null,
      sin_dias_habiles: ultimoHabil < licencia.desde,
      vispera: diaHabilAnterior(licencia.desde),
      ultimo_habil: ultimoHabil,
      vuelta: proximoDiaHabil(sumarDias(licencia.hasta, 1))
    },
    titular: licencia,
    ausencias: autorizado?.ausencias ?? []
  };
};

/**
 * El próximo aviso en su fecha de la gestión (spec 2026-10-15, 7.6), con persona autorizada: de los datasets que la víspera
 * adelantó, el día en que la persona autorizada los vuelve a presentar. Un día que ya pasó (la corrida no se hizo, o ella
 * faltaba) pasa al primer día hábil, desde la próxima corrida, en que no falta. Un dataset al que ese día ya le toca la
 * reiteración (yaTocaReiterar) no cuenta: lo informa la reiteración, como en la corrida. { fecha, cantidad } o null: la
 * cantidad es lo que sale ese día, sumando a los que vuelven a presentarse lo que seleccionarParaAviso elige para esa fecha.
 * corrida: el día de la próxima corrida posible. { titular, ausencias }: lo que devuelve licenciaDelFirmante (la licencia del
 * titular y las ausencias de la persona autorizada).
 */
const proximoAvisoEnSuFecha = async (gestion, corrida, { titular, ausencias }) => {
  const pendientes = await pendientesEnSuFecha(gestion, corrida, titular, ausencias);
  if (pendientes.length === 0) return null;
  // El primer día hábil desde la próxima corrida en que la persona autorizada no falta: el mismo para todos los atrasados
  const primerDiaLibre = diasHabilesLibres(corrida, titular.hasta, ausencias).primerDia;
  const fechas = pendientes
    .map(dataset => ({ dataset, efectiva: dataset.dia_en_su_fecha >= corrida ? dataset.dia_en_su_fecha : primerDiaLibre }))
    .filter(({ dataset, efectiva }) => efectiva && !yaTocaReiterar(dataset, efectiva))
    .map(({ efectiva }) => efectiva)
    .sort();
  if (fechas.length === 0) return null;
  const [fecha] = fechas;
  return { fecha, cantidad: (await seleccionarParaAviso(gestion, fecha)).length + fechas.filter(f => f === fecha).length };
};

/**
 * Nota de auditoría en el Estado (spec 2026-10-15, 10.4): cuántos cambios están en el canal nota en la próxima corrida
 * posible (hoy si es hábil) y la fecha de la próxima nota: la de esa corrida si alguno todavía no estuvo en una nota (o el
 * día hábil siguiente si la de esa fecha ya salió), y si no, 5 días hábiles después de la última nota de cada uno.
 * Días sin auditor: sin_quien_audite, cuántos cambios pendientes no tienen en esa corrida a nadie que pueda auditarlos
 * (quienesAuditan vacío), y periodos_sin_auditor, los de esa corrida a hoy + 60 días (auditoriaService.periodosSinAuditor).
 * { canal_nota, proxima: 'AAAA-MM-DD' | null, sin_quien_audite, periodos_sin_auditor }
 */
const estadoAuditoria = async (config, hoy) => {
  const corrida = proximoDiaHabil(hoy);
  const contexto = await contextoDeCanal(corrida, config);
  const cambios = await cambiosConCanal(corrida, contexto);
  const sinAuditor = {
    sin_quien_audite: cambios.filter(c => quienesAuditan(contexto.personas, c.usuario_id).personas.length === 0).length,
    periodos_sin_auditor: await periodosSinAuditor(corrida, sumarDias(hoy, DIAS_PERIODOS_SIN_AUDITOR))
  };
  const delCanal = cambios.filter(c => c.canal === 'nota');
  if (delCanal.length === 0) return { canal_nota: 0, proxima: null, ...sinAuditor };
  const previas = await notasDeAuditoriaDe(delCanal.map(c => c.id));
  const primeraLibre = (await hayNotaDeAuditoria(corrida)) ? proximoDiaHabil(sumarDias(corrida, 1)) : corrida;
  const fechas = delCanal.map((cambio) => {
    const ultima = previas.get(cambio.id)?.at(-1)?.fecha;
    const fecha = ultima ? sumarDiasHabiles(ultima, DIAS_HABILES_PARA_REITERAR_AUDITORIA) : primeraLibre;
    return fecha < primeraLibre ? primeraLibre : fecha;
  });
  return { canal_nota: delCanal.length, proxima: fechas.sort()[0], ...sinAuditor };
};

export const estadoNotas = async ({ hoy = hoyArgentina() } = {}) => {
  const config = await obtenerConfig();
  const firmaTitular = await firmaTitularDe(config);
  const delFirmante = await licenciaDelFirmante(config, hoy);
  const licencia = delFirmante?.publica ?? null;
  const dentro = (fecha) => Boolean(licencia) && !licencia.sin_dias_habiles && fecha >= licencia.desde && fecha <= licencia.hasta;
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
    // Un aviso que caería dentro de una licencia del firmante se anticipa a la víspera, si todavía no pasó; si ya pasó,
    // sin autorizado sale a la vuelta (con autorizado, en su fecha)
    if (aviso && dentro(aviso.fecha)) {
      if (licencia.vispera >= corrida) {
        aviso = { fecha: licencia.vispera, cantidad: (await seleccionarParaAviso(gestion, licencia.vispera, licencia.ultimo_habil)).length };
      } else if (!licencia.autorizado) {
        aviso = { fecha: licencia.vuelta, cantidad: (await seleccionarParaAviso(gestion, licencia.vuelta)).length };
      }
    }
    // Con persona autorizada, lo que adelantó la víspera sale otra vez en su fecha, también con la licencia ya en curso
    // (spec 7.6): si es antes que el aviso de arriba, o el mismo día (su cantidad ya suma los dos), ese es el próximo
    if (licencia?.autorizado && !licencia.sin_dias_habiles) {
      const enSuFecha = await proximoAvisoEnSuFecha(gestion, corrida, delFirmante);
      if (enSuFecha && (!aviso || enSuFecha.fecha <= aviso.fecha)) aviso = enSuFecha;
    }

    const evaluado = config[`reiteracion_evaluada_${gestion}`] === periodoActual;
    let fechaReiteracion = evaluado
      ? primerDiaHabilDelMes(periodoSiguiente(periodoActual))
      : proximoDiaHabil(primerDiaHabilDelMes(periodoActual) > hoy ? primerDiaHabilDelMes(periodoActual) : hoy);
    if (!licencia?.autorizado && dentro(fechaReiteracion)) fechaReiteracion = licencia.vuelta;

    proximas[gestion] = {
      aviso,
      reiteracion: { fecha: fechaReiteracion, cantidad: (await seleccionarParaReiteracion(gestion, fechaReiteracion)).length }
    };
  }
  const ultimaCorrida = await leerUltimaCorrida();
  return {
    envio_activo: Boolean(config.envio_activo),
    configuracion_faltante: configuracionCompleta(config, firmaTitular),
    fallidas: Number(fallidas),
    proximas,
    licencia_firmante: licencia,
    auditoria: await estadoAuditoria(config, hoy),
    ultima_corrida: ultimaCorrida,
    alertas: [
      ...alertasDeCorrida(config, ultimaCorrida, hoy),
      // Advertencias que no bloquean el envío (las imágenes no están en configuracionCompleta)
      // La imagen de la firma que usan las notas: la del titular, si hay uno elegido
      ...((config.firmante_usuario_id ? firmaTitular?.imagen : config.firma_imagen) ? [] : [{
        tipo: 'sin-firma', nivel: 'advertencia', mensaje: 'No hay imagen de la firma: las notas saldrían sin la firma escaneada.'
      }]),
      // La persona autorizada puede faltar algunos días a la vez que el titular: una advertencia, no un error
      ...(licencia?.autorizado_de_licencia_hasta ? [{
        tipo: 'autorizado-de-licencia', nivel: 'advertencia',
        mensaje: `La persona autorizada está de licencia hasta el ${formatoCorto(licencia.autorizado_de_licencia_hasta)}: hasta entonces no se generan notas.`
      }] : []),
      ...(licencia?.autorizado_no_vigente ? [{
        tipo: 'autorizado-no-vigente', nivel: 'error',
        mensaje: `La persona autorizada para la licencia del firmante (del ${formatoCorto(licencia.desde)} al ${formatoCorto(licencia.hasta)}) ya no está activa, no tiene su firma cargada o está de licencia todos los días hábiles de esa licencia: esos días no se generan notas.`
      }] : []),
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
