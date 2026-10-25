import PDFDocument from 'pdfkit';
import pool from '../config/database.js';
import { hoyArgentina, ahoraArgentina, formatoCorto } from '../services/notasDigitalesCalendario.js';
import { estadoDelDataset, tasaDeActualizacion } from '../services/fechasDatasetReglas.js';
import { nombreCorto, seguimientoDe, disposicionDeAdjunto } from '../services/seguimientoReglas.js';
import { fuentesDe } from '../services/seguimientoDatos.js';
import { OPCIONES_CINTA_PDF } from '../services/seguimientoPdf.js';
import { renderEstadoGeneral } from '../services/reportesEstadoGeneralPdf.js';
import { renderPorArea } from '../services/reportesPorAreaPdf.js';

// Colores institucionales
const COLORS = {
  primary: '#0066cc',
  primaryDark: '#1a365d',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  gray: '#6b7280',
  grayLight: '#f3f4f6',
  grayDark: '#374151',
  white: '#ffffff'
};

/**
 * Formatea fecha a formato argentino
 */
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Formatea fecha y hora
 */
const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Estado de una fila de los reportes (spec 2026-10-17-fechas-datasets, 11): el mismo cálculo que el listado y el tablero,
 * estadoDelDataset, con la próxima como 'AAAA-MM-DD' (proxima_iso) y la frecuencia en meses (null es eventual).
 * hoy es la fecha de Argentina ('AAAA-MM-DD').
 */
const estadoDeLaFila = (d, hoy) => estadoDelDataset({
  proxima: d.proxima_iso, meses: d.frecuencia_meses ?? null, tipoGestion: d.tipo_gestion, hoy
}).estado;

// Columnas que suman las reglas de las fechas a un SELECT de datasets (alias d) con su frecuencia (alias f):
// los meses de la frecuencia y la próxima y "Datos al" como 'AAAA-MM-DD'
const COLUMNAS_FECHAS = `f.meses AS frecuencia_meses,
             DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS proxima_iso,
             DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al_iso`;

/**
 * Dibuja el header del PDF
 */
const drawHeader = (doc, titulo, subtitulo = null) => {
  // Banda azul superior
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primaryDark);
  
  // Título
  doc.fillColor(COLORS.white)
     .fontSize(20)
     .font('Helvetica-Bold')
     .text('RPAD - ' + titulo, 40, 25);
  
  // Subtítulo
  if (subtitulo) {
    doc.fontSize(10)
       .font('Helvetica')
       .text(subtitulo, 40, 50);
  }
  
  // Fecha de generación
  doc.fontSize(9)
     .text(`Generado: ${formatDateTime(new Date())}`, 40, 50 + (subtitulo ? 15 : 0));
  
  doc.fillColor(COLORS.grayDark);
  doc.y = 100;
};

/**
 * Dibuja el footer del PDF
 */
const drawFooter = (doc, pageNum) => {
  const y = doc.page.height - 40;
  
  // Calcular posición centrada manualmente
  const texto = 'Dirección de Datos Públicos y Comunicación - Municipalidad de Comodoro Rivadavia';
  const textoWidth = doc.widthOfString(texto, { fontSize: 8 });
  const centerX = (doc.page.width - textoWidth) / 2;
  
  doc.fontSize(8)
     .fillColor(COLORS.gray)
     .text(texto, centerX, y, { lineBreak: false });
  
  doc.text(`Página ${pageNum}`, doc.page.width - 80, y, { lineBreak: false });
};

/**
 * Dibuja footers en todas las páginas del documento
 */
const drawAllFooters = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1);
  }
};

/**
 * Dibuja una tarjeta de estadística
 */
const drawStatCard = (doc, x, y, label, value, color, width = 120) => {
  const height = 60;
  
  // Fondo
  doc.rect(x, y, width, height).fill(COLORS.grayLight);
  
  // Barra superior de color
  doc.rect(x, y, width, 4).fill(color);
  
  // Valor
  doc.fillColor(COLORS.grayDark)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text(value.toString(), x + 10, y + 15, { width: width - 20 });
  
  // Label
  doc.fillColor(COLORS.gray)
     .fontSize(9)
     .font('Helvetica')
     .text(label, x + 10, y + 42, { width: width - 20 });
};

/**
 * Dibuja una tabla
 */
