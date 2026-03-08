import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

// Controladores
import { login, verifySession, changePassword, updateProfile, getProfile } from '../controllers/authController.js';
import { 
  getDatasets, 
  getDatasetById, 
  createDataset, 
  updateDataset, 
  deleteDataset,
  getEstadisticas,
  registrarActualizacion
} from '../controllers/datasetController.js';
import { getTemas, getFrecuencias, getFormatos } from '../controllers/catalogController.js';
import { fetchFromAndino } from '../controllers/andinoController.js';
import { 
  getAreas, 
  getAreaById, 
  createArea, 
  updateArea, 
  deleteArea 
} from '../controllers/areasController.js';
import { 
  ejecutarNotificacionesDiarias,
  pruebaNotificacion,
  verificarSMTP,
  previewEmail,
  ejecutarNotificacionCambiosPendientes,
  previewCambiosPendientes
} from '../controllers/notificacionesController.js';
import {
  reporteEstadoGeneral,
  reporteHistorialNotificaciones,
  reportePorArea,
  reporteCumplimiento
} from '../controllers/reportesController.js';
import { generarNota } from '../controllers/notasController.js';
import {
  getContadorPendientes,
  getCambiosPendientesParaRevisar,
  getMisCambios,
  getCambioPendienteById,
  verificarDatasetBloqueado,
  aprobarCambio,
  rechazarCambio,
  getDatasetsConPendientes
} from '../controllers/cambiosPendientesController.js';
import { enviarContacto } from '../controllers/contactoController.js';
import {
  verificar,
  estado as estadoBlockchain,
  registro,
  registrosPorDataset,
  certificar as certificarArchivo
} from '../controllers/blockchainController.js';
import {
  getMetricasAutomaticas,
  getMetricasManuales,
  createMetricaManual,
  deleteMetricaManual,
  getProyectos,
  getProyectoById,
  createProyecto,
  updateProyecto,
  deleteProyecto,
  createHito,
  updateHito,
  deleteHito,
  getTimeline,
  exportarMetricasCSV,
  uploadProyectoDocumentos,
  descargarProyectoDocumento,
  deleteProyectoDocumento,
  uploadHitoArchivos,
  descargarHitoArchivo,
  deleteHitoArchivo
} from '../controllers/gestionController.js';
import { uploadProyectoMiddleware, uploadHitoMiddleware } from '../config/upload.js';

const router = Router();

// Rate limiter para endpoint de certificación blockchain
const blockchainLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Demasiadas solicitudes de certificación. Intentá de nuevo en 1 minuto.' }
});

// Rate limiter para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// =====================================================
// Rutas públicas (sin autenticación)
// =====================================================

// Auth
router.post('/auth/login', loginLimiter, login);

// Datasets (lectura)
router.get('/datasets', getDatasets);
router.get('/datasets/estadisticas', getEstadisticas);
router.get('/datasets/:id', getDatasetById);

// Catálogos
router.get('/catalogos/temas', getTemas);
router.get('/catalogos/frecuencias', getFrecuencias);
router.get('/catalogos/formatos', getFormatos);

// Áreas (lectura pública para selects)
router.get('/areas', getAreas);
router.get('/areas/:id', getAreaById);

// Andino (Portal de Datos Abiertos)
router.get('/andino/fetch', fetchFromAndino);

// Contacto (público con rate limiting)
router.post('/contacto', enviarContacto);

// Blockchain (públicas)
router.get('/blockchain/verificar/:hash', verificar);
router.get('/blockchain/registro', registro);
router.get('/blockchain/dataset/:id', registrosPorDataset);

// =====================================================
// Rutas protegidas (requieren autenticación)
// =====================================================

// Auth
router.get('/auth/verify', authMiddleware, verifySession);
router.post('/auth/change-password', authMiddleware, changePassword);

// Perfil
router.get('/auth/profile', authMiddleware, getProfile);
router.put('/auth/profile', authMiddleware, updateProfile);

// Datasets (escritura — solo admin)
router.post('/datasets', authMiddleware, adminOnly, createDataset);
router.put('/datasets/:id', authMiddleware, adminOnly, updateDataset);
router.delete('/datasets/:id', authMiddleware, adminOnly, deleteDataset);
router.post('/datasets/:id/actualizar', authMiddleware, adminOnly, registrarActualizacion);

// Áreas (escritura — solo admin)
router.post('/areas', authMiddleware, adminOnly, createArea);
router.put('/areas/:id', authMiddleware, adminOnly, updateArea);
router.delete('/areas/:id', authMiddleware, adminOnly, deleteArea);

