// Los nombres de los archivos de los PDF de «Métricas y Reportes» (spec 2026-10-24-metricas-y-reportes, 5): los que los controladores
// ponen en el Content-Disposition (controllers/metricasController.js y reportesController.js) y los que usa la pestaña Reportes al
// guardar el Blob (public/js/reportes.js, nombreDelReporte, una copia atada por un test de paridad: API.pedirArchivo no da los
// encabezados). Puro: sin base de datos ni Date local; `hoy` es 'AAAA-MM-DD', el día de hoy en Argentina.
import { formatoCorto } from './notasDigitalesCalendario.js';

// El nombre del PDF de `tipo` (el data-reporte de cada tarjeta): 'metricas' y 'informe' con su `anio`; 'area' con el id del área
// (`area`) y `hoy`; 'estado', 'avisos', 'agenda' y 'completar' con `hoy`. El Estado general es el único con el día como dd-mm-aaaa (el
// formato de siempre). null si `tipo` no es de los siete
export const nombreDelReporte = (tipo, { anio, area, hoy } = {}) => {
  switch (tipo) {
    case 'metricas': return `Metricas-RPAD-${anio}.pdf`;
    case 'informe': return `Informe-anual-RPAD-${anio}.pdf`;
    case 'estado': return `estado-general-${formatoCorto(hoy).replace(/\//g, '-')}.pdf`;
    case 'area': return `Reporte-area-${area}-${hoy}.pdf`;
    case 'avisos': return `Avisos-RPAD-${hoy}.pdf`;
    case 'agenda': return `Agenda-de-pedidos-${hoy}.pdf`;
    case 'completar': return `Datos-para-completar-${hoy}.pdf`;
    default: return null;
  }
};