const drawTable = (doc, headers, rows, startY, colWidths) => {
  const startX = 40;
  const rowHeight = 20;
  const headerHeight = 25;
  let y = startY;
  
  // Header
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), headerHeight)
     .fill(COLORS.primaryDark);
  
  let x = startX;
  doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold');
  headers.forEach((header, i) => {
    doc.text(header, x + 5, y + 7, { width: colWidths[i] - 10 });
    x += colWidths[i];
  });
  
  y += headerHeight;
  
  // Rows
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row, rowIndex) => {
    // Check page break
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    
    // Alternating background
    if (rowIndex % 2 === 0) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight)
         .fill(COLORS.grayLight);
    }
    
    x = startX;
    doc.fillColor(COLORS.grayDark);
    row.forEach((cell, i) => {
      const cellText = cell?.toString() || '-';
      doc.text(cellText, x + 5, y + 5, { width: colWidths[i] - 10, height: rowHeight - 5, ellipsis: true });
      x += colWidths[i];
    });
    
    y += rowHeight;
  });
  
  return y;
};

// =====================================================
// REPORTE: Estado General de Datasets
// =====================================================
// El PDF lo dibuja services/reportesEstadoGeneralPdf.js con la base de los reportes (el diseño del anexo): acá van la consulta, el
// estado de cada fila y el pie, con el nombre corto de quien lo pide y la hora argentina (un solo instante para el pie y para "hoy").
export const reporteEstadoGeneral = async (req, res) => {
  try {
    // Obtener datos
    const [datasets] = await pool.execute(`
      SELECT d.*, f.nombre AS frecuencia_nombre, f.dias AS frecuencia_dias,
             ${COLUMNAS_FECHAS},
             a.nombre AS area_nombre, t.nombre AS tema_nombre
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      JOIN areas a ON d.area_id = a.id
      JOIN temas t ON d.tema_principal_id = t.id
      WHERE d.activo = TRUE
      ORDER BY d.proxima_actualizacion ASC
    `);
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const [[usuario]] = await pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]);

    const pdf = await renderEstadoGeneral(datasets.map(d => ({
      titulo: d.titulo,
      area: d.area_nombre,
      frecuencia: d.frecuencia_nombre,
      datos_al: d.datos_al_iso,
      proxima: d.proxima_iso,
      estado: estadoDeLaFila(d, hoy)
    })), { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });

    res.setHeader('Content-Type', 'application/pdf');
    // La fecha de hoy en Argentina, la del PDF (con new Date(), en un servidor en UTC, después de las 21 decía mañana)
    res.setHeader('Content-Disposition', `attachment; filename=estado-general-${formatoCorto(hoy).replace(/\//g, '-')}.pdf`);
    res.send(pdf);
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =====================================================
// REPORTE: Historial de Notificaciones
// =====================================================

/**
 * Obtiene texto descriptivo del tipo de notificación
 */
const getTipoNotificacionTexto = (tipo) => {
  const textos = {
    'interno-60': 'Aviso interno - 60 días',
    'interno-30': 'Aviso interno - 30 días',
    'interno-vencido': 'Aviso interno - Vencido',
    'externo-60': 'Aviso externo - 60 días',
    'externo-40': 'Aviso externo - 40 días',
    'externo-5': 'Aviso externo - 5 días',
    'externo-vencido': 'Aviso externo - Vencido',
    'area-aviso-40': 'Aviso a área - 40 días'
  };
  return textos[tipo] || tipo;
};

/**
 * Dibuja una tarjeta de notificación
 */