// =====================================================
// Cambios Pendientes (protegidas - solo admin)
// =====================================================
router.get('/cambios-pendientes/contador', authMiddleware, adminOnly, getContadorPendientes);
router.get('/cambios-pendientes/para-revisar', authMiddleware, adminOnly, getCambiosPendientesParaRevisar);
router.get('/cambios-pendientes/mis-cambios', authMiddleware, adminOnly, getMisCambios);
router.get('/cambios-pendientes/datasets-bloqueados', authMiddleware, adminOnly, getDatasetsConPendientes);
router.get('/cambios-pendientes/verificar/:datasetId', authMiddleware, adminOnly, verificarDatasetBloqueado);
router.get('/cambios-pendientes/:id', authMiddleware, adminOnly, getCambioPendienteById);
router.post('/cambios-pendientes/:id/aprobar', authMiddleware, adminOnly, aprobarCambio);
router.post('/cambios-pendientes/:id/rechazar', authMiddleware, adminOnly, rechazarCambio);

// =====================================================
// Blockchain (protegidas)
// =====================================================
router.get('/blockchain/estado', authMiddleware, adminOnly, estadoBlockchain);
router.post('/blockchain/certificar', authMiddleware, adminOnly, blockchainLimiter, certificarArchivo);

// =====================================================
// Notificaciones (protegidas)
// =====================================================
router.post('/notificaciones/ejecutar', authMiddleware, adminOnly, ejecutarNotificacionesDiarias);
router.get('/notificaciones/prueba/:tipo', authMiddleware, adminOnly, pruebaNotificacion);
router.get('/notificaciones/verificar-smtp', authMiddleware, adminOnly, verificarSMTP);
router.get('/notificaciones/preview/:tipo', authMiddleware, adminOnly, previewEmail);
router.post('/notificaciones/cambios-pendientes', authMiddleware, adminOnly, ejecutarNotificacionCambiosPendientes);
router.get('/notificaciones/preview-cambios-pendientes', authMiddleware, adminOnly, previewCambiosPendientes);

// =====================================================
// Reportes PDF (protegidas)
// =====================================================
router.get('/reportes/estado-general', authMiddleware, adminOnly, reporteEstadoGeneral);
router.get('/reportes/historial-notificaciones', authMiddleware, adminOnly, reporteHistorialNotificaciones);
router.get('/reportes/por-area/:areaId', authMiddleware, adminOnly, reportePorArea);
router.get('/reportes/cumplimiento', authMiddleware, adminOnly, reporteCumplimiento);

// =====================================================
// Notas DOCX (protegidas)
// =====================================================
router.post('/notas/generar', authMiddleware, adminOnly, generarNota);

// =====================================================
// Cron (protegido por clave secreta)
// =====================================================
router.post('/cron/notificaciones', (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }
  next();
}, ejecutarNotificacionesDiarias);

router.post('/cron/cambios-pendientes', (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }
  next();
}, ejecutarNotificacionCambiosPendientes);

// =====================================================
// Gestión: Métricas y Proyectos (protegidas)
// =====================================================

// Métricas (lectura: todos los autenticados; escritura: solo admin)
router.get('/gestion/metricas', authMiddleware, getMetricasAutomaticas);
router.get('/gestion/metricas/csv', authMiddleware, exportarMetricasCSV);
router.get('/gestion/metricas-manuales', authMiddleware, getMetricasManuales);
router.post('/gestion/metricas-manuales', authMiddleware, adminOnly, createMetricaManual);
router.delete('/gestion/metricas-manuales/:id', authMiddleware, adminOnly, deleteMetricaManual);

// Proyectos (lectura: todos los autenticados; escritura: solo admin)
router.get('/gestion/proyectos', authMiddleware, getProyectos);
router.get('/gestion/proyectos/:id', authMiddleware, getProyectoById);
router.post('/gestion/proyectos', authMiddleware, adminOnly, createProyecto);
router.put('/gestion/proyectos/:id', authMiddleware, adminOnly, updateProyecto);
router.delete('/gestion/proyectos/:id', authMiddleware, adminOnly, deleteProyecto);

// Hitos (solo admin)
router.post('/gestion/proyectos/:proyecto_id/hitos', authMiddleware, adminOnly, createHito);
router.put('/gestion/hitos/:id', authMiddleware, adminOnly, updateHito);
router.delete('/gestion/hitos/:id', authMiddleware, adminOnly, deleteHito);

// Documentos de proyecto (solo admin)
router.post('/gestion/proyectos/:id/documentos', authMiddleware, adminOnly, uploadProyectoMiddleware, uploadProyectoDocumentos);
router.get('/gestion/proyectos/:id/documentos/:docId/descargar', authMiddleware, adminOnly, descargarProyectoDocumento);
router.delete('/gestion/proyectos/:id/documentos/:docId', authMiddleware, adminOnly, deleteProyectoDocumento);

// Archivos de hitos (solo admin)
router.post('/gestion/hitos/:id/archivos', authMiddleware, adminOnly, uploadHitoMiddleware, uploadHitoArchivos);
router.get('/gestion/hitos/:id/archivos/:archivoId/descargar', authMiddleware, adminOnly, descargarHitoArchivo);
router.delete('/gestion/hitos/:id/archivos/:archivoId', authMiddleware, adminOnly, deleteHitoArchivo);

// Timeline (todos los autenticados)
router.get('/gestion/timeline', authMiddleware, getTimeline);

export default router;