const drawNotificacionCard = (doc, notificacion, datasetsTitulos, startY) => {
  const cardX = 40;
  const cardWidth = doc.page.width - 80;
  const padding = 12;
  const lineHeight = 14;
  
  // Preparar textos
  const fechaTipo = `${formatDateTime(notificacion.enviado_at)} - ${getTipoNotificacionTexto(notificacion.tipo)}`;
  const area = notificacion.area_nombre || 'DGMIT (Gestión interna)';
  const datasetsTexto = datasetsTitulos.length > 0 
    ? `${notificacion.cantidad_datasets} dataset(s): ${datasetsTitulos.join(', ')}`
    : `${notificacion.cantidad_datasets} dataset(s)`;
  const destinatarios = notificacion.destinatarios || 'Sin destinatarios';
  const estado = notificacion.success ? 'Enviado correctamente' : `Error: ${notificacion.error_message || 'Desconocido'}`;
  
  // Calcular alturas
  doc.fontSize(9);
  const datasetsHeight = Math.min(doc.heightOfString(datasetsTexto, { width: cardWidth - (padding * 2) }), lineHeight * 2);
  const destinatariosHeight = Math.min(doc.heightOfString(destinatarios, { width: cardWidth - (padding * 2) }), lineHeight * 2);
  
  // Altura total de la tarjeta
  const cardHeight = padding + 16 + 14 + datasetsHeight + destinatariosHeight + 14 + padding;
  
  // Verificar salto de página
  if (startY + cardHeight > doc.page.height - 60) {
    doc.addPage();
    startY = 40;
  }
  
  // Fondo de la tarjeta
  doc.rect(cardX, startY, cardWidth, cardHeight)
     .fill(COLORS.grayLight);
  
  // Barra lateral de color según éxito/error
  const statusColor = notificacion.success ? COLORS.success : COLORS.danger;
  doc.rect(cardX, startY, 4, cardHeight).fill(statusColor);
  
  let currentY = startY + padding;
  
  // Línea 1: Fecha y hora + Tipo (bold)
  doc.fillColor(COLORS.grayDark)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text(fechaTipo, cardX + padding, currentY, { 
       width: cardWidth - (padding * 2), 
       lineBreak: false,
       ellipsis: true 
     });
  currentY += 16;
  
  // Línea 2: Área destinataria
  doc.fillColor(COLORS.primary)
     .fontSize(9)
     .font('Helvetica')
     .text(`Area: ${area}`, cardX + padding, currentY, { 
       width: cardWidth - (padding * 2), 
       lineBreak: false,
       ellipsis: true 
     });
  currentY += 14;
  
  // Línea 3: Datasets
  doc.fillColor(COLORS.grayDark)
     .fontSize(8)
     .font('Helvetica')
     .text(datasetsTexto, cardX + padding, currentY, { 
       width: cardWidth - (padding * 2),
       height: datasetsHeight,
       ellipsis: true
     });
  currentY += datasetsHeight + 2;
  
  // Línea 4: Destinatarios
  doc.fillColor(COLORS.gray)
     .fontSize(8)
     .font('Helvetica')
     .text(`Enviado a: ${destinatarios}`, cardX + padding, currentY, { 
       width: cardWidth - (padding * 2),
       height: destinatariosHeight,
       ellipsis: true
     });
  currentY += destinatariosHeight + 2;
  
  // Línea 5: Estado
  const estadoColor = notificacion.success ? COLORS.success : COLORS.danger;
  doc.fillColor(estadoColor)
     .fontSize(8)
     .font('Helvetica-Bold')
     .text(estado, cardX + padding, currentY, { 
       width: cardWidth - (padding * 2),
       lineBreak: false
     });
  
  return startY + cardHeight + 8;
};

export const reporteHistorialNotificaciones = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (desde) {
      whereClause += ' AND n.enviado_at >= ?';
      params.push(desde);
    }
    if (hasta) {
      whereClause += ' AND n.enviado_at <= ?';
      params.push(hasta + ' 23:59:59');
    }
    
    const [notificaciones] = await pool.execute(`
      SELECT n.*, a.nombre AS area_nombre
      FROM notificaciones_log n
      LEFT JOIN areas a ON n.area_id = a.id
      WHERE 1=1 ${whereClause}
      ORDER BY n.enviado_at DESC
    `, params);
    
    // Obtener todos los IDs de datasets únicos
    const allDatasetIds = new Set();
    notificaciones.forEach(n => {
      if (n.datasets_ids) {
        n.datasets_ids.split(',').forEach(id => allDatasetIds.add(id.trim()));
      }
    });
    
    // Obtener títulos de datasets
    let datasetsTitulosMap = {};
    if (allDatasetIds.size > 0) {
      const idsArray = Array.from(allDatasetIds);
      const placeholders = idsArray.map(() => '?').join(',');
      const [datasets] = await pool.execute(
        `SELECT id, titulo FROM datasets WHERE id IN (${placeholders})`,
        idsArray
      );
      datasets.forEach(d => {
        datasetsTitulosMap[d.id] = d.titulo;
      });
    }
    
    // Estadísticas por tipo
    const porTipo = {};
    let exitosas = 0, fallidas = 0;
    notificaciones.forEach(n => {
      porTipo[n.tipo] = (porTipo[n.tipo] || 0) + 1;
      if (n.success) exitosas++;
      else fallidas++;
    });
    
    const fechaDesde = desde ? formatDate(desde) : 'Inicio';
    const fechaHasta = hasta ? formatDate(hasta) : 'Hoy';
    
    // Crear PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=historial-notificaciones-${formatDate(new Date()).replace(/\//g, '-')}.pdf`);
    
    doc.pipe(res);
    
    // Header
    drawHeader(doc, 'Historial de Notificaciones', `Período: ${fechaDesde} - ${fechaHasta}`);
    
    // Resumen
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.grayDark).text('Resumen', 40, doc.y + 10);
    doc.y += 25;
    
    const statsY = doc.y;
    drawStatCard(doc, 40, statsY, 'Total Enviadas', notificaciones.length, COLORS.primary);
    drawStatCard(doc, 170, statsY, 'Exitosas', exitosas, COLORS.success);
    drawStatCard(doc, 300, statsY, 'Fallidas', fallidas, COLORS.danger);
    
    doc.y = statsY + 80;
    
    // Desglose por tipo
    doc.fontSize(11).font('Helvetica-Bold').text('Desglose por tipo:', 40, doc.y);
    doc.y += 15;
    doc.font('Helvetica').fontSize(10);
    Object.entries(porTipo).forEach(([tipo, cantidad]) => {
      doc.text(`${getTipoNotificacionTexto(tipo)}: ${cantidad}`, 50, doc.y);
      doc.y += 15;
    });
    
    doc.y += 20;
    
    // Detalle de Notificaciones con tarjetas
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.grayDark).text('Detalle de Notificaciones', 40, doc.y);
    doc.y += 20;
    
    let currentY = doc.y;
    
    notificaciones.forEach(n => {
      // Obtener títulos de datasets para esta notificación
      const datasetsTitulos = [];
      if (n.datasets_ids) {
        n.datasets_ids.split(',').forEach(id => {
          const titulo = datasetsTitulosMap[id.trim()];
          if (titulo) datasetsTitulos.push(titulo);
        });
      }
      
      currentY = drawNotificacionCard(doc, n, datasetsTitulos, currentY);
    });
    
    // Footer
    drawAllFooters(doc);
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =====================================================
// REPORTE: Por Área Específica
// =====================================================
// El PDF lo dibuja services/reportesPorAreaPdf.js con la base de los reportes (spec 2026-10-24-metricas-y-reportes, 5): la portada,
// con el área, sus contactos, las tarjetas y la lista de sus datasets activos por grupo, y detrás la hoja del Seguimiento de cada uno
// (la de la descarga: seguimientoDe con la cinta del PDF). Acá van las consultas (las fuentes del Seguimiento, en una sola llamada con
// todos los ids), el estado de cada dataset y el pie, con el nombre corto de quien lo pide y la hora argentina (un solo instante para
// el pie y para "hoy"). Los dados de baja no van: ni en la lista ni con una hoja.
export const reportePorArea = async (req, res) => {
  try {
    const { areaId } = req.params;

    // Obtener área
    const [areas] = await pool.execute('SELECT * FROM areas WHERE id = ?', [areaId]);
    if (areas.length === 0) {
      return res.status(404).json({ success: false, error: 'Área no encontrada' });
    }
    const area = areas[0];

    // Los datasets activos del área, por próxima (y por título, los que no tienen): el orden dentro de cada grupo de la portada y
    // de las hojas
    const [datasets] = await pool.execute(`
      SELECT d.id, d.titulo, d.tipo_gestion, ${COLUMNAS_FECHAS}
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      WHERE d.area_id = ? AND d.activo = TRUE
      ORDER BY d.proxima_actualizacion ASC, d.titulo ASC
    `, [area.id]);
    const momento = ahoraArgentina();
    const hoy = momento.slice(0, 10);
    const [[[usuario]], fuentes] = await Promise.all([
      pool.execute('SELECT nombre_completo FROM usuarios WHERE id = ?', [req.user.userId]),
      fuentesDe(datasets.map(d => d.id))
    ]);

    // Un dataset sin sus fuentes queda sin Seguimiento: el dibujante no saca un reporte con hojas de menos (tira error: 500)
    const pdf = await renderPorArea({
      area,
      datasets: datasets.map(d => ({
        titulo: d.titulo,
        datos_al: d.datos_al_iso,
        proxima: d.proxima_iso,
        estado: estadoDeLaFila(d, hoy),
        activo: true,
        seguimiento: fuentes.has(d.id) ? seguimientoDe(fuentes.get(d.id), hoy, OPCIONES_CINTA_PDF) : null
      }))
    }, { hoy, generado: { momento, por: nombreCorto(usuario?.nombre_completo) } });

    res.setHeader('Content-Type', 'application/pdf');
    // La fecha de hoy en Argentina, la del PDF (no la del reloj del servidor)
    res.setHeader('Content-Disposition', disposicionDeAdjunto(`Reporte-area-${area.id}-${hoy}.pdf`));
    res.send(pdf);
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =====================================================
// REPORTE: Cumplimiento por Período
// =====================================================
export const reporteCumplimiento = async (req, res) => {
  try {
    const { periodo } = req.query; // 'mensual' o 'trimestral'
    
    // Determinar fechas según período
    const hoy = new Date();
    let fechaInicio;
    let tituloPerido;
    
    if (periodo === 'trimestral') {
      const trimestre = Math.floor(hoy.getMonth() / 3);
      fechaInicio = new Date(hoy.getFullYear(), trimestre * 3, 1);
      tituloPerido = `Trimestre ${trimestre + 1} - ${hoy.getFullYear()}`;
    } else {
      fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      tituloPerido = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    }
    
    // Obtener datasets y calcular cumplimiento
    const [datasets] = await pool.execute(`
      SELECT d.*, f.nombre AS frecuencia_nombre, f.dias AS frecuencia_dias,
             ${COLUMNAS_FECHAS},
             a.nombre AS area_nombre
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      JOIN areas a ON d.area_id = a.id
      WHERE d.activo = TRUE
    `);
    
    // Al día: actualizado o próximo. Los eventuales no tienen vencimiento: van aparte y no entran en el porcentaje (Ruling 22),
    // igual que en la tasa del tablero y del Estado General (tasaDeActualizacion)
    const hoyArg = hoyArgentina();
    const estados = datasets.map(d => ({ d, estado: estadoDeLaFila(d, hoyArg) }));
    const estaAlDia = ({ estado }) => estado === 'actualizado' || estado === 'proximo';
    const esEventual = ({ estado }) => estado === 'eventual';
    
    // Agrupar por área
    const porArea = {};
    estados.forEach(e => {
      const nombre = e.d.area_nombre;
      if (!porArea[nombre]) {
        porArea[nombre] = { total: 0, alDia: 0, eventuales: 0 };
      }
      porArea[nombre].total++;
      if (estaAlDia(e)) porArea[nombre].alDia++;
      if (esEventual(e)) porArea[nombre].eventuales++;
    });
    
    // Calcular porcentaje por área. Un área con solo eventuales no tiene nada que medir: porcentaje null
    const areasConPorcentaje = Object.entries(porArea).map(([nombre, stats]) => ({
      nombre,
      total: stats.total,
      alDia: stats.alDia,
      eventuales: stats.eventuales,
      porcentaje: tasaDeActualizacion(stats)
    })).sort((a, b) => (b.porcentaje ?? -1) - (a.porcentaje ?? -1));
    
    // Crear PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=cumplimiento-${formatDate(new Date()).replace(/\//g, '-')}.pdf`);
    
    doc.pipe(res);
    
    // Header
    drawHeader(doc, 'Reporte de Cumplimiento', tituloPerido);
    
    // Resumen general
    const totalDatasets = datasets.length;
    const totalAlDia = estados.filter(estaAlDia).length;
    const totalEventuales = estados.filter(esEventual).length;
    const porcentajeGeneral = tasaDeActualizacion({ alDia: totalAlDia, total: totalDatasets, eventuales: totalEventuales }) ?? 0;
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.grayDark).text('Cumplimiento General', 40, doc.y + 10);
    doc.y += 25;
    
    drawStatCard(doc, 40, doc.y, 'Total Datasets', totalDatasets, COLORS.primary);
    drawStatCard(doc, 170, doc.y, 'Al día', totalAlDia, COLORS.success);
    drawStatCard(doc, 300, doc.y, '% Cumplimiento', porcentajeGeneral + '%', porcentajeGeneral >= 70 ? COLORS.success : (porcentajeGeneral >= 40 ? COLORS.warning : COLORS.danger));
    
    doc.y += 12;
    
    // Los eventuales van aparte: no tienen vencimiento y no entran en el porcentaje
    if (totalEventuales > 0) {
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray)
         .text(`Eventuales (${totalEventuales}): no entran en el porcentaje porque no tienen fecha de vencimiento.`, 40, doc.y);
    }
    
    doc.y += 30;
    
    // Tabla por área
    doc.fontSize(12).font('Helvetica-Bold').text('Cumplimiento por Área', 40, doc.y);
    doc.y += 15;
    
    const headers = ['Área', 'Total', 'Al día', 'Eventuales', 'Cumplimiento'];
    const colWidths = [255, 45, 50, 75, 90];
    
    const rows = areasConPorcentaje.map(a => [
      a.nombre,
      a.total.toString(),
      a.alDia.toString(),
      a.eventuales.toString(),
      a.porcentaje === null ? 'Sin vencimientos' : a.porcentaje + '%'
    ]);
    
    drawTable(doc, headers, rows, doc.y, colWidths);
    
    // Footer
    drawAllFooters(doc);
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
